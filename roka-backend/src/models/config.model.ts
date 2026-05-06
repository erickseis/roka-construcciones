import { Queryable, getDb } from '../types';
import { ConfigDepartamento, ConfigCargo, ConfigRol, Permiso } from '../types/config.types';
import pool from '../db';

// --- Departamentos ---

export async function getAllDepartamentos(db?: Queryable): Promise<ConfigDepartamento[]> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT * FROM departamentos ORDER BY nombre');
  return rows;
}

export async function createDepartamento(
  nombre: string,
  descripcion: string | null,
  db?: Queryable
): Promise<ConfigDepartamento> {
  const conn = getDb(db);
  const { rows: [dept] } = await conn.query(
    'INSERT INTO departamentos (nombre, descripcion) VALUES ($1, $2) RETURNING *',
    [nombre, descripcion]
  );
  return dept;
}

// --- Cargos ---

export async function getAllCargos(db?: Queryable): Promise<ConfigCargo[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(`
    SELECT c.*, d.nombre as departamento_nombre
    FROM cargos c
    JOIN departamentos d ON d.id = c.departamento_id
    ORDER BY c.nombre
  `);
  return rows;
}

export async function createCargo(
  nombre: string,
  departamento_id: number,
  db?: Queryable
): Promise<ConfigCargo> {
  const conn = getDb(db);
  const { rows: [cargo] } = await conn.query(
    'INSERT INTO cargos (nombre, departamento_id) VALUES ($1, $2) RETURNING *',
    [nombre, departamento_id]
  );
  return cargo;
}

// --- Roles ---

export async function getAllRoles(db?: Queryable): Promise<ConfigRol[]> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT * FROM roles ORDER BY nombre');
  return rows;
}

// --- Permisos ---

export async function getAllPermisos(db?: Queryable): Promise<Permiso[]> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT * FROM permisos ORDER BY codigo');
  return rows;
}

export async function getPermisosByRol(
  rolId: number,
  db?: Queryable
): Promise<string[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT p.codigo
     FROM rol_permisos rp
     JOIN permisos p ON p.id = rp.permiso_id
     WHERE rp.rol_id = $1
     ORDER BY p.codigo`,
    [rolId]
  );
  return rows.map((r: { codigo: string }) => r.codigo);
}

export async function updatePermisosByRol(
  rolId: number,
  codigos: string[]
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM rol_permisos WHERE rol_id = $1', [rolId]);

    if (codigos.length > 0) {
      const { rows: permisos } = await client.query(
        'SELECT id, codigo FROM permisos WHERE codigo = ANY($1::text[])',
        [codigos]
      );

      const placeholders = permisos.map((_, j) => {
        const base = j * 2;
        return `($${base + 1}, $${base + 2})`;
      });
      const values = permisos.flatMap(p => [rolId, p.id]);
      await client.query(
        `INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ${placeholders.join(', ')}`,
        values
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
