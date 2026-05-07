-- ================================================
-- Roka Construcciones — Mejoras en Órdenes de Compra
-- ================================================
-- GAP-4: Campo autorizado_por_usuario_id en OC
-- GAP-7: Campo solicitud_id en OC para trazabilidad
-- GAP-8: Campo codigo_obra en OC
-- ================================================

-- GAP-4: Autorizado por
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS autorizado_por_usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL;

-- GAP-7: Solicitud_id para trazabilidad (vincula OC manual con solicitud de materiales)
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS solicitud_id INT REFERENCES solicitudes_material(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ordenes_solicitud ON ordenes_compra(solicitud_id);

-- GAP-8: Código de obra directo en OC
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS codigo_obra VARCHAR(60);