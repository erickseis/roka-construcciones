import { Queryable, getDb } from '../types';

export interface ProyectoRow {
  id: number;
  nombre: string;
  ubicacion: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_usuario_id: number | null;
  responsable_nombre?: string;
  numero_licitacion: string | null;
  descripcion_licitacion: string | null;
  fecha_apertura_licitacion: string | null;
  monto_referencial_licitacion: number | null;
  archivo_licitacion_path: string | null;
  archivo_licitacion_nombre: string | null;
  archivo_materiales_path: string | null;
  archivo_materiales_nombre: string | null;
  mandante: string | null;
  moneda: string | null;
  plazo_ejecucion_dias: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ResumenPresupuesto {
  monto_total: number;
  monto_comprometido: number;
  monto_disponible: number;
  porcentaje_uso: number;
}

export interface MetricasProyecto {
  total_solicitudes: number;
  total_cotizaciones: number;
  total_ordenes: number;
  gasto_total_oc: number;
}

export interface CreateProyectoData {
  nombre: string;
  ubicacion?: string | null;
  estado?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  responsable_usuario_id?: number | null;
  numero_licitacion?: string | null;
  descripcion_licitacion?: string | null;
  fecha_apertura_licitacion?: string | null;
  monto_referencial_licitacion?: number | null;
  archivo_licitacion_path?: string | null;
  archivo_licitacion_nombre?: string | null;
  archivo_materiales_path?: string | null;
  archivo_materiales_nombre?: string | null;
  mandante?: string | null;
  moneda?: string | null;
  plazo_ejecucion_dias?: number | null;
}

export interface UpdateProyectoData {
  nombre?: string | null;
  ubicacion?: string | null;
  estado?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  responsable_usuario_id?: string | null;
  numero_licitacion?: string | null;
  descripcion_licitacion?: string | null;
  fecha_apertura_licitacion?: string | null;
  monto_referencial_licitacion?: number | null;
  archivo_licitacion_path?: string | null;
  archivo_licitacion_nombre?: string | null;
  archivo_materiales_path?: string | null;
  archivo_materiales_nombre?: string | null;
  mandante?: string | null;
  moneda?: string | null;
  plazo_ejecucion_dias?: number | null;
}

export async function getAllProyectos(
  filters: { estado?: string; is_active?: boolean } = {},
  db?: Queryable
): Promise<ProyectoRow[]> {
  const conn = getDb(db);
  let query = `
    SELECT p.*, CONCAT(u.nombre, ' ', u.apellido) AS responsable_nombre
    FROM proyectos p
    LEFT JOIN usuarios u ON u.id = p.responsable_usuario_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.estado) {
    params.push(filters.estado);
    query += ` AND p.estado = $${params.length}`;
  }

  if (typeof filters.is_active !== 'undefined') {
    params.push(filters.is_active);
    query += ` AND p.is_active = $${params.length}`;
  }

  query += ' ORDER BY p.nombre';

  const { rows } = await conn.query(query, params);
  return rows;
}

export async function getProyectoById(id: number, db?: Queryable): Promise<ProyectoRow | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT p.*, CONCAT(u.nombre, ' ', u.apellido) AS responsable_nombre
     FROM proyectos p
     LEFT JOIN usuarios u ON u.id = p.responsable_usuario_id
     WHERE p.id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function getResumenPresupuesto(proyectoId: number, db?: Queryable): Promise<ResumenPresupuesto> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT
       COALESCE(pp.monto_total, 0)::numeric AS monto_total,
       COALESCE(pp.monto_comprometido, 0)::numeric AS monto_comprometido,
       COALESCE(pp.monto_total - pp.monto_comprometido, 0)::numeric AS monto_disponible,
       COALESCE((pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso
     FROM proyectos p
     LEFT JOIN presupuestos_proyecto pp ON pp.proyecto_id = p.id
     WHERE p.id = $1`,
    [proyectoId]
  );
  return rows[0] || { monto_total: 0, monto_comprometido: 0, monto_disponible: 0, porcentaje_uso: 0 };
}

