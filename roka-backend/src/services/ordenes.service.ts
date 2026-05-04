import pool from '../db';
import { GenerarOCInput } from '../types/orden.types';
import {
  getCotizacionForOC,
  checkExistingOC,
  createOrden,
  updateFolio,
} from '../models/ordenes.model';
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

const IVA_RATE = 0.19;

export async function generarOrdenCompra(input: GenerarOCInput, usuarioId: number | null) {
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
  } = input;

  if (!cotizacion_id) {
    throw Object.assign(new Error('Se requiere cotizacion_id'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar que la cotización existe y está aprobada
    const cotizacion = await getCotizacionForOC(cotizacion_id, client);
    if (!cotizacion) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Cotización no encontrada'), { statusCode: 404 });
    }
    if (cotizacion.estado !== 'Aprobada') {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('La cotización debe estar aprobada para generar una OC'), { statusCode: 400 });
    }

    // 2. Verificar que no exista OC duplicada
    const existingOCId = await checkExistingOC(cotizacion_id, client);
    if (existingOCId) {
      await client.query('ROLLBACK');
      throw Object.assign(
        new Error('Ya existe una orden de compra para esta cotización'),
        { statusCode: 409 }
      );
    }

    // 3. Validar presupuesto disponible del proyecto/categoria
    const { rows: [presupuesto] } = await client.query(
      `SELECT *
       FROM presupuestos_proyecto
       WHERE proyecto_id = $1 AND estado IN ('Vigente', 'Borrador')
       FOR UPDATE`,
      [cotizacion.proyecto_id]
    );

    if (!presupuesto) {
      await client.query('ROLLBACK');
      throw Object.assign(
        new Error('El proyecto no tiene presupuesto disponible para generar la OC'),
        { statusCode: 409 }
      );
    }

    const subtotalBase = Number(cotizacion.total);
    if (!Number.isFinite(subtotalBase) || subtotalBase <= 0) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('La cotización tiene un total inválido para generar la OC'), { statusCode: 400 });
    }

    const descuentoTipoNormalizado = String(descuento_tipo || 'none').toLowerCase();
    const descuentoTipo = ['none', 'porcentaje', 'monto'].includes(descuentoTipoNormalizado)
      ? descuentoTipoNormalizado
      : 'none';
    const descuentoValorNumerico = Number(descuento_valor ?? 0);

    if (!Number.isFinite(descuentoValorNumerico) || descuentoValorNumerico < 0) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('El descuento es inválido'), { statusCode: 400 });
    }

    if (descuentoTipo === 'porcentaje' && descuentoValorNumerico > 100) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('El descuento porcentual no puede ser mayor a 100'), { statusCode: 400 });
    }

    let descuentoMonto = 0;
    if (descuentoTipo === 'porcentaje') {
      descuentoMonto = (subtotalBase * descuentoValorNumerico) / 100;
    } else if (descuentoTipo === 'monto') {
      descuentoMonto = descuentoValorNumerico;
    }

    if (descuentoMonto > subtotalBase) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('El descuento no puede superar el subtotal de la cotización'), { statusCode: 400 });
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
      throw Object.assign(
        new Error('La orden supera el presupuesto disponible del proyecto'),
        { statusCode: 409 }
      );
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
        throw Object.assign(new Error('La categoría presupuestaria asociada a la solicitud no existe'), { statusCode: 409 });
      }

      const disponibleCategoria = Number(categoria.monto_asignado) - Number(categoria.monto_comprometido);
      if (montoCompromiso > disponibleCategoria) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('La orden supera el presupuesto disponible de la categoría asignada'), { statusCode: 409 });
      }

      categoriaComprometidaId = categoria.id;
    }

    // 4. Crear la Orden de Compra
    const folioLimpio = typeof folio === 'string' ? folio.trim() : '';
    const ordenCreada = await createOrden(
      {
        cotizacion_id,
        condiciones_pago: condiciones_pago || 'Neto 30 días',
        total: montoCompromiso,
        created_by_usuario_id: usuarioId,
        folio: folioLimpio || null,
        descuento_tipo: descuentoTipo,
        descuento_valor: descuentoTipo === 'none' ? 0 : Number(descuentoValorNumerico.toFixed(2)),
        descuento_monto: descuentoMontoFinal,
        subtotal_neto: subtotalNeto,
        impuesto_monto: impuestoMonto,
        total_final: totalFinal,
        plazo_entrega: typeof plazo_entrega === 'string' ? plazo_entrega.trim() || null : null,
        condiciones_entrega: typeof condiciones_entrega === 'string' ? condiciones_entrega.trim() || null : null,
        atencion_a: typeof atencion_a === 'string' ? atencion_a.trim() || null : null,
        observaciones: typeof observaciones === 'string' ? observaciones.trim() || null : null,
      },
      client
    );

    let orden = ordenCreada;

    if (!folioLimpio) {
      const folioGenerado = `OC-${String(orden.id).padStart(6, '0')}`;
      const ordenConFolio = await updateFolio(orden.id, folioGenerado, client);
      if (ordenConFolio) orden = ordenConFolio;
    }

    // 5. Comprometer monto en presupuesto del proyecto y categoria
    await commitPresupuesto(presupuesto.id, montoCompromiso, client);

    if (categoriaComprometidaId) {
      await commitCategoria(categoriaComprometidaId, montoCompromiso, client);
    }

    await insertMovimiento(
      {
        presupuesto_id: presupuesto.id,
        categoria_id: categoriaComprometidaId,
        orden_compra_id: orden.id,
        tipo: 'Compromiso',
        monto: montoCompromiso,
        descripcion: `Compromiso por creación de OC #${orden.id}`,
        created_by: usuarioId,
      },
      client
    );

    // 6. Notificaciones
    const actorId = usuarioId;
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
          entidad_tipo: 'presupuesto' as const,
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
          entidad_tipo: 'presupuesto' as const,
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

    // 7. Actualizar estado de la solicitud original a 'Aprobado'
    await client.query(
      `UPDATE solicitudes_material SET estado = 'Aprobado', updated_at = NOW()
       WHERE id = $1`,
      [cotizacion.solicitud_id]
    );

    await client.query('COMMIT');

    return {
      message: 'Orden de compra generada exitosamente',
      orden_compra: orden,
    };
  } catch (error: any) {
    await client.query('ROLLBACK');
    if (error?.code === '23505' && String(error?.constraint || '').includes('folio')) {
      throw Object.assign(new Error('El folio ya existe. Usa otro valor.'), { statusCode: 409 });
    }
    throw error;
  } finally {
    client.release();
  }
}
