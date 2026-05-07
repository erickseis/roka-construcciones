-- Migration 020: Importación de cotizaciones desde archivo (PDF/Excel/Imagen)
-- Agrega columnas para trazabilidad de importación y datos del proveedor

-- 1. Agregar columnas a cotizaciones para trazabilidad de importación
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS numero_cov VARCHAR(50),
  ADD COLUMN IF NOT EXISTS imported_from_file BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS datos_importados JSONB,
  ADD COLUMN IF NOT EXISTS metodo_importacion VARCHAR(20) DEFAULT 'manual'
    CHECK (metodo_importacion IN ('manual', 'pdf', 'excel', 'imagen'));

COMMENT ON COLUMN cotizaciones.numero_cov IS 'N° de Cotización de Venta del proveedor (ej: C000067544)';
COMMENT ON COLUMN cotizaciones.imported_from_file IS 'Indica si la cotización fue creada desde importación de archivo';
COMMENT ON COLUMN cotizaciones.datos_importados IS 'JSON con metadata extraída del archivo: fecha_documento, vendedor, validez, condiciones_pago, condiciones_entrega, subtotal_neto, iva, total_documento';
COMMENT ON COLUMN cotizaciones.metodo_importacion IS 'Método de creación: manual, pdf, excel o imagen';

-- 2. Agregar columnas a cotizacion_items para descuentos y código proveedor
ALTER TABLE cotizacion_items
  ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_proveedor VARCHAR(50);

COMMENT ON COLUMN cotizacion_items.descuento_porcentaje IS 'Porcentaje de descuento por línea según archivo del proveedor';
COMMENT ON COLUMN cotizacion_items.codigo_proveedor IS 'Código/SKU del ítem según el proveedor (para matching con solicitud_items.codigo)';

-- 3. Índices para búsqueda
CREATE INDEX IF NOT EXISTS idx_cotizaciones_numero_cov ON cotizaciones(numero_cov) WHERE numero_cov IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_metodo_importacion ON cotizaciones(metodo_importacion);