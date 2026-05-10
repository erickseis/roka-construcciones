-- ================================================
-- Roka Construcciones — OC Manual (sin cotización)
-- ================================================

-- Hacer cotizacion_id nullable para OC manuales
ALTER TABLE ordenes_compra ALTER COLUMN cotizacion_id DROP NOT NULL;

-- Agregar columnas de proyecto y proveedor directo para OC manual
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS proyecto_id INT REFERENCES proyectos(id);
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS proveedor VARCHAR(200);
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS proveedor_rut VARCHAR(20);
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS proveedor_direccion VARCHAR(300);
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS proveedor_telefono VARCHAR(20);
ALTER TABLE ordenes_compra ADD COLUMN IF NOT EXISTS proveedor_correo VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_ordenes_proyecto ON ordenes_compra(proyecto_id);