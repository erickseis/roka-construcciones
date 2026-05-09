import pool from '../db';
import { ComprometerInput } from '../types/presupuesto.types';
import {
  getPresupuestoForUpdate,
  getCategoriaForUpdate,
  commitPresupuesto,
  commitCategoria,
  insertMovimiento,
} from '../models/presupuestos.model';
import {
  createNotifications,
  getActorDisplayName,
  resolveRecipientUserIds,
} from '../lib/notifications';

export async function comprometerPresupuesto(input: ComprometerInput, usuarioId: number | null) {
  const { presupuesto_id, categoria_id, monto, descripcion } = input;

  if (!presupuesto_id || !monto) {
    throw Object.assign(new Error('presupuesto_id y monto son requeridos'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const presupuesto = await getPresupuestoForUpdate(presupuesto_id, client);

    if (!presupuesto) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Presupuesto no encontrado'), { statusCode: 404 });
    }

    const disponible = Number(presupuesto.monto_total) - Number(presupuesto.monto_comprometido);
    const montoTotal = Number(presupuesto.monto_total);
    const comprometidoPrevio = Number(presupuesto.monto_comprometido);
    const comprometidoNuevo = comprometidoPrevio + Number(monto);
    const porcentajePrevio = montoTotal > 0 ? (comprometidoPrevio / montoTotal) * 100 : 0;
    const porcentajeNuevo = montoTotal > 0 ? (comprometidoNuevo / montoTotal) * 100 : 0;
    const umbral = Number(presupuesto.umbral_alerta);

    if (Number(monto) > disponible) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('El monto excede el disponible del presupuesto'), { statusCode: 409 });
    }

    if (categoria_id) {
      const categoria = await getCategoriaForUpdate(categoria_id, presupuesto_id, client);

      if (!categoria) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('Categoría no encontrada para este presupuesto'), { statusCode: 404 });
      }

      const disponibleCategoria = Number(categoria.monto_asignado) - Number(categoria.monto_comprometido);
      if (Number(monto) > disponibleCategoria) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error('El monto excede el disponible de la categoría'), { statusCode: 409 });
      }

      await commitCategoria(categoria_id, monto, client);
    }

    await commitPresupuesto(presupuesto_id, monto, client);

    await insertMovimiento(
      {
        presupuesto_id,
        categoria_id: categoria_id || null,
        tipo: 'Compromiso',
        monto: Number(monto),
        descripcion: descripcion || 'Compromiso manual de presupuesto',
        created_by: usuarioId,
      },
      client
    );

    const actorId = usuarioId;
    const actorName = actorId ? await getActorDisplayName(actorId, client) : 'Sistema';
    const crossedThreshold = porcentajePrevio < umbral && porcentajeNuevo >= umbral;
    const crossedExceeded = porcentajePrevio < 100 && porcentajeNuevo >= 100;

    if (crossedThreshold || crossedExceeded) {
      const recipients = await resolveRecipientUserIds(
        {
          permissionCodes: ['presupuestos.view'],
          excludeUserId: actorId,
        },
        client
      );

      const type = crossedExceeded ? 'presupuesto.sobreconsumo' : 'presupuesto.umbral';
      const title = crossedExceeded ? 'Presupuesto excedido' : 'Umbral de presupuesto alcanzado';
      const alertState = crossedExceeded ? 'Sobreconsumo' : 'Umbral alcanzado';

      await createNotifications(
        recipients.map(uid => ({
          usuario_destino_id: uid,
          tipo: type,
          titulo: title,
          mensaje: `${actorName} comprometió presupuesto y el proyecto ${presupuesto.proyecto_nombre} quedó con ${porcentajeNuevo.toFixed(1)}% de uso.`,
          entidad_tipo: 'presupuesto',
          entidad_id: presupuesto.id,
          payload: {
            proyecto_id: presupuesto.proyecto_id,
            porcentaje_uso: Number(porcentajeNuevo.toFixed(2)),
            umbral_alerta: umbral,
            estado_alerta: alertState,
          },
          enviado_por_usuario_id: actorId,
        })),
        client
      );
    }

    await client.query('COMMIT');
    return { message: 'Compromiso registrado correctamente' };
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
