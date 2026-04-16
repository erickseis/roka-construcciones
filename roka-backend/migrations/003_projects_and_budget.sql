-- ================================================
-- Roka Construcciones — Proyectos y Presupuesto
-- ================================================

-- 1) Extensiones para Proyectos
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS fecha_inicio DATE,
  ADD COLUMN IF NOT EXISTS fecha_fin DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Responsable opcional del proyecto (usuario)
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS responsable_usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_estado ON proyectos(estado);
CREATE INDEX IF NOT EXISTS idx_proyectos_active ON proyectos(is_active);

-- 2) Presupuesto por proyecto
CREATE TABLE IF NOT EXISTS presupuestos_proyecto (
  id SERIAL PRIMARY KEY,
  proyecto_id INT NOT NULL UNIQUE REFERENCES proyectos(id) ON DELETE CASCADE,
  monto_total DECIMAL(14,2) NOT NULL CHECK (monto_total > 0),
  monto_comprometido DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (monto_comprometido >= 0),
  umbral_alerta DECIMAL(5,2) NOT NULL DEFAULT 80 CHECK (umbral_alerta > 0 AND umbral_alerta <= 100),
  estado VARCHAR(30) NOT NULL DEFAULT 'Vigente'
    CHECK (estado IN ('Borrador', 'Vigente', 'Cerrado')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_presupuestos_proyecto ON presupuestos_proyecto(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado ON presupuestos_proyecto(estado);

-- 3) Categorias del presupuesto
CREATE TABLE IF NOT EXISTS presupuesto_categorias (
  id SERIAL PRIMARY KEY,
  presupuesto_id INT NOT NULL REFERENCES presupuestos_proyecto(id) ON DELETE CASCADE,
  nombre VARCHAR(120) NOT NULL,
  monto_asignado DECIMAL(14,2) NOT NULL CHECK (monto_asignado > 0),
  monto_comprometido DECIMAL(14,2) NOT NULL DEFAULT 0 CHECK (monto_comprometido >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (presupuesto_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_categoria_presupuesto ON presupuesto_categorias(presupuesto_id);

-- 4) Movimientos de ejecucion presupuestaria
CREATE TABLE IF NOT EXISTS presupuesto_movimientos (
  id SERIAL PRIMARY KEY,
  presupuesto_id INT NOT NULL REFERENCES presupuestos_proyecto(id) ON DELETE CASCADE,
  categoria_id INT REFERENCES presupuesto_categorias(id) ON DELETE SET NULL,
  orden_compra_id INT UNIQUE REFERENCES ordenes_compra(id) ON DELETE SET NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Compromiso', 'Ajuste')),
  monto DECIMAL(14,2) NOT NULL,
  descripcion TEXT,
  created_by INT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_presupuesto ON presupuesto_movimientos(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_mov_orden ON presupuesto_movimientos(orden_compra_id);

-- 5) Vincular Solicitudes a categoria presupuestaria (opcional)
ALTER TABLE solicitudes_material
  ADD COLUMN IF NOT EXISTS presupuesto_categoria_id INT REFERENCES presupuesto_categorias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_solicitudes_categoria_presupuesto ON solicitudes_material(presupuesto_categoria_id);

-- 6) Base para permisos parametrizables por rol
CREATE TABLE IF NOT EXISTS permisos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(80) UNIQUE NOT NULL,
  descripcion VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS rol_permisos (
  id SERIAL PRIMARY KEY,
  rol_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id INT NOT NULL REFERENCES permisos(id) ON DELETE CASCADE,
  UNIQUE (rol_id, permiso_id)
);

-- Permisos iniciales de modulos
INSERT INTO permisos (codigo, descripcion) VALUES
  ('proyectos.view', 'Ver proyectos'),
  ('proyectos.manage', 'Crear y editar proyectos'),
  ('presupuestos.view', 'Ver presupuestos'),
  ('presupuestos.manage', 'Crear y editar presupuestos'),
  ('ordenes.create', 'Generar ordenes de compra'),
  ('config.manage', 'Administrar permisos por rol')
ON CONFLICT (codigo) DO NOTHING;

-- Seed inicial: Administrador con todos los permisos
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'Administrador'
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Seed operativo: acceso de lectura para todos los roles funcionales
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo IN ('proyectos.view', 'presupuestos.view')
WHERE r.nombre IN ('Director de Obra', 'Adquisiciones', 'Bodega')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;

-- Seed operativo: generación de OC para roles que gestionan compras
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo = 'ordenes.create'
WHERE r.nombre IN ('Director de Obra', 'Adquisiciones')
ON CONFLICT (rol_id, permiso_id) DO NOTHING;
