import { Queryable, getDb } from '../types';
import { OrdenCompra, OrdenCompraDetalle, OrdenItem } from '../types/orden.types';

export interface OrdenFilters {
  estado_entrega?: string;
  proyecto_id?: number;
}

export async function getAllOrdenes(filters: OrdenFilters): Promise<OrdenCompra[]> {
  const db = getDb();
  let query = `
    SELECT oc.*,
           COALESCE(sc.proveedor, oc.proveedor) AS proveedor,
           sc.solicitud_id,
           p.nombre AS proyecto_nombre,
           COALESCE(sm.proyecto_id, oc.proyecto_id) AS proyecto_id
    FROM ordenes_compra oc
    LEFT JOIN solicitud_cotizacion sc ON sc.id = oc.solicitud_cotizacion_id
    LEFT JOIN solicitudes_material sm ON sm.id = COALESCE(oc.solicitud_id, sc.solicitud_id)
    LEFT JOIN proyectos p ON p.id = COALESCE(sm.proyecto_id, oc.proyecto_id)
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.estado_entrega) {
    params.push(filters.estado_entrega);
    query += ` AND oc.estado_entrega = $${params.length}`;
  }
  if (filters.proyecto_id) {
    params.push(filters.proyecto_id);
    query += ` AND COALESCE(sm.proyecto_id, oc.proyecto_id) = $${params.length}`;
  }

  query += ' ORDER BY oc.created_at DESC';

  const { rows } = await db.query(query, params);
  return rows;
}

export async function getOrdenById(id: number): Promise<OrdenCompraDetalle | null> {
  const db = getDb();
  const { rows: [orden] } = await db.query(`
    SELECT oc.*,
           COALESCE(sc.proveedor, oc.proveedor) AS proveedor,
           sc.proveedor_id, sc.solicitud_id AS cotizacion_solicitud_id,
           sm.solicitante, sm.fecha AS fecha_solicitud, sm.estado AS solicitud_estado,
           p.nombre AS proyecto_nombre, p.ubicacion AS proyecto_ubicacion,
           p.numero_licitacion AS proyecto_numero_licitacion,
           p.numero_obra AS proyecto_numero_obra,
           p.descripcion_licitacion AS proyecto_descripcion_licitacion,
           COALESCE(pr.rut, oc.proveedor_rut) AS proveedor_rut,
           pr.razon_social AS proveedor_razon_social,
           COALESCE(pr.direccion, oc.proveedor_direccion) AS proveedor_direccion,
           COALESCE(pr.telefono, oc.proveedor_telefono) AS proveedor_telefono,
           COALESCE(pr.correo, oc.proveedor_correo) AS proveedor_correo,
           pr.contacto_nombre AS proveedor_contacto_nombre,
           pr.contacto_telefono AS proveedor_contacto_telefono,
           pr.contacto_correo AS proveedor_contacto_correo,
           CONCAT(ua.nombre, ' ', ua.apellido) AS autorizado_por_nombre
    FROM ordenes_compra oc
    LEFT JOIN solicitud_cotizacion sc ON sc.id = oc.solicitud_cotizacion_id
    LEFT JOIN solicitudes_material sm ON sm.id = COALESCE(oc.solicitud_id, sc.solicitud_id)
    LEFT JOIN proyectos p ON p.id = COALESCE(sm.proyecto_id, oc.proyecto_id)
    LEFT JOIN proveedores pr ON pr.id = sc.proveedor_id
    LEFT JOIN usuarios ua ON ua.id = COALESCE(oc.autorizado_por_usuario_id, oc.created_by_usuario_id)
    WHERE oc.id = $1
  `, [id]);

  return orden || null;
}

export async function getOrdenItems(cotizacionId: number): Promise<OrdenItem[]> {
  if (!cotizacionId || cotizacionId === 0) return [];
  const db = getDb();
  const { rows } = await db.query(`
    SELECT scd.*, si.nombre_material, si.cantidad_requerida, si.unidad,
           COALESCE(m.sku, si.codigo) AS material_sku
    FROM solicitud_cotizacion_detalle scd
    JOIN solicitud_items si ON si.id = scd.solicitud_item_id
    LEFT JOIN materiales m ON m.id = si.material_id
    WHERE scd.solicitud_cotizacion_id = $1 AND scd.precio_unitario IS NOT NULL
    ORDER BY scd.id
  `, [cotizacionId]);

  return rows;
}

export async function getOrdenItemsByOC(ordenCompraId: number): Promise<OrdenItem[]> {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT id, nombre_material, cantidad AS cantidad_requerida, unidad,
           precio_unitario, subtotal, codigo AS material_sku
    FROM orden_compra_items
    WHERE orden_compra_id = $1
    ORDER BY id
  `, [ordenCompraId]);

  return rows;
}

