-- ================================================
-- Roka Construcciones — Registro Maestro de Materiales
-- ================================================

-- 1. Unidades de Medida
CREATE TABLE IF NOT EXISTS unidades_medida (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    abreviatura VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Registro Maestro de Materiales
CREATE TABLE IF NOT EXISTS materiales (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    unidad_medida_id INT REFERENCES unidades_medida(id),
    categoria VARCHAR(100),
    precio_referencial DECIMAL(12,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Vincular ítems de solicitud con el maestro (Opcional/Futuro)
ALTER TABLE solicitud_items ADD COLUMN IF NOT EXISTS material_id INT REFERENCES materiales(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_materiales_nombre ON materiales(nombre);
CREATE INDEX IF NOT EXISTS idx_materiales_sku ON materiales(sku);
CREATE INDEX IF NOT EXISTS idx_materiales_categoria ON materiales(categoria);

-- ================================================
-- Datos de Semilla (Seed Data)
-- ================================================

INSERT INTO unidades_medida (nombre, abreviatura) VALUES
('Metros Lineales', 'ml'),
('Metros Cuadrados', 'm2'),
('Metros Cúbicos', 'm3'),
('Kilogramos', 'kg'),
('Toneladas', 'ton'),
('Unidades', 'und'),
('Sacos', 'sac'),
('Galones', 'gal'),
('Litros', 'l'),
('Pulgadas', 'plg'),
('Pies', 'ft')
ON CONFLICT DO NOTHING;

-- Algunos materiales comunes para empezar
INSERT INTO materiales (sku, nombre, descripcion, unidad_medida_id, categoria, precio_referencial) VALUES
('MAT-001', 'Cemento Gris Tipo I', 'Saco de 42.5kg', (SELECT id FROM unidades_medida WHERE abreviatura = 'sac'), 'Obra Gruesa', 4500.00),
('MAT-002', 'Acero Corrugado 3/8"', 'Barra de 6m', (SELECT id FROM unidades_medida WHERE abreviatura = 'und'), 'Obra Gruesa', 12000.00),
('MAT-003', 'Arena Lavada', 'Metro cúbico de arena fina', (SELECT id FROM unidades_medida WHERE abreviatura = 'm3'), 'Áridos', 25000.00),
('MAT-004', 'Gravilla 3/4"', 'Metro cúbico de piedra picada', (SELECT id FROM unidades_medida WHERE abreviatura = 'm3'), 'Áridos', 28000.00),
('MAT-005', 'Bloque Concreto 15cm', 'Bloque estructural estándar', (SELECT id FROM unidades_medida WHERE abreviatura = 'und'), 'Mampostería', 850.00)
ON CONFLICT DO NOTHING;
