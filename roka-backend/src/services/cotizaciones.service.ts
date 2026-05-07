import pool from '../db';
import { CreateCotizacionInput } from '../types/cotizacion.types';
import {
  createCotizacion,
  getCotizacionForUpdate,
  updateCotizacionEstado,
  updateSolicitudEstadoIfPendiente,
} from '../models/cotizaciones.model';
import {
  createNotifications,
  getActorDisplayName,
  resolveRecipientUserIds,
} from '../lib/notifications';

export async function crearCotizacion(input: CreateCotizacionInput, usuarioId: number | null) {
  const { 
    solicitud_id, 
    solicitud_cotizacion_id, 
    proveedor_id, 
    proveedor, 
    items,
    archivo_adjunto_path,
    archivo_adjunto_nombre,
    numero_cov,
    imported_from_file,
    metodo_importacion,
    datos_importados,
  } = input;

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

    // Validar duplicados en IDs de items
    const uniqueIds = new Set(items.map(i => i.solicitud_item_id));
    if (uniqueIds.size !== items.length) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('IDs duplicados en los ítems de cotización'), { statusCode: 400 });
    }

    // Batch validar todos los items (1 query en vez de N)
    const itemIds = items.map(i => i.solicitud_item_id);
    const { rows: solItems } = await client.query(
      'SELECT * FROM solicitud_items WHERE id = ANY($1::int[]) AND solicitud_id = $2',
      [itemIds, solicitud_id]
    );

    const foundIds = new Set(solItems.map(r => r.id));
    const missingIds = itemIds.filter(id => !foundIds.has(id));
    if (missingIds.length > 0) {
      await client.query('ROLLBACK');
      throw Object.assign(
        new Error(`Ítem de solicitud ${missingIds[0]} no válido`),
        { statusCode: 400 }
      );
    }

    // Calcular total y construir validatedItems en memoria
    let total = 0;
    const validatedItems: Array<{
      solicitud_item_id: number;
      precio_unitario: number;
      subtotal: number;
      descuento_porcentaje?: number;
      codigo_proveedor?: string;
    }> = [];
    const solItemMap = new Map(solItems.map(r => [r.id, r]));
    for (const item of items) {
      const solItem = solItemMap.get(item.solicitud_item_id)!;
      const descuento = item.descuento_porcentaje || 0;
      const subtotal = solItem.cantidad_requerida * item.precio_unitario * (1 - descuento / 100);
      total += subtotal;
      validatedItems.push({
        solicitud_item_id: item.solicitud_item_id,
        precio_unitario: item.precio_unitario,
        subtotal,
        descuento_porcentaje: item.descuento_porcentaje,
        codigo_proveedor: item.codigo_proveedor,
      });
    }

    const cotizacion = await createCotizacion(
      {
        solicitud_id,
        solicitud_cotizacion_id: solicitud_cotizacion_id || null,
        proveedor_id: proveedor_id || null,
        proveedor: nombreProveedor || 'Proveedor sin nombre',
        total,
        created_by_usuario_id: usuarioId,
        numero_cov: numero_cov || null,
        imported_from_file: imported_from_file || false,
        metodo_importacion: metodo_importacion || 'manual',
        datos_importados: datos_importados || null,
        archivo_adjunto_path: archivo_adjunto_path || null,
        archivo_adjunto_nombre: archivo_adjunto_nombre || null,
      },
      client
    );

    // Multi-row INSERT cotizacion_items con chunking (incluyendo nuevos campos)
    for (let i = 0; i < validatedItems.length; i += 500) {
      const chunk = validatedItems.slice(i, i + 500);
      const placeholders = chunk.map((_, j) => {
        const base = j * 6;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
      });
      const values = chunk.flatMap(vi => [
        cotizacion.id,
        vi.solicitud_item_id,
        vi.precio_unitario,
        vi.subtotal,
        vi.descuento_porcentaje || 0,
        vi.codigo_proveedor || null,
      ]);
      await client.query(
        `INSERT INTO cotizacion_items (cotizacion_id, solicitud_item_id, precio_unitario, subtotal, descuento_porcentaje, codigo_proveedor)
         VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    // Si se vincularon de una solicitud_cotizacion, marcarla como Respondida
    if (solicitud_cotizacion_id) {
      await client.query(
        `UPDATE solicitud_cotizacion SET estado = 'Respondida', updated_at = NOW() WHERE id = $1 AND estado IN ('Borrador', 'Enviada')`,
        [solicitud_cotizacion_id]
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
