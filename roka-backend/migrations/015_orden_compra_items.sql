-- ================================================
-- Roka Construcciones — Items de OC (independientes)
-- ================================================

CREATE TABLE IF NOT EXISTS orden_compra_items (
  id SERIAL PRIMARY KEY,
  orden_compra_id INT NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
  nombre_material VARCHAR(300) NOT NULL,
  cantidad DECIMAL(12,2) NOT NULL,
  unidad VARCHAR(30) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL,
  codigo VARCHAR(60),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oc_items_orden ON orden_compra_items(orden_compra_id);