-- Permiso para ver TODAS las solicitudes (sin este permiso, el usuario solo ve las propias)
INSERT INTO permisos (codigo, descripcion) VALUES
  ('solicitudes.view_all', 'Ver todas las solicitudes de materiales (sin este permiso solo ve las propias)')
ON CONFLICT (codigo) DO NOTHING;

-- Asignar a roles que deben ver todas las solicitudes
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('Administrador', 'Director de Obra', 'Adquisiciones')
  AND p.codigo = 'solicitudes.view_all'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
