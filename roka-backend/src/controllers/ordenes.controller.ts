import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as ordenesModel from '../models/ordenes.model';
import { generarOrdenCompra } from '../services/ordenes.service';
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

// Singleton browser — una instancia para toda la vida del proceso.
// Chrome en Windows usa mutex global: no permite múltiples procesos simultáneos.
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

const IVA_RATE = 0.19;

// ─── HTML export helpers ──────────────────────────────────────────────

function fmtMoney(v: number): string {
  return '$ ' + Number(v || 0).toLocaleString('es-CL', { minimumFractionDigits: 2 });
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

const ROKA_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1079 1079" width="62" height="62" style="flex-shrink:0;border-radius:10px">
  <rect width="1079" height="1079" fill="#ea9a00"/>
  <path d="M 656,606 L 646,591 L 635,591 L 356,678 L 318,777 L 343,776 L 374,702 L 656,615 Z M 989,597 L 968,585 L 815,818 L 282,818 L 293,843 L 834,843 Z M 885,539 L 868,522 L 858,522 L 691,574 L 691,583 L 701,598 L 711,598 L 873,547 L 885,547 Z" fill="#c58200" opacity="0.9"/>
  <path d="M 972,572 L 664,252 L 327,348 L 116,565 L 273,816 L 815,816 Z M 764,770 L 763,779 L 315,778 L 355,676 L 637,588 L 649,591 Z M 370,522 L 370,535 L 283,748 L 275,748 L 173,589 L 173,579 Z M 868,519 L 922,575 L 922,583 L 811,753 L 800,756 L 690,586 L 688,573 Z M 831,480 L 828,490 L 377,626 L 426,503 L 760,407 Z M 722,367 L 720,377 L 219,522 L 219,514 L 350,380 L 653,296 Z" fill="white" fill-rule="evenodd"/>
</svg>`;

function buildOCHtml(orden: any, items: any[], pdfUrl?: string): string {
  const folio = orden.folio || 'OC-' + String(orden.id).padStart(6, '0');
  const numeroSolicitud = orden.solicitud_id ? 'SM-' + String(orden.solicitud_id).padStart(3, '0') : '-';
  const numeroCotizacion = orden.cotizacion_id ? 'COT-' + String(orden.cotizacion_id).padStart(3, '0') : '-';
  const atencion = orden.atencion_a || orden.proveedor_contacto_nombre || '-';
  const subtotalNeto = Number(orden.subtotal_neto ?? orden.total ?? 0);
  const descuentoMonto = Number(orden.descuento_monto ?? 0);
  const descuentoTipo = String(orden.descuento_tipo || 'none');
  const descuentoValor = Number(orden.descuento_valor ?? 0);
  const impuesto = Number(orden.impuesto_monto ?? subtotalNeto * 0.19);
  const totalFinal = Number(orden.total_final ?? subtotalNeto + impuesto);

  let descuentoDetalle = 'Sin descuento';
  if (descuentoTipo === 'porcentaje') descuentoDetalle = descuentoValor.toFixed(2) + '%';
  else if (descuentoTipo === 'monto') descuentoDetalle = fmtMoney(descuentoValor);

  const itemsRows = items.length === 0
    ? '<tr><td colspan="6" style="border:1px solid #e2e8f0;padding:10px;text-align:center;font-size:10px;color:#64748b">Esta orden no tiene items cargados.</td></tr>'
    : items.map((it: any, i: number) => {
      const cant = Number(it.cantidad_requerida || 0);
      const punit = Number(it.precio_unitario || 0);
      const sub = Number(it.subtotal ?? cant * punit);
      return `<tr>
          <td style="border:1px solid #e2e8f0;padding:5px;font-size:9px;text-align:center">${i + 1}</td>
          <td style="border:1px solid #e2e8f0;padding:5px;font-size:9px;text-align:right">${cant.toLocaleString('es-CL')}</td>
          <td style="border:1px solid #e2e8f0;padding:5px;font-size:9px;text-align:center">${scape(it.material_sku)}</td>
          <td style="border:1px solid #e2e8f0;padding:5px;font-size:9px">
            <div style="font-weight:700">${scape(it.nombre_material)}</div>
            <div style="color:#475569">Unidad: ${scape(it.unidad)}</div>
          </td>
          <td style="border:1px solid #e2e8f0;padding:5px;font-size:9px;text-align:right">${fmtMoney(punit)}</td>
          <td style="border:1px solid #e2e8f0;padding:5px;font-size:9px;text-align:right">${fmtMoney(sub)}</td>
        </tr>`;
    }).join('');

  const logoTag = ROKA_LOGO_SVG;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${folio} — Orden de Compra</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#f1f5f9; display:flex; justify-content:center; padding:20px; }
  @media print {
    body { background:#fff; padding:0; }
    @page { margin:0; size:A4 portrait; }
    .download-bar { display:none !important; }
  }
</style>
</head>
<body>
${pdfUrl ? `<div class="download-bar" style="position:sticky;top:0;z-index:999;background:#0f172a;padding:8px 20px;display:flex;align-items:center;justify-content:space-between;font-family:'Trebuchet MS',sans-serif">
  <span style="color:#94a3b8;font-size:12px">Orden de Compra — Vista previa</span>
  <a href="${pdfUrl}" style="background:#f59e0b;color:#0f172a;padding:7px 20px;border-radius:6px;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:0.03em">
    📥 Descargar PDF
  </a>
</div>` : ''}
<div style="width:210mm;min-height:297mm;box-sizing:border-box;padding:10mm 11mm;color:#111827;background:#fff;font-family:'Trebuchet MS','Gill Sans',sans-serif">

  <div style="border:2px solid #0f172a;border-radius:10px;overflow:hidden;margin-bottom:8px">
    <div style="background:linear-gradient(90deg,#0f172a,#1e293b);color:#f8fafc;padding:7px 10px;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        ${logoTag}
        <div style="line-height:1.2">
          <div style="font-size:11px;opacity:0.9">Sistema de Compras y Abastecimiento</div>
          <div style="font-size:15px;font-weight:800;letter-spacing:0.03em;margin-bottom:3px">ORDEN DE COMPRA</div>
          <div style="font-size:10px;font-weight:700">Constructora Roka SpA</div>
          <div style="font-size:9px;opacity:0.95">General Arteaga N°30</div>
          <div style="font-size:9px;opacity:0.95">Rut 77.122.411-3</div>
          <div style="font-size:9px;opacity:0.95">Tel. +56 582 295842</div>
          <div style="font-size:9px;opacity:0.95">Cel. +56 9 31234288</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;opacity:0.85">Folio</div>
        <div style="font-size:16px;font-weight:800">${folio}</div>
        <div style="font-size:10px">Fecha: ${fmtDate(orden.fecha_emision)}</div>
      </div>
    </div>

    <div style="padding:8px 10px 10px;display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px">
        <div style="font-size:10px;font-weight:800;margin-bottom:6px;color:#0f172a">DATOS DEL PROVEEDOR</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Señor(es)</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Atención</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(atencion)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Dirección</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor_direccion) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Rut</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor_rut) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Teléfono</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor_telefono) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Email</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor_correo) || '-'}</td></tr>
        </table>
      </div>

      <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px">
        <div style="font-size:10px;font-weight:800;margin-bottom:6px;color:#0f172a">DATOS DE OBRA</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Despachar a</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.condiciones_entrega || 'Despachar a Obra')}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Plazo de Entrega</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.plazo_entrega) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Obra</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proyecto_nombre) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Autorizado por</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.autorizado_por_nombre) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Nro. Cotización</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${numeroCotizacion}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Encargado</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(atencion)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Forma de Pago</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.condiciones_pago || 'Crédito 45 días')}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Emitida por</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.autorizado_por_nombre) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Cód. Obra</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proyecto_numero_licitacion) || '-'}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Fecha Autorización</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${fmtDate(orden.updated_at || orden.fecha_emision)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Moneda</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">PESO CHILENO</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Nro. Solic. Mat.</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${numeroSolicitud}</td></tr>
        </table>
      </div>
    </div>
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;margin-bottom:7px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="border:1px solid #cbd5e1;padding:5px;font-size:9px;width:30px">#</th>
        <th style="border:1px solid #cbd5e1;padding:5px;font-size:9px;width:62px">Cant.</th>
        <th style="border:1px solid #cbd5e1;padding:5px;font-size:9px;width:70px">Codigo</th>
        <th style="border:1px solid #cbd5e1;padding:5px;font-size:9px">Descripcion</th>
        <th style="border:1px solid #cbd5e1;padding:5px;font-size:9px;width:88px">P. Unitario</th>
        <th style="border:1px solid #cbd5e1;padding:5px;font-size:9px;width:92px">Subtotal</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>

  <!-- Footer grid -->
  <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:10px;margin-bottom:10px">
    <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px">
      <div style="font-size:10px;font-weight:800;color:#0f172a;margin-bottom:4px">CONDICIONES COMERCIALES</div>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em;width:36%">Cond. de pago</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.condiciones_pago) || '-'}</td></tr>
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Plazo entrega</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.plazo_entrega) || '-'}</td></tr>
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Cond. entrega</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.condiciones_entrega) || '-'}</td></tr>
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Observaciones</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.observaciones) || '-'}</td></tr>
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Autorizado por</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.autorizado_por_nombre) || '-'}</td></tr>
      </table>
    </div>

    <div style="border:1px solid #1e293b;border-radius:8px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:7px;font-size:10px;border-bottom:1px solid #e2e8f0">Subtotal Neto</td>
          <td style="padding:7px;font-size:10px;text-align:right;border-bottom:1px solid #e2e8f0">${fmtMoney(subtotalNeto)}</td>
        </tr>
        <tr>
          <td style="padding:7px;font-size:10px;border-bottom:1px solid #e2e8f0">Descuento (${descuentoDetalle})</td>
          <td style="padding:7px;font-size:10px;text-align:right;border-bottom:1px solid #e2e8f0">- ${fmtMoney(descuentoMonto)}</td>
        </tr>
        <tr>
          <td style="padding:7px;font-size:10px;border-bottom:1px solid #e2e8f0">IVA (19%)</td>
          <td style="padding:7px;font-size:10px;text-align:right;border-bottom:1px solid #e2e8f0">${fmtMoney(impuesto)}</td>
        </tr>
        <tr style="background:#0f172a;color:#f8fafc">
          <td style="padding:9px;font-size:11px;font-weight:800">TOTAL FINAL</td>
          <td style="padding:9px;font-size:12px;font-weight:800;text-align:right">${fmtMoney(totalFinal)}</td>
        </tr>
      </table>
    </div>
  </div>

  <!-- Signatures -->
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">
    <div style="text-align:center">
      <div style="height:34px"></div>
      <div style="border-top:1px solid #94a3b8;padding-top:5px">
        <div style="font-size:10px;font-weight:700">Solicitado por</div>
        <div style="font-size:9px;color:#475569">${scape(orden.solicitante) || '-'}</div>
      </div>
    </div>
    <div style="text-align:center">
      <div style="height:34px"></div>
      <div style="border-top:1px solid #94a3b8;padding-top:5px">
        <div style="font-size:10px;font-weight:700">Revisado por</div>
        <div style="font-size:9px;color:#475569">${scape(orden.autorizado_por_nombre) || '-'}</div>
      </div>
    </div>
    <div style="text-align:center">
      <div style="height:34px"></div>
      <div style="border-top:1px solid #94a3b8;padding-top:5px">
        <div style="font-size:10px;font-weight:700">Aprobado por</div>
        <div style="font-size:9px;color:#475569">Constructora Roka SpA</div>
      </div>
    </div>
  </div>

  <div style="margin-top:8px;font-size:8px;color:#64748b;text-align:right">
    Documento generado por ROKA | ${fmtDate(new Date().toISOString())}
  </div>


</div>
</body>
</html>`;
}

