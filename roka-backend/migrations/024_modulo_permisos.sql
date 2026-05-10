-- Permisos de visibilidad de módulos del sidebar
INSERT INTO permisos (codigo, descripcion) VALUES
  ('dashboard.view', 'Ver Dashboard'),
  ('solicitudes.view', 'Ver Solicitudes de Materiales'),
  ('cotizaciones.view', 'Ver Solicitudes de Cotización'),
  ('ordenes.view', 'Ver Órdenes de Compra'),
  ('proveedores.view', 'Ver Proveedores'),
  ('materiales.view', 'Ver Catálogo de Materiales')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar todos los permisos de módulos al rol Administrador
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'Administrador'
  AND p.codigo IN ('dashboard.view', 'solicitudes.view', 'cotizaciones.view', 'ordenes.view', 'proveedores.view', 'materiales.view')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Asignar permisos de módulos a roles operativos (Director de Obra, Adquisiciones, Bodega)
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('Director de Obra', 'Adquisiciones', 'Bodega')
  AND p.codigo IN ('dashboard.view', 'solicitudes.view', 'cotizaciones.view', 'ordenes.view', 'proveedores.view', 'materiales.view')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
