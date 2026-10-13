import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger, getLogger, requestLogging } from '../src/logging.js';
import { errorHandler } from '../src/errors.js';

function harness() {
  const records: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      records.push(JSON.parse(chunk.toString()));
      callback();
    },
  });
  const log = createLogger({ level: 'info' }, stream);
  const app = express();
  app.use(requestLogging(log));
  return { app, log, records };
}

describe('structured logging and request context', () => {
  it('retains safe error codes and nested causes', async () => {
    const { app, records } = harness();
    app.get('/', () => {
      throw new Error('operation failed', {
        cause: Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' }),
      });
    });
    app.use(errorHandler);
    await request(app).get('/').expect(500);
    expect(records.find((entry) => entry.message === 'Unhandled request error')).toMatchObject({
      err: {
        message: 'operation failed',
        cause: { message: 'connection refused', code: 'ECONNREFUSED', stack: expect.any(String) },
      },
    });
  });

  it('handles cyclic error causes', async () => {
    const { app, records } = harness();
    const error = new Error('cyclic cause');
    error.cause = error;
    app.get('/', () => {
      throw error;
    });
    app.use(errorHandler);
    await request(app).get('/').expect(500);
    expect(records.find((entry) => entry.message === 'Unhandled request error')).toMatchObject({
      err: { cause: { type: 'TruncatedCause', message: 'Cause chain truncated' } },
    });
  });

  it('omits database error contents and arbitrary error properties', async () => {
    const { app, records } = harness();
    app.get('/', () => {
      throw Object.assign(new Error('sensitive database contents'), {
        name: 'PrismaClientUnknownRequestError',
        input: 'secret-value',
        code: 'P1001',
        clientVersion: '6.19.3',
      });
    });
    app.use(errorHandler);
    await request(app).get('/').expect(500);
    const serialized = JSON.stringify(records);
    expect(serialized).not.toContain('sensitive database contents');
    expect(serialized).not.toContain('secret-value');
    expect(records.find((entry) => entry.message === 'Unhandled request error')).toMatchObject({
      err: {
        type: 'PrismaClientUnknownRequestError',
        message: 'Database operation failed',
        code: 'P1001',
        clientVersion: '6.19.3',
      },
    });
  });

  it('generates a request ID and logs request completion', async () => {
    const { app, records } = harness();
    app.get('/health', (_req, res) => res.json({ ok: true }));
    const response = await request(app).get('/health').expect(200);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const record = records.find((entry) => entry.message === 'request completed');
    expect(record).toMatchObject({
      requestId: response.headers['x-request-id'],
      status: 'info',
      service: 'tsoadmin',
    });
    expect(record?.responseTime).toEqual(expect.any(Number));
    expect(record?.timestamp).toEqual(expect.any(String));
  });

  it('preserves a valid incoming ID and isolates concurrent async contexts', async () => {
    const { app, records } = harness();
    app.get('/work', async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      getLogger().info('business event');
      res.end();
    });
    await Promise.all(
      ['request-a', 'request-b'].map(async (id) => {
        const response = await request(app).get('/work').set('X-Request-ID', id).expect(200);
        expect(response.headers['x-request-id']).toBe(id);
      }),
    );
    expect(
      records
        .filter((entry) => entry.message === 'business event')
        .map((entry) => entry.requestId)
        .sort(),
    ).toEqual(['request-a', 'request-b']);
  });

  it.each(['bad id', 'x'.repeat(129)])('replaces unsafe IDs %s', async (id) => {
    const { app } = harness();
    app.get('/', (_req, res) => res.end());
    const response = await request(app).get('/').set('X-Request-ID', id);
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('omits HTTP secrets and redacts structured credentials', async () => {
    const { app, records } = harness();
    app.use(express.json());
    app.post('/admin/login', (_req, res) => {
      getLogger().info({ password: 'secret-value', token: 'secret-value' }, 'safe event');
      res.end();
    });
    await request(app)
      .post('/admin/login?token=secret-value')
      .set('Authorization', 'Bearer secret-value')
      .set('Cookie', 'session=secret-value')
      .send({ password: 'secret-value' });
    expect(JSON.stringify(records)).not.toContain('secret-value');
    expect(JSON.stringify(records)).not.toContain('?token');
  });

  it('logs unexpected errors with the request ID without exposing them in responses', async () => {
    const { app, records } = harness();
    app.get('/', () => {
      throw new Error('internal failure');
    });
    app.use(errorHandler);
    const response = await request(app).get('/').set('X-Request-ID', 'error-request').expect(500);
    expect(response.body).toEqual({ message: 'Internal server error' });
    expect(records.find((entry) => entry.message === 'Unhandled request error')).toMatchObject({
      requestId: 'error-request',
      status: 'error',
      method: 'GET',
      path: '/',
      statusCode: 500,
      err: { message: 'internal failure', stack: expect.any(String) },
    });
  });

  it('uses warning level for 4xx responses and honors the log level', async () => {
    const { app, log, records } = harness();
    log.debug('filtered debug');
    app.get('/', (_req, res) => res.status(400).end());
    await request(app).get('/');
    expect(records.find((entry) => entry.message === 'request completed')?.status).toBe('warn');
    expect(records.some((entry) => entry.message === 'filtered debug')).toBe(false);
  });
});
