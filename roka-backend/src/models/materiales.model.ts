import { Queryable, getDb } from '../types';
import {
  UnidadMedida,
  MaterialCategoria,
  Material,
  SolicitudItemJoined,
} from '../types/material.types';

// ================================================
// UNIDADES DE MEDIDA
// ================================================

export async function getAllUnidades(db?: Queryable): Promise<UnidadMedida[]> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT * FROM unidades_medida ORDER BY nombre');
  return rows;
}

export async function createUnidad(
  nombre: string,
  abreviatura: string,
  db?: Queryable
): Promise<UnidadMedida> {
  const conn = getDb(db);
  const { rows: [nueva] } = await conn.query(
    'INSERT INTO unidades_medida (nombre, abreviatura) VALUES ($1, $2) RETURNING *',
    [nombre, abreviatura]
  );
  return nueva;
}

export async function updateUnidad(
  id: number,
  nombre: string,
  abreviatura: string,
  db?: Queryable
): Promise<UnidadMedida | null> {
  const conn = getDb(db);
  const { rows: [actualizada] } = await conn.query(
    'UPDATE unidades_medida SET nombre = $1, abreviatura = $2 WHERE id = $3 RETURNING *',
    [nombre, abreviatura, id]
  );
  return actualizada || null;
}

export async function deleteUnidad(
  id: number,
  db?: Queryable
): Promise<{ used: boolean; rowCount: number }> {
  const conn = getDb(db);

  const { rows: [uso] } = await conn.query(
    'SELECT id FROM materiales WHERE unidad_medida_id = $1 LIMIT 1',
    [id]
  );
  if (uso) {
    return { used: true, rowCount: 0 };
  }

  const { rowCount } = await conn.query(
    'DELETE FROM unidades_medida WHERE id = $1',
    [id]
  );
  return { used: false, rowCount: rowCount || 0 };
}

// ================================================
// CATEGORIAS DE MATERIALES
// ================================================

export async function getAllCategorias(db?: Queryable): Promise<MaterialCategoria[]> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT * FROM material_categorias ORDER BY nombre');
  return rows;
}

export async function createCategoria(
  nombre: string,
  descripcion: string | null,
  db?: Queryable
): Promise<MaterialCategoria> {
  const conn = getDb(db);
  const { rows: [cat] } = await conn.query(
    'INSERT INTO material_categorias (nombre, descripcion) VALUES ($1, $2) RETURNING *',
    [nombre, descripcion]
  );
  return cat;
}

export async function updateCategoria(
  id: number,
  nombre: string,
  descripcion: string | null,
  db?: Queryable
): Promise<MaterialCategoria | null> {
  const conn = getDb(db);
  const { rows: [updated] } = await conn.query(
    'UPDATE material_categorias SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *',
    [nombre, descripcion, id]
  );
  return updated || null;
}

export async function deleteCategoria(
  id: number,
  db?: Queryable
): Promise<{ used: boolean; rowCount: number }> {
  const conn = getDb(db);

  const { rows: [hasMaterials] } = await conn.query(
    'SELECT id FROM materiales WHERE categoria_id = $1 LIMIT 1',
    [id]
  );
  if (hasMaterials) {
    return { used: true, rowCount: 0 };
  }

  const { rowCount } = await conn.query(
    'DELETE FROM material_categorias WHERE id = $1',
    [id]
  );
  return { used: false, rowCount: rowCount || 0 };
}

// ================================================
// MATERIALES SOLICITADOS
// ================================================

