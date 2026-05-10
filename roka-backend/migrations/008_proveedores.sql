-- ================================================
-- Roka Construcciones — Catálogo de Proveedores
-- ================================================

CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    rut VARCHAR(15) UNIQUE,
    nombre VARCHAR(200) NOT NULL,
    razon_social VARCHAR(300),
    direccion TEXT,
    telefono VARCHAR(20),
    correo VARCHAR(150),
    contacto_nombre VARCHAR(150),
    contacto_telefono VARCHAR(20),
    contacto_correo VARCHAR(150),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nombre ON proveedores(nombre);
CREATE INDEX IF NOT EXISTS idx_proveedores_rut ON proveedores(rut);

-- Agregar proveedor_id a cotizaciones para vincular con el catálogo
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS proveedor_id INT REFERENCES proveedores(id);

-- Seed inicial de proveedores de ejemplo
INSERT INTO proveedores (rut, nombre, razon_social, direccion, telefono, correo, contacto_nombre, contacto_telefono, contacto_correo) VALUES
('76.123.456-7', 'Materiales del Caribe S.A.', 'Materiales del Caribe S.A.', 'Av. Principal 123, Santiago', '+56 2 2123 4567', 'ventas@materialescaribe.cl', 'Juan Pérez', '+56 9 1234 5678', 'juanp@materialescaribe.cl'),
('76.234.567-8', 'Ferretería Industrial ABC', 'Ferretería Industrial ABC SpA', 'Calle工业区 456, Santiago', '+56 2 2987 6543', 'contacto@ferretabc.cl', 'María González', '+56 9 2345 6789', 'mgonzalez@ferretabc.cl'),
('76.345.678-9', 'Cementos del Norte', 'Cementos del Norte Ltda.', 'Ruta 5 Norte Km 45', '+56 2 2345 6789', 'ventas@cementosnorte.cl', 'Pedro Salazar', '+56 9 3456 7890', 'psalazar@cementosnorte.cl'),
('76.456.789-0', 'Distribuidora Nacional', 'Distribuidora Nacional de Materiales', 'Av. Logística 789, Santiago', '+56 2 2876 5432', 'info@distnacional.cl', 'Laura Rivas', '+56 9 4567 8901', 'lrivas@distnacional.cl')
ON CONFLICT (rut) DO NOTHING;