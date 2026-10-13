import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RequestHandler } from 'express';
import { pino, type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { pinoHttp } from 'pino-http';

const context = new AsyncLocalStorage<Logger>();

function serializeError(error: unknown, seen = new WeakSet<Error>(), depth = 0): object {
  if (!(error instanceof Error)) return { type: 'UnknownError', message: 'Non-Error value thrown' };
  if (seen.has(error) || depth >= 3)
    return { type: 'TruncatedCause', message: 'Cause chain truncated' };
  seen.add(error);
  const databaseError = error.name.startsWith('PrismaClient');
  const message = databaseError ? 'Database operation failed' : error.message;
  const frames = error.stack?.split('\n').filter((line) => line.trimStart().startsWith('at '));
  const code =
    'code' in error && typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
      ? error.code
      : undefined;
  const clientVersion =
    'clientVersion' in error &&
    typeof error.clientVersion === 'string' &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(error.clientVersion)
      ? error.clientVersion
      : undefined;
  return {
    type: error.name,
    message,
    stack: databaseError ? `${error.name}: ${message}\n${frames?.join('\n') ?? ''}` : error.stack,
    ...(code ? { code } : {}),
    ...(clientVersion ? { clientVersion } : {}),
    ...(error.cause !== undefined ? { cause: serializeError(error.cause, seen, depth + 1) } : {}),
  };
}

export function createLogger(options: LoggerOptions = {}, destination?: DestinationStream) {
  return pino(
    {
      level: process.env.LOG_LEVEL ?? 'info',
      base: {
        service: process.env.SERVICE_NAME ?? process.env.DD_SERVICE ?? 'tsoadmin',
        env: process.env.DD_ENV ?? process.env.NODE_ENV ?? 'development',
        ...(process.env.DD_VERSION ? { version: process.env.DD_VERSION } : {}),
      },
      messageKey: 'message',
      serializers: { err: serializeError },
      timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      formatters: { level: (label, number) => ({ level: number, status: label }) },
      redact: {
        paths: [
          'password',
          'token',
          'secret',
          'authorization',
          'cookie',
          '*.password',
          '*.token',
          '*.secret',
          'req.headers',
          'req.body',
          'res.headers',
        ],
        censor: '[REDACTED]',
      },
      ...options,
    },
    destination,
  );
}

export const logger = createLogger();

export function getLogger(): Logger {
  return context.getStore() ?? logger;
}

export function requestLogging(log: Logger = logger): RequestHandler {
  const httpLogger = pinoHttp({
    logger: log,
    quietReqLogger: true,
    customAttributeKeys: { reqId: 'requestId' },
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming)
          ? incoming
          : randomUUID();
      res.setHeader('X-Request-ID', id);
      return id;
    },
    wrapSerializers: false,
    serializers: {
      err: serializeError,
      req: (req: IncomingMessage) => ({ method: req.method, path: req.url?.split('?')[0] }),
      res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, error) =>
      error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
    customSuccessMessage: () => 'request completed',
    customErrorMessage: () => 'request failed',
  });
  return (req, res, next) => {
    httpLogger(req, res, () => context.run(req.log, next));
  };
}
