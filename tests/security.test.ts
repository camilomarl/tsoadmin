import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.js';
import { createSecurity } from '../src/security.js';
import { errorHandler } from '../src/errors.js';

function harness(overrides: NodeJS.ProcessEnv = {}) {
  const config = readConfig({
    DATABASE_URL: 'postgresql://localhost/tsoadmin',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD: 'test-password',
    SESSION_SECRET: 'x'.repeat(32),
    ...overrides,
  });
  const app = express();
  app.use(createSecurity(config));
  app.use(express.json({ limit: '100kb', inflate: false }));
  app.get('/api/products', (_req, res) => res.json([]));
  app.post('/api/products', (_req, res) => res.json({ ok: true }));
  app.post('/admin/login', (_req, res) => res.status(401).json({ message: 'Invalid credentials' }));
  app.post('/admin/action', (_req, res) => res.json({ ok: true }));
  app.get('/admin/login', (_req, res) => res.send('<html>login</html>'));
  app.get('/docs', (_req, res) => res.send('<html>docs</html>'));
  app.use(errorHandler);
  return app;
}

describe('HTTP security', () => {
  it('sets security headers and removes the Express header', async () => {
    const response = await request(harness()).get('/api/products').expect(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('same-origin');
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('enables HSTS only in production', async () => {
    const response = await request(harness({ NODE_ENV: 'production' })).get('/api/products');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
  });

  it('allows configured origins and exposes request IDs without credentials', async () => {
    const response = await request(harness({ CORS_ORIGINS: 'https://frontend.example.com' }))
      .options('/api/products')
      .set('Origin', 'https://frontend.example.com')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://frontend.example.com');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    expect(response.headers['access-control-expose-headers']).toContain('X-Request-ID');
  });

  it('allows same-origin API requests', async () => {
    await request(harness())
      .post('/api/products')
      .set('Origin', 'http://127.0.0.1:3000')
      .send({})
      .expect(200);
  });

  it('rejects other origins and permits non-browser requests', async () => {
    const app = harness();
    const response = await request(app)
      .get('/api/products')
      .set('Origin', 'https://evil.example.com')
      .expect(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    await request(app).get('/api/products').expect(200);
  });

  it('rejects cross-origin admin writes even when the origin is allowed for the API', async () => {
    const app = harness({ CORS_ORIGINS: 'https://frontend.example.com' });
    await request(app)
      .post('/admin/action')
      .set('Origin', 'https://frontend.example.com')
      .expect(403);
    await request(app).post('/admin/action').expect(403);
    await request(app).post('/admin/action').set('Origin', 'http://127.0.0.1:3000').expect(200);
  });

  it('limits API traffic and failed admin login attempts', async () => {
    const app = harness({ API_RATE_LIMIT: '2', ADMIN_LOGIN_RATE_LIMIT: '2' });
    await request(app).get('/api/products').expect(200);
    await request(app).get('/api/products').expect(200);
    await request(app).get('/api/products').expect(429);
    for (let i = 0; i < 2; i++)
      await request(app).post('/admin/login').set('Origin', 'http://127.0.0.1:3000').expect(401);
    const response = await request(app)
      .post('/admin/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .expect(429);
    expect(response.headers['retry-after']).toBeDefined();
  });

  it('returns controlled responses for oversized or compressed bodies', async () => {
    const app = harness();
    await request(app)
      .post('/api/products')
      .send({ name: 'x'.repeat(110000) })
      .expect(413);
    await request(app).post('/api/products').set('Content-Encoding', 'gzip').send({}).expect(415);
  });

  it('scopes the inline-script exception to AdminJS', async () => {
    const app = harness();
    const admin = await request(app).get('/admin/login');
    expect(admin.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
    const api = await request(app).get('/api/products');
    expect(api.headers['content-security-policy']).not.toContain("'unsafe-inline'");
    const docs = await request(app).get('/docs');
    expect(docs.headers['content-security-policy']).toContain("script-src 'self'");
  });
});
