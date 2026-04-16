-- ================================================
-- Roka Construcciones — Schema de Base de Datos
-- Sistema de Gestión de Compras
-- ================================================

-- 1. Proyectos
CREATE TABLE IF NOT EXISTS proyectos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    ubicacion VARCHAR(300),
    estado VARCHAR(50) DEFAULT 'En Curso',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Solicitudes de Material
CREATE TABLE IF NOT EXISTS solicitudes_material (
    id SERIAL PRIMARY KEY,
    proyecto_id INT NOT NULL REFERENCES proyectos(id),
    solicitante VARCHAR(150) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente', 'Cotizando', 'Aprobado')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Ítems de Solicitud
CREATE TABLE IF NOT EXISTS solicitud_items (
    id SERIAL PRIMARY KEY,
    solicitud_id INT NOT NULL REFERENCES solicitudes_material(id) ON DELETE CASCADE,
    nombre_material VARCHAR(200) NOT NULL,
    cantidad_requerida DECIMAL(12,2) NOT NULL,
    unidad VARCHAR(30) NOT NULL
);

-- 4. Cotizaciones
CREATE TABLE IF NOT EXISTS cotizaciones (
    id SERIAL PRIMARY KEY,
    solicitud_id INT NOT NULL REFERENCES solicitudes_material(id),
    proveedor VARCHAR(200) NOT NULL,
    total DECIMAL(14,2) DEFAULT 0,
    archivo_adjunto VARCHAR(500),
    estado VARCHAR(30) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado IN ('Pendiente', 'Aprobada', 'Rechazada')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Ítems de Cotización
CREATE TABLE IF NOT EXISTS cotizacion_items (
    id SERIAL PRIMARY KEY,
    cotizacion_id INT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
    solicitud_item_id INT NOT NULL REFERENCES solicitud_items(id),
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(14,2) NOT NULL
);

-- 6. Órdenes de Compra
CREATE TABLE IF NOT EXISTS ordenes_compra (
    id SERIAL PRIMARY KEY,
    cotizacion_id INT NOT NULL UNIQUE REFERENCES cotizaciones(id),
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    condiciones_pago VARCHAR(300),
    estado_entrega VARCHAR(50) NOT NULL DEFAULT 'Pendiente'
        CHECK (estado_entrega IN ('Pendiente', 'Recibido parcial', 'Completado')),
    total DECIMAL(14,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_solicitudes_proyecto ON solicitudes_material(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_material(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_solicitud ON cotizaciones(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_cotizacion ON ordenes_compra(cotizacion_id);

-- ================================================
-- Datos de ejemplo (Seed)
-- ================================================

-- Proyectos
INSERT INTO proyectos (nombre, ubicacion, estado) VALUES
('Torre Miramar - Etapa C', 'Av. Principal #120, Zona Norte', 'En Curso'),
('Residencial Los Álamos', 'Calle 45 #78, Zona Este', 'En Curso'),
('Centro Comercial Oasis', 'Km 5 Autopista Sur', 'Planificación')
ON CONFLICT DO NOTHING;

-- Solicitudes de Material
INSERT INTO solicitudes_material (proyecto_id, solicitante, fecha, estado) VALUES
(1, 'Ing. Carlos Méndez', '2026-04-01', 'Aprobado'),
(1, 'Arq. Laura Rivas', '2026-04-05', 'Cotizando'),
(2, 'Ing. Pedro Salazar', '2026-04-08', 'Pendiente'),
(1, 'Ing. Carlos Méndez', '2026-04-10', 'Pendiente'),
(2, 'Arq. María González', '2026-04-12', 'Pendiente')
ON CONFLICT DO NOTHING;

-- Ítems de Solicitudes
INSERT INTO solicitud_items (solicitud_id, nombre_material, cantidad_requerida, unidad) VALUES
-- Solicitud 1
(1, 'Acero Corrugado 3/8"', 12.00, 'Toneladas'),
(1, 'Cemento Gris Tipo I', 500.00, 'Sacos'),
(1, 'Arena Lavada', 30.00, 'm³'),
-- Solicitud 2
(2, 'Bloques de Concreto 15cm', 2000.00, 'Unidades'),
(2, 'Varilla #4', 8.00, 'Toneladas'),
-- Solicitud 3
(3, 'Gravilla 3/4"', 40.00, 'm³'),
(3, 'Tubo PVC 4"', 120.00, 'Unidades'),
(3, 'Alambre de Amarre #18', 200.00, 'kg'),
-- Solicitud 4
(4, 'Pintura Exterior Blanca', 80.00, 'Galones'),
(4, 'Impermeabilizante', 50.00, 'Galones'),
-- Solicitud 5
(5, 'Madera para Encofrado', 150.00, 'Piezas'),
(5, 'Clavos 3"', 50.00, 'kg')
ON CONFLICT DO NOTHING;

-- Cotizaciones
INSERT INTO cotizaciones (solicitud_id, proveedor, total, estado) VALUES
(1, 'Materiales del Caribe S.A.', 285000.00, 'Aprobada'),
(1, 'Ferretería Industrial ABC', 302500.00, 'Rechazada'),
(2, 'Cementos del Norte', 175000.00, 'Pendiente'),
(2, 'Distribuidora Nacional', 168000.00, 'Pendiente')
ON CONFLICT DO NOTHING;

-- Ítems de Cotización
INSERT INTO cotizacion_items (cotizacion_id, solicitud_item_id, precio_unitario, subtotal) VALUES
-- Cotización 1 (Materiales del Caribe)
(1, 1, 18500.00, 222000.00),
(1, 2, 95.00, 47500.00),
(1, 3, 516.67, 15500.00),
-- Cotización 2 (Ferretería ABC)
(2, 1, 19500.00, 234000.00),
(2, 2, 100.00, 50000.00),
(2, 3, 616.67, 18500.00)
ON CONFLICT DO NOTHING;

-- Orden de Compra (a partir de cotización aprobada)
INSERT INTO ordenes_compra (cotizacion_id, condiciones_pago, estado_entrega, total) VALUES
(1, 'Neto 30 días', 'Recibido parcial', 285000.00)
ON CONFLICT DO NOTHING;
