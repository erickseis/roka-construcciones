-- Agregar created_by_usuario_id a presupuestos_proyecto
ALTER TABLE presupuestos_proyecto
  ADD COLUMN IF NOT EXISTS created_by_usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

COMMENT ON COLUMN presupuestos_proyecto.created_by_usuario_id IS 'Usuario que creó el presupuesto';

CREATE INDEX IF NOT EXISTS idx_presupuestos_created_by ON presupuestos_proyecto(created_by_usuario_id);
