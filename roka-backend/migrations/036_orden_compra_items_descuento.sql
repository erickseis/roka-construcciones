-- ================================================
-- Migration 036: Agregar descuento por línea en items de OC
-- ================================================
-- Propósito:
--   1. Agregar columna descuento_porcentaje a orden_compra_items
--   2. Hacer backfill desde solicitud_cotizacion_detalle para
--      items que provienen de una cotización con respuesta del proveedor
-- ================================================

-- 1. Agregar columna de descuento por línea
ALTER TABLE orden_compra_items
  ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) DEFAULT 0;

COMMENT ON COLUMN orden_compra_items.descuento_porcentaje IS 'Porcentaje de descuento por línea proveniente de la cotización del proveedor';

-- 2. Backfill: copiar descuento_porcentaje desde solicitud_cotizacion_detalle
--    para los items de OC que tienen un solicitud_cotizacion_id vinculado
UPDATE orden_compra_items oci
SET descuento_porcentaje = COALESCE(scd.descuento_porcentaje, 0)
FROM ordenes_compra oc
JOIN solicitud_cotizacion sc ON sc.id = oc.solicitud_cotizacion_id
JOIN solicitud_cotizacion_detalle scd ON scd.solicitud_cotizacion_id = sc.id
JOIN solicitud_items si ON si.id = scd.solicitud_item_id
WHERE oci.orden_compra_id = oc.id
  AND oci.nombre_material = si.nombre_material
  AND scd.precio_unitario IS NOT NULL;
