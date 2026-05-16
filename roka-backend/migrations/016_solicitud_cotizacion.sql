-- ================================================
-- Roka Construcciones — Solicitud de Cotización
-- ================================================
-- Esta migración reestructura el módulo de cotizaciones:
-- 1. Crea solicitud_cotizacion (envío al proveedor, sin precios)
-- 2. Crea solicitud_cotizacion_detalle (ítems asignados por proveedor)
-- 3. Agrega columns a cotizaciones para vincular con solicitud_cotizacion
-- 4. Migra datos existentes a la nueva estructura
-- ================================================

-- 1. Crear tabla solicitud_cotizacion
CREATE TABLE IF NOT EXISTS solicitud_cotizacion (
  id SERIAL PRIMARY KEY,
  solicitud_id INT NOT NULL REFERENCES solicitudes_material(id),
  proveedor_id INT REFERENCES proveedores(id) ON DELETE SET NULL,
  proveedor VARCHAR(200) NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'Borrador'
    CHECK (estado IN ('Borrador', 'Enviada', 'Respondida', 'Anulada')),
  observaciones TEXT,
  created_by_usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sc_solicitud ON solicitud_cotizacion(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_sc_estado ON solicitud_cotizacion(estado);
CREATE INDEX IF NOT EXISTS idx_sc_proveedor ON solicitud_cotizacion(proveedor);

-- 2. Crear tabla solicitud_cotizacion_detalle
CREATE TABLE IF NOT EXISTS solicitud_cotizacion_detalle (
  id SERIAL PRIMARY KEY,
  solicitud_cotizacion_id INT NOT NULL REFERENCES solicitud_cotizacion(id) ON DELETE CASCADE,
  solicitud_item_id INT NOT NULL REFERENCES solicitud_items(id),
  UNIQUE(solicitud_cotizacion_id, solicitud_item_id)
);

CREATE INDEX IF NOT EXISTS idx_scd_cotizacion ON solicitud_cotizacion_detalle(solicitud_cotizacion_id);

-- 3. Agregar columnas a cotizaciones (ahora concepto "Cotización de Venta")
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS solicitud_cotizacion_id INT REFERENCES solicitud_cotizacion(id) ON DELETE SET NULL;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS archivo_adjunto_path VARCHAR(500);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS archivo_adjunto_nombre VARCHAR(200);

-- 4. Migrar datos existentes de cotizaciones a la nueva estructura
DO $$
DECLARE
  c RECORD;
  sc_id INT;
  ci RECORD;
  nuevo_estado VARCHAR(30);
BEGIN
  FOR c IN SELECT * FROM cotizaciones WHERE solicitud_cotizacion_id IS NULL LOOP
    -- Determinar estado de la solicitud_cotizacion según estado de la cotización
    IF c.estado IN ('Aprobada', 'Rechazada') THEN
      nuevo_estado := 'Respondida';
    ELSE
      nuevo_estado := 'Enviada';
    END IF;

    -- Crear solicitud_cotizacion
    INSERT INTO solicitud_cotizacion (solicitud_id, proveedor_id, proveedor, estado, created_by_usuario_id, created_at)
    VALUES (c.solicitud_id, c.proveedor_id, c.proveedor, nuevo_estado, c.created_by_usuario_id, c.created_at)
    RETURNING id INTO sc_id;

    -- Crear detalle desde cotizacion_items
    FOR ci IN SELECT solicitud_item_id FROM cotizacion_items WHERE cotizacion_id = c.id LOOP
      BEGIN
        INSERT INTO solicitud_cotizacion_detalle (solicitud_cotizacion_id, solicitud_item_id)
        VALUES (sc_id, ci.solicitud_item_id);
      EXCEPTION WHEN unique_violation THEN
        -- Skip duplicados
      END;
    END LOOP;

    -- Vincular cotización existente con su solicitud_cotizacion
    UPDATE cotizaciones SET solicitud_cotizacion_id = sc_id WHERE id = c.id;
  END LOOP;
END $$;
