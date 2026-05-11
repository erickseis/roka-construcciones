-- Migration 037: Add global discount percentage at SC level
-- Applied on top of items subtotals after individual item discounts.
ALTER TABLE solicitud_cotizacion
  ADD COLUMN IF NOT EXISTS descuento_global_cov DECIMAL(5,2) DEFAULT 0;

COMMENT ON COLUMN solicitud_cotizacion.descuento_global_cov IS 'Porcentaje de descuento global aplicado al subtotal de la cotización del proveedor (0-100)';
