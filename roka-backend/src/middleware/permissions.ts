import { Response, NextFunction } from 'express';
import pool from '../db';
import { AuthRequest } from './authMiddleware';

export function requirePermission(permissionCode: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.rol_id) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    try {
      const { rows } = await pool.query(
        `SELECT 1
         FROM rol_permisos rp
         JOIN permisos p ON p.id = rp.permiso_id
         WHERE rp.rol_id = $1 AND p.codigo = $2
         LIMIT 1`,
        [req.user.rol_id, permissionCode]
      );

      if (rows.length === 0) {
        return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
      }

      next();
    } catch (error) {
      console.error('Error validando permisos:', error);
      return res.status(500).json({ error: 'Error al validar permisos' });
    }
  };
}