export async function getMetricasProyecto(proyectoId: number, db?: Queryable): Promise<MetricasProyecto> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT
       COUNT(DISTINCT sm.id)::int AS total_solicitudes,
       COUNT(DISTINCT c.id)::int AS total_cotizaciones,
       COUNT(DISTINCT oc.id)::int AS total_ordenes,
       COALESCE(SUM(oc.total), 0)::numeric AS gasto_total_oc
     FROM proyectos p
     LEFT JOIN solicitudes_material sm ON sm.proyecto_id = p.id
     LEFT JOIN cotizaciones c ON c.solicitud_id = sm.id
     LEFT JOIN ordenes_compra oc ON oc.cotizacion_id = c.id
     WHERE p.id = $1`,
    [proyectoId]
  );
  return rows[0] || { total_solicitudes: 0, total_cotizaciones: 0, total_ordenes: 0, gasto_total_oc: 0 };
}

export async function createProyecto(data: CreateProyectoData, db?: Queryable): Promise<ProyectoRow> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `INSERT INTO proyectos (
       nombre, ubicacion, estado, fecha_inicio, fecha_fin,
       responsable_usuario_id, numero_licitacion, descripcion_licitacion,
       fecha_apertura_licitacion, monto_referencial_licitacion,
       archivo_licitacion_path, archivo_licitacion_nombre, 
       archivo_materiales_path, archivo_materiales_nombre,
       mandante, moneda, plazo_ejecucion_dias
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING *`,
    [
      data.nombre,
      data.ubicacion || null,
      data.estado || 'Planificacion',
      data.fecha_inicio || null,
      data.fecha_fin || null,
      data.responsable_usuario_id || null,
      data.numero_licitacion || null,
      data.descripcion_licitacion || null,
      data.fecha_apertura_licitacion || null,
      data.monto_referencial_licitacion || null,
      data.archivo_licitacion_path || null,
      data.archivo_licitacion_nombre || null,
      data.archivo_materiales_path || null,
      data.archivo_materiales_nombre || null,
      data.mandante || null,
      data.moneda || 'CLP',
      data.plazo_ejecucion_dias || null,
    ]
  );
  return rows[0];
}

export async function updateProyecto(id: number, data: UpdateProyectoData, db?: Queryable): Promise<ProyectoRow | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `UPDATE proyectos
     SET
       nombre = COALESCE($1, nombre),
       ubicacion = COALESCE($2, ubicacion),
       estado = COALESCE($3, estado),
       fecha_inicio = COALESCE($4, fecha_inicio),
       fecha_fin = COALESCE($5, fecha_fin),
       responsable_usuario_id = COALESCE($6, responsable_usuario_id),
       numero_licitacion = COALESCE($7, numero_licitacion),
       descripcion_licitacion = COALESCE($8, descripcion_licitacion),
       fecha_apertura_licitacion = COALESCE($9, fecha_apertura_licitacion),
       monto_referencial_licitacion = COALESCE($10, monto_referencial_licitacion),
       archivo_licitacion_path = COALESCE($11, archivo_licitacion_path),
       archivo_licitacion_nombre = COALESCE($12, archivo_licitacion_nombre),
       archivo_materiales_path = COALESCE($13, archivo_materiales_path),
       archivo_materiales_nombre = COALESCE($14, archivo_materiales_nombre),
mandante = COALESCE($15, mandante),
        moneda = COALESCE($16, moneda),
        plazo_ejecucion_dias = COALESCE($17, plazo_ejecucion_dias),
        updated_at = NOW()
      WHERE id = $18
      RETURNING *`,
    [
      data.nombre || null,
      data.ubicacion || null,
      data.estado || null,
      data.fecha_inicio || null,
      data.fecha_fin || null,
      data.responsable_usuario_id || null,
      data.numero_licitacion || null,
      data.descripcion_licitacion || null,
      data.fecha_apertura_licitacion || null,
      data.monto_referencial_licitacion || null,
      data.archivo_licitacion_path || null,
      data.archivo_licitacion_nombre || null,
      data.archivo_materiales_path || null,
      data.archivo_materiales_nombre || null,
      data.mandante || null,
      data.moneda || null,
      data.plazo_ejecucion_dias || null,
      id,
    ]
  );
  return rows[0] || null;
}

export async function toggleActive(id: number, is_active: boolean, db?: Queryable): Promise<ProyectoRow | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `UPDATE proyectos
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [is_active, id]
  );
  return rows[0] || null;
}

export async function getLicitacionArchivo(id: number, db?: Queryable): Promise<{ archivo_licitacion_path: string | null; archivo_licitacion_nombre: string | null } | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    'SELECT archivo_licitacion_path, archivo_licitacion_nombre FROM proyectos WHERE id = $1',
    [id]
  );
  return rows[0] || null;
}
