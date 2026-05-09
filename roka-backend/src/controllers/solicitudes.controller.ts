import * as fs from 'fs';
import * as path from 'path';
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
import { htmlToPdf } from '../lib/pdf-utils';
import { fmtDate, scape, ROKA_LOGO_SVG } from '../lib/html-templates';

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

export function buildSolicitudHtml(solicitud: any, items: any[]): string {
  const folio = 'SM-' + String(solicitud.id).padStart(3, '0');

  const estadoBadgeStyle =
    solicitud.estado === 'Aprobado' ? 'background:#16a34a;color:#fff' :
    solicitud.estado === 'Cotizando' ? 'background:#f59e0b;color:#0f172a' :
    solicitud.estado === 'Anulada' ? 'background:#dc2626;color:#fff' :
    'background:#64748b;color:#fff';

  const itemsRows = items.length === 0
    ? '<tr><td colspan="5" style="border:1px solid #e2e8f0;padding:10px;text-align:center;font-size:10px;color:#64748b">Esta solicitud no tiene items cargados.</td></tr>'
    : items.map((it: any, i: number) => {
      const cant = Number(it.cantidad_requerida ?? 0);
      const sku = it.material_sku || it.codigo || '—';
      const descripcion = it.material_oficial_nombre || it.nombre_material || '—';
      const unidadAbr = it.unidad_abreviatura || it.unidad || '';
      return `<tr style="page-break-inside:avoid;break-inside:avoid">
          <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px;text-align:center">${i + 1}</td>
          <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px;text-align:center">${scape(sku)}</td>
          <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px">
            <div style="font-weight:700">${scape(descripcion)}</div>
            <div style="color:#475569;font-size:9px">Unidad: ${scape(unidadAbr)}</div>
          </td>
          <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px;text-align:right">${cant.toLocaleString('es-CL')}</td>
          <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px;text-align:center">${scape(unidadAbr)}</td>
        </tr>`;
    }).join('');

  const logoTag = ROKA_LOGO_SVG;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${folio} — Solicitud de Materiales</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f1f5f9; display:flex; justify-content:center; padding:20px; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
  @media print {
    body { background:#fff; padding:0; display:block; }
    @page { margin:0; size:A4 portrait; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    thead { display: table-header-group; }
  }
</style>
</head>
<body>
<div style="width:210mm;min-height:297mm;box-sizing:border-box;padding:7mm 8mm;color:#111827;background:#fff;font-family:'Trebuchet MS','Gill Sans',sans-serif">

  <div style="border:2px solid #0f172a;border-radius:8px;overflow:hidden;margin-bottom:8px;page-break-inside:avoid;break-inside:avoid">
    <div style="background:linear-gradient(90deg,#0f172a,#1e293b);color:#f8fafc;padding:7px 10px;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        ${logoTag}
        <div style="line-height:1.25">
          <div style="font-size:11px;opacity:0.9">Sistema de Compras y Abastecimiento</div>
          <div style="font-size:17px;font-weight:800;letter-spacing:0.03em;margin-bottom:2px">SOLICITUD DE MATERIALES</div>
          <div style="font-size:11px;font-weight:700">Constructora Roka SpA</div>
          <div style="font-size:9px;opacity:0.95">General Arteaga N°30</div>
          <div style="font-size:9px;opacity:0.95">Rut 77.122.411-3</div>
          <div style="font-size:9px;opacity:0.95">Tel. +56 582 295842</div>
          <div style="font-size:9px;opacity:0.95">Cel. +56 9 31234288</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;opacity:0.85">Folio</div>
        <div style="font-size:19px;font-weight:800">${folio}</div>
        <div style="font-size:10px">Fecha: ${fmtDate(solicitud.fecha)}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="width:50%;padding:8px 5px 10px 10px;vertical-align:top">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;height:100%">
            <div style="font-size:10px;font-weight:800;margin-bottom:5px;color:#0f172a">DATOS DE LA SOLICITUD</div>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Solicitante</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(solicitud.solicitante)}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Fecha de Solicitud</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${fmtDate(solicitud.fecha)}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Fecha Requerida</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${solicitud.fecha_requerida ? fmtDate(solicitud.fecha_requerida) : '-'}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Estado</td><td style="padding:2px 4px"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;${estadoBadgeStyle}">${scape(solicitud.estado)}</span></td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Proyecto</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(solicitud.proyecto_nombre) || '-'}</td></tr>
            </table>
          </div>
        </td>
        <td style="width:50%;padding:8px 10px 10px 5px;vertical-align:top">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;height:100%">
            <div style="font-size:10px;font-weight:800;margin-bottom:5px;color:#0f172a">DATOS DE OBRA</div>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Obra</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(solicitud.proyecto_nombre) || '-'}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Nro. Solicitud</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${folio}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Emitida por</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(solicitud.solicitante)}</td></tr>
            </table>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:8px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px;width:28px">#</th>
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px;width:80px">Código / SKU</th>
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px">Descripción</th>
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px;width:72px">Cantidad</th>
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px;width:68px">Unidad</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <!-- Footer -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;page-break-inside:avoid;break-inside:avoid">
    <tr>
      <td style="width:60%;padding-right:5px;vertical-align:top">
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px">
          <div style="font-size:10px;font-weight:800;color:#0f172a;margin-bottom:4px">OBSERVACIONES</div>
          <div style="font-size:10px;color:#64748b;min-height:48px">—</div>
        </div>
      </td>
      <td style="width:40%;padding-left:5px;vertical-align:top">
        <div style="border:1px solid #1e293b;border-radius:6px;overflow:hidden">
          <table style="width:100%;border-collapse:collapse">
            <tr style="background:#0f172a;color:#f8fafc">
              <td style="padding:8px;font-size:10px;font-weight:800">Total Ítems</td>
              <td style="padding:8px;font-size:11px;font-weight:800;text-align:right">${items.length}</td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- Signatures -->
  <table style="width:100%;border-collapse:collapse;margin-top:8px;page-break-inside:avoid;break-inside:avoid">
    <tr>
      <td style="width:33%;text-align:center;padding:0 5px;vertical-align:top">
        <div style="height:32px"></div>
        <div style="border-top:1px solid #94a3b8;padding-top:5px">
          <div style="font-size:11px;font-weight:700">Solicitado por</div>
          <div style="font-size:9px;color:#475569">${scape(solicitud.solicitante)}</div>
        </div>
      </td>
      <td style="width:33%;text-align:center;padding:0 5px;vertical-align:top">
        <div style="height:32px"></div>
        <div style="border-top:1px solid #94a3b8;padding-top:5px">
          <div style="font-size:11px;font-weight:700">Revisado por</div>
          <div style="font-size:9px;color:#475569">${scape(solicitud.estado_changed_by_nombre) || '-'}</div>
        </div>
      </td>
      <td style="width:34%;text-align:center;padding:0 5px;vertical-align:top">
        <div style="height:32px"></div>
        <div style="border-top:1px solid #94a3b8;padding-top:5px">
          <div style="font-size:11px;font-weight:700">Aprobado por</div>
          <div style="font-size:9px;color:#475569">${scape(solicitud.aprobado_by_nombre) || '-'}</div>
        </div>
      </td>
    </tr>
  </table>

  <div style="margin-top:6px;font-size:8px;color:#64748b;text-align:right">
    Documento generado por ROKA | ${fmtDate(new Date().toISOString())}
  </div>

