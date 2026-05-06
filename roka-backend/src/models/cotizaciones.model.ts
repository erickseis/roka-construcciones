import { Queryable, getDb } from '../types';
import { Cotizacion, CotizacionItem } from '../types/cotizacion.types';

export interface CotizacionFilters {
  solicitud_id?: number;
  estado?: string;
  solicitud_cotizacion_id?: number;
}

export async function getAllCotizaciones(filters: CotizacionFilters): Promise<Cotizacion[]> {
  const db = getDb();
  let query = `
    SELECT c.*, sm.solicitante, p.nombre AS proyecto_nombre,
           sc.estado AS solicitud_cotizacion_estado
    FROM cotizaciones c
    JOIN solicitudes_material sm ON sm.id = c.solicitud_id
    JOIN proyectos p ON p.id = sm.proyecto_id
    LEFT JOIN solicitud_cotizacion sc ON sc.id = c.solicitud_cotizacion_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.solicitud_id) {
    params.push(filters.solicitud_id);
    query += ` AND c.solicitud_id = $${params.length}`;
  }
  if (filters.estado) {
    params.push(filters.estado);
    query += ` AND c.estado = $${params.length}`;
  }
  if (filters.solicitud_cotizacion_id) {
    params.push(filters.solicitud_cotizacion_id);
    query += ` AND c.solicitud_cotizacion_id = $${params.length}`;
  }

  query += ' ORDER BY c.created_at DESC';

  const { rows } = await db.query(query, params);
  return rows;
}

export async function getCotizacionById(id: number): Promise<(Cotizacion & { fecha_solicitud?: string }) | null> {
  const db = getDb();
  const { rows: [cotizacion] } = await db.query(`
    SELECT c.*, sm.solicitante, sm.fecha AS fecha_solicitud,
           p.nombre AS proyecto_nombre,
           sc.estado AS solicitud_cotizacion_estado
    FROM cotizaciones c
    JOIN solicitudes_material sm ON sm.id = c.solicitud_id
    JOIN proyectos p ON p.id = sm.proyecto_id
    LEFT JOIN solicitud_cotizacion sc ON sc.id = c.solicitud_cotizacion_id
    WHERE c.id = $1
  `, [id]);

  return cotizacion || null;
}

export async function getCotizacionItems(cotizacionId: number): Promise<CotizacionItem[]> {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT ci.*, si.nombre_material, si.cantidad_requerida, si.unidad
    FROM cotizacion_items ci
    JOIN solicitud_items si ON si.id = ci.solicitud_item_id
    WHERE ci.cotizacion_id = $1
    ORDER BY ci.id
  `, [cotizacionId]);

  return rows;
}

export async function createCotizacion(data: {
  solicitud_id: number;
  solicitud_cotizacion_id: number | null;
  proveedor_id: number | null;
  proveedor: string;
  total: number;
  created_by_usuario_id: number | null;
}, db?: Queryable): Promise<Cotizacion> {
  const conn = getDb(db);
  const { rows: [cotizacion] } = await conn.query(
    `INSERT INTO cotizaciones (solicitud_id, solicitud_cotizacion_id, proveedor_id, proveedor, total, created_by_usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.solicitud_id, data.solicitud_cotizacion_id, data.proveedor_id, data.proveedor, data.total, data.created_by_usuario_id]
  );

  return cotizacion;
}

export async function createCotizacionItem(data: {
  cotizacion_id: number;
  solicitud_item_id: number;
  precio_unitario: number;
  subtotal: number;
}, db?: Queryable): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `INSERT INTO cotizacion_items (cotizacion_id, solicitud_item_id, precio_unitario, subtotal)
     VALUES ($1, $2, $3, $4)`,
    [data.cotizacion_id, data.solicitud_item_id, data.precio_unitario, data.subtotal]
  );
}

export async function updateCotizacionEstado(id: number, estado: string, db?: Queryable): Promise<Cotizacion | null> {
  const conn = getDb(db);
  const { rows: [cotizacion] } = await conn.query(
    `UPDATE cotizaciones SET estado = $1 WHERE id = $2 RETURNING *`,
    [estado, id]
  );

  return cotizacion || null;
}

export async function getCotizacionForUpdate(id: number, db: Queryable): Promise<{
  id: number;
  estado: string;
  created_by_usuario_id: number | null;
  proyecto_nombre: string;
} | null> {
  const { rows: [cotizacionActual] } = await db.query(
    `SELECT c.id, c.estado, c.created_by_usuario_id, p.nombre AS proyecto_nombre
     FROM cotizaciones c
     JOIN solicitudes_material sm ON sm.id = c.solicitud_id
     JOIN proyectos p ON p.id = sm.proyecto_id
     WHERE c.id = $1
     FOR UPDATE`,
    [id]
  );

  return cotizacionActual || null;
}

export async function getSolicitudEstado(id: number, db?: Queryable): Promise<string | null> {
  const conn = getDb(db);
  const { rows: [solicitud] } = await conn.query(
    'SELECT estado FROM solicitudes_material WHERE id = $1',
    [id]
  );

  return solicitud?.estado || null;
}

export async function updateSolicitudEstadoIfPendiente(id: number, db?: Queryable): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `UPDATE solicitudes_material SET estado = 'Cotizando', updated_at = NOW()
     WHERE id = $1 AND estado = 'Pendiente'`,
    [id]
  );
}

export async function updateCotizacionArchivo(id: number, archivoPath: string, archivoNombre: string, db?: Queryable): Promise<Cotizacion | null> {
  const conn = getDb(db);
  const { rows: [cotizacion] } = await conn.query(
    `UPDATE cotizaciones SET archivo_adjunto_path = $1, archivo_adjunto_nombre = $2 WHERE id = $3 RETURNING *`,
    [archivoPath, archivoNombre, id]
  );
  return cotizacion || null;
}
