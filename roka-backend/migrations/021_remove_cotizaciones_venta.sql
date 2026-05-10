-- ================================================
-- Roka Construcciones — Eliminar Cotizaciones de Venta
-- ================================================
-- Esta migración elimina las tablas 'cotizaciones' y 'cotizacion_items'
-- y migra su funcionalidad a las tablas de solicitud_cotizacion.
--
-- Pasos:
-- 1. Agregar columnas de precio a solicitud_cotizacion_detalle
-- 2. Agregar columnas de respuesta a solicitud_cotizacion
-- 3. Agregar solicitud_cotizacion_id a ordenes_compra
-- 4. Migrar datos existentes (precios, archivos, vínculos)
-- 5. Eliminar FK y columna cotizacion_id de ordenes_compra
-- 6. Eliminar tablas cotizacion_items y cotizaciones
-- ================================================

-- ================================================
-- VERIFICACIÓN PREVIA: Detectar cotizaciones sin SC vinculada
-- ================================================
-- Estas cotizaciones no tienen solicitud_cotizacion_id y podrían perder datos
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM cotizaciones
  WHERE solicitud_cotizacion_id IS NULL;

  IF orphan_count > 0 THEN
    RAISE NOTICE 'ATENCIÓN: Existen % cotizaciones sin solicitud_cotizacion_id vinculada. Se creará SC automáticamente.',
      orphan_count;
  END IF;
END $$;

-- ================================================
-- 1. AGREGAR COLUMNAS DE PRECIO A solicitud_cotizacion_detalle
-- ================================================
ALTER TABLE solicitud_cotizacion_detalle
  ADD COLUMN IF NOT EXISTS precio_unitario DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS descuento_porcentaje DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_proveedor VARCHAR(50);

COMMENT ON COLUMN solicitud_cotizacion_detalle.precio_unitario IS 'Precio unitario cotizado por el proveedor';
COMMENT ON COLUMN solicitud_cotizacion_detalle.subtotal IS 'Subtotal = cantidad * precio_unitario - descuento';
COMMENT ON COLUMN solicitud_cotizacion_detalle.descuento_porcentaje IS 'Porcentaje de descuento por línea';
COMMENT ON COLUMN solicitud_cotizacion_detalle.codigo_proveedor IS 'Código/SKU del ítem según el proveedor';

-- ================================================
-- 2. AGREGAR COLUMNAS DE RESPUESTA A solicitud_cotizacion
-- ================================================
ALTER TABLE solicitud_cotizacion
  ADD COLUMN IF NOT EXISTS numero_cov VARCHAR(50),
  ADD COLUMN IF NOT EXISTS archivo_adjunto_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS archivo_adjunto_nombre VARCHAR(200);

COMMENT ON COLUMN solicitud_cotizacion.numero_cov IS 'N° de Cotización de Venta del proveedor (ej: C000067544)';
COMMENT ON COLUMN solicitud_cotizacion.archivo_adjunto_path IS 'Ruta del archivo adjunto de la cotización de venta';
COMMENT ON COLUMN solicitud_cotizacion.archivo_adjunto_nombre IS 'Nombre original del archivo adjunto';

