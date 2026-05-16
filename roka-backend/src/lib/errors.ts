/**
 * Custom application error for structured error handling.
 * Usage: throw new AppError(400, 'Presupuesto no encontrado')
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Convenience factories for common HTTP errors
 */
export const BadRequest = (message: string) => new AppError(400, message);
export const Unauthorized = (message = 'No autorizado') => new AppError(401, message);
export const Forbidden = (message = 'No tienes permiso') => new AppError(403, message);
export const NotFound = (message: string) => new AppError(404, message);
export const Conflict = (message: string) => new AppError(409, message);
