import { Queryable, getDb } from '../types';

export interface SolicitudRow {
  id: number;
  proyecto_id: number;
  solicitante: string;
  fecha: string;
  fecha_requerida?: string | null;
  estado: string;
  created_at: Date;
  updated_at: Date;
  proyecto_nombre?: string;
  proyecto_numero_obra?: string;
  total_items?: number;
  presupuesto_categoria_id?: number | null;
  created_by_usuario_id?: number | null;
  // Audit trail — sección 5
  aprobado_by_usuario_id?: number | null;
  aprobado_at?: Date | string | null;
  rechazado_by_usuario_id?: number | null;
  rechazado_at?: Date | string | null;
  estado_changed_by_usuario_id?: number | null;
  estado_changed_at?: Date | string | null;
  aprobado_by_nombre?: string | null;
  rechazado_by_nombre?: string | null;
  estado_changed_by_nombre?: string | null;
}

export interface SolicitudItemRow {
  id: number;
  solicitud_id: number;
  material_id: number | null;
  nombre_material: string;
  cantidad_requerida: number;
  unidad: string;
  codigo?: string;
  material_oficial_nombre?: string;
  material_sku?: string;
  precio_referencial?: number;
  unidad_abreviatura?: string;
}

export interface CreateSolicitudData {
  proyecto_id: number;
  solicitante: string;
  fecha?: string;
  fecha_requerida?: string | null;
  created_by_usuario_id?: number | null;
}

export interface CreateSolicitudItemData {
  solicitud_id: number;
  material_id?: number | null;
  nombre_material: string;
  cantidad_requerida: number;
  unidad: string;
  codigo?: string;
}

export async function getAllSolicitudes(
  filters: { proyecto_id?: number; estado?: string; created_by_usuario_id?: number } = {},
  db?: Queryable
): Promise<SolicitudRow[]> {
  const conn = getDb(db);
  let query = `
    SELECT sm.*, p.nombre AS proyecto_nombre, p.numero_obra AS proyecto_numero_obra,
      (SELECT COUNT(*) FROM solicitud_items si WHERE si.solicitud_id = sm.id) AS total_items
    FROM solicitudes_material sm
    JOIN proyectos p ON p.id = sm.proyecto_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.proyecto_id) {
    params.push(filters.proyecto_id);
    query += ` AND sm.proyecto_id = $${params.length}`;
  }

  if (filters.estado) {
    params.push(filters.estado);
    query += ` AND sm.estado = $${params.length}`;
  }

  if (filters.created_by_usuario_id) {
    params.push(filters.created_by_usuario_id);
    query += ` AND sm.created_by_usuario_id = $${params.length}`;
  }

  if (!filters.estado) {
    query += " AND sm.estado != 'Anulada'";
  }
  
  query += " ORDER BY sm.created_at DESC";

  const { rows } = await conn.query(query, params);
  return rows;
}

export async function getSolicitudById(id: number, db?: Queryable): Promise<SolicitudRow | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT sm.*, p.nombre AS proyecto_nombre, p.numero_obra AS proyecto_numero_obra,
            NULLIF(CONCAT(u_apr.nombre, ' ', u_apr.apellido), ' ') AS aprobado_by_nombre,
            NULLIF(CONCAT(u_rec.nombre, ' ', u_rec.apellido), ' ') AS rechazado_by_nombre,
            NULLIF(CONCAT(u_chg.nombre, ' ', u_chg.apellido), ' ') AS estado_changed_by_nombre
     FROM solicitudes_material sm
     JOIN proyectos p ON p.id = sm.proyecto_id
     LEFT JOIN usuarios u_apr ON u_apr.id = sm.aprobado_by_usuario_id
     LEFT JOIN usuarios u_rec ON u_rec.id = sm.rechazado_by_usuario_id
     LEFT JOIN usuarios u_chg ON u_chg.id = sm.estado_changed_by_usuario_id
     WHERE sm.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function getSolicitudItems(solicitudId: number, db?: Queryable): Promise<SolicitudItemRow[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT si.*, COALESCE(m.sku, si.codigo) AS material_sku,
            m.nombre AS material_oficial_nombre,
            m.precio_referencial,
            u.abreviatura AS unidad_abreviatura
     FROM solicitud_items si
     LEFT JOIN materiales m ON m.id = si.material_id
     LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
     WHERE si.solicitud_id = $1
     ORDER BY si.id`,
    [solicitudId]
  );
  return rows;
}

export async function createSolicitud(data: CreateSolicitudData, db?: Queryable): Promise<SolicitudRow> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `INSERT INTO solicitudes_material (proyecto_id, solicitante, fecha, fecha_requerida, created_by_usuario_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [data.proyecto_id, data.solicitante, data.fecha || new Date().toISOString().split('T')[0], data.fecha_requerida || null, data.created_by_usuario_id || null]
  );
  return rows[0];
}

export async function createSolicitudItem(data: CreateSolicitudItemData, db?: Queryable): Promise<SolicitudItemRow> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `INSERT INTO solicitud_items (solicitud_id, material_id, nombre_material, cantidad_requerida, unidad, codigo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.solicitud_id, data.material_id || null, data.nombre_material, data.cantidad_requerida, data.unidad, data.codigo || null]
  );
  return rows[0];
}

export async function updateSolicitudEstado(id: number, estado: string, changedByUsuarioId: number | null, db?: Queryable): Promise<SolicitudRow | null> {
  const conn = getDb(db);
  
  // Build dynamic SET clauses based on the new estado
  let setClauses = `estado = $1, updated_at = NOW(), estado_changed_by_usuario_id = $3, estado_changed_at = NOW()`;
  const params: any[] = [estado, id, changedByUsuarioId];
  
  if (estado === 'Aprobado') {
    setClauses += `, aprobado_by_usuario_id = $3, aprobado_at = NOW()`;
  }
  
  const { rows } = await conn.query(
    `UPDATE solicitudes_material SET ${setClauses} WHERE id = $2 RETURNING *`,
    params
  );
  return rows[0] || null;
}

export async function deleteSolicitud(id: number, anuladoByUsuarioId?: number | null, db?: Queryable): Promise<boolean> {
  const conn = getDb(db);
  
  // Verificamos el estado actual
  const { rows } = await conn.query('SELECT estado FROM solicitudes_material WHERE id = $1', [id]);
  if (rows.length === 0) return false;
  
  const currentEstado = rows[0].estado;
  
  if (currentEstado !== 'Anulada') {
    // Primer paso: Anular con trazabilidad
    const { rowCount } = await conn.query(
      `UPDATE solicitudes_material SET estado = 'Anulada', updated_at = NOW(), rechazado_by_usuario_id = $2, rechazado_at = NOW(), estado_changed_by_usuario_id = $2, estado_changed_at = NOW() WHERE id = $1`,
      [id, anuladoByUsuarioId || null]
    );
    return (rowCount ?? 0) > 0;
  } else {
    // Segundo paso: Eliminación física (ya tiene ON DELETE CASCADE en las FKs actualizadas)
    const { rowCount } = await conn.query(
      'DELETE FROM solicitudes_material WHERE id = $1',
      [id]
    );
    return (rowCount ?? 0) > 0;
  }
}
