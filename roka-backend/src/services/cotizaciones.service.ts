import pool from '../db';
import { CreateCotizacionInput } from '../types/cotizacion.types';
import {
  createCotizacion,
  createCotizacionItem,
  getCotizacionForUpdate,
  getSolicitudEstado,
  updateCotizacionEstado,
  updateSolicitudEstadoIfPendiente,
} from '../models/cotizaciones.model';
import {
  createNotifications,
  getActorDisplayName,
  resolveRecipientUserIds,
} from '../lib/notifications';

export async function crearCotizacion(input: CreateCotizacionInput, usuarioId: number | null) {
  const { solicitud_id, proveedor_id, proveedor, items } = input;

  if (!solicitud_id || (!proveedor_id && !proveedor) || !items || items.length === 0) {
    throw Object.assign(new Error('Faltan campos requeridos'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar solicitud existe
    const { rows: [solicitud] } = await client.query(
      'SELECT * FROM solicitudes_material WHERE id = $1',
      [solicitud_id]
    );
    if (!solicitud) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Solicitud no encontrada'), { statusCode: 404 });
    }

    // Obtener nombre del proveedor si se seleccionó del catálogo
    let nombreProveedor = proveedor;
    if (proveedor_id && !proveedor) {
      const { rows: [prov] } = await client.query(
        'SELECT nombre FROM proveedores WHERE id = $1',
        [proveedor_id]
      );
      if (prov) nombreProveedor = prov.nombre;
    }

    // Calcular total y validar items
    let total = 0;
    const validatedItems: { solicitud_item_id: number; precio_unitario: number; subtotal: number }[] = [];

    for (const item of items) {
      const { rows: [solItem] } = await client.query(
        'SELECT * FROM solicitud_items WHERE id = $1 AND solicitud_id = $2',
        [item.solicitud_item_id, solicitud_id]
      );
      if (!solItem) {
        await client.query('ROLLBACK');
        throw Object.assign(
          new Error(`Ítem de solicitud ${item.solicitud_item_id} no válido`),
          { statusCode: 400 }
        );
      }
      const subtotal = parseFloat(solItem.cantidad_requerida) * parseFloat(item.precio_unitario);
      total += subtotal;
      validatedItems.push({
        solicitud_item_id: item.solicitud_item_id,
        precio_unitario: item.precio_unitario,
        subtotal,
      });
    }

    const cotizacion = await createCotizacion(
      {
        solicitud_id,
        proveedor_id: proveedor_id || null,
        proveedor: nombreProveedor,
        total,
        created_by_usuario_id: usuarioId,
      },
      client
    );

    for (const vi of validatedItems) {
      await createCotizacionItem(
        {
          cotizacion_id: cotizacion.id,
          solicitud_item_id: vi.solicitud_item_id,
          precio_unitario: vi.precio_unitario,
          subtotal: vi.subtotal,
        },
        client
      );
    }

    // Cambiar estado de la solicitud a 'Cotizando' si está Pendiente
    if (solicitud.estado === 'Pendiente') {
      await updateSolicitudEstadoIfPendiente(solicitud_id, client);
    }

    await client.query('COMMIT');
    return cotizacion;
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function aprobarCotizacion(id: number, usuarioId: number | null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cotizacionActual = await getCotizacionForUpdate(id, client);

    if (!cotizacionActual || cotizacionActual.estado !== 'Pendiente') {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Cotización no encontrada o ya procesada'), { statusCode: 404 });
    }

    const cotizacion = await updateCotizacionEstado(id, 'Aprobada', client);

    const actorId = usuarioId;
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
          mensaje: `${actorName} aprobó la cotización COT-${String(cotizacion!.id).padStart(3, '0')} del proyecto ${cotizacionActual.proyecto_nombre}.`,
          entidad_tipo: 'cotizacion',
          entidad_id: cotizacion!.id,
          payload: { estado: 'Aprobada' },
          enviado_por_usuario_id: actorId,
        })),
        client
      );
    }

    await client.query('COMMIT');
    return cotizacion;
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function rechazarCotizacion(id: number, usuarioId: number | null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const cotizacionActual = await getCotizacionForUpdate(id, client);

    if (!cotizacionActual || cotizacionActual.estado !== 'Pendiente') {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Cotización no encontrada o ya procesada'), { statusCode: 404 });
    }

    const cotizacion = await updateCotizacionEstado(id, 'Rechazada', client);

    const actorId = usuarioId;
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
          mensaje: `${actorName} rechazó la cotización COT-${String(cotizacion!.id).padStart(3, '0')} del proyecto ${cotizacionActual.proyecto_nombre}.`,
          entidad_tipo: 'cotizacion',
          entidad_id: cotizacion!.id,
          payload: { estado: 'Rechazada' },
          enviado_por_usuario_id: actorId,
        })),
        client
      );
    }

    await client.query('COMMIT');
    return cotizacion;
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
