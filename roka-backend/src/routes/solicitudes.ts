import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET /api/solicitudes — Listar todas las solicitudes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { proyecto_id, estado } = req.query;
    let query = `
      SELECT sm.*, p.nombre AS proyecto_nombre,
        (SELECT COUNT(*) FROM solicitud_items si WHERE si.solicitud_id = sm.id) AS total_items
      FROM solicitudes_material sm
      JOIN proyectos p ON p.id = sm.proyecto_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (proyecto_id) {
      params.push(proyecto_id);
      query += ` AND sm.proyecto_id = $${params.length}`;
    }
    if (estado) {
      params.push(estado);
      query += ` AND sm.estado = $${params.length}`;
    }

    query += ' ORDER BY sm.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});

// GET /api/solicitudes/:id — Detalle de una solicitud con ítems
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { rows: [solicitud] } = await pool.query(`
      SELECT sm.*, p.nombre AS proyecto_nombre
      FROM solicitudes_material sm
      JOIN proyectos p ON p.id = sm.proyecto_id
      WHERE sm.id = $1
    `, [id]);

    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const { rows: items } = await pool.query(`
      SELECT si.*, m.nombre AS material_oficial_nombre, m.sku AS material_sku,
             u.abreviatura AS unidad_abreviatura
      FROM solicitud_items si
      LEFT JOIN materiales m ON m.id = si.material_id
      LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
      WHERE si.solicitud_id = $1
      ORDER BY si.id
    `, [id]);

    res.json({ ...solicitud, items });
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({ error: 'Error al obtener solicitud' });
  }
});

// POST /api/solicitudes — Crear solicitud con ítems
router.post('/', async (req: Request, res: Response) => {
  const { proyecto_id, solicitante, fecha, items } = req.body;

  if (!proyecto_id || !solicitante || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan campos requeridos (proyecto_id, solicitante, items)' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [solicitud] } = await client.query(
      `INSERT INTO solicitudes_material (proyecto_id, solicitante, fecha)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [proyecto_id, solicitante, fecha || new Date().toISOString().split('T')[0]]
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO solicitud_items (solicitud_id, material_id, nombre_material, cantidad_requerida, unidad)
         VALUES ($1, $2, $3, $4, $5)`,
        [solicitud.id, item.material_id || null, item.nombre_material, item.cantidad_requerida, item.unidad]
      );
    }

    await client.query('COMMIT');

    // Fetch the complete solicitud with items
    const { rows: insertedItems } = await pool.query(
      'SELECT * FROM solicitud_items WHERE solicitud_id = $1',
      [solicitud.id]
    );

    res.status(201).json({ ...solicitud, items: insertedItems });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ error: 'Error al crear solicitud' });
  } finally {
    client.release();
  }
});

// PATCH /api/solicitudes/:id/estado — Cambiar estado
router.patch('/:id/estado', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    if (!['Pendiente', 'Cotizando', 'Aprobado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE solicitudes_material SET estado = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [estado, id]
    );

    if (!updated) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

// DELETE /api/solicitudes/:id — Eliminar solicitud
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query('DELETE FROM solicitudes_material WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }
    res.json({ message: 'Solicitud eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({ error: 'Error al eliminar solicitud' });
  }
});

export default router;
