import { withTransaction } from '../lib/db-utils';
import { BadRequest, NotFound, Conflict } from '../lib/errors';
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
    throw BadRequest('presupuesto_id y monto son requeridos');
  }

  return withTransaction(async (client) => {
    const presupuesto = await getPresupuestoForUpdate(presupuesto_id, client);

    if (!presupuesto) {
      throw NotFound('Presupuesto no encontrado');
    }

    const disponible = Number(presupuesto.monto_total) - Number(presupuesto.monto_comprometido);
    const montoTotal = Number(presupuesto.monto_total);
    const comprometidoPrevio = Number(presupuesto.monto_comprometido);
    const comprometidoNuevo = comprometidoPrevio + Number(monto);
    const porcentajePrevio = montoTotal > 0 ? (comprometidoPrevio / montoTotal) * 100 : 0;
    const porcentajeNuevo = montoTotal > 0 ? (comprometidoNuevo / montoTotal) * 100 : 0;
    const umbral = Number(presupuesto.umbral_alerta);

    if (Number(monto) > disponible) {
      throw Conflict('El monto excede el disponible del presupuesto');
    }

    if (categoria_id) {
      const categoria = await getCategoriaForUpdate(categoria_id, presupuesto_id, client);

      if (!categoria) {
        throw NotFound('Categoría no encontrada para este presupuesto');
      }

      const disponibleCategoria = Number(categoria.monto_asignado) - Number(categoria.monto_comprometido);
      if (Number(monto) > disponibleCategoria) {
        throw Conflict('El monto excede el disponible de la categoría');
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

    return { message: 'Compromiso registrado correctamente' };
  });
}
