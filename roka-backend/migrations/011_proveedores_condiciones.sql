-- ================================================
-- Roka Construcciones — Condiciones Comerciales Proveedores
-- ================================================

ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS condiciones_pago VARCHAR(100);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS condicion_despacho VARCHAR(100);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS plazo_entrega VARCHAR(50);
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'CLP';

CREATE INDEX IF NOT EXISTS idx_proveedores_moneda ON proveedores(moneda);