</div>
</body>
</html>`;
}

// ─── Controller handlers for PDF export ───────────────────────────────

const PDF_OUTPUT_DIR = path.join(process.cwd(), 'uploads', 'solicitudes-pdf');

export async function exportarHtml(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const solicitud = await solicitudModel.getSolicitudById(id);
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const items = await solicitudModel.getSolicitudItems(id);
    const html = buildSolicitudHtml(solicitud, items);

    const folio = 'SM-' + String(id).padStart(3, '0');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${folio}.html"`);
    res.send(html);
  } catch (error) {
    console.error('Error al exportar solicitud:', error);
    res.status(500).json({ error: 'Error al exportar solicitud de materiales' });
  }
}

export async function exportarPdf(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const solicitud = await solicitudModel.getSolicitudById(id);
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const items = await solicitudModel.getSolicitudItems(id);
    const html = buildSolicitudHtml(solicitud, items);
    const pdfBuffer = await htmlToPdf(html);

    const folio = 'SM-' + String(id).padStart(3, '0');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${folio}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF de solicitud de materiales' });
  }
}

export async function generarPdfLink(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const solicitud = await solicitudModel.getSolicitudById(id);
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (!fs.existsSync(PDF_OUTPUT_DIR)) {
      fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
    }

    const items = await solicitudModel.getSolicitudItems(id);
    const html = buildSolicitudHtml(solicitud, items);
    const pdfBuffer = await htmlToPdf(html);

    const folio = 'SM-' + String(id).padStart(3, '0');
    const filename = `${folio}.pdf`;
    const filePath = path.join(PDF_OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    res.json({
      url: `/uploads/solicitudes-pdf/${filename}`,
      filename,
      size: pdfBuffer.length,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error al generar link de PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF de solicitud de materiales' });
  }
}