export async function getSolicitudCotizacionForOC(solicitudCotizacionId: number, db: Queryable): Promise<{
  id: number;
  solicitud_id: number;
  total: number;
  estado: string;
  proveedor_id: number | null;
  created_by_usuario_id: number | null;
  proyecto_id: number;
  proyecto_nombre: string;
  presupuesto_categoria_id: number | null;
  solicitud_estado: string;
} | null> {
  // Calcular total desde solicitud_cotizacion_detalle (donde precio_unitario IS NOT NULL)
  const { rows: [sc] } = await db.query(
    `SELECT sc.*, 
            s.id AS solicitud_id_ref, s.estado AS solicitud_estado,
            s.proyecto_id, s.presupuesto_categoria_id,
            p.nombre AS proyecto_nombre,
            COALESCE(
              (SELECT SUM(
                CASE 
                  WHEN scd.descuento_porcentaje > 0 THEN 
                    (scd.cantidad_requerida * scd.precio_unitario) * (1 - scd.descuento_porcentaje / 100)
                  ELSE 
                    scd.cantidad_requerida * scd.precio_unitario
                END
              )
              FROM solicitud_cotizacion_detalle scd
              JOIN solicitud_items si ON si.id = scd.solicitud_item_id
              WHERE scd.solicitud_cotizacion_id = sc.id AND scd.precio_unitario IS NOT NULL),
              0
            ) AS total
     FROM solicitud_cotizacion sc
     JOIN solicitudes_material s ON s.id = sc.solicitud_id
     JOIN proyectos p ON p.id = s.proyecto_id
     WHERE sc.id = $1`,
    [solicitudCotizacionId]
  );

  return sc || null;
}

export async function checkExistingOC(solicitudCotizacionId: number, db?: Queryable): Promise<number | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    'SELECT id FROM ordenes_compra WHERE solicitud_cotizacion_id = $1',
    [solicitudCotizacionId]
  );
  return rows[0]?.id || null;
}

export async function createOrden(data: {
  solicitud_cotizacion_id: number;
  condiciones_pago: string;
  total: number;
  created_by_usuario_id: number | null;
  autorizado_por_usuario_id?: number | null;
  solicitud_id?: number | null;
  codigo_obra?: string | null;
  folio: string | null;
  descuento_tipo: string;
  descuento_valor: number;
  descuento_monto: number;
  subtotal_neto: number;
  impuesto_monto: number;
  total_final: number;
  plazo_entrega: string | null;
  condiciones_entrega: string | null;
  atencion_a: string | null;
  observaciones: string | null;
}, db?: Queryable): Promise<OrdenCompra> {
  const conn = getDb(db);
  const { rows: [orden] } = await conn.query(
    `INSERT INTO ordenes_compra (
        solicitud_cotizacion_id, condiciones_pago, total, created_by_usuario_id,
        autorizado_por_usuario_id, solicitud_id, codigo_obra,
        folio, descuento_tipo, descuento_valor, descuento_monto,
        subtotal_neto, impuesto_monto, total_final,
        plazo_entrega, condiciones_entrega, atencion_a, observaciones
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     RETURNING *`,
    [
      data.solicitud_cotizacion_id,
      data.condiciones_pago,
      data.total,
      data.created_by_usuario_id,
      data.autorizado_por_usuario_id ?? null,
      data.solicitud_id ?? null,
      data.codigo_obra ?? null,
      data.folio,
      data.descuento_tipo,
      data.descuento_valor,
      data.descuento_monto,
      data.subtotal_neto,
      data.impuesto_monto,
      data.total_final,
      data.plazo_entrega,
      data.condiciones_entrega,
      data.atencion_a,
      data.observaciones,
    ]
  );

  return orden;
}

export async function updateFolio(id: number, folio: string, db?: Queryable): Promise<OrdenCompra | null> {
  const conn = getDb(db);
  const { rows: [orden] } = await conn.query(
    `UPDATE ordenes_compra SET folio = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [folio, id]
  );

  return orden || null;
}

export async function updateEstadoEntrega(id: number, estado: string): Promise<OrdenCompra | null> {
  const db = getDb();
  const { rows: [updated] } = await db.query(
    `UPDATE ordenes_compra SET estado_entrega = $1, updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [estado, id]
  );

  return updated || null;
}