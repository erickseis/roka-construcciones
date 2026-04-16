import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';

const router = Router();

// GET /api/proyectos
router.get('/', authMiddleware, requirePermission('proyectos.view'), async (req: Request, res: Response) => {
  try {
    const { estado, is_active } = req.query;
    let query = `
      SELECT p.*, CONCAT(u.nombre, ' ', u.apellido) AS responsable_nombre
      FROM proyectos p
      LEFT JOIN usuarios u ON u.id = p.responsable_usuario_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (estado) {
      params.push(estado);
      query += ` AND p.estado = $${params.length}`;
    }

    if (typeof is_active !== 'undefined') {
      params.push(is_active === 'true');
      query += ` AND p.is_active = $${params.length}`;
    }

    query += ' ORDER BY p.nombre';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar proyectos:', error);
    res.status(500).json({ error: 'Error al listar proyectos' });
  }
});

// GET /api/proyectos/:id
router.get('/:id', authMiddleware, requirePermission('proyectos.view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { rows: [proyecto] } = await pool.query(
      `SELECT p.*, CONCAT(u.nombre, ' ', u.apellido) AS responsable_nombre
       FROM proyectos p
       LEFT JOIN usuarios u ON u.id = p.responsable_usuario_id
       WHERE p.id = $1`,
      [id]
    );

    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const { rows: [resumen] } = await pool.query(
      `SELECT
          COALESCE(pp.monto_total, 0)::numeric AS monto_total,
          COALESCE(pp.monto_comprometido, 0)::numeric AS monto_comprometido,
          COALESCE(pp.monto_total - pp.monto_comprometido, 0)::numeric AS monto_disponible,
          COALESCE((pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso
       FROM proyectos p
       LEFT JOIN presupuestos_proyecto pp ON pp.proyecto_id = p.id
       WHERE p.id = $1`,
      [id]
    );

    const { rows: [metricas] } = await pool.query(
      `SELECT
          COUNT(DISTINCT sm.id)::int AS total_solicitudes,
          COUNT(DISTINCT c.id)::int AS total_cotizaciones,
          COUNT(DISTINCT oc.id)::int AS total_ordenes,
          COALESCE(SUM(oc.total), 0)::numeric AS gasto_total_oc
       FROM proyectos p
       LEFT JOIN solicitudes_material sm ON sm.proyecto_id = p.id
       LEFT JOIN cotizaciones c ON c.solicitud_id = sm.id
       LEFT JOIN ordenes_compra oc ON oc.cotizacion_id = c.id
       WHERE p.id = $1`,
      [id]
    );

    res.json({ ...proyecto, resumen_presupuesto: resumen, metricas });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    res.status(500).json({ error: 'Error al obtener proyecto' });
  }
});

// POST /api/proyectos
router.post('/', authMiddleware, requirePermission('proyectos.manage'), async (req: Request, res: Response) => {
  const { nombre, ubicacion, estado, fecha_inicio, fecha_fin, responsable_usuario_id } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
  }

  try {
    const { rows: [created] } = await pool.query(
      `INSERT INTO proyectos (nombre, ubicacion, estado, fecha_inicio, fecha_fin, responsable_usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [nombre, ubicacion || null, estado || 'Planificación', fecha_inicio || null, fecha_fin || null, responsable_usuario_id || null]
    );

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear proyecto:', error);
    res.status(500).json({ error: 'Error al crear proyecto' });
  }
});

// PATCH /api/proyectos/:id
router.patch('/:id', authMiddleware, requirePermission('proyectos.manage'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, ubicacion, estado, fecha_inicio, fecha_fin, responsable_usuario_id } = req.body;

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE proyectos
       SET
         nombre = COALESCE($1, nombre),
         ubicacion = COALESCE($2, ubicacion),
         estado = COALESCE($3, estado),
         fecha_inicio = COALESCE($4, fecha_inicio),
         fecha_fin = COALESCE($5, fecha_fin),
         responsable_usuario_id = COALESCE($6, responsable_usuario_id),
         updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [nombre || null, ubicacion || null, estado || null, fecha_inicio || null, fecha_fin || null, responsable_usuario_id || null, id]
    );

    if (!updated) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar proyecto:', error);
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  }
});

// PATCH /api/proyectos/:id/active
router.patch('/:id/active', authMiddleware, requirePermission('proyectos.manage'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active debe ser booleano' });
  }

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE proyectos
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [is_active, id]
    );

    if (!updated) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al cambiar estado del proyecto:', error);
    res.status(500).json({ error: 'Error al cambiar estado del proyecto' });
  }
});

export default router;
