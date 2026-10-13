import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { readFile } from 'node:fs/promises';
import { RegisterRoutes } from './generated/routes.js';
import { createAdmin } from './admin.js';
import type { AdminCredentialVerifier } from './admin-auth.js';
import { errorHandler } from './errors.js';
import type { Config } from './config.js';
import { requestLogging } from './logging.js';
import { createSecurity } from './security.js';
export async function createApp(config: Config, verifyCredentials?: AdminCredentialVerifier) {
  const app = express();
  app.use(requestLogging());
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy ? 1 : false);
  app.use(createSecurity(config));
  const admin = await createAdmin(config, verifyCredentials);
  app.use('/admin', admin.router);
  app.use(express.json({ limit: '100kb', inflate: false }));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  const spec = JSON.parse(
    await readFile(new URL('./generated/swagger.json', import.meta.url), 'utf8'),
  );
  app.get('/openapi.json', (_req, res) => res.json(spec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  RegisterRoutes(app);
  app.use((_req, res) => res.status(404).json({ message: 'Not found' }));
  app.use(errorHandler);
  return { app, close: admin.close };
}
