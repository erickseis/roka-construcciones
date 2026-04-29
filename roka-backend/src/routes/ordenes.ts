import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import {
  createNotifications,
  getActorDisplayName,
  NotificationInput,
  resolveRecipientUserIds,
} from '../lib/notifications';
import { getLogoBase64 } from '../lib/logo';

const router = Router();
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

function buildOCHtml(orden: any, items: any[]): string {
  const logoB64 = getLogoBase64();
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

  const logoTag = logoB64
    ? `<img src="data:image/png;base64,${logoB64}" alt="ROKA" style="width:95px;object-fit:contain;filter:brightness(120%)" />`
    : '<div style="width:95px;height:50px;background:#334155;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#f8fafc;font-weight:800;font-size:18px">ROKA</div>';

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
  }
</style>
</head>
<body>
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
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Señor(es)</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Atención</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(atencion)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Dirección</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor_direccion)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Rut</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor_rut)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Teléfono</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor_telefono)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Email</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proveedor_correo)}</td></tr>
        </table>
      </div>

      <div style="border:1px solid #cbd5e1;border-radius:8px;padding:8px">
        <div style="font-size:10px;font-weight:800;margin-bottom:6px;color:#0f172a">DATOS DE OBRA</div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px;width:36%">Despachar a</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.condiciones_entrega || 'Despachar a Obra')}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Plazo de Entrega</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.plazo_entrega)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Obra</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proyecto_nombre)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Autorizado por</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.autorizado_por_nombre)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Nro. Cotización</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${numeroCotizacion}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Encargado</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(atencion)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Forma de Pago</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.condiciones_pago || 'Crédito 45 días')}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Emitida por</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.autorizado_por_nombre)}</td></tr>
          <tr><td style="font-size:8px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;padding:2px 4px">Cód. Obra</td><td style="font-size:10px;font-weight:700;color:#0f172a;padding:2px 4px">${scape(orden.proyecto_numero_licitacion)}</td></tr>
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
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em;width:36%">Cond. de pago</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.condiciones_pago)}</td></tr>
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Plazo entrega</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.plazo_entrega)}</td></tr>
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Cond. entrega</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.condiciones_entrega)}</td></tr>
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Observaciones</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.observaciones)}</td></tr>
        <tr><td style="padding:4px 6px;font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.04em">Autorizado por</td><td style="padding:4px 6px;font-size:10px;color:#111827;border-bottom:1px dotted #d1d5db">${scape(orden.autorizado_por_nombre)}</td></tr>
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
        <div style="font-size:9px;color:#475569">${scape(orden.solicitante)}</div>
      </div>
    </div>
    <div style="text-align:center">
      <div style="height:34px"></div>
      <div style="border-top:1px solid #94a3b8;padding-top:5px">
        <div style="font-size:10px;font-weight:700">Revisado por</div>
        <div style="font-size:9px;color:#475569">${scape(orden.autorizado_por_nombre)}</div>
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

