import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

/**
 * Global error handler middleware. Must be registered AFTER all routes.
 * 
 * - AppError (operational): returns { error: message } with statusCode
 * - AppError (non-operational): returns 500
 * - Unknown errors: returns 500 with generic message
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.isOperational) {
      res.status(err.statusCode).json({ error: err.message });
    } else {
      console.error('[AppError] Non-operational:', err.message);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
    return;
  }

  // Unknown errors
  console.error('[Unhandled]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
