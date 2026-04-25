-- ================================================
-- Roka Construcciones — Ordenes de compra formato comercial
-- ================================================

ALTER TABLE ordenes_compra
  ADD COLUMN IF NOT EXISTS folio VARCHAR(60),
  ADD COLUMN IF NOT EXISTS descuento_tipo VARCHAR(20) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS descuento_valor DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS descuento_monto DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal_neto DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS impuesto_monto DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS total_final DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS plazo_entrega VARCHAR(120),
  ADD COLUMN IF NOT EXISTS condiciones_entrega VARCHAR(300),
  ADD COLUMN IF NOT EXISTS atencion_a VARCHAR(150),
  ADD COLUMN IF NOT EXISTS observaciones TEXT;

UPDATE ordenes_compra
SET
  folio = COALESCE(NULLIF(folio, ''), 'OC-' || LPAD(id::TEXT, 6, '0')),
  descuento_tipo = COALESCE(descuento_tipo, 'none'),
  descuento_valor = COALESCE(descuento_valor, 0),
  descuento_monto = COALESCE(descuento_monto, 0),
  subtotal_neto = COALESCE(subtotal_neto, total),
  impuesto_monto = COALESCE(impuesto_monto, ROUND(total * 0.19, 2)),
  total_final = COALESCE(total_final, ROUND(total * 1.19, 2));

ALTER TABLE ordenes_compra
  ALTER COLUMN folio SET NOT NULL,
  ALTER COLUMN descuento_tipo SET NOT NULL,
  ALTER COLUMN descuento_valor SET NOT NULL,
  ALTER COLUMN descuento_monto SET NOT NULL,
  ALTER COLUMN subtotal_neto SET NOT NULL,
  ALTER COLUMN impuesto_monto SET NOT NULL,
  ALTER COLUMN total_final SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ordenes_compra_descuento_tipo_check'
  ) THEN
    ALTER TABLE ordenes_compra
      ADD CONSTRAINT ordenes_compra_descuento_tipo_check
      CHECK (descuento_tipo IN ('none', 'porcentaje', 'monto'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ordenes_compra_folio ON ordenes_compra(folio);
