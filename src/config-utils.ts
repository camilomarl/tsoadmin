export function required(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value;
}

export function validateLogLevel(value: string) {
  if (!['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'].includes(value))
    throw new Error('Invalid LOG_LEVEL');
}

export function parseDatabaseUrl(value: string) {
  try {
    if (!/^postgres(ql)?:$/.test(new URL(value).protocol)) throw new Error();
    return value;
  } catch {
    throw new Error('Invalid DATABASE_URL');
  }
}

export function validateSessionSecret(value: string) {
  if (value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return value;
}

export function parsePort(value: string | undefined) {
  const port = Number(value ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  return port;
}

export function parseTrustProxy(value: string | undefined) {
  const trustProxy = value ?? 'false';
  if (!['true', 'false'].includes(trustProxy)) throw new Error('Invalid TRUST_PROXY');
  return trustProxy === 'true';
}

export function parseOrigin(value: string, key: string) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== value)
      throw new Error();
    return value;
  } catch {
    throw new Error(`Invalid ${key}: use an HTTP(S) origin without a path`);
  }
}

export function parseOrigins(value: string | undefined, key: string) {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => parseOrigin(origin, key));
}

export function parsePositiveInteger(value: string | undefined, key: string, fallback: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error(`Invalid ${key}`);
  return parsed;
}

export function assertTestDatabase(url: string | undefined, developmentUrl: string | undefined) {
  if (!url) throw new Error('TEST_DATABASE_URL is required');
  const test = new URL(url);
  if (
    !test.pathname.endsWith('_test') ||
    (developmentUrl && test.pathname === new URL(developmentUrl).pathname)
  )
    throw new Error('Tests require a distinct database ending in _test');
  return url;
}
