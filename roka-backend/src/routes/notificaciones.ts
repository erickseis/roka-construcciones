import { Router, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';

const router = Router();

router.use(authMiddleware, requirePermission('notificaciones.view'));

// GET /api/notificaciones
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const soloNoLeidas = req.query.solo_no_leidas === 'true';
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const params: any[] = [userId];
    let query = `
      SELECT n.*,
             CONCAT(u.nombre, ' ', u.apellido) AS enviado_por_nombre
      FROM notificaciones n
      LEFT JOIN usuarios u ON u.id = n.enviado_por_usuario_id
      WHERE n.usuario_destino_id = $1
    `;

    if (soloNoLeidas) {
      query += ' AND n.leida = FALSE';
    }

    params.push(limit);
    params.push(offset);

    query += `
      ORDER BY n.created_at DESC
      LIMIT $${params.length - 1}
      OFFSET $${params.length}
    `;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar notificaciones:', error);
    res.status(500).json({ error: 'Error al listar notificaciones' });
  }
});

// GET /api/notificaciones/unread-count
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { rows: [result] } = await pool.query(
      `SELECT COUNT(*)::int AS unread
       FROM notificaciones
       WHERE usuario_destino_id = $1 AND leida = FALSE`,
      [userId]
    );

    res.json(result || { unread: 0 });
  } catch (error) {
    console.error('Error al obtener contador de no leídas:', error);
    res.status(500).json({ error: 'Error al obtener contador de no leídas' });
  }
});

// PATCH /api/notificaciones/:id/leida
router.patch('/:id/leida', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { id } = req.params;
    const leida = typeof req.body?.leida === 'boolean' ? req.body.leida : true;

    const { rows: [updated] } = await pool.query(
      `UPDATE notificaciones
       SET leida = $1,
           leida_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END
       WHERE id = $2 AND usuario_destino_id = $3
       RETURNING *`,
      [leida, id, userId]
    );

    if (!updated) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar notificación:', error);
    res.status(500).json({ error: 'Error al actualizar notificación' });
  }
});

// PATCH /api/notificaciones/marcar-todas-leidas
router.patch('/marcar-todas-leidas', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { rowCount } = await pool.query(
      `UPDATE notificaciones
       SET leida = TRUE,
           leida_at = NOW()
       WHERE usuario_destino_id = $1 AND leida = FALSE`,
      [userId]
    );

    res.json({ updated: rowCount || 0 });
  } catch (error) {
    console.error('Error al marcar notificaciones:', error);
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
});

export default router;