// GET /api/ordenes — Listar órdenes de compra
router.get('/', async (req: Request, res: Response) => {
  try {
    const { estado_entrega, proyecto_id } = req.query;
    let query = `
      SELECT oc.*, c.proveedor, c.solicitud_id,
             p.nombre AS proyecto_nombre
      FROM ordenes_compra oc
      JOIN cotizaciones c ON c.id = oc.cotizacion_id
      JOIN solicitudes_material sm ON sm.id = c.solicitud_id
      JOIN proyectos p ON p.id = sm.proyecto_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (estado_entrega) {
      params.push(estado_entrega);
      query += ` AND oc.estado_entrega = $${params.length}`;
    }
    if (proyecto_id) {
      params.push(proyecto_id);
      query += ` AND sm.proyecto_id = $${params.length}`;
    }

    query += ' ORDER BY oc.created_at DESC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener órdenes:', error);
    res.status(500).json({ error: 'Error al obtener órdenes de compra' });
  }
});

// GET /api/ordenes/:id — Detalle con cotización y solicitud
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { rows: [orden] } = await pool.query(`
      SELECT oc.*, c.proveedor, c.proveedor_id, c.solicitud_id, c.total AS cotizacion_total,
             sm.solicitante, sm.fecha AS fecha_solicitud, sm.estado AS solicitud_estado,
             p.nombre AS proyecto_nombre, p.ubicacion AS proyecto_ubicacion,
             p.numero_licitacion AS proyecto_numero_licitacion,
             p.descripcion_licitacion AS proyecto_descripcion_licitacion,
             pr.rut AS proveedor_rut,
             pr.razon_social AS proveedor_razon_social,
             pr.direccion AS proveedor_direccion,
             pr.telefono AS proveedor_telefono,
             pr.correo AS proveedor_correo,
             pr.contacto_nombre AS proveedor_contacto_nombre,
             pr.contacto_telefono AS proveedor_contacto_telefono,
             pr.contacto_correo AS proveedor_contacto_correo,
             CONCAT(u.nombre, ' ', u.apellido) AS autorizado_por_nombre
      FROM ordenes_compra oc
      JOIN cotizaciones c ON c.id = oc.cotizacion_id
      JOIN solicitudes_material sm ON sm.id = c.solicitud_id
      JOIN proyectos p ON p.id = sm.proyecto_id
      LEFT JOIN proveedores pr ON pr.id = c.proveedor_id
      LEFT JOIN usuarios u ON u.id = oc.created_by_usuario_id
      WHERE oc.id = $1
    `, [id]);

    if (!orden) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    // Obtener ítems de la cotización asociada
    const { rows: items } = await pool.query(`
      SELECT ci.*, si.nombre_material, si.cantidad_requerida, si.unidad,
             m.sku AS material_sku
      FROM cotizacion_items ci
      JOIN solicitud_items si ON si.id = ci.solicitud_item_id
      LEFT JOIN materiales m ON m.id = si.material_id
      WHERE ci.cotizacion_id = $1
      ORDER BY ci.id
    `, [orden.cotizacion_id]);

    res.json({ ...orden, items });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    res.status(500).json({ error: 'Error al obtener orden de compra' });
  }
});

// POST /api/ordenes — Generar OC desde cotización aprobada
router.post('/', authMiddleware, requirePermission('ordenes.create'), async (req: AuthRequest, res: Response) => {
  const {
    cotizacion_id,
    condiciones_pago,
    folio,
    descuento_tipo,
    descuento_valor,
    plazo_entrega,
    condiciones_entrega,
    atencion_a,
    observaciones,
  } = req.body;

  if (!cotizacion_id) {
    return res.status(400).json({ error: 'Se requiere cotizacion_id' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar que la cotización existe y está aprobada
    const { rows: [cotizacion] } = await client.query(
      `SELECT c.*, s.id AS solicitud_id_ref, s.estado AS solicitud_estado,
              s.proyecto_id, s.presupuesto_categoria_id,
              p.nombre AS proyecto_nombre
       FROM cotizaciones c
       JOIN solicitudes_material s ON s.id = c.solicitud_id
       JOIN proyectos p ON p.id = s.proyecto_id
       WHERE c.id = $1`,
      [cotizacion_id]
    );

    if (!cotizacion) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    if (cotizacion.estado !== 'Aprobada') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La cotización debe estar aprobada para generar una OC' });
    }

    // 2. Verificar que no exista OC duplicada
    const { rows: existingOC } = await client.query(
      'SELECT id FROM ordenes_compra WHERE cotizacion_id = $1',
      [cotizacion_id]
    );
    if (existingOC.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Ya existe una orden de compra para esta cotización',
        orden_existente_id: existingOC[0].id
      });
    }

    // 3. Validar presupuesto disponible del proyecto/categoria antes de comprometer OC
    const { rows: [presupuesto] } = await client.query(
      `SELECT *
       FROM presupuestos_proyecto
       WHERE proyecto_id = $1 AND estado IN ('Vigente', 'Borrador')
       FOR UPDATE`,
      [cotizacion.proyecto_id]
    );

    if (!presupuesto) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'El proyecto no tiene presupuesto disponible para generar la OC'
      });
    }

    const subtotalBase = Number(cotizacion.total);
    if (!Number.isFinite(subtotalBase) || subtotalBase <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La cotización tiene un total inválido para generar la OC' });
    }

    const descuentoTipoNormalizado = String(descuento_tipo || 'none').toLowerCase();
    const descuentoTipo = ['none', 'porcentaje', 'monto'].includes(descuentoTipoNormalizado)
      ? descuentoTipoNormalizado
      : 'none';
    const descuentoValorNumerico = Number(descuento_valor ?? 0);

    if (!Number.isFinite(descuentoValorNumerico) || descuentoValorNumerico < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El descuento es inválido' });
    }

    if (descuentoTipo === 'porcentaje' && descuentoValorNumerico > 100) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El descuento porcentual no puede ser mayor a 100' });
    }

    let descuentoMonto = 0;
    if (descuentoTipo === 'porcentaje') {
      descuentoMonto = (subtotalBase * descuentoValorNumerico) / 100;
    } else if (descuentoTipo === 'monto') {
      descuentoMonto = descuentoValorNumerico;
    }

    if (descuentoMonto > subtotalBase) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El descuento no puede superar el subtotal de la cotización' });
    }

    const descuentoMontoFinal = Number(descuentoMonto.toFixed(2));
    const subtotalNeto = Number((subtotalBase - descuentoMontoFinal).toFixed(2));
    const impuestoMonto = Number((subtotalNeto * IVA_RATE).toFixed(2));
    const totalFinal = Number((subtotalNeto + impuestoMonto).toFixed(2));
    const montoCompromiso = subtotalNeto;

    const disponiblePresupuesto = Number(presupuesto.monto_total) - Number(presupuesto.monto_comprometido);
    const presupuestoTotal = Number(presupuesto.monto_total);
    const previoComprometido = Number(presupuesto.monto_comprometido);
    const nuevoComprometido = previoComprometido + montoCompromiso;
    const porcentajePrevio = presupuestoTotal > 0 ? (previoComprometido / presupuestoTotal) * 100 : 0;
    const porcentajeNuevo = presupuestoTotal > 0 ? (nuevoComprometido / presupuestoTotal) * 100 : 0;
    const umbral = Number(presupuesto.umbral_alerta);

    if (montoCompromiso > disponiblePresupuesto) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'La orden supera el presupuesto disponible del proyecto',
        disponible: Number(disponiblePresupuesto.toFixed(2)),
        solicitado: montoCompromiso
      });
    }

    let categoriaComprometidaId: number | null = null;
    if (cotizacion.presupuesto_categoria_id) {
      const { rows: [categoria] } = await client.query(
        `SELECT *
         FROM presupuesto_categorias
         WHERE id = $1 AND presupuesto_id = $2
         FOR UPDATE`,
        [cotizacion.presupuesto_categoria_id, presupuesto.id]
      );

      if (!categoria) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'La categoría presupuestaria asociada a la solicitud no existe' });
      }

      const disponibleCategoria = Number(categoria.monto_asignado) - Number(categoria.monto_comprometido);
      if (montoCompromiso > disponibleCategoria) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: 'La orden supera el presupuesto disponible de la categoría asignada',
          disponible: Number(disponibleCategoria.toFixed(2)),
          solicitado: montoCompromiso
        });
      }

      categoriaComprometidaId = categoria.id;
    }

    // 4. Crear la Orden de Compra
    const folioLimpio = typeof folio === 'string' ? folio.trim() : '';
    let orden: any;
    const { rows: [ordenCreada] } = await client.query(
      `INSERT INTO ordenes_compra (
          cotizacion_id, condiciones_pago, total, created_by_usuario_id,
          folio, descuento_tipo, descuento_valor, descuento_monto,
          subtotal_neto, impuesto_monto, total_final,
          plazo_entrega, condiciones_entrega, atencion_a, observaciones
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        cotizacion_id,
        condiciones_pago || 'Neto 30 días',
        montoCompromiso,
        req.user?.id || null,
        folioLimpio || null,
        descuentoTipo,
        descuentoTipo === 'none' ? 0 : Number(descuentoValorNumerico.toFixed(2)),
        descuentoMontoFinal,
        subtotalNeto,
        impuestoMonto,
        totalFinal,
        typeof plazo_entrega === 'string' ? plazo_entrega.trim() || null : null,
        typeof condiciones_entrega === 'string' ? condiciones_entrega.trim() || null : null,
        typeof atencion_a === 'string' ? atencion_a.trim() || null : null,
        typeof observaciones === 'string' ? observaciones.trim() || null : null,
      ]
    );
    orden = ordenCreada;

    if (!folioLimpio) {
      const folioGenerado = `OC-${String(orden.id).padStart(6, '0')}`;
      const { rows: [ordenConFolio] } = await client.query(
        `UPDATE ordenes_compra
         SET folio = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [folioGenerado, orden.id]
      );
      orden = ordenConFolio;
    }

    // 5. Comprometer monto en presupuesto del proyecto y categoria
    await client.query(
      `UPDATE presupuestos_proyecto
       SET monto_comprometido = monto_comprometido + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [montoCompromiso, presupuesto.id]
    );

    if (categoriaComprometidaId) {
      await client.query(
        `UPDATE presupuesto_categorias
         SET monto_comprometido = monto_comprometido + $1,
             updated_at = NOW()
         WHERE id = $2`,
        [montoCompromiso, categoriaComprometidaId]
      );
    }

    await client.query(
      `INSERT INTO presupuesto_movimientos
       (presupuesto_id, categoria_id, orden_compra_id, tipo, monto, descripcion, created_by)
       VALUES ($1, $2, $3, 'Compromiso', $4, $5, $6)`,
      [
        presupuesto.id,
        categoriaComprometidaId,
        orden.id,
        montoCompromiso,
        `Compromiso por creación de OC #${orden.id}`,
        req.user?.id || null,
      ]
    );

    const actorId = req.user?.id || null;
    const actorName = actorId ? await getActorDisplayName(actorId, client) : 'Sistema';
    const recipients = await resolveRecipientUserIds(
      {
        creatorUserId: cotizacion.created_by_usuario_id,
        roleNames: ['Director de Obra', 'Adquisiciones'],
        excludeUserId: actorId,
      },
      client
    );

    const notifications: NotificationInput[] = recipients.map(uid => ({
      usuario_destino_id: uid,
      tipo: 'orden.generada',
      titulo: 'Orden de compra generada',
      mensaje: `${actorName} generó la orden ${orden.folio} desde COT-${String(cotizacion.id).padStart(3, '0')} por $${montoCompromiso.toLocaleString('es-CL')}.`,
      entidad_tipo: 'orden',
      entidad_id: orden.id,
      payload: { cotizacion_id: cotizacion.id, total: montoCompromiso, folio: orden.folio },
      enviado_por_usuario_id: actorId,
    }));

    if (porcentajePrevio < 100 && porcentajeNuevo >= 100) {
      notifications.push(
        ...recipients.map(uid => ({
          usuario_destino_id: uid,
          tipo: 'presupuesto.sobreconsumo',
          titulo: 'Presupuesto excedido',
          mensaje: `El proyecto ${cotizacion.proyecto_nombre} alcanzó ${porcentajeNuevo.toFixed(1)}% de uso del presupuesto tras la OC-${String(orden.id).padStart(3, '0')}.`,
          entidad_tipo: 'presupuesto',
          entidad_id: presupuesto.id,
          payload: {
            proyecto_id: cotizacion.proyecto_id,
            porcentaje_uso: Number(porcentajeNuevo.toFixed(2)),
            umbral_alerta: umbral,
            estado_alerta: 'Sobreconsumo',
          },
          enviado_por_usuario_id: actorId,
        }))
      );
    } else if (porcentajePrevio < umbral && porcentajeNuevo >= umbral) {
      notifications.push(
        ...recipients.map(uid => ({
          usuario_destino_id: uid,
          tipo: 'presupuesto.umbral',
          titulo: 'Umbral de presupuesto alcanzado',
          mensaje: `El proyecto ${cotizacion.proyecto_nombre} alcanzó ${porcentajeNuevo.toFixed(1)}% de uso del presupuesto (umbral ${umbral}%).`,
          entidad_tipo: 'presupuesto',
          entidad_id: presupuesto.id,
          payload: {
            proyecto_id: cotizacion.proyecto_id,
            porcentaje_uso: Number(porcentajeNuevo.toFixed(2)),
            umbral_alerta: umbral,
            estado_alerta: 'Umbral alcanzado',
          },
          enviado_por_usuario_id: actorId,
        }))
      );
    }

    await createNotifications(notifications, client);

    // 6. Actualizar estado de la solicitud original a 'Aprobado'
    await client.query(
      `UPDATE solicitudes_material SET estado = 'Aprobado', updated_at = NOW()
       WHERE id = $1`,
      [cotizacion.solicitud_id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Orden de compra generada exitosamente',
      orden_compra: orden
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error al generar orden de compra:', error);
    if (error?.code === '23505' && String(error?.constraint || '').includes('folio')) {
      return res.status(409).json({ error: 'El folio ya existe. Usa otro valor.' });
    }
    res.status(500).json({ error: 'Error al generar la orden de compra' });
  } finally {
    client.release();
  }
});

// PATCH /api/ordenes/:id/entrega — Actualizar estado de entrega
router.patch('/:id/entrega', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { estado_entrega } = req.body;

    if (!['Pendiente', 'Recibido parcial', 'Completado'].includes(estado_entrega)) {
      return res.status(400).json({ error: 'Estado de entrega inválido' });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE ordenes_compra SET estado_entrega = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [estado_entrega, id]
    );

    if (!updated) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar entrega:', error);
    res.status(500).json({ error: 'Error al actualizar estado de entrega' });
  }
});

