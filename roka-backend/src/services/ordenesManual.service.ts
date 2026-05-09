import pool from '../db';
import * as ordenesModel from '../models/ordenes.model';
import {
  commitPresupuesto,
  commitCategoria,
  insertMovimiento,
} from '../models/presupuestos.model';
import {
  createNotifications,
  getActorDisplayName,
  NotificationInput,
  resolveRecipientUserIds,
} from '../lib/notifications';

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
  solicitud_id?: number;
  autorizado_por_usuario_id?: number | null;
  codigo_obra?: string;
}

export async function crearOCManual(input: CrearOCManualInput, usuarioId: number | null) {
  const {
    proyecto_id, proveedor, items, condiciones_pago, plazo_entrega,
    condiciones_entrega, atencion_a, observaciones,
    descuento_tipo, descuento_valor, folio,
    proveedor_rut, proveedor_direccion, proveedor_telefono, proveedor_correo,
    solicitud_id, autorizado_por_usuario_id, codigo_obra,
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
  const montoCompromiso = subtotalNeto;

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
        proveedor_telefono, proveedor_correo,
        created_by_usuario_id, autorizado_por_usuario_id,
        solicitud_id, codigo_obra
      ) VALUES (CURRENT_DATE, $1, 'Pendiente', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
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
        usuarioId, autorizado_por_usuario_id ?? null,
        solicitud_id || null, codigo_obra || null,
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

    // ── GAP-5: Comprometer presupuesto del proyecto ──
    let presupuestoComprometido = false;
    let porcentajePrevio = 0;
    let porcentajeNuevo = 0;
    let umbral = 0;
    let presupuestoId: number | null = null;

    const { rows: [presupuesto] } = await client.query(
      `SELECT *
       FROM presupuestos_proyecto
       WHERE proyecto_id = $1 AND estado IN ('Vigente', 'Borrador')
       FOR UPDATE`,
      [proyecto_id]
    );

    if (presupuesto) {
      const disponiblePresupuesto = Number(presupuesto.monto_total) - Number(presupuesto.monto_comprometido);
      const presupuestoTotal = Number(presupuesto.monto_total);
      const previoComprometido = Number(presupuesto.monto_comprometido);
      const nuevoComprometido = previoComprometido + montoCompromiso;
      porcentajePrevio = presupuestoTotal > 0 ? (previoComprometido / presupuestoTotal) * 100 : 0;
      porcentajeNuevo = presupuestoTotal > 0 ? (nuevoComprometido / presupuestoTotal) * 100 : 0;
      umbral = Number(presupuesto.umbral_alerta);
      presupuestoId = presupuesto.id;

      if (montoCompromiso > disponiblePresupuesto) {
        await client.query('ROLLBACK');
        throw Object.assign(
          new Error('La orden manual supera el presupuesto disponible del proyecto'),
          { statusCode: 409 }
        );
      }

      await commitPresupuesto(presupuesto.id, montoCompromiso, client);

      await insertMovimiento(
        {
          presupuesto_id: presupuesto.id,
          orden_compra_id: orden.id,
          tipo: 'Compromiso',
          monto: montoCompromiso,
          descripcion: `Compromiso por creación de OC manual #${orden.id}`,
          created_by: usuarioId,
        },
        client
      );

      presupuestoComprometido = true;
    }
    // Si no hay presupuesto, se permite la OC pero registramos advertencia en consola
    if (!presupuesto) {
      console.warn(`[OC Manual #${orden.id}] Proyecto ${proyecto_id} sin presupuesto — OC creada sin compromiso presupuestario.`);
    }

    // ── GAP-6: Notificaciones ──
    const actorId = usuarioId;
    const actorName = actorId ? await getActorDisplayName(actorId, client) : 'Sistema';

    // Obtener nombre del proyecto para notificaciones
    const { rows: [proyectoRow] } = await client.query(
      'SELECT nombre FROM proyectos WHERE id = $1',
      [proyecto_id]
    );
    const proyectoNombre = proyectoRow?.nombre || `Proyecto #${proyecto_id}`;

    const recipients = await resolveRecipientUserIds(
      {
        permissionCodes: ['ordenes.view'],
        excludeUserId: actorId,
      },
      client
    );

    const notifications: NotificationInput[] = recipients.map(uid => ({
      usuario_destino_id: uid,
      tipo: 'orden.generada',
      titulo: 'Orden de compra manual generada',
      mensaje: `${actorName} generó la orden manual ${orden.folio} para el proyecto ${proyectoNombre} por $${montoCompromiso.toLocaleString('es-CL')}.`,
      entidad_tipo: 'orden',
      entidad_id: orden.id,
      payload: { proyecto_id, total: montoCompromiso, folio: orden.folio, tipo: 'manual' },
      enviado_por_usuario_id: actorId,
    }));

    // Alertas de presupuesto
    if (presupuestoComprometido && presupuesto) {
      if (porcentajePrevio < 100 && porcentajeNuevo >= 100) {
        notifications.push(
          ...recipients.map(uid => ({
            usuario_destino_id: uid,
            tipo: 'presupuesto.sobreconsumo' as const,
            titulo: 'Presupuesto excedido',
            mensaje: `El proyecto ${proyectoNombre} alcanzó ${porcentajeNuevo.toFixed(1)}% de uso del presupuesto tras la OC manual ${orden.folio}.`,
            entidad_tipo: 'presupuesto' as const,
            entidad_id: presupuesto.id,
            payload: {
              proyecto_id,
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
            tipo: 'presupuesto.umbral' as const,
            titulo: 'Umbral de presupuesto alcanzado',
            mensaje: `El proyecto ${proyectoNombre} alcanzó ${porcentajeNuevo.toFixed(1)}% de uso del presupuesto (umbral ${umbral}%).`,
            entidad_tipo: 'presupuesto' as const,
            entidad_id: presupuesto.id,
            payload: {
              proyecto_id,
              porcentaje_uso: Number(porcentajeNuevo.toFixed(2)),
              umbral_alerta: umbral,
              estado_alerta: 'Umbral alcanzado',
            },
            enviado_por_usuario_id: actorId,
          }))
        );
      }
    }

    await createNotifications(notifications, client);

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