import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import pool from '../db';
import * as scModel from '../models/solicitud_cotizacion.model';
import { crearSolicitudCotizacion, crearBatchSolicitudesCotizacion, cambiarEstadoSolicitudCotizacion } from '../services/solicitud_cotizacion.service';
import { getDb } from '../types';
import { isEventEnabled, sendEmail, buildSCProveedorHtml, buildCotizacionCreadaHtml, getUserEmailsByPermission } from '../lib/email';
import { htmlToPdf } from '../lib/pdf-utils';
import { fmtDate, scape, ROKA_LOGO_SVG } from '../lib/html-templates';

function buildSolicitudCotizacionHtml(sc: any, items: any[], proveedor?: any, solicitud?: any, pdfUrl?: string): string {
  const folio = 'SC-' + String(sc.id).padStart(3, '0');
  const numeroSolicitudMaterial = sc.solicitud_id ? 'SM-' + String(sc.solicitud_id).padStart(3, '0') : '-';
  const fechaRequerida = solicitud?.fecha_requerida ? fmtDate(solicitud.fecha_requerida) : '-';
  const now = new Date().toLocaleDateString('es-CL');

  // Provider data with fallbacks
  const provNombre = proveedor?.nombre || sc.proveedor || '-';
  const provRut = proveedor?.rut || '-';
  const provDireccion = proveedor?.direccion || '-';
  const provTelefono = proveedor?.telefono || '-';
  const provCorreo = proveedor?.correo || '-';
  const provAtencion = proveedor?.contacto_nombre || '-';

  const itemsRows = items.length === 0
    ? '<tr><td colspan="5" style="border:1px solid #e2e8f0;padding:10px;text-align:center;font-size:10px;color:#64748b">Sin ítems</td></tr>'
    : items.map((it: any, i: number) => {
      const codigo = it.material_sku || it.codigo || '-';
      return `<tr style="page-break-inside:avoid;break-inside:avoid">
        <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px;text-align:center">${i + 1}</td>
        <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px;text-align:center">${scape(codigo)}</td>
        <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px">
          <div style="font-weight:700">${scape(it.nombre_material)}</div>
          <div style="color:#475569;font-size:9px">Unidad: ${scape(it.unidad)}</div>
        </td>
        <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px;text-align:right">${Number(it.cantidad_requerida || 0).toLocaleString('es-CL')}</td>
        <td style="border:1px solid #e2e8f0;padding:5px 4px;font-size:10px;text-align:center">${scape(it.unidad)}</td>
      </tr>`;
    }).join('');

  const logoTag = ROKA_LOGO_SVG;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${folio} — Solicitud de Cotización</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f1f5f9; display:flex; justify-content:center; padding:20px; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
  @media print {
    body { background:#fff; padding:0; display:block; }
    @page { margin:0; size:A4 portrait; }
    .download-bar { display:none !important; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    thead { display: table-header-group; }
  }
</style>
</head>
<body>
${pdfUrl ? `<div class="download-bar" style="position:sticky;top:0;z-index:999;background:#0f172a;padding:8px 20px;display:flex;align-items:center;justify-content:space-between;font-family:'Trebuchet MS',sans-serif">
  <span style="color:#94a3b8;font-size:13px">Solicitud de Cotización — Vista previa</span>
  <a href="${pdfUrl}" style="background:#f59e0b;color:#0f172a;padding:7px 20px;border-radius:6px;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:0.03em">
    📥 Descargar PDF
  </a>
</div>` : ''}
<div style="width:210mm;min-height:297mm;box-sizing:border-box;padding:7mm 8mm;color:#111827;background:#fff;font-family:'Trebuchet MS','Gill Sans',sans-serif">

  <div style="border:2px solid #0f172a;border-radius:8px;overflow:hidden;margin-bottom:8px;page-break-inside:avoid;break-inside:avoid">
    <div style="background:linear-gradient(90deg,#0f172a,#1e293b);color:#f8fafc;padding:7px 10px;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        ${logoTag}
        <div style="line-height:1.25">
          <div style="font-size:11px;opacity:0.9">Sistema de Compras y Abastecimiento</div>
          <div style="font-size:17px;font-weight:800;letter-spacing:0.03em;margin-bottom:2px">SOLICITUD DE COTIZACIÓN</div>
          <div style="font-size:11px;font-weight:700">Constructora Roka SpA</div>
          <div style="font-size:9px;opacity:0.95">General Arteaga N°30</div>
          <div style="font-size:9px;opacity:0.95">Rut 77.122.411-3</div>
          <div style="font-size:9px;opacity:0.95">Tel. +56 582 295842</div>
          <div style="font-size:9px;opacity:0.95">Cel. +56 9 31234288</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;opacity:0.85">Solicitud de Cotización N°:</div>
        <div style="font-size:19px;font-weight:800">${folio}</div>
        <div style="font-size:10px">Fecha: ${fmtDate(sc.created_at)}</div>
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="width:50%;padding:8px 5px 10px 10px;vertical-align:top">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;height:100%">
            <div style="font-size:10px;font-weight:800;margin-bottom:5px;color:#0f172a">DATOS DEL PROVEEDOR</div>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Señor(es)</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(provNombre)}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Atención</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(provAtencion)}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Dirección</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(provDireccion)}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Rut</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(provRut)}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Teléfono</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(provTelefono)}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Email</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(provCorreo)}</td></tr>
            </table>
          </div>
        </td>
        <td style="width:50%;padding:8px 10px 10px 5px;vertical-align:top">
          <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px;height:100%">
            <div style="font-size:10px;font-weight:800;margin-bottom:5px;color:#0f172a">DATOS DE OBRA / TRAZABILIDAD</div>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Obra</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(sc.proyecto_nombre) || '-'}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Nro. de Obra</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(sc.proyecto_numero_obra) || '-'}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Solicitante</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(sc.solicitante) || '-'}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Nro. Solic. Material</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${numeroSolicitudMaterial}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Fecha Requerida</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${fechaRequerida}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Estado</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(sc.estado) || '-'}</td></tr>
              <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Fecha Solicitud</td><td style="font-size:11px;font-weight:700;color:#0f172a;padding:2px 4px">${fmtDate(sc.fecha_solicitud)}</td></tr>
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
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px;width:68px">Código</th>
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px">Descripción</th>
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px;width:58px">Cantidad</th>
        <th style="border:1px solid #cbd5e1;padding:5px 4px;font-size:10px;width:50px">Unidad</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <!-- Footer section with observations -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;page-break-inside:avoid;break-inside:avoid">
    <tr>
      <td style="width:55%;padding-right:5px;vertical-align:top">
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px">
          <div style="font-size:10px;font-weight:800;color:#0f172a;margin-bottom:4px">OBSERVACIONES</div>
          <div style="font-size:10px;color:#374151;min-height:40px">${sc.observaciones ? scape(sc.observaciones) : 'Sin observaciones'}</div>
        </div>
      </td>
      <td style="width:45%;padding-left:5px;vertical-align:top">
        <div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px">
          <div style="font-size:10px;font-weight:800;color:#0f172a;margin-bottom:4px">RESUMEN</div>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:3px 5px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em;width:50%">Total ítems</td><td style="padding:3px 5px;font-size:11px;font-weight:700;color:#0f172a;text-align:right">${items.length}</td></tr>
            <tr><td style="padding:3px 5px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Fecha Emisión</td><td style="padding:3px 5px;font-size:11px;font-weight:700;color:#0f172a;text-align:right">${fmtDate(sc.created_at)}</td></tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- Signatures -->
  <table style="width:100%;border-collapse:collapse;margin-top:8px;page-break-inside:avoid;break-inside:avoid">
    <tr>
      <td style="width:50%;text-align:center;padding:0 5px;vertical-align:top">
        <div style="height:32px"></div>
        <div style="border-top:1px solid #94a3b8;padding-top:5px">
          <div style="font-size:11px;font-weight:700">Solicitado por</div>
          <div style="font-size:9px;color:#475569">${scape(sc.solicitante) || '-'}</div>
        </div>
      </td>
      <td style="width:50%;text-align:center;padding:0 5px;vertical-align:top">
        <div style="height:32px"></div>
        <div style="border-top:1px solid #94a3b8;padding-top:5px">
          <div style="font-size:11px;font-weight:700">Revisado por</div>
          <div style="font-size:9px;color:#475569">Constructora Roka SpA</div>
        </div>
      </td>
    </tr>
  </table>

  <div style="margin-top:6px;font-size:8px;color:#64748b;text-align:right">
    Documento generado por ROKA | ${now}
  </div>

