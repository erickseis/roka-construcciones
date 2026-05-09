import pool from '../db';
import {
  sendEmail,
  buildAlertaFechaEntregaHtml,
  getUserEmailById,
} from './email';

// Intervalo configurable por variable de entorno (default 30 minutos)
const POLL_INTERVAL_MS = parseInt(
  process.env.ALERT_EMAIL_INTERVAL_MS || '1800000',
  10
);

let schedulerStarted = false;

interface AlertaConfig {
  id: number;
  habilitada: boolean;
  umbral_tipo: 'horas' | 'dias';
  umbral_valor: number;
  recordatorios_habilitados: boolean;
  recordatorios_cantidad: number;
  recordatorios_frecuencia_hs: number;
  destinatarios_usuario_ids: number[];
}

interface SolicitudEnVentana {
  id: number;
  solicitante: string;
  fecha_requerida: string;
  estado: string;
  proyecto_id: number;
  proyecto_nombre: string;
}

export function startAlertScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  console.log(
    `[AlertasEmail] Scheduler iniciado — intervalo: ${POLL_INTERVAL_MS / 60000} minutos`
  );

  const poll = async () => {
    try {
      // 1. Leer configuración
      const { rows } = await pool.query(
        'SELECT * FROM alerta_email_config WHERE id = 1'
      );
      const config: AlertaConfig | undefined = rows[0];

      if (!config || !config.habilitada) {
        return; // Módulo deshabilitado
      }

      if (
        !config.destinatarios_usuario_ids ||
        config.destinatarios_usuario_ids.length === 0
      ) {
        return; // Sin destinatarios configurados
      }

      // 2. Calcular ventana de tiempo
      const now = new Date();
      let windowDate: Date;
      if (config.umbral_tipo === 'dias') {
        windowDate = new Date(
          now.getTime() + config.umbral_valor * 24 * 60 * 60 * 1000
        );
      } else {
        windowDate = new Date(
          now.getTime() + config.umbral_valor * 60 * 60 * 1000
        );
      }

      const nowStr = now.toISOString().split('T')[0];
      const windowStr = windowDate.toISOString().split('T')[0];

      // 3. Buscar solicitudes cuya fecha_requerida está en la ventana
      const { rows: solicitudes } = await pool.query(
        `SELECT sm.id, sm.solicitante, sm.fecha_requerida, sm.estado,
                sm.proyecto_id, p.nombre AS proyecto_nombre
         FROM solicitudes_material sm
         JOIN proyectos p ON p.id = sm.proyecto_id
         WHERE sm.estado IN ('Pendiente', 'Cotizando')
           AND sm.fecha_requerida IS NOT NULL
           AND sm.fecha_requerida >= $1::date
           AND sm.fecha_requerida <= $2::date
         ORDER BY sm.fecha_requerida ASC`,
        [nowStr, windowStr]
      );

      if (!solicitudes.length) return;

      // 4. Para cada solicitud, procesar alertas por usuario destinatario
      for (const sol of solicitudes as SolicitudEnVentana[]) {
        for (const userId of config.destinatarios_usuario_ids) {
          await processAlertaForUser(sol, userId, config);
        }
      }
    } catch (err) {
      console.error('[AlertasEmail] Error en ciclo de verificación:', err);
    }
  };

  // Ejecutar al inicio y luego en cada intervalo
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
}

