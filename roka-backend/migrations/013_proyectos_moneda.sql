-- ================================================
-- Roka Construcciones — Campo Moneda en Proyectos
-- ================================================

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS moneda VARCHAR(10) DEFAULT 'CLP';

CREATE INDEX IF NOT EXISTS idx_proyectos_moneda ON proyectos(moneda);