-- 039: Agregar 'Anulada' a ordenes_compra.estado_entrega
-- y 'Observación' a solicitud_cotizacion.estado

ALTER TABLE ordenes_compra DROP CONSTRAINT IF EXISTS ordenes_compra_estado_entrega_check;
ALTER TABLE ordenes_compra ADD CONSTRAINT ordenes_compra_estado_entrega_check
  CHECK (estado_entrega IN ('Pendiente', 'Recibido parcial', 'Completado', 'Anulada'));

ALTER TABLE solicitud_cotizacion DROP CONSTRAINT IF EXISTS solicitud_cotizacion_estado_check;
ALTER TABLE solicitud_cotizacion ADD CONSTRAINT solicitud_cotizacion_estado_check
  CHECK (estado IN ('Borrador', 'Enviada', 'Respondida', 'Observación', 'Anulada'));