async function processAlertaForUser(
  sol: SolicitudEnVentana,
  userId: number,
  config: AlertaConfig
): Promise<void> {
  try {
    // Verificar si ya existe alerta tipo 'umbral' (numero_envio=1, tipo='umbral')
    const { rows: existingUmbral } = await pool.query(
      `SELECT id FROM alerta_email_log
       WHERE solicitud_id = $1 AND usuario_destino_id = $2
         AND tipo_alerta = 'umbral' AND numero_envio = 1`,
      [sol.id, userId]
    );

    if (existingUmbral.length === 0) {
      // No se ha enviado alerta umbral → enviar
      await sendAlertaEmail(sol, userId, 'umbral', 1);
    }

    // Si recordatorios habilitados, verificar si corresponde enviar
    if (config.recordatorios_habilitados && config.recordatorios_cantidad > 0) {
      const { rows: recordatorios } = await pool.query(
        `SELECT numero_envio, enviado_at FROM alerta_email_log
         WHERE solicitud_id = $1 AND usuario_destino_id = $2
           AND tipo_alerta = 'recordatorio'
         ORDER BY numero_envio DESC`,
        [sol.id, userId]
      );

      const count = recordatorios.length;

      if (count < config.recordatorios_cantidad) {
        let debeEnviar = false;

        if (count === 0) {
          // Sin recordatorios — verificar tiempo desde la alerta umbral
          const { rows: [umbralRow] } = await pool.query(
            `SELECT enviado_at FROM alerta_email_log
             WHERE solicitud_id = $1 AND usuario_destino_id = $2
               AND tipo_alerta = 'umbral' AND numero_envio = 1
             ORDER BY enviado_at DESC LIMIT 1`,
            [sol.id, userId]
          );
          if (umbralRow) {
            const tiempoDesdeUmbral =
              Date.now() - new Date(umbralRow.enviado_at).getTime();
            if (
              tiempoDesdeUmbral >=
              config.recordatorios_frecuencia_hs * 60 * 60 * 1000
            ) {
              debeEnviar = true;
            }
          } else {
            // Caso borde: sin umbral ni recordatorio (no debería ocurrir normalmente)
            debeEnviar = true;
          }
        } else {
          // Verificar tiempo desde el último recordatorio
          const ultimoEnvio = new Date(recordatorios[0].enviado_at).getTime();
          const tiempoDesdeUltimo = Date.now() - ultimoEnvio;
          if (
            tiempoDesdeUltimo >=
            config.recordatorios_frecuencia_hs * 60 * 60 * 1000
          ) {
            debeEnviar = true;
          }
        }

        if (debeEnviar) {
          await sendAlertaEmail(sol, userId, 'recordatorio', count + 1);
        }
      }
    }
  } catch (err) {
    console.error(
      `[AlertasEmail] Error procesando alerta solicitud ${sol.id} usuario ${userId}:`,
      err
    );
  }
}

async function sendAlertaEmail(
  sol: SolicitudEnVentana,
  userId: number,
  tipoAlerta: 'umbral' | 'recordatorio',
  numeroEnvio: number
): Promise<void> {
  const email = await getUserEmailById(userId);
  if (!email) {
    console.warn(
      `[AlertasEmail] Usuario ID ${userId} sin correo — omitiendo`
    );
    return;
  }

  const fechaRequeridaStr = sol.fecha_requerida
    ? new Date(sol.fecha_requerida).toISOString().split('T')[0]
    : undefined;

  const html = buildAlertaFechaEntregaHtml({
    solicitudId: sol.id,
    solicitante: sol.solicitante,
    proyectoNombre: sol.proyecto_nombre,
    fechaRequerida: fechaRequeridaStr,
    estado: sol.estado,
    tipoAlerta,
    numeroEnvio,
  });

  const folio = `SOL-${String(sol.id).padStart(3, '0')}`;
  const tipoLabel =
    tipoAlerta === 'umbral'
      ? 'Alerta de fecha próxima'
      : `Recordatorio #${numeroEnvio}`;

  try {
    await sendEmail({
      to: email,
      subject: `${tipoLabel} — Solicitud ${folio}`,
      html,
      eventoCodigo: 'alerta.fecha_entrega',
      entidadTipo: 'solicitud',
      entidadId: sol.id,
    });

    // Registrar en log; ON CONFLICT DO NOTHING para evitar errores de concurrencia
    await pool.query(
      `INSERT INTO alerta_email_log
         (solicitud_id, usuario_destino_id, tipo_alerta, numero_envio)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (solicitud_id, usuario_destino_id, tipo_alerta, numero_envio)
       DO NOTHING`,
      [sol.id, userId, tipoAlerta, numeroEnvio]
    );
  } catch (err: any) {
    // Si falla por violación de unicidad, es esperado (otra instancia ganó la carrera)
    if (err.code === '23505') {
      return;
    }
    console.error(
      `[AlertasEmail] Error enviando email a ${email} (solicitud ${sol.id}):`,
      err
    );
  }
}
