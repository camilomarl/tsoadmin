import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../src/errors.js';
import { ValidationError } from '../src/validation-error.js';
import { logger } from '../src/logging.js';
describe('error responses', () => {
  it('maps a validation error to 400 with its message', async () => {
    const app = express();
    app.get('/', () => {
      throw new ValidationError('Invalid input');
    });
    app.use(errorHandler);
    const response = await request(app).get('/').expect(400);
    expect(response.body).toEqual({ message: 'Invalid input' });
  });

  it('recognizes validation error subclasses', async () => {
    class CustomValidationError extends ValidationError {
      constructor() {
        super('Custom validation message');
      }
    }
    const error = new CustomValidationError();
    expect(error.name).toBe('CustomValidationError');
    expect(error).toBeInstanceOf(Error);
    const app = express();
    app.get('/', () => {
      throw error;
    });
    app.use(errorHandler);
    const response = await request(app).get('/').expect(400);
    expect(response.body).toEqual({ message: 'Custom validation message' });
  });

  it('logs 500 diagnostics without request middleware', async () => {
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => {});
    try {
      const error = new Error('internal failure');
      const app = express();
      app.get('/failure', () => {
        throw error;
      });
      app.use(errorHandler);
      await request(app).get('/failure?token=secret-value').expect(500);
      expect(logged).toHaveBeenCalledWith(
        { err: error, method: 'GET', path: '/failure', statusCode: 500 },
        'Unhandled request error',
      );
    } finally {
      logged.mockRestore();
    }
  });

  it('does not leak internal errors', async () => {
    const app = express();
    app.get('/', () => {
      throw new Error('private secret');
    });
    app.use(errorHandler);
    const response = await request(app).get('/').expect(500);
    expect(response.body).toEqual({ message: 'Internal server error' });
  });
});
