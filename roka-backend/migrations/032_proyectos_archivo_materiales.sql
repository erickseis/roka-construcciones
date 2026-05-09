-- Agregar columnas para archivo Excel de materiales adjunto a proyectos
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS archivo_materiales_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS archivo_materiales_nombre VARCHAR(255);

COMMENT ON COLUMN proyectos.archivo_materiales_path IS 'Ruta del archivo Excel de materiales adjunto al proyecto';
COMMENT ON COLUMN proyectos.archivo_materiales_nombre IS 'Nombre original del archivo Excel de materiales';
