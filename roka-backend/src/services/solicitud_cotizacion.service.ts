import pool from '../db';
import { BatchCreateSolicitudCotizacionInput, CreateSolicitudCotizacionInput } from '../types/solicitudCotizacion.types';
import {
  createSolicitudCotizacion,
  createBatchSolicitudCotizacionDetalle,
  updateSolicitudCotizacionEstado,
  checkAllItemsCovered,
  updateSolicitudEstadoIfPendiente,
} from '../models/solicitud_cotizacion.model';
import {
  createNotifications,
  resolveRecipientUserIds,
  getActorDisplayName,
  NotificationInput,
} from '../lib/notifications';
import { isEventEnabled, sendEmail, getUserEmailById, buildSolicitudCotizandoHtml } from '../lib/email';

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

    let nombreProveedor: string = proveedor || '';
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

    // Si todos los ítems están cubiertos, avanzar solicitud a Cotizando
    if (solicitud.estado === 'Pendiente') {
      const allCovered = await checkAllItemsCovered(solicitud_id, client);
      if (allCovered) {
        await updateSolicitudEstadoIfPendiente(solicitud_id, usuarioId, client);
      }
    }

    await client.query('COMMIT');

    // Notificar si la solicitud pasó a Cotizando
    if (solicitud.estado === 'Pendiente') {
      try {
        const allCovered = await checkAllItemsCovered(solicitud_id);
        if (allCovered) {
          const actorName = usuarioId ? await getActorDisplayName(usuarioId) : 'Sistema';
          const { rows: [solicitudUpdated] } = await pool.query(
            'SELECT sm.*, p.nombre AS proyecto_nombre FROM solicitudes_material sm JOIN proyectos p ON p.id = sm.proyecto_id WHERE sm.id = $1',
            [solicitud_id]
          );
          const proyectoNombre = solicitudUpdated?.proyecto_nombre || 'Proyecto';
          const solicitudFolio = `SOL-${String(solicitud_id).padStart(3, '0')}`;

          const recipients = await resolveRecipientUserIds({
            creatorUserId: solicitud.created_by_usuario_id || null,
            permissionCodes: ['solicitudes.view', 'cotizaciones.view'],
            excludeUserId: usuarioId,
          });

          if (recipients.length > 0) {
            const notifications: NotificationInput[] = recipients.map(uid => ({
              usuario_destino_id: uid,
              tipo: 'solicitud.cotizando',
              titulo: 'Solicitud en cotización',
              mensaje: `${actorName} envió cotizaciones para todos los ítems de la solicitud ${solicitudFolio} del proyecto ${proyectoNombre}. La solicitud ahora está en cotización.`,
              entidad_tipo: 'solicitud',
              entidad_id: solicitud_id,
              payload: {
                estado: 'Cotizando',
                proyecto_nombre: proyectoNombre,
              },
              enviado_por_usuario_id: usuarioId,
            }));

            await createNotifications(notifications);
          }

          // Fire-and-forget: email al creador cuando la solicitud pasa a Cotizando
          if (solicitud.created_by_usuario_id) {
            getUserEmailById(solicitud.created_by_usuario_id).then(async (correo) => {
              if (!correo) return;
              const html = buildSolicitudCotizandoHtml({
                solicitudId: solicitud_id,
                solicitante: solicitud.solicitante,
                proyectoNombre: proyectoNombre,
              });
              const folio = `SOL-${String(solicitud_id).padStart(3, '0')}`;
              sendEmail({
                to: correo,
                subject: `Solicitud en cotización: ${folio}`,
                html,
                eventoCodigo: 'solicitud.cotizando',
                entidadTipo: 'solicitud',
                entidadId: solicitud_id,
              }).catch(console.error);
            }).catch(console.error);
          }
        }
      } catch (notifError) {
        console.error('Error al enviar notificación de solicitud en cotización:', notifError);
      }
    }

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

    // Si todos los ítems están cubiertos, avanzar solicitud a Cotizando
    if (solicitud.estado === 'Pendiente') {
      const allCovered = await checkAllItemsCovered(solicitud_id, client);
      if (allCovered) {
        await updateSolicitudEstadoIfPendiente(solicitud_id, usuarioId, client);
      }
    }

    await client.query('COMMIT');

    // Notificar si la solicitud pasó a Cotizando
    if (solicitud.estado === 'Pendiente') {
      try {
        const allCovered = await checkAllItemsCovered(solicitud_id);
        if (allCovered) {
          const actorName = usuarioId ? await getActorDisplayName(usuarioId) : 'Sistema';
          const { rows: [solicitudUpdated] } = await pool.query(
            'SELECT sm.*, p.nombre AS proyecto_nombre FROM solicitudes_material sm JOIN proyectos p ON p.id = sm.proyecto_id WHERE sm.id = $1',
            [solicitud_id]
          );
          const proyectoNombre = solicitudUpdated?.proyecto_nombre || 'Proyecto';
          const solicitudFolio = `SOL-${String(solicitud_id).padStart(3, '0')}`;

          const recipients = await resolveRecipientUserIds({
            creatorUserId: solicitud.created_by_usuario_id || null,
            permissionCodes: ['solicitudes.view', 'cotizaciones.view'],
            excludeUserId: usuarioId,
          });

          if (recipients.length > 0) {
            const notifications: NotificationInput[] = recipients.map(uid => ({
              usuario_destino_id: uid,
              tipo: 'solicitud.cotizando',
              titulo: 'Solicitud en cotización',
              mensaje: `${actorName} envió cotizaciones para todos los ítems de la solicitud ${solicitudFolio} del proyecto ${proyectoNombre}. La solicitud ahora está en cotización.`,
              entidad_tipo: 'solicitud',
              entidad_id: solicitud_id,
              payload: {
                estado: 'Cotizando',
                proyecto_nombre: proyectoNombre,
              },
              enviado_por_usuario_id: usuarioId,
            }));

            await createNotifications(notifications);
          }

          // Fire-and-forget: email al creador cuando la solicitud pasa a Cotizando
          if (solicitud.created_by_usuario_id) {
            getUserEmailById(solicitud.created_by_usuario_id).then(async (correo) => {
              if (!correo) return;
              const html = buildSolicitudCotizandoHtml({
                solicitudId: solicitud_id,
                solicitante: solicitud.solicitante,
                proyectoNombre: proyectoNombre,
              });
              const folio = `SOL-${String(solicitud_id).padStart(3, '0')}`;
              sendEmail({
                to: correo,
                subject: `Solicitud en cotización: ${folio}`,
                html,
                eventoCodigo: 'solicitud.cotizando',
                entidadTipo: 'solicitud',
                entidadId: solicitud_id,
              }).catch(console.error);
            }).catch(console.error);
          }
        }
      } catch (notifError) {
        console.error('Error al enviar notificación de solicitud en cotización:', notifError);
      }
    }

    return results;
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function cambiarEstadoSolicitudCotizacion(id: number, estado: string, usuarioId: number | null) {
  const validStates = ['Borrador', 'Enviada', 'Respondida', 'Observación', 'Anulada'];
  if (!validStates.includes(estado)) {
    throw Object.assign(new Error('Estado no válido'), { statusCode: 400 });
  }

  // Validación para estado Respondida
  if (estado === 'Respondida') {
    const { rows: [sc] } = await pool.query(
      `SELECT archivo_adjunto_path, 
              (SELECT COUNT(*) FROM solicitud_cotizacion_detalle 
               WHERE solicitud_cotizacion_id = $1 AND precio_unitario > 0) as has_prices
       FROM solicitud_cotizacion WHERE id = $1`,
      [id]
    );

    if (!sc) {
      throw Object.assign(new Error('Solicitud de cotización no encontrada'), { statusCode: 404 });
    }

    if (!sc.archivo_adjunto_path && Number(sc.has_prices) === 0) {
      throw Object.assign(new Error('No se puede marcar como Respondida sin haber cargado la respuesta del vendedor (precios o archivo)'), { statusCode: 400 });
    }
  }

  const sc = await updateSolicitudCotizacionEstado(id, estado, usuarioId);
  if (!sc) {
    throw Object.assign(new Error('Solicitud de cotización no encontrada'), { statusCode: 404 });
  }
  return sc;
}

