-- ================================================
-- Roka Construcciones — Notificaciones In-App
-- ================================================

-- 1) Trazabilidad de creador en entidades de flujo
ALTER TABLE solicitudes_material
  ADD COLUMN IF NOT EXISTS created_by_usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS created_by_usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL;

ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS created_by_usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_created_by ON solicitudes_material(created_by_usuario_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_created_by ON cotizaciones(created_by_usuario_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_created_by ON ordenes_compra(created_by_usuario_id);

-- 2) Notificaciones por usuario destino
CREATE TABLE IF NOT EXISTS notificaciones (
  id SERIAL PRIMARY KEY,
  usuario_destino_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo VARCHAR(80) NOT NULL,
  titulo VARCHAR(180) NOT NULL,
  mensaje TEXT NOT NULL,
  entidad_tipo VARCHAR(50),
  entidad_id INT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  enviado_por_usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  leida BOOLEAN NOT NULL DEFAULT FALSE,
  leida_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_fecha ON notificaciones(usuario_destino_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida ON notificaciones(usuario_destino_id, leida);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones(tipo);

-- 3) Permisos del módulo
INSERT INTO permisos (codigo, descripcion)
VALUES ('notificaciones.view', 'Ver notificaciones in-app')
ON CONFLICT (codigo) DO NOTHING;

-- Admin y roles operativos con acceso de lectura
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo = 'notificaciones.view'
WHERE r.nombre IN ('Administrador', 'Director de Obra', 'Adquisiciones', 'Bodega')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
