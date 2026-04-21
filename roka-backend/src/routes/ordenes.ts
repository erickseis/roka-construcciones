import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import {
  createNotifications,
  getActorDisplayName,
  NotificationInput,
  resolveRecipientUserIds,
} from '../lib/notifications';

const router = Router();

// GET /api/ordenes — Listar órdenes de compra
router.get('/', async (req: Request, res: Response) => {
  try {
    const { estado_entrega, proyecto_id } = req.query;
    let query = `
      SELECT oc.*, c.proveedor, c.solicitud_id,
             p.nombre AS proyecto_nombre
      FROM ordenes_compra oc
      JOIN cotizaciones c ON c.id = oc.cotizacion_id
      JOIN solicitudes_material sm ON sm.id = c.solicitud_id
      JOIN proyectos p ON p.id = sm.proyecto_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (estado_entrega) {
      params.push(estado_entrega);
      query += ` AND oc.estado_entrega = $${params.length}`;
    }
    if (proyecto_id) {
      params.push(proyecto_id);
      query += ` AND sm.proyecto_id = $${params.length}`;
    }

    query += ' ORDER BY oc.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({ error: 'Error al obtener órdenes de compra' });
  }
});

// GET /api/ordenes/:id — Detalle con cotización y solicitud
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { rows: [orden] } = await pool.query(`
      SELECT oc.*, c.proveedor, c.solicitud_id, c.total AS cotizacion_total,
             sm.solicitante, sm.fecha AS fecha_solicitud, sm.estado AS solicitud_estado,
             p.nombre AS proyecto_nombre,
             CONCAT(u.nombre, ' ', u.apellido) AS autorizado_por_nombre
      FROM ordenes_compra oc
      JOIN cotizaciones c ON c.id = oc.cotizacion_id
      JOIN solicitudes_material sm ON sm.id = c.solicitud_id
      JOIN proyectos p ON p.id = sm.proyecto_id
      LEFT JOIN usuarios u ON u.id = oc.created_by_usuario_id
      WHERE oc.id = $1
    `, [id]);

    if (!orden) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    // Obtener ítems de la cotización asociada
    const { rows: items } = await pool.query(`
      SELECT ci.*, si.nombre_material, si.cantidad_requerida, si.unidad,
             m.sku AS material_sku
      FROM cotizacion_items ci
      JOIN solicitud_items si ON si.id = ci.solicitud_item_id
      LEFT JOIN materiales m ON m.id = si.material_id
      WHERE ci.cotizacion_id = $1
      ORDER BY ci.id
    `, [orden.cotizacion_id]);

    res.json({ ...orden, items });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({ error: 'Error al obtener orden de compra' });
  }
});

// POST /api/ordenes — Generar OC desde cotización aprobada
router.post('/', authMiddleware, requirePermission('ordenes.create'), async (req: AuthRequest, res: Response) => {
  const { cotizacion_id, condiciones_pago } = req.body;

  if (!cotizacion_id) {
    return res.status(400).json({ error: 'Se requiere cotizacion_id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar que la cotización existe y está aprobada
    const { rows: [cotizacion] } = await client.query(
      `SELECT c.*, s.id AS solicitud_id_ref, s.estado AS solicitud_estado,
              s.proyecto_id, s.presupuesto_categoria_id,
              p.nombre AS proyecto_nombre
       FROM cotizaciones c
       JOIN solicitudes_material s ON s.id = c.solicitud_id
       JOIN proyectos p ON p.id = s.proyecto_id
       WHERE c.id = $1`,
      [cotizacion_id]
    );

    if (!cotizacion) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    if (cotizacion.estado !== 'Aprobada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La cotización debe estar aprobada para generar una OC' });
    }

    // 2. Verificar que no exista OC duplicada
    const { rows: existingOC } = await client.query(
      'SELECT id FROM ordenes_compra WHERE cotizacion_id = $1',
      [cotizacion_id]
    );
    if (existingOC.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Ya existe una orden de compra para esta cotización',
        orden_existente_id: existingOC[0].id
      });
    }

    // 3. Validar presupuesto disponible del proyecto/categoria antes de comprometer OC
    const { rows: [presupuesto] } = await client.query(
      `SELECT *
       FROM presupuestos_proyecto
       WHERE proyecto_id = $1 AND estado IN ('Vigente', 'Borrador')
       FOR UPDATE`,
      [cotizacion.proyecto_id]
    );

    if (!presupuesto) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'El proyecto no tiene presupuesto disponible para generar la OC'
      });
    }

    const montoCotizacion = Number(cotizacion.total);
    const disponiblePresupuesto = Number(presupuesto.monto_total) - Number(presupuesto.monto_comprometido);
    const presupuestoTotal = Number(presupuesto.monto_total);
    const previoComprometido = Number(presupuesto.monto_comprometido);
    const nuevoComprometido = previoComprometido + montoCotizacion;
    const porcentajePrevio = presupuestoTotal > 0 ? (previoComprometido / presupuestoTotal) * 100 : 0;
    const porcentajeNuevo = presupuestoTotal > 0 ? (nuevoComprometido / presupuestoTotal) * 100 : 0;
    const umbral = Number(presupuesto.umbral_alerta);

    if (montoCotizacion > disponiblePresupuesto) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'La orden supera el presupuesto disponible del proyecto',
        disponible: Number(disponiblePresupuesto.toFixed(2)),
        solicitado: montoCotizacion
      });
    }

    let categoriaComprometidaId: number | null = null;
    if (cotizacion.presupuesto_categoria_id) {
      const { rows: [categoria] } = await client.query(
        `SELECT *
         FROM presupuesto_categorias
         WHERE id = $1 AND presupuesto_id = $2
         FOR UPDATE`,
        [cotizacion.presupuesto_categoria_id, presupuesto.id]
      );

      if (!categoria) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'La categoría presupuestaria asociada a la solicitud no existe' });
      }

      const disponibleCategoria = Number(categoria.monto_asignado) - Number(categoria.monto_comprometido);
      if (montoCotizacion > disponibleCategoria) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'La orden supera el presupuesto disponible de la categoría asignada',
          disponible: Number(disponibleCategoria.toFixed(2)),
          solicitado: montoCotizacion
        });
      }

      categoriaComprometidaId = categoria.id;
    }

    // 4. Crear la Orden de Compra
    const { rows: [orden] } = await client.query(
      `INSERT INTO ordenes_compra (cotizacion_id, condiciones_pago, total, created_by_usuario_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [cotizacion_id, condiciones_pago || 'Neto 30 días', cotizacion.total, req.user?.id || null]
    );

    // 5. Comprometer monto en presupuesto del proyecto y categoria
    await client.query(
      `UPDATE presupuestos_proyecto
       SET monto_comprometido = monto_comprometido + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [montoCotizacion, presupuesto.id]
    );

    if (categoriaComprometidaId) {
      await client.query(
        `UPDATE presupuesto_categorias
         SET monto_comprometido = monto_comprometido + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [montoCotizacion, categoriaComprometidaId]
      );
    }

    await client.query(
      `INSERT INTO presupuesto_movimientos
       (presupuesto_id, categoria_id, orden_compra_id, tipo, monto, descripcion, created_by)
       VALUES ($1, $2, $3, 'Compromiso', $4, $5, $6)`,
      [
        presupuesto.id,
        categoriaComprometidaId,
        orden.id,
        montoCotizacion,
        `Compromiso por creación de OC #${orden.id}`,
        req.user?.id || null,
      ]
    );

    const actorId = req.user?.id || null;
    const actorName = actorId ? await getActorDisplayName(actorId, client) : 'Sistema';
    const recipients = await resolveRecipientUserIds(
      {
        creatorUserId: cotizacion.created_by_usuario_id,
        roleNames: ['Director de Obra', 'Adquisiciones'],
        excludeUserId: actorId,
      },
      client
    );

    const notifications: NotificationInput[] = recipients.map(uid => ({
      usuario_destino_id: uid,
      tipo: 'orden.generada',
      titulo: 'Orden de compra generada',
      mensaje: `${actorName} generó la orden OC-${String(orden.id).padStart(3, '0')} desde COT-${String(cotizacion.id).padStart(3, '0')} por $${montoCotizacion.toLocaleString('es-CL')}.`,
      entidad_tipo: 'orden',
      entidad_id: orden.id,
      payload: { cotizacion_id: cotizacion.id, total: montoCotizacion },
      enviado_por_usuario_id: actorId,
    }));

    if (porcentajePrevio < 100 && porcentajeNuevo >= 100) {
      notifications.push(
        ...recipients.map(uid => ({
          usuario_destino_id: uid,
          tipo: 'presupuesto.sobreconsumo',
          titulo: 'Presupuesto excedido',
          mensaje: `El proyecto ${cotizacion.proyecto_nombre} alcanzó ${porcentajeNuevo.toFixed(1)}% de uso del presupuesto tras la OC-${String(orden.id).padStart(3, '0')}.`,
          entidad_tipo: 'presupuesto',
          entidad_id: presupuesto.id,
          payload: {
            proyecto_id: cotizacion.proyecto_id,
            porcentaje_uso: Number(porcentajeNuevo.toFixed(2)),
            umbral_alerta: umbral,
            estado_alerta: 'Sobreconsumo',
          },
          enviado_por_usuario_id: actorId,
        }))
      );
    } else if (porcentajePrevio < umbral && porcentajeNuevo >= umbral) {
      notifications.push(
        ...recipients.map(uid => ({
          usuario_destino_id: uid,
          tipo: 'presupuesto.umbral',
          titulo: 'Umbral de presupuesto alcanzado',
          mensaje: `El proyecto ${cotizacion.proyecto_nombre} alcanzó ${porcentajeNuevo.toFixed(1)}% de uso del presupuesto (umbral ${umbral}%).`,
          entidad_tipo: 'presupuesto',
          entidad_id: presupuesto.id,
          payload: {
            proyecto_id: cotizacion.proyecto_id,
            porcentaje_uso: Number(porcentajeNuevo.toFixed(2)),
            umbral_alerta: umbral,
            estado_alerta: 'Umbral alcanzado',
          },
          enviado_por_usuario_id: actorId,
        }))
      );
    }

    await createNotifications(notifications, client);

    // 6. Actualizar estado de la solicitud original a 'Aprobado'
    await client.query(
      `UPDATE solicitudes_material SET estado = 'Aprobado', updated_at = NOW()
       WHERE id = $1`,
      [cotizacion.solicitud_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Orden de compra generada exitosamente',
      orden_compra: orden
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al generar orden de compra:', error);
    res.status(500).json({ error: 'Error al generar la orden de compra' });
  } finally {
    client.release();
  }
});

// PATCH /api/ordenes/:id/entrega — Actualizar estado de entrega
router.patch('/:id/entrega', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado_entrega } = req.body;

    if (!['Pendiente', 'Recibido parcial', 'Completado'].includes(estado_entrega)) {
      return res.status(400).json({ error: 'Estado de entrega inválido' });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE ordenes_compra SET estado_entrega = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [estado_entrega, id]
    );

    if (!updated) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar entrega:', error);
    res.status(500).json({ error: 'Error al actualizar estado de entrega' });
  }
});

export default router;
