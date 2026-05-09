import { Request, Response } from 'express';
import * as solicitudModel from '../models/solicitudes.model';
import { crearSolicitudConItems } from '../services/solicitudes.service';
import { AuthRequest } from '../middleware/authMiddleware';
import {
  createNotifications,
  resolveRecipientUserIds,
  getActorDisplayName,
  NotificationInput,
} from '../lib/notifications';
import pool from '../db';
import { isEventEnabled, sendEmail, getUserEmailsByPermission, getUserEmailById, buildSolicitudCreadaHtml, buildSolicitudCotizandoHtml, buildSolicitudRechazadaHtml } from '../lib/email';

async function userHasPermission(rolId: number, permissionCode: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM rol_permisos rp JOIN permisos p ON p.id = rp.permiso_id WHERE rp.rol_id = $1 AND p.codigo = $2 LIMIT 1`,
    [rolId, permissionCode]
  );
  return rows.length > 0;
}

export async function list(req: Request, res: Response) {
  try {
    const { proyecto_id, estado } = req.query;
    const filters: { proyecto_id?: number; estado?: string; created_by_usuario_id?: number } = {};

    if (proyecto_id && typeof proyecto_id === 'string') {
      filters.proyecto_id = Number(proyecto_id);
    }

    if (estado && typeof estado === 'string') {
      filters.estado = estado;
    }

    // Verificar permiso view_all — si no lo tiene, solo ver las propias
    const user = (req as AuthRequest).user;
    if (user?.rol_id) {
      const canViewAll = await userHasPermission(user.rol_id, 'solicitudes.view_all');
      if (!canViewAll) {
        filters.created_by_usuario_id = user.id;
      }
    }

    const solicitudes = await solicitudModel.getAllSolicitudes(filters);
    res.json(solicitudes);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const solicitud = await solicitudModel.getSolicitudById(id);
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Verificar permiso view_all — si no lo tiene, solo puede ver las propias
    const user = (req as AuthRequest).user;
    if (user?.rol_id) {
      const canViewAll = await userHasPermission(user.rol_id, 'solicitudes.view_all');
      if (!canViewAll && solicitud.created_by_usuario_id && solicitud.created_by_usuario_id !== user.id) {
        return res.status(403).json({ error: 'No tienes permiso para ver esta solicitud' });
      }
    }

    const items = await solicitudModel.getSolicitudItems(id);
    res.json({ ...solicitud, items });
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({ error: 'Error al obtener solicitud' });
  }
}

export async function create(req: Request, res: Response) {
  const { proyecto_id, solicitante, fecha, fecha_requerida, items } = req.body;

  if (!proyecto_id || !solicitante || !items || items.length === 0) {
    return res
      .status(400)
      .json({ error: 'Faltan campos requeridos (proyecto_id, solicitante, items)' });
  }

  try {
    const user = (req as AuthRequest).user;
    const result = await crearSolicitudConItems({
      proyecto_id: Number(proyecto_id),
      solicitante,
      fecha: fecha || undefined,
      fecha_requerida: fecha_requerida || null,
      created_by_usuario_id: user?.id || null,
      items,
    });

    res.status(201).json(result);

    // Fire-and-forget: email notification
    isEventEnabled('solicitud.creada').then(async (enabled) => {
      if (!enabled) return;
      const creatorId = user?.id ?? null;
      const destinatarios = await getUserEmailsByPermission('cotizaciones.view', creatorId);
      if (!destinatarios.length) return;
      const html = buildSolicitudCreadaHtml({
        id: result.id,
        solicitante,
        fecha_requerida: fecha_requerida || undefined,
        itemCount: items?.length,
      });
      const folio = `SOL-${String(result.id).padStart(3, '0')}`;
      sendEmail({
        to: destinatarios,
        subject: `Nueva solicitud de material: ${folio}`,
        html,
        eventoCodigo: 'solicitud.creada',
        entidadTipo: 'solicitud',
        entidadId: result.id,
      }).catch(console.error);
    }).catch(console.error);
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ error: 'Error al crear solicitud' });
  }
}

export async function changeEstado(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const { estado } = req.body;
    if (!['Pendiente', 'Cotizando', 'Aprobado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado invalido' });
    }

    const userId = (req as AuthRequest).user?.id || null;
    const updated = await solicitudModel.updateSolicitudEstado(id, estado, userId);
    if (!updated) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Obtener datos de la solicitud (necesario para notificaciones y email)
    const solicitud = await solicitudModel.getSolicitudById(id);

    // Notificar cambio de estado a Cotizando o Aprobado
    if (estado === 'Cotizando' || estado === 'Aprobado') {
      try {
        const actorId = (req as any).user?.id || null;
        const actorName = actorId ? await getActorDisplayName(actorId) : 'Sistema';
        const proyectoNombre = solicitud?.proyecto_nombre || 'Proyecto';
        const solicitudFolio = `SOL-${String(id).padStart(3, '0')}`;

        const recipients = await resolveRecipientUserIds({
          creatorUserId: solicitud?.created_by_usuario_id || null,
          permissionCodes: estado === 'Cotizando'
            ? ['solicitudes.view', 'cotizaciones.view']
            : ['solicitudes.view'],
          excludeUserId: actorId,
        });

        if (recipients.length > 0) {
          const estadoLabel = estado === 'Cotizando' ? 'en cotización' : 'aprobada';
          const notifications: NotificationInput[] = recipients.map(uid => ({
            usuario_destino_id: uid,
            tipo: estado === 'Cotizando' ? 'solicitud.cotizando' : 'solicitud.aprobada',
            titulo: estado === 'Cotizando' ? 'Solicitud en cotización' : 'Solicitud aprobada',
            mensaje: `${actorName} cambió la solicitud ${solicitudFolio} del proyecto ${proyectoNombre} a estado ${estadoLabel}.`,
            entidad_tipo: 'solicitud',
            entidad_id: id,
            payload: {
              estado,
              proyecto_nombre: proyectoNombre,
            },
            enviado_por_usuario_id: actorId,
          }));

          await createNotifications(notifications);
        }
      } catch (notifError) {
        console.error('Error al enviar notificación de cambio de estado:', notifError);
        // No fallar el cambio de estado si la notificación falla
      }

      // Fire-and-forget: email al creador cuando cambia a Cotizando
      if (estado === 'Cotizando' && solicitud?.created_by_usuario_id) {
        getUserEmailById(solicitud.created_by_usuario_id).then(async (correo) => {
          if (!correo) return;
          const html = buildSolicitudCotizandoHtml({
            solicitudId: id,
            solicitante: solicitud.solicitante,
            proyectoNombre: solicitud.proyecto_nombre,
          });
          const folio = `SOL-${String(id).padStart(3, '0')}`;
          sendEmail({
            to: correo,
            subject: `Solicitud en cotización: ${folio}`,
            html,
            eventoCodigo: 'solicitud.cotizando',
            entidadTipo: 'solicitud',
            entidadId: id,
          }).catch(console.error);
        }).catch(console.error);
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const user = (req as AuthRequest).user;

    // Verificar permiso view_all para eliminar solicitudes ajenas
    if (user?.rol_id) {
      const canViewAll = await userHasPermission(user.rol_id, 'solicitudes.view_all');
      if (!canViewAll) {
        const solicitud = await solicitudModel.getSolicitudById(id);
        if (solicitud?.created_by_usuario_id && solicitud.created_by_usuario_id !== user.id) {
          return res.status(403).json({ error: 'No tienes permiso para eliminar esta solicitud' });
        }
      }
    }

    const solicitud = await solicitudModel.getSolicitudById(id);
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const isAnulling = solicitud.estado !== 'Anulada';
    const creatorId = solicitud.created_by_usuario_id;

    const deleted = await solicitudModel.deleteSolicitud(id, user?.id || null);
    if (!deleted) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json({ message: 'Solicitud eliminada exitosamente' });

    // Fire-and-forget: notificar al creador si la solicitud fue anulada
    if (isAnulling && creatorId) {
      const actorName = user ? await getActorDisplayName(user.id) : 'Sistema';
      const solicitudFolio = `SOL-${String(id).padStart(3, '0')}`;
      const proyectoNombre = solicitud.proyecto_nombre || 'Proyecto';

      // In-app notification
      createNotifications([{
        usuario_destino_id: creatorId,
        tipo: 'solicitud.rechazada',
        titulo: 'Solicitud rechazada',
        mensaje: `Tu solicitud ${solicitudFolio} del proyecto ${proyectoNombre} ha sido rechazada y anulada por ${actorName}.`,
        entidad_tipo: 'solicitud',
        entidad_id: id,
        payload: { estado_anterior: solicitud.estado },
        enviado_por_usuario_id: user?.id || null,
      }]).catch(console.error);

      // Email
      getUserEmailById(creatorId).then(correo => {
        if (!correo) return;
        sendEmail({
          to: correo,
          subject: `Solicitud rechazada: ${solicitudFolio}`,
          html: buildSolicitudRechazadaHtml({
            solicitudId: id, proyectoNombre, rechazadoPor: actorName,
          }),
          eventoCodigo: 'solicitud.rechazada',
          entidadTipo: 'solicitud',
          entidadId: id,
        }).catch(console.error);
      }).catch(console.error);
    }
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({ error: 'Error al eliminar solicitud' });
  }
}
