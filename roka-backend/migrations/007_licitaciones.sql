-- Migration 007: Add licitaciones (tender) fields to proyectos
-- Adds support for storing tender/licitacion metadata and attachments

ALTER TABLE proyectos
  ADD COLUMN numero_licitacion VARCHAR(100),
  ADD COLUMN descripcion_licitacion TEXT,
  ADD COLUMN fecha_apertura_licitacion DATE,
  ADD COLUMN monto_referencial_licitacion DECIMAL(14,2),
  ADD COLUMN archivo_licitacion_path VARCHAR(500),
  ADD COLUMN archivo_licitacion_nombre VARCHAR(255);
