-- Migration 006: Material Categories
-- Purpose: Formalize material categories into a dedicated table.

CREATE TABLE IF NOT EXISTS material_categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Seed existing categories from the current catalog
INSERT INTO material_categorias (nombre)
SELECT DISTINCT categoria FROM materiales WHERE categoria IS NOT NULL AND categoria <> ''
ON CONFLICT (nombre) DO NOTHING;

-- Ensure some defaults if table was empty
INSERT INTO material_categorias (nombre)
VALUES ('General'), ('Obra Gruesa'), ('Acabados'), ('Herramientas')
ON CONFLICT (nombre) DO NOTHING;

-- Add categoria_id column to materiales
ALTER TABLE materiales ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES material_categorias(id);

-- Update materials to link to the new categories
UPDATE materiales m
SET categoria_id = mc.id
FROM material_categorias mc
WHERE m.categoria = mc.nombre;
