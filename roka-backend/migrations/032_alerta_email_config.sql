-- ================================================
-- Roka Construcciones — Configuración de Alertas de Email
-- ================================================
-- Módulo de configuración global de alertas por
-- fecha de entrega de solicitudes de material.
--
-- Tablas:
--   alerta_email_config → Configuración global del módulo
--   alerta_email_log    → Historial de alertas enviadas
-- ================================================

-- --------------------------------------------------
-- 1. Configuración global de alertas de fecha de entrega
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS alerta_email_config (
  id              SERIAL PRIMARY KEY,
  habilitada      BOOLEAN NOT NULL DEFAULT FALSE,
  umbral_tipo     VARCHAR(10) NOT NULL DEFAULT 'horas',  -- 'horas' | 'dias'
  umbral_valor    INTEGER NOT NULL DEFAULT 48,
  recordatorios_habilitados  BOOLEAN NOT NULL DEFAULT FALSE,
  recordatorios_cantidad      INTEGER NOT NULL DEFAULT 3,
  recordatorios_frecuencia_hs INTEGER NOT NULL DEFAULT 24,
  destinatarios_usuario_ids  INTEGER[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE alerta_email_config IS 'Configuración global de alertas de email por fecha de entrega de solicitudes';
COMMENT ON COLUMN alerta_email_config.habilitada IS 'Activar/desactivar el módulo de alertas';
COMMENT ON COLUMN alerta_email_config.umbral_tipo IS 'Unidad del umbral de anticipación: horas o dias';
COMMENT ON COLUMN alerta_email_config.umbral_valor IS 'Valor del umbral de anticipación antes de la fecha requerida';
COMMENT ON COLUMN alerta_email_config.recordatorios_habilitados IS 'Activar envío de recordatorios periódicos';
COMMENT ON COLUMN alerta_email_config.recordatorios_cantidad IS 'Número máximo de recordatorios a enviar';
COMMENT ON COLUMN alerta_email_config.recordatorios_frecuencia_hs IS 'Horas entre cada recordatorio';
COMMENT ON COLUMN alerta_email_config.destinatarios_usuario_ids IS 'Array de IDs de usuarios que reciben las alertas';

-- Seed inicial
INSERT INTO alerta_email_config (id, habilitada, umbral_tipo, umbral_valor, recordatorios_habilitados, recordatorios_cantidad, recordatorios_frecuencia_hs, destinatarios_usuario_ids)
VALUES (1, FALSE, 'horas', 48, FALSE, 3, 24, '{}')
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------
-- 2. Historial de alertas de fecha de entrega enviadas
-- --------------------------------------------------
CREATE TABLE IF NOT EXISTS alerta_email_log (
  id                  SERIAL PRIMARY KEY,
  solicitud_id        INTEGER NOT NULL REFERENCES solicitudes_material(id) ON DELETE CASCADE,
  usuario_destino_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo_alerta         VARCHAR(20) NOT NULL,  -- 'umbral' | 'recordatorio'
  numero_envio        INTEGER NOT NULL DEFAULT 1,
  enviado_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(solicitud_id, usuario_destino_id, tipo_alerta, numero_envio)
);

COMMENT ON TABLE alerta_email_log IS 'Historial de alertas de email enviadas por fecha de entrega';
COMMENT ON COLUMN alerta_email_log.solicitud_id IS 'Solicitud de material que disparó la alerta';
COMMENT ON COLUMN alerta_email_log.usuario_destino_id IS 'Usuario que recibió la alerta';
COMMENT ON COLUMN alerta_email_log.tipo_alerta IS 'Tipo de alerta: umbral (primer aviso) o recordatorio (re-envío)';
COMMENT ON COLUMN alerta_email_log.numero_envio IS 'Número de envío: 1 para umbral, 2+ para recordatorios';

CREATE INDEX IF NOT EXISTS idx_alerta_email_log_solicitud ON alerta_email_log(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_alerta_email_log_enviado ON alerta_email_log(enviado_at);
