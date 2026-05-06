import pool from '../db';
import * as ordenesModel from '../models/ordenes.model';

interface CrearOCManualInput {
  proyecto_id: number;
  proveedor: string;
  proveedor_rut?: string;
  proveedor_direccion?: string;
  proveedor_telefono?: string;
  proveedor_correo?: string;
  items: {
    nombre_material: string;
    cantidad: number;
    unidad: string;
    precio_unitario: number;
    codigo?: string;
  }[];
  condiciones_pago?: string;
  plazo_entrega?: string;
  condiciones_entrega?: string;
  atencion_a?: string;
  observaciones?: string;
  descuento_tipo?: string;
  descuento_valor?: number;
  folio?: string;
}

export async function crearOCManual(input: CrearOCManualInput, usuarioId: number | null) {
  const {
    proyecto_id, proveedor, items, condiciones_pago, plazo_entrega,
    condiciones_entrega, atencion_a, observaciones,
    descuento_tipo, descuento_valor, folio,
    proveedor_rut, proveedor_direccion, proveedor_telefono, proveedor_correo,
  } = input;

  if (!proyecto_id) {
    throw Object.assign(new Error('Se requiere proyecto_id'), { statusCode: 400 });
  }
  if (!proveedor) {
    throw Object.assign(new Error('Se requiere el nombre del proveedor'), { statusCode: 400 });
  }
  if (!items || items.length === 0) {
    throw Object.assign(new Error('Se requiere al menos un ítem'), { statusCode: 400 });
  }

  const IVA_RATE = 0.19;

  let subtotalBase = 0;
  const itemsData = items.map((it) => {
    const total = Number(it.cantidad) * Number(it.precio_unitario);
    subtotalBase += total;
    return {
      nombre_material: it.nombre_material,
      cantidad: Number(it.cantidad),
      unidad: it.unidad,
      precio_unitario: Number(it.precio_unitario),
      subtotal: total,
      codigo: it.codigo || null,
    };
  });

  const descuentoTipoNormalizado = String(descuento_tipo || 'none').toLowerCase();
  const descuentoTipo = ['none', 'porcentaje', 'monto'].includes(descuentoTipoNormalizado)
    ? descuentoTipoNormalizado
    : 'none';
  const descuentoValorNumerico = Number(descuento_valor ?? 0);

  let descuentoMonto = 0;
  if (descuentoTipo === 'porcentaje') {
    descuentoMonto = (subtotalBase * descuentoValorNumerico) / 100;
  } else if (descuentoTipo === 'monto') {
    descuentoMonto = descuentoValorNumerico;
  }

  const subtotalNeto = subtotalBase - descuentoMonto;
  const impuestoMonto = Math.round(subtotalNeto * IVA_RATE * 100) / 100;
  const totalFinal = subtotalNeto + impuestoMonto;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const folioFinal = folio || `OC-MAN-${Date.now()}`;

    const ordenResult = await client.query(
      `INSERT INTO ordenes_compra (
        fecha_emision, condiciones_pago, estado_entrega,
        total, folio, subtotal_neto, impuesto_monto, total_final,
        descuento_tipo, descuento_valor, descuento_monto,
        plazo_entrega, condiciones_entrega, atencion_a, observaciones,
        proyecto_id, proveedor, proveedor_rut, proveedor_direccion,
        proveedor_telefono, proveedor_correo
      ) VALUES (CURRENT_DATE, $1, 'Pendiente', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        condiciones_pago || 'Contado', totalFinal, folioFinal,
        subtotalNeto, impuestoMonto, totalFinal,
        descuentoTipo, descuentoValorNumerico, descuentoMonto,
        plazo_entrega || null, condiciones_entrega || null,
        atencion_a || null, observaciones || null,
        proyecto_id, proveedor,
        proveedor_rut || null, proveedor_direccion || null,
        proveedor_telefono || null, proveedor_correo || null,
      ]
    );

    const orden = ordenResult.rows[0];

    for (const item of itemsData) {
      await client.query(
        `INSERT INTO orden_compra_items (orden_compra_id, nombre_material, cantidad, unidad, precio_unitario, subtotal, codigo)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [orden.id, item.nombre_material, item.cantidad, item.unidad, item.precio_unitario, item.subtotal, item.codigo]
      );
    }

    await client.query('COMMIT');

    const createdOrden = await ordenesModel.getOrdenById(orden.id);
    return createdOrden || orden;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
