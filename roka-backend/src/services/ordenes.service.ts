import pool from '../db';
import { GenerarOCInput } from '../types/orden.types';
import {
  getSolicitudCotizacionForOC,
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
import { isEventEnabled, sendEmail, getUserEmailById, buildSolicitudAprobadaHtml } from '../lib/email';

const IVA_RATE = 0.19;

export async function generarOrdenCompra(input: GenerarOCInput, usuarioId: number | null) {
  const {
    solicitud_cotizacion_id,
    condiciones_pago,
    folio,
    descuento_tipo,
    descuento_valor,
    plazo_entrega,
    condiciones_entrega,
    atencion_a,
    observaciones,
    autorizado_por_usuario_id,
    codigo_obra,
    numero_cov,
  } = input;

  if (!solicitud_cotizacion_id) {
    throw Object.assign(new Error('Se requiere solicitud_cotizacion_id'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar que la solicitud de cotización existe y está respondida
    const sc = await getSolicitudCotizacionForOC(solicitud_cotizacion_id, client);
    if (!sc) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Solicitud de cotización no encontrada'), { statusCode: 404 });
    }
    if (sc.estado !== 'Respondida') {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('La solicitud de cotización debe estar respondida para generar una OC'), { statusCode: 400 });
    }

    // 2. Verificar que no exista OC duplicada
    const existingOCId = await checkExistingOC(solicitud_cotizacion_id, client);
    if (existingOCId) {
      await client.query('ROLLBACK');
      throw Object.assign(
        new Error('Ya existe una orden de compra para esta solicitud de cotización'),
        { statusCode: 409 }
      );
    }

    // 3. Validar presupuesto disponible del proyecto/categoria
    const { rows: [presupuesto] } = await client.query(
      `SELECT *
       FROM presupuestos_proyecto
       WHERE proyecto_id = $1 AND estado IN ('Vigente', 'Borrador')
       FOR UPDATE`,
      [sc.proyecto_id]
    );

    // Presupuesto es opcional — si no existe, se genera OC sin comprometer

    const subtotalBase = Number(sc.total);
    if (!Number.isFinite(subtotalBase) || subtotalBase <= 0) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('La solicitud de cotización tiene un total inválido para generar la OC'), { statusCode: 400 });
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
      throw Object.assign(new Error('El descuento no puede superar el subtotal de la solicitud de cotización'), { statusCode: 400 });
    }

    const descuentoMontoFinal = Number(descuentoMonto.toFixed(2));
    const subtotalNeto = Number((subtotalBase - descuentoMontoFinal).toFixed(2));
    const impuestoMonto = Number((subtotalNeto * IVA_RATE).toFixed(2));
    const totalFinal = Number((subtotalNeto + impuestoMonto).toFixed(2));
    const montoCompromiso = subtotalNeto;

    let porcentajePrevio = 0;
    let porcentajeNuevo = 0;
    let umbral = 0;
    let categoriaComprometidaId: number | null = null;

    if (presupuesto) {
      const disponiblePresupuesto = Number(presupuesto.monto_total) - Number(presupuesto.monto_comprometido);
      const presupuestoTotal = Number(presupuesto.monto_total);
      const previoComprometido = Number(presupuesto.monto_comprometido);
      const nuevoComprometido = previoComprometido + montoCompromiso;
      porcentajePrevio = presupuestoTotal > 0 ? (previoComprometido / presupuestoTotal) * 100 : 0;
      porcentajeNuevo = presupuestoTotal > 0 ? (nuevoComprometido / presupuestoTotal) * 100 : 0;
      umbral = Number(presupuesto.umbral_alerta);

      if (montoCompromiso > disponiblePresupuesto) {
        await client.query('ROLLBACK');
        throw Object.assign(
          new Error('La orden supera el presupuesto disponible del proyecto'),
          { statusCode: 409 }
        );
      }

      if (sc.presupuesto_categoria_id) {
        const { rows: [categoria] } = await client.query(
          `SELECT *
           FROM presupuesto_categorias
           WHERE id = $1 AND presupuesto_id = $2
           FOR UPDATE`,
          [sc.presupuesto_categoria_id, presupuesto.id]
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
    }

    // 4. Crear la Orden de Compra
    const folioLimpio = typeof folio === 'string' ? folio.trim() : '';
    const folioTemporal = folioLimpio || `OC-TEMP-${Date.now()}`;
    const ordenCreada = await createOrden(
      {
        solicitud_cotizacion_id,
        condiciones_pago: condiciones_pago || 'Neto 30 días',
        total: montoCompromiso,
        created_by_usuario_id: usuarioId,
        autorizado_por_usuario_id: autorizado_por_usuario_id ?? null,
        solicitud_id: sc.solicitud_id ?? null,
        codigo_obra: codigo_obra ?? null,
        folio: folioTemporal,
        numero_cov: numero_cov ?? sc.numero_cov ?? null,
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

    // 4b. Insertar items desde solicitud_cotizacion_detalle a orden_compra_items
    const { rows: scItems } = await client.query(
      `SELECT scd.*, si.nombre_material, si.cantidad_requerida, si.unidad, si.codigo
       FROM solicitud_cotizacion_detalle scd
       JOIN solicitud_items si ON si.id = scd.solicitud_item_id
       WHERE scd.solicitud_cotizacion_id = $1 AND scd.precio_unitario IS NOT NULL`,
      [solicitud_cotizacion_id]
    );

    for (const item of scItems) {
      const cant = Number(item.cantidad_requerida);
      const punit = Number(item.precio_unitario);
      const descPct = Number(item.descuento_porcentaje || 0);
      const desc = descPct > 0 ? 1 - descPct / 100 : 1;
      const sub = Math.round(punit * cant * desc * 100) / 100;
      await client.query(
        `INSERT INTO orden_compra_items (orden_compra_id, nombre_material, cantidad, unidad, precio_unitario, subtotal, codigo, descuento_porcentaje)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [orden.id, item.nombre_material, cant, item.unidad, punit, sub, item.codigo_proveedor || item.codigo, descPct]
      );
    }

    // 5. Comprometer monto en presupuesto del proyecto y categoria (opcional)
    if (presupuesto) {
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
    }

    // 6. Notificaciones
    const actorId = usuarioId;
    const actorName = actorId ? await getActorDisplayName(actorId, client) : 'Sistema';
    const recipients = await resolveRecipientUserIds(
      {
        creatorUserId: sc.created_by_usuario_id,
        permissionCodes: ['ordenes.view', 'solicitudes.view'],
        excludeUserId: actorId,
      },
      client
    );

    const notifications: NotificationInput[] = recipients.map(uid => ({
      usuario_destino_id: uid,
      tipo: 'orden.generada',
      titulo: 'Orden de compra generada',
      mensaje: `${actorName} generó la orden ${orden.folio} desde SC-${String(sc.id).padStart(3, '0')}: Subtotal $${subtotalNeto.toLocaleString('es-CL')} + IVA 19% $${impuestoMonto.toLocaleString('es-CL')} = Total $${totalFinal.toLocaleString('es-CL')}.`,
      entidad_tipo: 'orden',
      entidad_id: orden.id,
      payload: { solicitud_cotizacion_id: sc.id, subtotal: subtotalNeto, impuesto: impuestoMonto, total: totalFinal, folio: orden.folio },
      enviado_por_usuario_id: actorId,
    }));

    if (presupuesto) {
      if (porcentajePrevio < 100 && porcentajeNuevo >= 100) {
        notifications.push(
          ...recipients.map(uid => ({
            usuario_destino_id: uid,
            tipo: 'presupuesto.sobreconsumo',
            titulo: 'Presupuesto excedido',
            mensaje: `El proyecto ${sc.proyecto_nombre} alcanzó ${porcentajeNuevo.toFixed(1)}% de uso del presupuesto tras la OC-${String(orden.id).padStart(3, '0')}.`,
            entidad_tipo: 'presupuesto' as const,
            entidad_id: presupuesto.id,
            payload: {
              proyecto_id: sc.proyecto_id,
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
            mensaje: `El proyecto ${sc.proyecto_nombre} alcanzó ${porcentajeNuevo.toFixed(1)}% de uso del presupuesto (umbral ${umbral}%).`,
            entidad_tipo: 'presupuesto' as const,
            entidad_id: presupuesto.id,
            payload: {
              proyecto_id: sc.proyecto_id,
              porcentaje_uso: Number(porcentajeNuevo.toFixed(2)),
              umbral_alerta: umbral,
              estado_alerta: 'Umbral alcanzado',
            },
            enviado_por_usuario_id: actorId,
          }))
        );
      }
    }

    // Notificación de solicitud aprobada
    const solicitudFolio = `SOL-${String(sc.solicitud_id).padStart(3, '0')}`;
    notifications.push(
      ...recipients.map(uid => ({
        usuario_destino_id: uid,
        tipo: 'solicitud.aprobada',
        titulo: 'Solicitud de materiales aprobada',
        mensaje: `${actorName} generó una OC desde SC-${String(sc.id).padStart(3, '0')}, aprobando la solicitud ${solicitudFolio} del proyecto ${sc.proyecto_nombre}.`,
        entidad_tipo: 'solicitud' as const,
        entidad_id: sc.solicitud_id,
        payload: {
          estado: 'Aprobado',
          proyecto_nombre: sc.proyecto_nombre,
          orden_id: orden.id,
        },
        enviado_por_usuario_id: actorId,
      }))
    );

    await createNotifications(notifications, client);

    // 7. Actualizar estado de la solicitud original a 'Aprobado'
    await client.query(
      `UPDATE solicitudes_material SET estado = 'Aprobado', updated_at = NOW()
       WHERE id = $1`,
      [sc.solicitud_id]
    );

    await client.query('COMMIT');

    // Fire-and-forget: email notificación solicitud aprobada
    isEventEnabled('solicitud.aprobada').then(async (enabled) => {
      if (!enabled || !sc.solicitud_id) return;
      const { rows: [sol] } = await pool.query(
        'SELECT created_by_usuario_id FROM solicitudes_material WHERE id = $1',
        [sc.solicitud_id]
      );
      if (!sol?.created_by_usuario_id) return;
      const correo = await getUserEmailById(sol.created_by_usuario_id);
      if (!correo) return;
      const html = buildSolicitudAprobadaHtml({
        solicitudId: sc.solicitud_id,
        proyectoNombre: sc.proyecto_nombre,
        ordenNumero: orden.folio || `OC-${String(orden.id).padStart(3, '0')}`,
        proveedorNombre: (sc as any).proveedor,
        total: totalFinal,
      });
      sendEmail({
        to: correo,
        subject: `Solicitud aprobada: SOL-${String(sc.solicitud_id).padStart(3, '0')}`,
        html,
        eventoCodigo: 'solicitud.aprobada',
        entidadTipo: 'solicitud',
        entidadId: sc.solicitud_id,
      }).catch(console.error);
    }).catch(console.error);

    return {
      message: `Orden de compra generada exitosamente: Subtotal $${subtotalNeto.toLocaleString('es-CL')} + IVA 19% $${impuestoMonto.toLocaleString('es-CL')} = Total $${totalFinal.toLocaleString('es-CL')}`,
      orden_compra: orden,
      subtotal_neto: subtotalNeto,
      impuesto: impuestoMonto,
      total_final: totalFinal,
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