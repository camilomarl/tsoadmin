import { describe, it, expect } from 'vitest';
import { readConfig } from '../src/config.js';
import { assertTestDatabase } from '../src/config-utils.js';
const valid = {
  DATABASE_URL: 'postgresql://localhost/tsoadmin',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'a-long-password',
  SESSION_SECRET: 'x'.repeat(32),
};
describe('configuration', () => {
  it.each(['*', 'https://example.com/path', 'https://user:secret@example.com'])(
    'rejects invalid browser origin %s',
    (origin) => {
      expect(() => readConfig({ ...valid, PUBLIC_ORIGIN: origin })).toThrow('PUBLIC_ORIGIN');
      expect(() => readConfig({ ...valid, CORS_ORIGINS: origin })).toThrow('CORS_ORIGINS');
    },
  );
  it.each(['API_RATE_LIMIT', 'ADMIN_LOGIN_RATE_LIMIT'])(
    'rejects invalid request limit %s',
    (key) => {
      expect(() => readConfig({ ...valid, [key]: '0' })).toThrow(key);
    },
  );

  it('rejects invalid log levels', () =>
    expect(() => readConfig({ ...valid, LOG_LEVEL: 'invalid' })).toThrow('LOG_LEVEL'));

  it('accepts valid configuration', () => expect(readConfig(valid).port).toBe(3000));
  it.each(['DATABASE_URL', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'SESSION_SECRET'])(
    'requires %s',
    (key) => expect(() => readConfig({ ...valid, [key]: '' })).toThrow(key),
  );
  it('rejects invalid ports', () =>
    expect(() => readConfig({ ...valid, PORT: '0' })).toThrow('PORT'));
  it('requires a strong session secret', () =>
    expect(() => readConfig({ ...valid, SESSION_SECRET: 'short' })).toThrow('SESSION_SECRET'));
  it('rejects unsafe test databases', () =>
    expect(() => assertTestDatabase(valid.DATABASE_URL, valid.DATABASE_URL)).toThrow());
  it('accepts a distinct test database', () =>
    expect(
      assertTestDatabase('postgresql://localhost/tsoadmin_test', valid.DATABASE_URL),
    ).toContain('_test'));
});