-- ================================================
-- 3. AGREGAR solicitud_cotizacion_id A ordenes_compra
-- ================================================
ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS solicitud_cotizacion_id INT REFERENCES solicitud_cotizacion(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_solicitud_cotizacion ON ordenes_compra(solicitud_cotizacion_id);

-- ================================================
-- 4. MIGRAR DATOS EXISTENTES
-- ================================================

-- 4.1 Migrar precios de cotizacion_items a solicitud_cotizacion_detalle
-- Se vincula mediante solicitud_item_id que existe en ambas tablas
UPDATE solicitud_cotizacion_detalle scd
SET
  precio_unitario = ci.precio_unitario,
  subtotal = ci.subtotal,
  descuento_porcentaje = COALESCE(ci.descuento_porcentaje, 0),
  codigo_proveedor = ci.codigo_proveedor
FROM cotizacion_items ci
JOIN cotizaciones c ON c.id = ci.cotizacion_id
WHERE scd.solicitud_cotizacion_id = c.solicitud_cotizacion_id
  AND scd.solicitud_item_id = ci.solicitud_item_id
  AND c.solicitud_cotizacion_id IS NOT NULL;

-- 4.2 Migrar numero_cov, archivo_adjunto de cotizaciones a solicitud_cotizacion
UPDATE solicitud_cotizacion sc
SET
  numero_cov = c.numero_cov,
  archivo_adjunto_path = c.archivo_adjunto_path,
  archivo_adjunto_nombre = c.archivo_adjunto_nombre
FROM cotizaciones c
WHERE sc.id = c.solicitud_cotizacion_id
  AND c.solicitud_cotizacion_id IS NOT NULL;

-- 4.3 Verificar cotizaciones huérfanas (no debería haber ninguna tras migración 016)
-- Si hay cotizaciones sin SC, crear SCs automáticamente
DO $$
DECLARE
  orphan_count INT;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM cotizaciones WHERE solicitud_cotizacion_id IS NULL;
  IF orphan_count > 0 THEN
    RAISE NOTICE 'ATENCIÓN: % cotizaciones sin SC vinculada. Creando SCs automáticamente.', orphan_count;
    -- Crear SCs para cada cotización huérfana
    INSERT INTO solicitud_cotizacion (solicitud_id, proveedor_id, proveedor, estado, created_at)
    SELECT c.solicitud_id, c.proveedor_id, c.proveedor, 'Respondida', c.created_at
    FROM cotizaciones c
    WHERE c.solicitud_cotizacion_id IS NULL;
    -- Nota: los detalles de SC para huérfanas se pierden si no se vinculan manualmente
  END IF;
END $$;

-- 4.4 Migrar cotizacion_id -> solicitud_cotizacion_id en ordenes_compra
UPDATE ordenes_compra oc
SET solicitud_cotizacion_id = c.solicitud_cotizacion_id
FROM cotizaciones c
WHERE oc.cotizacion_id = c.id
  AND oc.cotizacion_id IS NOT NULL;

-- ================================================
-- 5. ELIMINAR FK Y COLUMNA cotizacion_id DE ordenes_compra
-- ================================================

-- 5.1 Eliminar la restricción de FK (si existe)
-- Primero obtenemos el nombre de la constraint
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'ordenes_compra'::regclass
    AND contype = 'f'
    AND confrelid = 'cotizaciones'::regclass;

  IF fk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE ordenes_compra DROP CONSTRAINT ' || fk_name;
    RAISE NOTICE 'Eliminado FK: %', fk_name;
  END IF;
END $$;

-- 5.2 Eliminar la columna cotizacion_id
ALTER TABLE ordenes_compra DROP COLUMN IF EXISTS cotizacion_id;

-- ================================================
-- 6. ELIMINAR TABLAS cotizacion_items Y cotizaciones
-- ================================================

-- 6.1 Eliminar tabla cotizacion_items (sin FK externas, solo FK a cotizaciones)
DROP TABLE IF EXISTS cotizacion_items;

-- 6.2 Eliminar tabla cotizaciones (verificar que no tenga otras FK)
DROP TABLE IF EXISTS cotizaciones;

-- ================================================
-- 7. LIMPIEZA: Eliminar índices huérfanos
-- ================================================
DROP INDEX IF EXISTS idx_cotizaciones_solicitud;
DROP INDEX IF EXISTS idx_cotizaciones_numero_cov;
DROP INDEX IF EXISTS idx_cotizaciones_metodo_importacion;
DROP INDEX IF EXISTS idx_ordenes_cotizacion;

-- ================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ================================================
DO $$
DECLARE
  sc_count INT;
  scd_with_price INT;
  oc_with_sc INT;
BEGIN
  -- Contar SCs con precios
  SELECT COUNT(*) INTO sc_count FROM solicitud_cotizacion;
  SELECT COUNT(*) INTO scd_with_price
  FROM solicitud_cotizacion_detalle
  WHERE precio_unitario IS NOT NULL;

  -- Contar OCs vinculadas a SC
  SELECT COUNT(*) INTO oc_with_sc
  FROM ordenes_compra
  WHERE solicitud_cotizacion_id IS NOT NULL;

  RAISE NOTICE '=== VERIFICACIÓN POST-MIGRACIÓN ===';
  RAISE NOTICE 'Total solicitud_cotizacion: %', sc_count;
  RAISE NOTICE 'Detalles con precio: %', scd_with_price;
  RAISE NOTICE 'OCs vinculadas a SC: %', oc_with_sc;
  RAISE NOTICE 'Migración completada exitosamente.';
END $$;
