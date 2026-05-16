-- Agregar campo numero_obra a proyectos (obligatorio para nuevos proyectos)
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS numero_obra VARCHAR(100);

-- Para proyectos existentes que no tienen numero_obra, usar el numero_licitacion como fallback
UPDATE proyectos SET numero_obra = numero_licitacion WHERE numero_obra IS NULL AND numero_licitacion IS NOT NULL;

-- Para proyectos existentes sin numero_licitacion ni numero_obra, asignar un valor default
UPDATE proyectos SET numero_obra = 'OBRA-' || id WHERE numero_obra IS NULL;