export async function getAllMaterialesSolicitados(
  q?: string,
  proyecto_id?: number,
  db?: Queryable
): Promise<SolicitudItemJoined[]> {
  const conn = getDb(db);
  let sql = `
    SELECT si.*, sm.proyecto_id, p.nombre AS proyecto_nombre,
           sm.solicitante, sm.fecha, sm.estado
    FROM solicitud_items si
    JOIN solicitudes_material sm ON sm.id = si.solicitud_id
    JOIN proyectos p ON p.id = sm.proyecto_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (proyecto_id) {
    params.push(proyecto_id);
    sql += ` AND sm.proyecto_id = $${params.length}`;
  }

  if (q) {
    params.push(`%${q}%`);
    sql += ` AND si.nombre_material ILIKE $${params.length}`;
  }

  sql += ' ORDER BY sm.fecha DESC, si.id DESC';

  const { rows } = await conn.query(sql, params);
  return rows;
}

// ================================================
// MATERIALES (Maestro)
// ================================================

export interface MaterialQueryParams {
  categoria?: string;
  categoria_id?: number;
  q?: string;
}

export async function getAllMateriales(
  filters: MaterialQueryParams,
  db?: Queryable
): Promise<Material[]> {
  const conn = getDb(db);
  let query = `
    SELECT m.*, u.nombre AS unidad_nombre, u.abreviatura AS unidad_abreviatura,
           mc.nombre AS categoria_nombre
    FROM materiales m
    LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
    LEFT JOIN material_categorias mc ON mc.id = m.categoria_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.categoria_id) {
    params.push(filters.categoria_id);
    query += ` AND m.categoria_id = $${params.length}`;
  } else if (filters.categoria) {
    params.push(filters.categoria);
    query += ` AND m.categoria = $${params.length}`;
  }

  if (filters.q) {
    params.push(`%${filters.q}%`);
    query += ` AND (m.nombre ILIKE $${params.length} OR m.sku ILIKE $${params.length})`;
  }

  query += ' ORDER BY m.nombre ASC';

  const { rows } = await conn.query(query, params);
  return rows;
}

export async function getMaterialById(
  id: number,
  db?: Queryable
): Promise<Material | null> {
  const conn = getDb(db);
  const { rows: [material] } = await conn.query(
    `SELECT m.*, u.nombre AS unidad_nombre, u.abreviatura AS unidad_abreviatura,
            mc.nombre AS categoria_nombre
     FROM materiales m
     LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
     LEFT JOIN material_categorias mc ON mc.id = m.categoria_id
     WHERE m.id = $1`,
    [id]
  );
  return material || null;
}

export interface CreateMaterialInput {
  sku?: string;
  nombre: string;
  descripcion?: string;
  unidad_medida_id: number;
  categoria_id?: number;
  categoria?: string;
  precio_referencial?: number;
}

export async function createMaterial(
  data: CreateMaterialInput,
  db?: Queryable
): Promise<Material> {
  const conn = getDb(db);
  const { rows: [inserted] } = await conn.query(
    `INSERT INTO materiales (sku, nombre, descripcion, unidad_medida_id, categoria_id, categoria, precio_referencial)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.sku, data.nombre, data.descripcion,
      data.unidad_medida_id, data.categoria_id || null,
      data.categoria, data.precio_referencial,
    ]
  );
  return inserted;
}

export interface UpdateMaterialInput {
  sku?: string;
  nombre?: string;
  descripcion?: string;
  unidad_medida_id?: number;
  categoria_id?: number;
  categoria?: string;
  precio_referencial?: number;
  is_active?: boolean;
}

export async function updateMaterial(
  id: number,
  data: UpdateMaterialInput,
  db?: Queryable
): Promise<Material | null> {
  const conn = getDb(db);
  const { rows: [updated] } = await conn.query(
    `UPDATE materiales
     SET sku = $1, nombre = $2, descripcion = $3, unidad_medida_id = $4,
         categoria_id = $5, categoria = $6, precio_referencial = $7, is_active = $8, updated_at = NOW()
     WHERE id = $9 RETURNING *`,
    [
      data.sku, data.nombre, data.descripcion,
      data.unidad_medida_id, data.categoria_id || null,
      data.categoria, data.precio_referencial,
      data.is_active, id,
    ]
  );
  return updated || null;
}

export async function deleteMaterial(
  id: number,
  db?: Queryable
): Promise<{ used: boolean; rowCount: number }> {
  const conn = getDb(db);

  const { rows: [usage] } = await conn.query(
    'SELECT id FROM solicitud_items WHERE material_id = $1 LIMIT 1',
    [id]
  );
  if (usage) {
    return { used: true, rowCount: 0 };
  }

  const { rowCount } = await conn.query(
    'DELETE FROM materiales WHERE id = $1',
    [id]
  );
  return { used: false, rowCount: rowCount || 0 };
}
