-- Migration 034: Store condiciones_pago and plazo_entrega from provider response
ALTER TABLE solicitud_cotizacion
  ADD COLUMN IF NOT EXISTS condiciones_pago_cov VARCHAR(300),
  ADD COLUMN IF NOT EXISTS plazo_entrega_cov VARCHAR(150);

COMMENT ON COLUMN solicitud_cotizacion.condiciones_pago_cov IS 'Condiciones de pago extraídas del documento del proveedor';
COMMENT ON COLUMN solicitud_cotizacion.plazo_entrega_cov IS 'Plazo de entrega extraído del documento del proveedor';
