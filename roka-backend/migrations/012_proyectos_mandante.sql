-- ================================================
-- Roka Construcciones — Campo Mandante en Proyectos
-- ================================================

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS mandante VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_proyectos_mandante ON proyectos(mandante);