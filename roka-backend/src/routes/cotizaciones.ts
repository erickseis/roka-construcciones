import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import {
  createNotifications,
  getActorDisplayName,
  resolveRecipientUserIds,
} from '../lib/notifications';

const router = Router();

// GET /api/cotizaciones — Listar cotizaciones
router.get('/', async (req: Request, res: Response) => {
  try {
    const { solicitud_id, estado } = req.query;
    let query = `
      SELECT c.*, sm.solicitante, p.nombre AS proyecto_nombre
      FROM cotizaciones c
      JOIN solicitudes_material sm ON sm.id = c.solicitud_id
      JOIN proyectos p ON p.id = sm.proyecto_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (solicitud_id) {
      params.push(solicitud_id);
      query += ` AND c.solicitud_id = $${params.length}`;
    }
    if (estado) {
      params.push(estado);
      query += ` AND c.estado = $${params.length}`;
    }

    query += ' ORDER BY c.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error);
    res.status(500).json({ error: 'Error al obtener cotizaciones' });
  }
});

// GET /api/cotizaciones/:id — Detalle con ítems cotizados
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { rows: [cotizacion] } = await pool.query(`
      SELECT c.*, sm.solicitante, sm.fecha AS fecha_solicitud,
             p.nombre AS proyecto_nombre
      FROM cotizaciones c
      JOIN solicitudes_material sm ON sm.id = c.solicitud_id
      JOIN proyectos p ON p.id = sm.proyecto_id
      WHERE c.id = $1
    `, [id]);

    if (!cotizacion) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    const { rows: items } = await pool.query(`
      SELECT ci.*, si.nombre_material, si.cantidad_requerida, si.unidad
      FROM cotizacion_items ci
      JOIN solicitud_items si ON si.id = ci.solicitud_item_id
      WHERE ci.cotizacion_id = $1
      ORDER BY ci.id
    `, [id]);

    res.json({ ...cotizacion, items });
  } catch (error) {
    console.error('Error al obtener cotización:', error);
    res.status(500).json({ error: 'Error al obtener cotización' });
  }
});

// POST /api/cotizaciones — Crear cotización con precios por ítem
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { solicitud_id, proveedor_id, proveedor, items } = req.body;

  if (!solicitud_id || (!proveedor_id && !proveedor) || !items || items.length === 0) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar solicitud existe
    const { rows: [solicitud] } = await client.query(
      'SELECT * FROM solicitudes_material WHERE id = $1', [solicitud_id]
    );
    if (!solicitud) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Obtener nombre del proveedor si se seleccionó del catálogo
    let nombreProveedor = proveedor;
    if (proveedor_id && !proveedor) {
      const { rows: [prov] } = await client.query(
        'SELECT nombre FROM proveedores WHERE id = $1', [proveedor_id]
      );
      if (prov) nombreProveedor = prov.nombre;
    }

    // Calcular total y crear cotización
    let total = 0;
    const validatedItems: { solicitud_item_id: number; precio_unitario: number; subtotal: number }[] = [];

    for (const item of items) {
      const { rows: [solItem] } = await client.query(
        'SELECT * FROM solicitud_items WHERE id = $1 AND solicitud_id = $2',
        [item.solicitud_item_id, solicitud_id]
      );
      if (!solItem) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ítem de solicitud ${item.solicitud_item_id} no válido` });
      }
      const subtotal = parseFloat(solItem.cantidad_requerida) * parseFloat(item.precio_unitario);
      total += subtotal;
      validatedItems.push({
        solicitud_item_id: item.solicitud_item_id,
        precio_unitario: item.precio_unitario,
        subtotal,
      });
    }

    const { rows: [cotizacion] } = await client.query(
      `INSERT INTO cotizaciones (solicitud_id, proveedor_id, proveedor, total, created_by_usuario_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [solicitud_id, proveedor_id || null, nombreProveedor, total, req.user?.id || null]
    );

    for (const vi of validatedItems) {
      await client.query(
        `INSERT INTO cotizacion_items (cotizacion_id, solicitud_item_id, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4)`,
        [cotizacion.id, vi.solicitud_item_id, vi.precio_unitario, vi.subtotal]
      );
    }

    // Cambiar estado de la solicitud a 'Cotizando' si está Pendiente
    if (solicitud.estado === 'Pendiente') {
      await client.query(
        `UPDATE solicitudes_material SET estado = 'Cotizando', updated_at = NOW()
         WHERE id = $1`, [solicitud_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json(cotizacion);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear cotización:', error);
    res.status(500).json({ error: 'Error al crear cotización' });
  } finally {
    client.release();
  }
});

// PATCH /api/cotizaciones/:id/aprobar — Aprobar cotización
router.patch('/:id/aprobar', authMiddleware, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { rows: [cotizacionActual] } = await client.query(
      `SELECT c.id, c.estado, c.created_by_usuario_id, p.nombre AS proyecto_nombre
       FROM cotizaciones c
       JOIN solicitudes_material sm ON sm.id = c.solicitud_id
       JOIN proyectos p ON p.id = sm.proyecto_id
       WHERE c.id = $1
       FOR UPDATE`,
      [id]
    );

    if (!cotizacionActual || cotizacionActual.estado !== 'Pendiente') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cotización no encontrada o ya procesada' });
    }

    const { rows: [cotizacion] } = await client.query(
      `UPDATE cotizaciones
       SET estado = 'Aprobada'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const actorId = req.user?.id || null;
    if (actorId) {
      const actorName = await getActorDisplayName(actorId, client);
      const recipients = await resolveRecipientUserIds(
        {
          creatorUserId: cotizacionActual.created_by_usuario_id,
          roleNames: ['Director de Obra', 'Adquisiciones'],
          excludeUserId: actorId,
        },
        client
      );

      await createNotifications(
        recipients.map(uid => ({
          usuario_destino_id: uid,
          tipo: 'cotizacion.aprobada',
          titulo: 'Cotización aprobada',
          mensaje: `${actorName} aprobó la cotización COT-${String(cotizacion.id).padStart(3, '0')} del proyecto ${cotizacionActual.proyecto_nombre}.`,
          entidad_tipo: 'cotizacion',
          entidad_id: cotizacion.id,
          payload: { estado: 'Aprobada' },
          enviado_por_usuario_id: actorId,
        })),
        client
      );
    }

    await client.query('COMMIT');
    res.json(cotizacion);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al aprobar cotización:', error);
    res.status(500).json({ error: 'Error al aprobar cotización' });
  } finally {
    client.release();
  }
});

