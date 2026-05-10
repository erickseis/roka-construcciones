-- Garantizar que Administrador tiene todos los permisos del catálogo
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'Administrador'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Garantizar que roles operativos tienen los permisos de visibilidad de módulos
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('Director de Obra', 'Adquisiciones', 'Bodega')
  AND p.codigo IN (
    'dashboard.view', 'solicitudes.view', 'cotizaciones.view',
    'ordenes.view', 'proveedores.view', 'materiales.view',
    'proyectos.view', 'presupuestos.view'
  )
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
