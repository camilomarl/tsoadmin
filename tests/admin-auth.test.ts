import { describe, expect, it, vi } from 'vitest';
import type { AuthenticationContext } from '@adminjs/express';
import { createAdminAuthentication } from '../src/admin-auth.js';
import { readConfig } from '../src/config.js';

const config = readConfig({
  DATABASE_URL: 'postgresql://localhost/tsoadmin',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD: 'test-password',
  SESSION_SECRET: 'x'.repeat(32),
});

function context(regenerate = vi.fn((callback: (error?: Error) => void) => callback())) {
  return { req: { session: { regenerate } }, res: {} } as unknown as AuthenticationContext;
}

describe('admin authentication', () => {
  it('accepts configured credentials and regenerates the session', async () => {
    const ctx = context();
    const auth = createAdminAuthentication(config);
    expect(await auth.authenticate!('admin@example.com', 'test-password', ctx)).toEqual({
      email: 'admin@example.com',
    });
    expect(ctx.req.session.regenerate).toHaveBeenCalledOnce();
  });

  it.each([
    ['wrong@example.com', 'test-password'],
    ['admin@example.com', 'wrong'],
  ])('rejects invalid credentials %s', async (email, password) => {
    const ctx = context();
    expect(await createAdminAuthentication(config).authenticate!(email, password, ctx)).toBeNull();
    expect(ctx.req.session.regenerate).not.toHaveBeenCalled();
  });

  it('allows a custom verifier without bypassing session rotation', async () => {
    const verify = vi.fn(async () => ({ email: 'custom@example.com', id: 'custom-user' }));
    const ctx = context();
    const auth = createAdminAuthentication(config, verify);
    expect(await auth.authenticate!('custom@example.com', 'custom-password', ctx)).toEqual({
      email: 'custom@example.com',
      id: 'custom-user',
    });
    expect(verify).toHaveBeenCalledWith('custom@example.com', 'custom-password');
    expect(ctx.req.session.regenerate).toHaveBeenCalledOnce();
  });

  it('fails authentication when session regeneration fails', async () => {
    const ctx = context(
      vi.fn((callback: (error?: Error) => void) => callback(new Error('session failure'))),
    );
    await expect(
      createAdminAuthentication(config).authenticate!('admin@example.com', 'test-password', ctx),
    ).rejects.toThrow('session failure');
  });
});
