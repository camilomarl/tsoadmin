import {
  required,
  validateLogLevel,
  parseDatabaseUrl,
  validateSessionSecret,
  parsePort,
  parseTrustProxy,
  parseOrigin,
  parseOrigins,
  parsePositiveInteger,
} from './config-utils.js';

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  validateLogLevel(env.LOG_LEVEL ?? 'info');
  const databaseUrl = parseDatabaseUrl(required(env, 'DATABASE_URL'));
  const adminEmail = required(env, 'ADMIN_EMAIL');
  const adminPassword = required(env, 'ADMIN_PASSWORD');
  const sessionSecret = validateSessionSecret(required(env, 'SESSION_SECRET'));
  const port = parsePort(env.PORT);
  const trustProxy = parseTrustProxy(env.TRUST_PROXY);
  const host = env.HOST ?? '127.0.0.1';

  return {
    publicOrigin: parseOrigin(env.PUBLIC_ORIGIN ?? `http://${host}:${port}`, 'PUBLIC_ORIGIN'),
    corsOrigins: parseOrigins(env.CORS_ORIGINS, 'CORS_ORIGINS'),
    apiRateLimit: parsePositiveInteger(env.API_RATE_LIMIT, 'API_RATE_LIMIT', 100),
    adminLoginRateLimit: parsePositiveInteger(
      env.ADMIN_LOGIN_RATE_LIMIT,
      'ADMIN_LOGIN_RATE_LIMIT',
      20,
    ),
    databaseUrl,
    adminEmail,
    adminPassword,
    sessionSecret,
    port,
    host,
    production: env.NODE_ENV === 'production',
    trustProxy,
  };
}

export type Config = ReturnType<typeof readConfig>;