// ─── Controller handlers ──────────────────────────────────────────────

export async function list(req: AuthRequest, res: Response) {
  try {
    const { estado_entrega, proyecto_id } = req.query;
    const filters: { estado_entrega?: string; proyecto_id?: number } = {};
    if (estado_entrega) filters.estado_entrega = String(estado_entrega);
    if (proyecto_id) filters.proyecto_id = Number(proyecto_id);

    const rows = await ordenesModel.getAllOrdenes(filters);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({ error: 'Error al obtener órdenes de compra' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const orden = await ordenesModel.getOrdenById(Number(id));

    if (!orden) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    const items = await ordenesModel.getOrdenItems(orden.cotizacion_id);
    res.json({ ...orden, items });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({ error: 'Error al obtener orden de compra' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const result = await generarOrdenCompra(req.body, req.user?.id || null);
    res.status(201).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al generar orden de compra:', error);
    res.status(statusCode).json({ error: error.message || 'Error al generar la orden de compra' });
  }
}

export async function updateEntrega(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { estado_entrega } = req.body;

    if (!['Pendiente', 'Recibido parcial', 'Completado'].includes(estado_entrega)) {
      return res.status(400).json({ error: 'Estado de entrega inválido' });
    }

    const updated = await ordenesModel.updateEstadoEntrega(Number(id), estado_entrega);

    if (!updated) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar entrega:', error);
    res.status(500).json({ error: 'Error al actualizar estado de entrega' });
  }
}

export async function exportarHtml(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const pdfUrl = req.query.pdfUrl ? String(req.query.pdfUrl) : undefined;
    const orden = await ordenesModel.getOrdenById(Number(id));

    if (!orden) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    const items = await ordenesModel.getOrdenItems(orden.cotizacion_id);
    const html = buildOCHtml(orden, items, pdfUrl);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!pdfUrl) {
      // Solo attachment cuando se descarga directo (sin botón PDF)
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${(orden.folio || 'OC-' + String(orden.id).padStart(6, '0')).replace(/[^a-zA-Z0-9\-_]/g, '_')}.html"`
      );
    }
    res.send(html);
  } catch (error) {
    console.error('Error al exportar orden:', error);
    res.status(500).json({ error: 'Error al exportar orden de compra' });
  }
}

