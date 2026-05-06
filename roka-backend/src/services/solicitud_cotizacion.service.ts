import pool from '../db';
import { BatchCreateSolicitudCotizacionInput, CreateSolicitudCotizacionInput } from '../types/solicitudCotizacion.types';
import {
  createSolicitudCotizacion,
  createBatchSolicitudCotizacionDetalle,
  updateSolicitudCotizacionEstado,
} from '../models/solicitud_cotizacion.model';

export async function crearSolicitudCotizacion(input: CreateSolicitudCotizacionInput, usuarioId: number | null) {
  const { solicitud_id, proveedor_id, proveedor, solicitud_item_ids, observaciones } = input;

  if (!solicitud_id || (!proveedor_id && !proveedor) || !solicitud_item_ids || solicitud_item_ids.length === 0) {
    throw Object.assign(new Error('Faltan campos requeridos'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [solicitud] } = await client.query(
      'SELECT * FROM solicitudes_material WHERE id = $1',
      [solicitud_id]
    );
    if (!solicitud) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Solicitud de materiales no encontrada'), { statusCode: 404 });
    }

    let nombreProveedor = proveedor;
    if (proveedor_id && !proveedor) {
      const { rows: [prov] } = await client.query(
        'SELECT nombre FROM proveedores WHERE id = $1',
        [proveedor_id]
      );
      if (prov) nombreProveedor = prov.nombre;
    }

    const { rows: solItems } = await client.query(
      'SELECT * FROM solicitud_items WHERE id = ANY($1::int[]) AND solicitud_id = $2',
      [solicitud_item_ids, solicitud_id]
    );
    if (solItems.length !== solicitud_item_ids.length) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Algunos ítems no pertenecen a la solicitud'), { statusCode: 400 });
    }

    const sc = await createSolicitudCotizacion(
      {
        solicitud_id,
        proveedor_id: proveedor_id || null,
        proveedor: nombreProveedor,
        estado: 'Borrador',
        observaciones: observaciones || null,
        created_by_usuario_id: usuarioId,
      },
      client
    );

    await createBatchSolicitudCotizacionDetalle(sc.id, solicitud_item_ids, client);

    await client.query('COMMIT');
    return sc;
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function crearBatchSolicitudesCotizacion(input: BatchCreateSolicitudCotizacionInput, usuarioId: number | null) {
  const { solicitud_id, asignaciones, observaciones } = input;

  if (!solicitud_id || !asignaciones || asignaciones.length === 0) {
    throw Object.assign(new Error('Faltan campos requeridos'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [solicitud] } = await client.query(
      'SELECT * FROM solicitudes_material WHERE id = $1',
      [solicitud_id]
    );
    if (!solicitud) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Solicitud de materiales no encontrada'), { statusCode: 404 });
    }

    const allItemIds = asignaciones.flatMap(a => a.solicitud_item_ids);
    const uniqueIds = new Set(allItemIds);
    if (uniqueIds.size !== allItemIds.length) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Ítems duplicados entre asignaciones'), { statusCode: 400 });
    }

    const { rows: solItems } = await client.query(
      'SELECT * FROM solicitud_items WHERE id = ANY($1::int[]) AND solicitud_id = $2',
      [[...uniqueIds], solicitud_id]
    );
    if (solItems.length !== uniqueIds.size) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Algunos ítems no pertenecen a la solicitud'), { statusCode: 400 });
    }

    const results = [];
    for (const asig of asignaciones) {
      if (!asig.proveedor || asig.solicitud_item_ids.length === 0) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('Cada asignación debe tener proveedor y al menos un ítem'), { statusCode: 400 });
      }

      let nombreProveedor = asig.proveedor;
      if (asig.proveedor_id && !asig.proveedor) {
        const { rows: [prov] } = await client.query(
          'SELECT nombre FROM proveedores WHERE id = $1',
          [asig.proveedor_id]
        );
        if (prov) nombreProveedor = prov.nombre;
      }

      const sc = await createSolicitudCotizacion(
        {
          solicitud_id,
          proveedor_id: asig.proveedor_id || null,
          proveedor: nombreProveedor,
          estado: 'Borrador',
          observaciones: observaciones || null,
          created_by_usuario_id: usuarioId,
        },
        client
      );

      await createBatchSolicitudCotizacionDetalle(sc.id, asig.solicitud_item_ids, client);
      results.push(sc);
    }

    await client.query('COMMIT');
    return results;
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function cambiarEstadoSolicitudCotizacion(id: number, estado: string, usuarioId: number | null) {
  const validStates = ['Borrador', 'Enviada', 'Respondida', 'Anulada'];
  if (!validStates.includes(estado)) {
    throw Object.assign(new Error('Estado no válido'), { statusCode: 400 });
  }

  const sc = await updateSolicitudCotizacionEstado(id, estado);
  if (!sc) {
    throw Object.assign(new Error('Solicitud de cotización no encontrada'), { statusCode: 404 });
  }
  return sc;
}
