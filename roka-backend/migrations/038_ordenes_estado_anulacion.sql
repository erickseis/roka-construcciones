-- 038: Agregar estado a ordenes_compra (Vigente / Anulada)
-- Permite anular OCs sin eliminar datos

ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'Vigente'
  CHECK (estado IN ('Vigente', 'Anulada'));

-- Actualizar OCs existentes
UPDATE ordenes_compra SET estado = 'Vigente' WHERE estado IS NULL;