</div>
</body>
</html>`;
}

// Helper function to fetch provider data
async function getProveedorById(proveedorId: number): Promise<any | null> {
  const db = getDb();
  const { rows: [proveedor] } = await db.query(
    `SELECT nombre, rut, direccion, telefono, correo, contacto_nombre
     FROM proveedores WHERE id = $1 AND is_active = true`,
    [proveedorId]
  );
  return proveedor || null;
}

// Helper function to fetch solicitud data for fecha_requerida
async function getSolicitudById(solicitudId: number): Promise<any | null> {
  const db = getDb();
  const { rows: [solicitud] } = await db.query(
    `SELECT fecha_requerida FROM solicitudes_material WHERE id = $1`,
    [solicitudId]
  );
  return solicitud || null;
}

const PDF_OUTPUT_DIR = path.join(process.cwd(), 'uploads', 'sc-pdf');

export async function list(req: AuthRequest, res: Response) {
  try {
    const { solicitud_id, estado, proveedor, proyecto_id } = req.query;
    const filters: { solicitud_id?: number; estado?: string; proveedor?: string; proyecto_id?: number } = {};
    if (solicitud_id) filters.solicitud_id = Number(solicitud_id);
    if (estado) filters.estado = String(estado);
    if (proveedor) filters.proveedor = String(proveedor);
    if (proyecto_id) filters.proyecto_id = Number(proyecto_id);

    const rows = await scModel.getAllSolicitudesCotizacion(filters);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar solicitudes de cotización:', error);
    res.status(500).json({ error: 'Error al listar solicitudes de cotización' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sc = await scModel.getSolicitudCotizacionById(Number(id));
    if (!sc) {
      return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });
    }
    const items = await scModel.getSolicitudCotizacionDetalle(Number(id));
    res.json({ ...sc, items });
  } catch (error) {
    console.error('Error al obtener solicitud de cotización:', error);
    res.status(500).json({ error: 'Error al obtener solicitud de cotización' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const sc = await crearSolicitudCotizacion(req.body, req.user?.id || null);
    res.status(201).json(sc);

    // Fire-and-forget: email notification
    isEventEnabled('cotizacion.creada').then(async (enabled) => {
      if (!enabled) return;
      const destinatarios = await getUserEmailsByPermission('cotizaciones.view');
      if (!destinatarios.length) return;
      const detalles = await scModel.getSolicitudCotizacionDetalle(sc.id);
      const html = buildCotizacionCreadaHtml({
        scId: sc.id,
        proveedorNombre: (sc as any).proveedor || 'Proveedor',
        solicitudId: (sc as any).solicitud_id,
        proyectoNombre: undefined,
        itemCount: detalles.length,
      });
      const folio = `SC-${String(sc.id).padStart(3, '0')}`;
      sendEmail({
        to: destinatarios,
        subject: `Nueva solicitud de cotización: ${folio}`,
        html,
        eventoCodigo: 'cotizacion.creada',
        entidadTipo: 'solicitud_cotizacion',
        entidadId: sc.id,
      }).catch(console.error);
    }).catch(console.error);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al crear solicitud de cotización:', error);
    res.status(statusCode).json({ error: error.message || 'Error al crear solicitud de cotización' });
  }
}

export async function createBatch(req: AuthRequest, res: Response) {
  try {
    const results = await crearBatchSolicitudesCotizacion(req.body, req.user?.id || null);
    res.status(201).json(results);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al crear lote de solicitudes de cotización:', error);
    res.status(statusCode).json({ error: error.message || 'Error al crear lote de solicitudes de cotización' });
  }
}

export async function changeEstado(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado) {
      return res.status(400).json({ error: 'Estado requerido' });
    }
    const sc = await cambiarEstadoSolicitudCotizacion(Number(id), estado, req.user?.id || null);
    res.json(sc);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al cambiar estado:', error);
    res.status(statusCode).json({ error: error.message || 'Error al cambiar estado' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const deleted = await scModel.deleteSolicitudCotizacion(Number(id));
    if (!deleted) {
      return res.status(400).json({ error: 'No se pudo eliminar. Solo se permite en estado Borrador' });
    }
    res.json({ message: 'Solicitud de cotización eliminada' });
  } catch (error) {
    console.error('Error al eliminar solicitud de cotización:', error);
    res.status(500).json({ error: 'Error al eliminar solicitud de cotización' });
  }
}

export async function exportarHtml(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const pdfUrl = req.query.pdfUrl ? String(req.query.pdfUrl) : undefined;
    const sc = await scModel.getSolicitudCotizacionById(Number(id));
    if (!sc) {
      return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });
    }
    const items = await scModel.getSolicitudCotizacionDetalle(Number(id));

    // Fetch additional data: provider and solicitud
    let proveedor = null;
    let solicitud = null;
    if (sc.proveedor_id) {
      proveedor = await getProveedorById(sc.proveedor_id);
    }
    if (sc.solicitud_id) {
      solicitud = await getSolicitudById(sc.solicitud_id);
    }

    const html = buildSolicitudCotizacionHtml(sc, items, proveedor, solicitud, pdfUrl);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!pdfUrl) {
      res.setHeader('Content-Disposition', `attachment; filename="SC-${String(sc.id).padStart(3, '0')}.html"`);
    }
    res.send(html);
  } catch (error) {
    console.error('Error al exportar solicitud de cotización:', error);
    res.status(500).json({ error: 'Error al exportar solicitud de cotización' });
  }
}

export async function exportarPdf(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sc = await scModel.getSolicitudCotizacionById(Number(id));
    if (!sc) {
      return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });
    }
    const items = await scModel.getSolicitudCotizacionDetalle(Number(id));

    // Fetch additional data: provider and solicitud
    let proveedor = null;
    let solicitud = null;
    if (sc.proveedor_id) {
      proveedor = await getProveedorById(sc.proveedor_id);
    }
    if (sc.solicitud_id) {
      solicitud = await getSolicitudById(sc.solicitud_id);
    }

    try {
      const html = buildSolicitudCotizacionHtml(sc, items, proveedor, solicitud);
      const pdfBuffer = await htmlToPdf(html);
      const folio = `SC-${String(sc.id).padStart(3, '0')}`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${folio}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (pdfError: any) {
      // Fallback: return HTML if Chrome/Puppeteer is not available
      console.warn('PDF generation failed, returning HTML instead:', pdfError.message);
      const html = buildSolicitudCotizacionHtml(sc, items, proveedor, solicitud);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    }
  } catch (error) {
    console.error('Error al exportar solicitud de cotización:', error);
    res.status(500).json({ error: 'Error al exportar solicitud de cotización' });
  }
}

export async function generarPdfLink(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sc = await scModel.getSolicitudCotizacionById(Number(id));
    if (!sc) {
      return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });
    }

    const items = await scModel.getSolicitudCotizacionDetalle(Number(id));

    // Fetch additional data: provider and solicitud
    let proveedor = null;
    let solicitud = null;
    if (sc.proveedor_id) {
      proveedor = await getProveedorById(sc.proveedor_id);
    }
    if (sc.solicitud_id) {
      solicitud = await getSolicitudById(sc.solicitud_id);
    }

    try {
      if (!fs.existsSync(PDF_OUTPUT_DIR)) {
        fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
      }

      const html = buildSolicitudCotizacionHtml(sc, items, proveedor, solicitud);
      const pdfBuffer = await htmlToPdf(html);

      const folio = `SC-${String(sc.id).padStart(3, '0')}`;
      const filename = `${folio}.pdf`;
      const filePath = path.join(PDF_OUTPUT_DIR, filename);
      fs.writeFileSync(filePath, pdfBuffer);

      const inline = req.query.inline === 'true';
      res.json({
        url: `/uploads/sc-pdf/${filename}`,
        filename,
        size: pdfBuffer.length,
        generated_at: new Date().toISOString(),
        ...(inline ? { base64: pdfBuffer.toString('base64') } : {}),
      });
    } catch (pdfError: any) {
      // Fallback: return HTML URL if Chrome/Puppeteer is not available
      console.warn('PDF generation failed, returning HTML instead:', pdfError.message);
      const htmlUrl = `/api/solicitud-cotizacion/${id}/exportar?pdfUrl=false`;
      res.json({
        url: htmlUrl,
        filename: `SC-${String(sc.id).padStart(3, '0')}.html`,
        fallback: true,
        message: 'Chrome no disponible. Retornando HTML para impresión.',
        generated_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error al generar link de PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF de solicitud de cotización' });
  }
}

// ---- Importar respuesta de cotización desde archivo ----

export async function importarArchivo(req: AuthRequest, res: Response) {
  try {
    const { solicitud_cotizacion_id } = req.body;
    const file = req.file;

    if (!solicitud_cotizacion_id || !file) {
      return res.status(400).json({ error: 'Se requiere solicitud_cotizacion_id y un archivo' });
    }

    // Get SC and its items
    const sc = await scModel.getSolicitudCotizacionById(Number(solicitud_cotizacion_id));
    if (!sc) {
      return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });
    }

    const items = await scModel.getSolicitudCotizacionDetalle(Number(solicitud_cotizacion_id));

    // Sanitize items for OCR service (ensure nombre_material is string)
    const sanitizedItems = items.map((item: any) => ({
      id: item.id,
      solicitud_item_id: item.solicitud_item_id,
      nombre_material: item.nombre_material || '',
      cantidad_requerida: item.cantidad_requerida || 0,
      unidad: item.unidad || '',
    }));

    // Fetch proveedor from DB for RUT and other fields
    let proveedorDb: any = null;
    if (sc.proveedor_id) {
      proveedorDb = await getProveedorById(sc.proveedor_id);
    }

    // Parse the file with AI
    const { parseCotizacionArchivo } = await import('../services/sc-import.service');
    const parsed = await parseCotizacionArchivo(file.path, sanitizedItems, sc.proveedor);

    // Build preview with matching
    const preview = {
      solicitud_cotizacion_id: Number(solicitud_cotizacion_id),
      archivo_path: file.path,
      archivo_nombre: file.originalname,
      numero_cov: parsed.numero_cov,
      proveedor_nombre: parsed.proveedor_nombre || proveedorDb?.nombre || sc.proveedor,
      proveedor_rut: proveedorDb?.rut || undefined,
      proveedor_esperado: sc.proveedor,
      condiciones_pago: parsed.condiciones_pago,
      monto_total: parsed.monto_total,
      items: parsed.items,
      warnings: parsed.warnings || [],
      datos_importados: parsed.datos_raw,
    };

    res.json(preview);
  } catch (error: any) {
    console.error('Error al importar archivo:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Error al importar archivo' });
  }
}

export async function confirmarImportacion(req: AuthRequest, res: Response) {
  try {
    const {
      solicitud_cotizacion_id,
      archivo_path,
      archivo_nombre,
      numero_cov,
      condiciones_pago,
      plazo_entrega,
      descuento_global,
      proveedor_nombre,
      items,
    } = req.body;

    if (!solicitud_cotizacion_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere solicitud_cotizacion_id e ítems con precios' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify SC exists
      const sc = await scModel.getSolicitudCotizacionById(solicitud_cotizacion_id);
      if (!sc) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });
      }

      // Update each item with prices
      for (const item of items) {
        if (item.solicitud_item_id && item.precio_unitario) {
          // Find the detalle for this solicitud_item_id
          const { rows: [detalle] } = await client.query(
            'SELECT id FROM solicitud_cotizacion_detalle WHERE solicitud_cotizacion_id = $1 AND solicitud_item_id = $2',
            [solicitud_cotizacion_id, item.solicitud_item_id]
          );
          if (detalle) {
            await scModel.updateDetalleConPrecios(detalle.id, {
              precio_unitario: item.precio_unitario,
              descuento_porcentaje: item.descuento_porcentaje,
              codigo_proveedor: item.codigo_proveedor,
            }, client);
          }
        }
      }

      // Update SC with file info and numero_cov
      if (archivo_path && archivo_nombre) {
        await scModel.updateSCArchivo(solicitud_cotizacion_id, archivo_path, archivo_nombre, client);
      }
      if (numero_cov || condiciones_pago || plazo_entrega || descuento_global != null) {
        await scModel.updateSCRespuestaProveedor(solicitud_cotizacion_id, {
          numero_cov: numero_cov || null,
          condiciones_pago_cov: condiciones_pago || null,
          plazo_entrega_cov: plazo_entrega || null,
          descuento_global_cov: descuento_global != null ? Number(descuento_global) : null,
        }, client);
      }

      // Mark SC as RESPONDIDA — con trazabilidad de quién lo hizo
      await scModel.updateSolicitudCotizacionEstado(solicitud_cotizacion_id, 'Respondida', (req as AuthRequest).user?.id || null, client);

      await client.query('COMMIT');

      // Return updated SC
      const updated = await scModel.getSolicitudCotizacionById(solicitud_cotizacion_id);
      const updatedItems = await scModel.getDetalleConPrecios(solicitud_cotizacion_id);
      res.json({ ...updated, items: updatedItems });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error al confirmar importación:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Error al confirmar importación' });
  }
}

export async function enviarProveedor(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const habilitado = await isEventEnabled('sc.envio_proveedor');
    if (!habilitado) {
      return res.status(403).json({ error: 'El envío de SC a proveedor no está habilitado en la configuración' });
    }

    const sc = await scModel.getSolicitudCotizacionById(id);
    if (!sc) return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });

    let emailDestino: string | null = null;
    if (sc.proveedor_id) {
      const db = getDb();
      const { rows: [prov] } = await db.query(
        'SELECT correo, contacto_correo FROM proveedores WHERE id = $1',
        [sc.proveedor_id]
      );
      emailDestino = prov?.correo || prov?.contacto_correo || null;
    }

    if (!emailDestino) {
      return res.status(400).json({ error: 'El proveedor no tiene correo registrado' });
    }

    const items = await scModel.getSolicitudCotizacionDetalle(id);
    const folio = `SC-${String(id).padStart(3, '0')}`;

    const html = buildSCProveedorHtml({
      id,
      proveedor: (sc as any).proveedor || 'Proveedor',
      proyectoNombre: (sc as any).proyecto_nombre,
      observaciones: sc.observaciones || undefined,
      items: items.map((i: any) => ({
        codigo: i.codigo || undefined,
        descripcion: i.nombre_material || i.descripcion || '-',
        cantidad: i.cantidad_requerida || i.cantidad || 0,
        unidad: i.unidad || undefined,
      })),
    });

    // Generar PDF para adjuntar
    let pdfBuffer: Buffer | null = null;
    try {
      let proveedorRow: any = null;
      let solicitudRow: any = null;
      if (sc.proveedor_id) proveedorRow = await getProveedorById(sc.proveedor_id);
      if (sc.solicitud_id) solicitudRow = await getSolicitudById(sc.solicitud_id);
      const pdfHtml = buildSolicitudCotizacionHtml(sc, items, proveedorRow, solicitudRow);
      pdfBuffer = await htmlToPdf(pdfHtml);
    } catch (pdfErr: any) {
      console.warn('[enviarProveedor SC] PDF generation failed, sending email without attachment:', pdfErr?.message || pdfErr);
    }

    await sendEmail({
      to: emailDestino,
      subject: `Solicitud de Cotización ${folio} — ROKA Construcciones`,
      html,
      eventoCodigo: 'sc.envio_proveedor',
      entidadTipo: 'solicitud_cotizacion',
      entidadId: id,
      attachments: pdfBuffer ? [{
        filename: `${folio}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }] : undefined,
    });

    // Marcar como Enviada después de enviar email exitosamente
    await scModel.updateSolicitudCotizacionEstado(id, 'Enviada', req.user?.id || null);

    res.json({ ok: true, enviado_a: emailDestino });
  } catch (err: any) {
    console.error('Error al enviar SC al proveedor:', err);
    res.status(500).json({ error: err.message || 'Error al enviar SC al proveedor' });
  }
}
