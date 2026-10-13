import 'dotenv/config';
import { readConfig } from './config.js';
import { prisma } from './db.js';
import { createApp } from './app.js';
import { logger } from './logging.js';

async function start() {
  const config = readConfig();
  await prisma.$connect();
  const { app, close } = await createApp(config);
  const server = app.listen(config.port, config.host, () =>
    logger.info({ host: config.host, port: config.port }, 'Server started'),
  );
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 1000;
  server.on('error', (err) => {
    logger.fatal({ err }, 'HTTP server failed');
    void Promise.all([close(), prisma.$disconnect()]).catch((err) =>
      logger.error({ err }, 'Cleanup failed'),
    );
    process.exitCode = 1;
  });
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => {
      if (stopping) return;
      stopping = true;
      logger.info({ signal }, 'Server stopping');
      server.close(() => {
        void Promise.all([close(), prisma.$disconnect()])
          .then(() => {
            logger.info('Server stopped');
            logger.flush();
          })
          .catch((err) => {
            logger.error({ err }, 'Shutdown failed');
            process.exitCode = 1;
          });
      });
      server.closeIdleConnections();
    });
}

start().catch(async (err) => {
  logger.fatal({ err }, 'Startup failed');
  await prisma.$disconnect();
  process.exitCode = 1;
});