export async function exportarPdf(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const orden = await ordenesModel.getOrdenById(Number(id));

    if (!orden) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    const items = await ordenesModel.getOrdenItems(orden.cotizacion_id);
    const html = buildOCHtml(orden, items);
    const pdfBuffer = await htmlToPdf(html);

    const folio = (orden.folio || 'OC-' + String(orden.id).padStart(6, '0'))
      .replace(/[^a-zA-Z0-9\-_]/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${folio}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF de orden de compra' });
  }
}

const PDF_OUTPUT_DIR = path.join(process.cwd(), 'uploads', 'ordenes-pdf');

export async function generarPdfLink(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const orden = await ordenesModel.getOrdenById(Number(id));
    if (!orden) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    if (!fs.existsSync(PDF_OUTPUT_DIR)) {
      fs.mkdirSync(PDF_OUTPUT_DIR, { recursive: true });
    }

    const items = await ordenesModel.getOrdenItems(orden.cotizacion_id);
    const html = buildOCHtml(orden, items);
    const pdfBuffer = await htmlToPdf(html);

    const folio = (orden.folio || 'OC-' + String(orden.id).padStart(6, '0'))
      .replace(/[^a-zA-Z0-9\-_]/g, '_');
    const filename = `${folio}.pdf`;
    const filePath = path.join(PDF_OUTPUT_DIR, filename);
    fs.writeFileSync(filePath, pdfBuffer);

    const inline = req.query.inline === 'true';
    res.json({
      url: `/uploads/ordenes-pdf/${filename}`,
      filename,
      size: pdfBuffer.length,
      generated_at: new Date().toISOString(),
      ...(inline ? { base64: pdfBuffer.toString('base64') } : {}),
    });
  } catch (error) {
    console.error('Error al generar link de PDF:', error);
    res.status(500).json({ error: 'Error al generar PDF de orden de compra' });
  }
}
