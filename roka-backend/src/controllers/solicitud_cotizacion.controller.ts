import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as scModel from '../models/solicitud_cotizacion.model';
import { crearSolicitudCotizacion, crearBatchSolicitudesCotizacion, cambiarEstadoSolicitudCotizacion } from '../services/solicitud_cotizacion.service';
import puppeteer from 'puppeteer-core';

function detectChromePath(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
        ];
  return candidates.find((p) => fs.existsSync(p));
}

const CHROME_EXECUTABLE = detectChromePath();

let browserPromise: Promise<puppeteer.Browser> | null = null;
let browserInstance: puppeteer.Browser | null = null;

function getBrowser(): Promise<puppeteer.Browser> {
  if (browserInstance?.isConnected()) {
    return Promise.resolve(browserInstance);
  }
  if (!browserPromise) {
    if (!CHROME_EXECUTABLE) {
      return Promise.reject(new Error('Chrome executable not found. Set CHROME_PATH env var.'));
    }
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_'));
    browserPromise = puppeteer
      .launch({
        executablePath: CHROME_EXECUTABLE,
        userDataDir,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      .then((browser) => {
        browserInstance = browser;
        browser.on('disconnected', () => {
          browserInstance = null;
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

function fmtDate(input?: string): string {
  if (!input) return '-';
  const d = new Date(input);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('es-CL');
}

function scape(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ROKA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1079 1079" width="52" height="52" style="flex-shrink:0;border-radius:8px">
  <rect width="1079" height="1079" fill="#ea9a00"/>
  <path d="M 656,606 L 646,591 L 635,591 L 356,678 L 318,777 L 343,776 L 374,702 L 656,615 Z M 989,597 L 968,585 L 815,818 L 282,818 L 293,843 L 834,843 Z M 885,539 L 868,522 L 858,522 L 691,574 L 691,583 L 701,598 L 711,598 L 873,547 L 885,547 Z" fill="#c58200" opacity="0.9"/>
  <path d="M 972,572 L 664,252 L 327,348 L 116,565 L 273,816 L 815,816 Z M 764,770 L 763,779 L 315,778 L 355,676 L 637,588 L 649,591 Z M 370,522 L 370,535 L 283,748 L 275,748 L 173,589 L 173,579 Z M 868,519 L 922,575 L 922,583 L 811,753 L 800,756 L 690,586 L 688,573 Z M 831,480 L 828,490 L 377,626 L 426,503 L 760,407 Z M 722,367 L 720,377 L 219,522 L 219,514 L 350,380 L 653,296 Z" fill="white" fill-rule="evenodd"/>
</svg>`;

function buildSolicitudCotizacionHtml(sc: any, items: any[], pdfUrl?: string): string {
  const folio = 'SC-' + String(sc.id).padStart(3, '0');
  const now = new Date().toLocaleDateString('es-CL');

  const itemsRows = items.length === 0
    ? '<tr><td colspan="4" style="border:1px solid #e2e8f0;padding:10px;text-align:center;font-size:10px;color:#64748b">Sin ítems</td></tr>'
    : items.map((it: any, i: number) => `
      <tr>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b">${i + 1}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:11px">${scape(it.nombre_material)}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;text-align:right;font-size:11px">${Number(it.cantidad_requerida).toLocaleString('es-CL')}</td>
        <td style="padding:8px;border:1px solid #e2e8f0;font-size:11px">${scape(it.unidad)}</td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${folio}</title>
<style>
  @page { margin: 20px; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 24px; color: #1e293b; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; padding: 8px; border: 1px solid #e2e8f0; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #475569; }
</style>
</head>
<body>
${pdfUrl ? `
<div style="position:sticky;top:0;z-index:100;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:8px 12px;display:flex;align-items:center;justify-content:space-between">
  <span style="font-size:11px;color:#475569">Vista previa — <strong>${folio}</strong></span>
  <a href="${pdfUrl}" target="_blank" style="background:#0f172a;color:#fff;padding:6px 16px;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600">Descargar PDF</a>
</div>` : ''}

<div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px;border-radius:10px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
  ${ROKA_LOGO_SVG}
  <div style="flex:1">
    <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Sistema de Compras y Abastecimiento</p>
    <p style="margin:2px 0 0;font-size:22px;font-weight:900;color:#ea9a00;letter-spacing:1px">SOLICITUD DE COTIZACIÓN</p>
  </div>
  <div style="text-align:right">
    <p style="margin:0;font-size:20px;font-weight:900;color:#fff">${folio}</p>
    <p style="margin:2px 0 0;font-size:10px;color:#94a3b8">${fmtDate(sc.created_at)}</p>
  </div>
</div>

<div style="display:flex;gap:16px;margin-bottom:20px">
  <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
    <p style="margin:0 0 6px;font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8">PROVEEDOR</p>
    <p style="margin:0;font-size:12px;font-weight:700">${scape(sc.proveedor)}</p>
  </div>
  <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
    <p style="margin:0 0 6px;font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8">PROYECTO</p>
    <p style="margin:0;font-size:12px;font-weight:700">${scape(sc.proyecto_nombre || '-')}</p>
  </div>
  <div style="flex:1;padding:12px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0">
    <p style="margin:0 0 6px;font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8">SOLICITANTE</p>
    <p style="margin:0;font-size:12px;font-weight:700">${scape(sc.solicitante || '-')}</p>
  </div>
</div>

<div style="margin-bottom:20px">
  <p style="font-size:9px;font-weight:700;text-transform:uppercase;color:#94a3b8;margin-bottom:6px">MATERIALES SOLICITADOS A COTIZAR</p>
  <table>
    <thead>
      <tr><th>#</th><th style="text-align:left">Material</th><th style="text-align:right">Cantidad</th><th style="text-align:left">Unidad</th></tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <p style="margin-top:6px;font-size:10px;color:#94a3b8;text-align:right">Total de ítems: <strong>${items.length}</strong></p>
</div>

${sc.observaciones ? `
<div style="margin-bottom:20px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px">
  <p style="margin:0 0 4px;font-size:9px;font-weight:700;text-transform:uppercase;color:#d97706">Observaciones</p>
  <p style="margin:0;font-size:11px;color:#92400e">${scape(sc.observaciones)}</p>
</div>` : ''}

<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0">
  <p style="font-size:10px;color:#94a3b8;text-align:center">Documento generado por ROKA | ${now}</p>
</div>

</body>
</html>`;
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
    const html = buildSolicitudCotizacionHtml(sc, items, pdfUrl);

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
    const html = buildSolicitudCotizacionHtml(sc, items);
    const pdfBuffer = await htmlToPdf(html);

    const folio = `SC-${String(sc.id).padStart(3, '0')}`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${folio}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF de solicitud de cotización' });
  }
}

export async function generarPdfLink(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sc = await scModel.getSolicitudCotizacionById(Number(id));
    if (!sc) {
      return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });
    }

    if (!fs.existsSync(PDF_OUTPUT_DIR)) {
      fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
    }

    const items = await scModel.getSolicitudCotizacionDetalle(Number(id));
    const html = buildSolicitudCotizacionHtml(sc, items);
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
  } catch (error) {
    console.error('Error al generar link de PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF de solicitud de cotización' });
  }
}