// GET /api/ordenes/:id/exportar — Exportar OC como HTML standalone (idéntico al frontend)
router.get('/:id/exportar', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { rows: [orden] } = await pool.query(`
      SELECT oc.*, c.proveedor, c.proveedor_id, c.solicitud_id, c.total AS cotizacion_total,
             sm.solicitante, sm.fecha AS fecha_solicitud, sm.estado AS solicitud_estado,
             p.nombre AS proyecto_nombre, p.ubicacion AS proyecto_ubicacion,
             p.numero_licitacion AS proyecto_numero_licitacion,
             pr.rut AS proveedor_rut,
             pr.razon_social AS proveedor_razon_social,
             pr.direccion AS proveedor_direccion,
             pr.telefono AS proveedor_telefono,
             pr.correo AS proveedor_correo,
             pr.contacto_nombre AS proveedor_contacto_nombre,
             pr.contacto_telefono AS proveedor_contacto_telefono,
             pr.contacto_correo AS proveedor_contacto_correo,
             CONCAT(u.nombre, ' ', u.apellido) AS autorizado_por_nombre
      FROM ordenes_compra oc
      JOIN cotizaciones c ON c.id = oc.cotizacion_id
      JOIN solicitudes_material sm ON sm.id = c.solicitud_id
      JOIN proyectos p ON p.id = sm.proyecto_id
      LEFT JOIN proveedores pr ON pr.id = c.proveedor_id
      LEFT JOIN usuarios u ON u.id = oc.created_by_usuario_id
      WHERE oc.id = $1
    `, [id]);

    if (!orden) {
      return res.status(404).json({ error: 'Orden de compra no encontrada' });
    }

    const { rows: items } = await pool.query(`
      SELECT ci.*, si.nombre_material, si.cantidad_requerida, si.unidad,
             m.sku AS material_sku
      FROM cotizacion_items ci
      JOIN solicitud_items si ON si.id = ci.solicitud_item_id
      LEFT JOIN materiales m ON m.id = si.material_id
      WHERE ci.cotizacion_id = $1
      ORDER BY ci.id
    `, [orden.cotizacion_id]);

    const html = buildOCHtml(orden, items);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${(orden.folio || 'OC-' + String(orden.id).padStart(6, '0')).replace(/[^a-zA-Z0-9\-_]/g, '_')}.html"`);
    res.send(html);
  } catch (error) {
    console.error('Error al exportar orden:', error);
    res.status(500).json({ error: 'Error al exportar orden de compra' });
  }
});

export default router;
