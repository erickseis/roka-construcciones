-- ================================================
-- Roka Construcciones — Auth and User Management
-- ================================================

-- 1. Departamentos
CREATE TABLE IF NOT EXISTS departamentos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Cargos
CREATE TABLE IF NOT EXISTS cargos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    departamento_id INT REFERENCES departamentos(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    rut VARCHAR(15) UNIQUE NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    departamento_id INT REFERENCES departamentos(id) ON DELETE SET NULL,
    cargo_id INT REFERENCES cargos(id) ON DELETE SET NULL,
    rol_id INT REFERENCES roles(id) ON DELETE SET NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_user_rut ON usuarios(rut);
CREATE INDEX IF NOT EXISTS idx_user_email ON usuarios(correo);

-- Initial Data
INSERT INTO roles (nombre) VALUES 
('Administrador'), 
('Director de Obra'), 
('Adquisiciones'), 
('Bodega') 
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO departamentos (nombre) VALUES 
('Administración'), 
('Operaciones'), 
('Finanzas'), 
('Logística') 
ON CONFLICT (nombre) DO NOTHING;

-- Admin User (password: admin123)
-- Hash for 'admin123' using bcrypt
INSERT INTO usuarios (nombre, apellido, rut, correo, password_hash, rol_id)
SELECT 'Admin', 'Sistema', '12345678-9', 'admin@roka.cl', '$2b$10$v3MarkRQFJp/4TXWoltQwe.8Z5BXYIAWswCWO.eec9fT9n4yrxul.', (SELECT id FROM roles WHERE nombre = 'Administrador')
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE correo = 'admin@roka.cl');
