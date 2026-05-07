-- Flexibilizar llaves foráneas para permitir borrado lógico y actualizaciones en solicitudes_material
ALTER TABLE solicitud_cotizacion DROP CONSTRAINT IF EXISTS solicitud_cotizacion_solicitud_id_fkey;
ALTER TABLE solicitud_cotizacion ADD CONSTRAINT solicitud_cotizacion_solicitud_id_fkey 
  FOREIGN KEY (solicitud_id) REFERENCES solicitudes_material(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Asegurar que la tabla solicitudes_material permita el estado 'Anulada'
ALTER TABLE solicitudes_material DROP CONSTRAINT IF EXISTS solicitudes_material_estado_check;
ALTER TABLE solicitudes_material ADD CONSTRAINT solicitudes_material_estado_check 
  CHECK (estado IN ('Pendiente', 'Cotizando', 'Aprobado', 'Anulada'));
