-- Agregar campo is_active a roles para soft-delete
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Todos los roles existentes quedan activos
UPDATE roles SET is_active = true WHERE is_active IS NULL;
