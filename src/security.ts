import { Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import type { Config } from './config.js';

export function createSecurity(config: Config) {
  const router = Router();
  const directives = {
    frameAncestors: ["'none'"],
    styleSrc: ["'self'"],
    upgradeInsecureRequests: config.production ? [] : null,
  };
  router.use(
    helmet({
      contentSecurityPolicy: { directives },
      strictTransportSecurity: config.production
        ? { maxAge: 31536000, includeSubDomains: false }
        : false,
      xFrameOptions: { action: 'deny' },
      referrerPolicy: { policy: 'same-origin' },
    }),
  );
  // AdminJS templates require inline scripts and styles; keep this exception local.
  router.use(
    '/admin',
    helmet.contentSecurityPolicy({
      directives: {
        ...directives,
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://adminjs-docs.s3.amazonaws.com'],
      },
    }),
  );
  router.use(
    '/docs',
    helmet.contentSecurityPolicy({
      directives: { ...directives, styleSrc: ["'self'", "'unsafe-inline'"] },
    }),
  );

  const origins = new Set([config.publicOrigin, ...config.corsOrigins]);
  router.use(
    '/api',
    (req, res, next) => {
      const origin = req.get('origin');
      if (origin && !origins.has(origin)) {
        res.status(403).json({ message: 'Origin is not allowed' });
        return;
      }
      next();
    },
    cors({
      origin: (origin, callback) => callback(null, origin !== undefined && origins.has(origin)),
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      credentials: false,
      maxAge: 600,
    }),
    rateLimit({
      windowMs: 60000,
      limit: config.apiRateLimit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Too many requests' },
    }),
  );

  router.use('/admin', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    const changesState = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const crossSiteLogout = req.path === '/logout' && req.get('sec-fetch-site') === 'cross-site';
    if ((changesState && req.get('origin') !== config.publicOrigin) || crossSiteLogout) {
      res.status(403).json({ message: 'Admin requests require the configured same origin' });
      return;
    }
    const length = Number(req.get('content-length'));
    if (Number.isFinite(length) && length > 100 * 1024) {
      res.status(413).json({ message: 'Request body too large' });
      return;
    }
    next();
  });
  router.post(
    '/admin/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.adminLoginRateLimit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Too many login attempts' },
    }),
  );
  return router;
}
