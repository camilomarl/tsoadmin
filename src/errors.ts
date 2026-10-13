import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ValidateError } from 'tsoa';
import { ValidationError } from './validation-error.js';
import { getLogger } from './logging.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error && typeof error === 'object' && 'type' in error) {
    if (error.type === 'entity.too.large') {
      res.status(413).json({ message: 'Request body too large' });
      return;
    }
    if (error.type === 'encoding.unsupported') {
      res.status(415).json({ message: 'Compressed request bodies are not supported' });
      return;
    }
  }
  if (error instanceof ValidateError) {
    res.status(400).json({ message: 'Invalid request', fields: error.fields });
    return;
  }
  if (error instanceof ValidationError) {
    res.status(400).json({ message: error.message });
    return;
  }
  if (error instanceof SyntaxError && 'status' in error && error.status === 400) {
    res.status(400).json({ message: 'Malformed JSON' });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      res.status(404).json({ message: 'Product not found' });
      return;
    }
    if (['P2004', 'P2000', 'P2007', 'P2011', 'P2020'].includes(error.code)) {
      res.status(400).json({ message: 'Invalid product data' });
      return;
    }
  }
  const log = req.log ?? getLogger();
  log.error(
    {
      err: error,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: 500,
    },
    'Unhandled request error',
  );
  res.status(500).json({ message: 'Internal server error' });
};