// PATCH /api/cotizaciones/:id/rechazar — Rechazar cotización
router.patch('/:id/rechazar', authMiddleware, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { rows: [cotizacionActual] } = await client.query(
      `SELECT c.id, c.estado, c.created_by_usuario_id, p.nombre AS proyecto_nombre
       FROM cotizaciones c
       JOIN solicitudes_material sm ON sm.id = c.solicitud_id
       JOIN proyectos p ON p.id = sm.proyecto_id
       WHERE c.id = $1
       FOR UPDATE`,
      [id]
    );

    if (!cotizacionActual || cotizacionActual.estado !== 'Pendiente') {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cotización no encontrada o ya procesada' });
    }

    const { rows: [cotizacion] } = await client.query(
      `UPDATE cotizaciones
       SET estado = 'Rechazada'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const actorId = req.user?.id || null;
    if (actorId) {
      const actorName = await getActorDisplayName(actorId, client);
      const recipients = await resolveRecipientUserIds(
        {
          creatorUserId: cotizacionActual.created_by_usuario_id,
          roleNames: ['Director de Obra', 'Adquisiciones'],
          excludeUserId: actorId,
        },
        client
      );

      await createNotifications(
        recipients.map(uid => ({
          usuario_destino_id: uid,
          tipo: 'cotizacion.rechazada',
          titulo: 'Cotización rechazada',
          mensaje: `${actorName} rechazó la cotización COT-${String(cotizacion.id).padStart(3, '0')} del proyecto ${cotizacionActual.proyecto_nombre}.`,
          entidad_tipo: 'cotizacion',
          entidad_id: cotizacion.id,
          payload: { estado: 'Rechazada' },
          enviado_por_usuario_id: actorId,
        })),
        client
      );
    }

    await client.query('COMMIT');
    res.json(cotizacion);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al rechazar cotización:', error);
    res.status(500).json({ error: 'Error al rechazar cotización' });
  } finally {
    client.release();
  }
});

export default router;
