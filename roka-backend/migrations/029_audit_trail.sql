-- ================================================
-- Roka Construcciones — Auditoría y Trazabilidad
-- ================================================
-- Agrega columnas de auditoría (quién/cuándo) a las
-- tablas del flujo de compras:
--   solicitudes_material → aprobación, rechazo, cambio de estado
--   solicitud_cotizacion  → envío, respuesta, aprobación, rechazo
--   ordenes_compra        → cambio de estado de entrega
--
-- Todas las columnas son NULLABLE para no afectar
-- registros históricos existentes.
-- ================================================

-- --------------------------------------------------
-- 1. solicitudes_material
-- --------------------------------------------------
ALTER TABLE solicitudes_material
  ADD COLUMN IF NOT EXISTS aprobado_by_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprobado_at                   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rechazado_by_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rechazado_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estado_changed_by_usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado_changed_at             TIMESTAMPTZ;

COMMENT ON COLUMN solicitudes_material.aprobado_by_usuario_id       IS 'Usuario que aprueba la solicitud';
COMMENT ON COLUMN solicitudes_material.aprobado_at                   IS 'Timestamp de aprobación';
COMMENT ON COLUMN solicitudes_material.rechazado_by_usuario_id      IS 'Usuario que rechaza/anula la solicitud';
COMMENT ON COLUMN solicitudes_material.rechazado_at                  IS 'Timestamp de rechazo/anulación';
COMMENT ON COLUMN solicitudes_material.estado_changed_by_usuario_id IS 'Último usuario que cambió el estado (ej: Cotizando)';
COMMENT ON COLUMN solicitudes_material.estado_changed_at             IS 'Timestamp del último cambio de estado';

CREATE INDEX IF NOT EXISTS idx_solicitudes_aprobado_by  ON solicitudes_material(aprobado_by_usuario_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_rechazado_by ON solicitudes_material(rechazado_by_usuario_id);

-- --------------------------------------------------
-- 2. solicitud_cotizacion
-- --------------------------------------------------
ALTER TABLE solicitud_cotizacion
  ADD COLUMN IF NOT EXISTS enviado_by_usuario_id    INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS enviado_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS respondido_by_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS respondido_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aprobado_by_usuario_id   INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprobado_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rechazado_by_usuario_id  INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rechazado_at             TIMESTAMPTZ;

COMMENT ON COLUMN solicitud_cotizacion.enviado_by_usuario_id    IS 'Usuario que envía la SC al proveedor';
COMMENT ON COLUMN solicitud_cotizacion.enviado_at                IS 'Timestamp de envío al proveedor';
COMMENT ON COLUMN solicitud_cotizacion.respondido_by_usuario_id IS 'Usuario que marca como respondida / importa respuesta';
COMMENT ON COLUMN solicitud_cotizacion.respondido_at             IS 'Timestamp de respuesta';
COMMENT ON COLUMN solicitud_cotizacion.aprobado_by_usuario_id   IS 'Usuario que aprueba la SC (para futuro)';
COMMENT ON COLUMN solicitud_cotizacion.aprobado_at               IS 'Timestamp de aprobación';
COMMENT ON COLUMN solicitud_cotizacion.rechazado_by_usuario_id  IS 'Usuario que anula la SC';
COMMENT ON COLUMN solicitud_cotizacion.rechazado_at              IS 'Timestamp de anulación';

CREATE INDEX IF NOT EXISTS idx_sc_enviado_by    ON solicitud_cotizacion(enviado_by_usuario_id);
CREATE INDEX IF NOT EXISTS idx_sc_respondido_by ON solicitud_cotizacion(respondido_by_usuario_id);

-- --------------------------------------------------
-- 3. ordenes_compra
-- --------------------------------------------------
ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS entrega_updated_by_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS entrega_updated_at            TIMESTAMPTZ;

COMMENT ON COLUMN ordenes_compra.entrega_updated_by_usuario_id IS 'Usuario que cambió el estado de entrega';
COMMENT ON COLUMN ordenes_compra.entrega_updated_at             IS 'Timestamp del último cambio de estado de entrega';

CREATE INDEX IF NOT EXISTS idx_ordenes_entrega_updated_by ON ordenes_compra(entrega_updated_by_usuario_id);
