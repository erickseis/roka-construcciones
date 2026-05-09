import nodemailer from 'nodemailer';
import pool from '../db';

type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

interface SendEmailOpts {
  to: string | string[];
  subject: string;
  html: string;
  eventoCodigo?: string;
  entidadTipo?: string;
  entidadId?: number;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

async function getConfigValue(clave: string, db?: Queryable): Promise<string | null> {
  const conn = db || pool;
  const { rows } = await conn.query(
    'SELECT valor FROM email_system_config WHERE clave = $1',
    [clave]
  );
  return rows[0]?.valor ?? null;
}

export async function isEventEnabled(codigo: string, db?: Queryable): Promise<boolean> {
  const conn = db || pool;
  const { rows } = await conn.query(
    'SELECT habilitado FROM email_notification_eventos WHERE codigo = $1',
    [codigo]
  );
  return rows[0]?.habilitado === true;
}

async function logEmail(
  opts: Pick<SendEmailOpts, 'to' | 'subject' | 'eventoCodigo' | 'entidadTipo' | 'entidadId'>,
  estado: 'enviado' | 'fallido',
  errorMsg?: string
): Promise<void> {
  const destinatarios = Array.isArray(opts.to) ? opts.to : [opts.to];
  for (const dest of destinatarios) {
    await pool.query(
      `INSERT INTO email_logs (evento_codigo, destinatario, asunto, estado, error_msg, entidad_tipo, entidad_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        opts.eventoCodigo || null,
        dest,
        opts.subject,
        estado,
        errorMsg || null,
        opts.entidadTipo || null,
        opts.entidadId || null,
      ]
    );
  }
}

async function createTransport(): Promise<nodemailer.Transporter> {
  const [clientId, clientSecret, refreshToken, gmailUser] = await Promise.all([
    getConfigValue('gmail_client_id'),
    getConfigValue('gmail_client_secret'),
    getConfigValue('gmail_refresh_token'),
    getConfigValue('gmail_user'),
  ]);

  if (!clientId || !clientSecret || !refreshToken || !gmailUser) {
    throw new Error('Configuración de email incompleta. Configure Gmail OAuth2 en Ajustes → Notificaciones Email.');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: gmailUser,
      clientId,
      clientSecret,
      refreshToken,
    },
  });
}

export async function sendEmail(opts: SendEmailOpts): Promise<void> {
  const [fromName, gmailUser] = await Promise.all([
    getConfigValue('from_name'),
    getConfigValue('gmail_user'),
  ]);

  const transport = await createTransport();

  const mailOpts: nodemailer.SendMailOptions = {
    from: fromName ? `"${fromName}" <${gmailUser}>` : gmailUser!,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    html: opts.html,
  };

  if (opts.attachments?.length) {
    mailOpts.attachments = opts.attachments.map(a => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    }));
  }

  try {
    await transport.sendMail(mailOpts);
    await logEmail(opts, 'enviado');
  } catch (err: any) {
    await logEmail(opts, 'fallido', err.message || 'Error desconocido');
    throw err;
  }
}

export async function testEmailConnection(): Promise<void> {
  const transport = await createTransport();
  await transport.verify();
}

export async function getEmailSystemConfig(): Promise<Record<string, string>> {
  const claves = ['gmail_client_id', 'gmail_client_secret', 'gmail_refresh_token', 'gmail_user', 'from_name'];
  const { rows } = await pool.query(
    'SELECT clave, valor FROM email_system_config WHERE clave = ANY($1)',
    [claves]
  );
  const config: Record<string, string> = {};
  for (const row of rows) {
    if (row.clave === 'gmail_client_secret' || row.clave === 'gmail_refresh_token') {
      config[row.clave] = row.valor ? '••••••••' : '';
    } else {
      config[row.clave] = row.valor || '';
    }
  }
  return config;
}

export async function updateEmailSystemConfig(updates: Record<string, string>): Promise<void> {
  const allowed = new Set(['gmail_client_id', 'gmail_client_secret', 'gmail_refresh_token', 'gmail_user', 'from_name']);
  for (const [clave, valor] of Object.entries(updates)) {
    if (!allowed.has(clave)) continue;
    if (valor === '••••••••') continue; // skip masked sentinel
    await pool.query(
      `INSERT INTO email_system_config (clave, valor, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()`,
      [clave, valor]
    );
  }
}

export async function getUserEmailsByPermission(
  permissionCode: string,
  excludeUserId?: number | null
): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.correo
     FROM usuarios u
     JOIN rol_permisos rp ON rp.rol_id = u.rol_id
     JOIN permisos p ON p.id = rp.permiso_id
     WHERE u.is_active = TRUE AND p.codigo = $1 AND u.correo IS NOT NULL
       AND ($2::int IS NULL OR u.id <> $2)`,
    [permissionCode, excludeUserId ?? null]
  );
  return rows.map((r: any) => r.correo as string);
}

export async function getUserEmailsByRoles(roleNames: string[], excludeUserId?: number | null): Promise<string[]> {
  if (!roleNames.length) return [];
  const { rows } = await pool.query(
    `SELECT DISTINCT u.correo
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE u.is_active = TRUE AND r.nombre = ANY($1::text[]) AND u.correo IS NOT NULL
       AND ($2::int IS NULL OR u.id <> $2)`,
    [roleNames, excludeUserId ?? null]
  );
  return rows.map((r: any) => r.correo as string);
}

export async function getUserEmailById(userId: number): Promise<string | null> {
  const { rows } = await pool.query(
    'SELECT correo FROM usuarios WHERE id = $1 AND is_active = TRUE',
    [userId]
  );
  return rows[0]?.correo || null;
}

function baseEmailLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
    .header { background: #ea9a00; padding: 24px 32px; }
    .header h1 { margin: 0; color: white; font-size: 22px; font-weight: 700; }
    .header p { margin: 4px 0 0; color: rgba(255,255,255,.85); font-size: 13px; }
    .body { padding: 28px 32px; color: #333; line-height: 1.6; }
    .body h2 { font-size: 16px; margin: 0 0 12px; color: #111; }
    .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    .info-table td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
    .info-table td:first-child { font-weight: 600; color: #555; width: 40%; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-orange { background: #fef3c7; color: #92400e; }
    .badge-green { background: #d1fae5; color: #065f46; }
    .footer { padding: 16px 32px; background: #f9f9f9; border-top: 1px solid #eee; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ROKA Construcciones</h1>
      <p>${title}</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">Este es un mensaje automático del Sistema ROKA. No responda este correo.</div>
  </div>
</body>
</html>`;
}

export function buildSolicitudCreadaHtml(solicitud: {
  id: number;
  solicitante: string;
  proyecto_nombre?: string;
  fecha?: string;
  fecha_requerida?: string;
  itemCount?: number;
}): string {
  const folio = `SOL-${String(solicitud.id).padStart(3, '0')}`;
  const body = `
    <h2>Nueva Solicitud de Material</h2>
    <p>Se ha creado una nueva solicitud de material que requiere su atención.</p>
    <table class="info-table">
      <tr><td>Folio</td><td><strong>${folio}</strong></td></tr>
      <tr><td>Solicitante</td><td>${solicitud.solicitante}</td></tr>
      ${solicitud.proyecto_nombre ? `<tr><td>Proyecto</td><td>${solicitud.proyecto_nombre}</td></tr>` : ''}
      ${solicitud.fecha_requerida ? `<tr><td>Fecha requerida</td><td>${solicitud.fecha_requerida}</td></tr>` : ''}
      ${solicitud.itemCount !== undefined ? `<tr><td>Ítems</td><td>${solicitud.itemCount}</td></tr>` : ''}
    </table>
  `;
  return baseEmailLayout(`Nueva solicitud de material: ${folio}`, body);
}

export function buildSolicitudCotizandoHtml(data: {
  solicitudId: number;
  solicitante: string;
  proyectoNombre?: string;
  fecha_requerida?: string;
  itemCount?: number;
}): string {
  const folio = `SOL-${String(data.solicitudId).padStart(3, '0')}`;
  const body = `
    <h2>Solicitud en Cotización</h2>
    <p>Su solicitud de material ha sido revisada y ahora se encuentra <strong>en proceso de cotización</strong>.</p>
    <table class="info-table">
      <tr><td>Folio</td><td><strong>${folio}</strong></td></tr>
      <tr><td>Solicitante</td><td>${data.solicitante}</td></tr>
      ${data.proyectoNombre ? `<tr><td>Proyecto</td><td>${data.proyectoNombre}</td></tr>` : ''}
      ${data.fecha_requerida ? `<tr><td>Fecha requerida</td><td>${data.fecha_requerida}</td></tr>` : ''}
      ${data.itemCount !== undefined ? `<tr><td>Ítems</td><td>${data.itemCount}</td></tr>` : ''}
      <tr><td>Estado</td><td><span class="badge badge-orange">En Cotización</span></td></tr>
    </table>
    <p style="font-size:13px;color:#666;margin-top:16px">El equipo de Adquisiciones está gestionando cotizaciones con proveedores. Recibirá una notificación cuando haya novedades.</p>
  `;
  return baseEmailLayout(`Solicitud en cotización: ${folio}`, body);
}

export function buildSolicitudRechazadaHtml(data: {
  solicitudId: number;
  proyectoNombre?: string;
  rechazadoPor?: string;
}): string {
  const folio = `SOL-${String(data.solicitudId).padStart(3, '0')}`;
  const body = `
    <h2>Solicitud Rechazada</h2>
    <p>Tu solicitud de material <strong>${folio}</strong>${data.proyectoNombre ? ` del proyecto <strong>${data.proyectoNombre}</strong>` : ''} ha sido rechazada y anulada${data.rechazadoPor ? ` por <strong>${data.rechazadoPor}</strong>` : ''}.</p>
    <p style="color:#666;font-size:13px;margin-top:16px">Si tienes dudas sobre esta decisión, contacta al equipo de Adquisiciones.</p>
  `;
  return baseEmailLayout(`Solicitud rechazada: ${folio}`, body);
}

export function buildSolicitudAprobadaHtml(data: {
  solicitudId: number;
  proyectoNombre?: string;
  ordenNumero?: string;
  proveedorNombre?: string;
  total?: number;
}): string {
  const folio = `SOL-${String(data.solicitudId).padStart(3, '0')}`;
  const totalFmt = data.total
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(data.total)
    : '-';
  const body = `
    <h2>Solicitud Aprobada</h2>
    <p>Su solicitud de material ha sido aprobada y se ha generado una Orden de Compra.</p>
    <table class="info-table">
      <tr><td>Folio Solicitud</td><td><strong>${folio}</strong></td></tr>
      ${data.proyectoNombre ? `<tr><td>Proyecto</td><td>${data.proyectoNombre}</td></tr>` : ''}
      ${data.ordenNumero ? `<tr><td>N° Orden de Compra</td><td>${data.ordenNumero}</td></tr>` : ''}
      ${data.proveedorNombre ? `<tr><td>Proveedor</td><td>${data.proveedorNombre}</td></tr>` : ''}
      <tr><td>Total</td><td><strong>${totalFmt}</strong></td></tr>
      <tr><td>Estado</td><td><span class="badge badge-green">Aprobada</span></td></tr>
    </table>
  `;
  return baseEmailLayout(`Solicitud aprobada: ${folio}`, body);
}

export function buildCotizacionCreadaHtml(data: {
  scId: number;
  proveedorNombre: string;
  solicitudId?: number;
  proyectoNombre?: string;
  itemCount?: number;
}): string {
  const folio = `SC-${String(data.scId).padStart(3, '0')}`;
  const body = `
    <h2>Nueva Solicitud de Cotización</h2>
    <p>Se ha creado una nueva solicitud de cotización al proveedor.</p>
    <table class="info-table">
      <tr><td>Folio SC</td><td><strong>${folio}</strong></td></tr>
      <tr><td>Proveedor</td><td>${data.proveedorNombre}</td></tr>
      ${data.proyectoNombre ? `<tr><td>Proyecto</td><td>${data.proyectoNombre}</td></tr>` : ''}
      ${data.solicitudId ? `<tr><td>Solicitud relacionada</td><td>SOL-${String(data.solicitudId).padStart(3, '0')}</td></tr>` : ''}
      ${data.itemCount !== undefined ? `<tr><td>Ítems a cotizar</td><td>${data.itemCount}</td></tr>` : ''}
      <tr><td>Estado</td><td><span class="badge badge-orange">Borrador</span></td></tr>
    </table>
  `;
  return baseEmailLayout(`Nueva solicitud de cotización: ${folio}`, body);
}

export function buildSCProveedorHtml(sc: {
  id: number;
  proveedor: string;
  proyectoNombre?: string;
  observaciones?: string;
  items: { codigo?: string; descripcion: string; cantidad: number; unidad?: string }[];
}): string {
  const folio = `SC-${String(sc.id).padStart(3, '0')}`;
  const itemsHtml = sc.items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${i.codigo || '-'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${i.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${i.cantidad} ${i.unidad || ''}</td>
    </tr>`
  ).join('');

  const body = `
    <h2>Solicitud de Cotización ${folio}</h2>
    <p>Estimado proveedor <strong>${sc.proveedor}</strong>, le enviamos la siguiente solicitud de cotización para su revisión.</p>
    ${sc.proyectoNombre ? `<p><strong>Proyecto:</strong> ${sc.proyectoNombre}</p>` : ''}
    ${sc.observaciones ? `<p><strong>Observaciones:</strong> ${sc.observaciones}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 12px;text-align:left;font-size:13px;border-bottom:2px solid #ddd">Código</th>
          <th style="padding:8px 12px;text-align:left;font-size:13px;border-bottom:2px solid #ddd">Descripción</th>
          <th style="padding:8px 12px;text-align:right;font-size:13px;border-bottom:2px solid #ddd">Cantidad</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <p style="font-size:13px;color:#666">Por favor responda este correo con sus precios y condiciones, o comuníquese con nosotros para coordinar la entrega de cotización.</p>
  `;
  return baseEmailLayout(`Solicitud de Cotización ${folio} — ROKA Construcciones`, body);
}

export function buildAlertaFechaEntregaHtml(data: {
  solicitudId: number;
  solicitante: string;
  proyectoNombre?: string;
  fechaRequerida?: string;
  estado: string;
  tipoAlerta: 'umbral' | 'recordatorio';
  numeroEnvio: number;
}): string {
  const folio = `SOL-${String(data.solicitudId).padStart(3, '0')}`;
  const tipoLabel =
    data.tipoAlerta === 'umbral'
      ? 'Alerta de fecha de entrega próxima'
      : `Recordatorio #${data.numeroEnvio} de fecha de entrega`;
  const isReminder = data.tipoAlerta === 'recordatorio';

  const estadoBadge =
    data.estado === 'Cotizando'
      ? '<span class="badge badge-orange">Cotizando</span>'
      : '<span class="badge badge-orange">Pendiente</span>';

  const body = `
    <h2>${tipoLabel}</h2>
    <p>La siguiente solicitud de material tiene su <strong>fecha de entrega próxima a vencer</strong> y requiere atención.</p>
    <table class="info-table">
      <tr><td>Folio</td><td><strong>${folio}</strong></td></tr>
      <tr><td>Solicitante</td><td>${data.solicitante}</td></tr>
      ${data.proyectoNombre ? `<tr><td>Proyecto</td><td>${data.proyectoNombre}</td></tr>` : ''}
      ${data.fechaRequerida ? `<tr><td>Fecha requerida en terreno</td><td style="color:#d97706;font-weight:600">${data.fechaRequerida}</td></tr>` : ''}
      <tr><td>Estado</td><td>${estadoBadge}</td></tr>
    </table>
    ${isReminder ? '<p style="color:#d97706;font-weight:600;margin-top:12px">⚠️ Este es un recordatorio. La fecha de entrega está cada vez más cerca.</p>' : ''}
    <p style="font-size:13px;color:#666;margin-top:16px">Por favor revise el estado de esta solicitud y coordine con el equipo de Adquisiciones para asegurar el cumplimiento de la fecha requerida.</p>
  `;
  return baseEmailLayout(`Alerta de fecha de entrega: ${folio}`, body);
}

export function buildOCProveedorHtml(oc: {
  id: number;
  numero?: string;
  proveedor: string;
  proyectoNombre?: string;
  condicionesPago?: string;
  plazoEntrega?: string;
  total?: number;
  items: { descripcion: string; cantidad: number; unidad?: string; precio_unitario?: number; total?: number }[];
}): string {
  const folio = oc.numero || `OC-${String(oc.id).padStart(3, '0')}`;
  const totalFmt = oc.total
    ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(oc.total)
    : '-';

  const itemsHtml = oc.items.map(i => {
    const pUnit = i.precio_unitario
      ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(i.precio_unitario)
      : '-';
    const tot = i.total
      ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(i.total)
      : '-';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${i.descripcion}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${i.cantidad} ${i.unidad || ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${pUnit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${tot}</td>
    </tr>`;
  }).join('');

  const body = `
    <h2>Orden de Compra ${folio}</h2>
    <p>Estimado proveedor <strong>${oc.proveedor}</strong>, adjuntamos la Orden de Compra para su proceso.</p>
    ${oc.proyectoNombre ? `<p><strong>Proyecto:</strong> ${oc.proyectoNombre}</p>` : ''}
    <table class="info-table" style="margin-bottom:16px">
      ${oc.condicionesPago ? `<tr><td>Condiciones de pago</td><td>${oc.condicionesPago}</td></tr>` : ''}
      ${oc.plazoEntrega ? `<tr><td>Plazo de entrega</td><td>${oc.plazoEntrega}</td></tr>` : ''}
    </table>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead>
        <tr style="background:#f5f5f5">
          <th style="padding:8px 12px;text-align:left;font-size:13px;border-bottom:2px solid #ddd">Descripción</th>
          <th style="padding:8px 12px;text-align:right;font-size:13px;border-bottom:2px solid #ddd">Cantidad</th>
          <th style="padding:8px 12px;text-align:right;font-size:13px;border-bottom:2px solid #ddd">P. Unitario</th>
          <th style="padding:8px 12px;text-align:right;font-size:13px;border-bottom:2px solid #ddd">Total</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot>
        <tr style="background:#fef3c7">
          <td colspan="3" style="padding:10px 12px;font-weight:700;font-size:14px">TOTAL</td>
          <td style="padding:10px 12px;font-weight:700;font-size:14px;text-align:right">${totalFmt}</td>
        </tr>
      </tfoot>
    </table>
    <p style="font-size:13px;color:#666">Para consultas sobre esta orden de compra, comuníquese con el equipo de Adquisiciones.</p>
  `;
  return baseEmailLayout(`Orden de Compra ${folio} — ROKA Construcciones`, body);
}
