import { createHash, timingSafeEqual } from 'node:crypto';
import type { CurrentAdmin } from 'adminjs';
import type { AuthenticationOptions } from '@adminjs/express';
import type { Config } from './config.js';

export type AdminCredentialVerifier = (
  email: string,
  password: string,
) => Promise<CurrentAdmin | null>;

const digest = (value: string) => createHash('sha256').update(value).digest();

function environmentVerifier(config: Config): AdminCredentialVerifier {
  return async (email, password) => {
    const emailMatches = timingSafeEqual(digest(email), digest(config.adminEmail));
    const passwordMatches = timingSafeEqual(digest(password), digest(config.adminPassword));
    return emailMatches && passwordMatches ? { email: config.adminEmail } : null;
  };
}

export function createAdminAuthentication(
  config: Config,
  verifyCredentials: AdminCredentialVerifier = environmentVerifier(config),
): AuthenticationOptions {
  return {
    authenticate: async (email, password, context) => {
      if (typeof email !== 'string' || typeof password !== 'string') return null;
      const admin = await verifyCredentials(email, password);
      if (!admin) return null;
      if (context) {
        await new Promise<void>((resolve, reject) =>
          context.req.session.regenerate((error) => (error ? reject(error) : resolve())),
        );
      }
      return admin;
    },
    cookieName: 'tsoadmin',
    cookiePassword: config.sessionSecret,
  };
}
