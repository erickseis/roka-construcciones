ALTER TABLE ordenes_compra ADD COLUMN numero_cov VARCHAR(50);
COMMENT ON COLUMN ordenes_compra.numero_cov IS 'Numero de cotizacion de venta del proveedor (numero_cov)';
