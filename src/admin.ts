import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import { Database, Resource } from '@adminjs/prisma';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import { productAdminResource } from './products/admin.js';
import { adminBranding, adminLocale } from './admin-branding.js';
import { createAdminAuthentication, type AdminCredentialVerifier } from './admin-auth.js';
import type { Config } from './config.js';
AdminJS.registerAdapter({ Database, Resource });
export async function createAdmin(config: Config, verifyCredentials?: AdminCredentialVerifier) {
  const admin = new AdminJS({
    rootPath: '/admin',
    branding: adminBranding,
    locale: adminLocale,
    resources: [productAdminResource],
  });
  await admin.initialize();
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const Store = connectPgSimple(session);
  const store = new Store({ pool, tableName: 'admin_session', createTableIfMissing: true });
  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    createAdminAuthentication(config, verifyCredentials),
    null,
    {
      store,
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: config.production,
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000,
      },
    },
    { maxFields: 20, maxFieldsSize: 100 * 1024, maxFileSize: 1, multiples: false },
  );
  return {
    router,
    close: async () => {
      store.close();
      await pool.end();
    },
  };
}
