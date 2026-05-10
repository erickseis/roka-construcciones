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

export async function updateDepartamento(
  id: number,
  nombre: string,
  descripcion: string | null,
  db?: Queryable
): Promise<ConfigDepartamento | null> {
  const conn = getDb(db);
  const { rows: [dept] } = await conn.query(
    `UPDATE departamentos SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *`,
    [nombre, descripcion, id]
  );
  return dept || null;
}

export async function getUserCountByDepartamento(id: number, db?: Queryable): Promise<number> {
  const conn = getDb(db);
  const { rows: [row] } = await conn.query(
    'SELECT COUNT(*)::int AS count FROM usuarios WHERE departamento_id = $1',
    [id]
  );
  return row.count;
}

export async function getAvailableDepartamentos(excludeId: number, db?: Queryable): Promise<ConfigDepartamento[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    'SELECT * FROM departamentos WHERE id != $1 ORDER BY nombre',
    [excludeId]
  );
  return rows;
}

export async function migrateUsersDepartamento(fromId: number, toId: number, db?: Queryable): Promise<number> {
  const conn = getDb(db);
  const { rowCount } = await conn.query(
    'UPDATE usuarios SET departamento_id = $1 WHERE departamento_id = $2',
    [toId, fromId]
  );
  return rowCount ?? 0;
}

export async function deleteDepartamento(id: number, db?: Queryable): Promise<boolean> {
  const conn = getDb(db);
  const { rowCount } = await conn.query('DELETE FROM departamentos WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

// --- Cargos ---

export async function updateCargo(
  id: number,
  nombre: string,
  departamento_id: number,
  db?: Queryable
): Promise<ConfigCargo | null> {
  const conn = getDb(db);
  const { rows: [cargo] } = await conn.query(
    `UPDATE cargos SET nombre = $1, departamento_id = $2 WHERE id = $3 RETURNING *`,
    [nombre, departamento_id, id]
  );
  return cargo || null;
}

export async function getUserCountByCargo(id: number, db?: Queryable): Promise<number> {
  const conn = getDb(db);
  const { rows: [row] } = await conn.query(
    'SELECT COUNT(*)::int AS count FROM usuarios WHERE cargo_id = $1',
    [id]
  );
  return row.count;
}

export async function getAvailableCargos(excludeId: number, db?: Queryable): Promise<any[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT c.*, d.nombre AS departamento_nombre
     FROM cargos c
     JOIN departamentos d ON d.id = c.departamento_id
     WHERE c.id != $1
     ORDER BY c.nombre`,
    [excludeId]
  );
  return rows;
}

export async function migrateUsersCargo(fromId: number, toId: number, db?: Queryable): Promise<number> {
  const conn = getDb(db);
  const { rowCount } = await conn.query(
    'UPDATE usuarios SET cargo_id = $1 WHERE cargo_id = $2',
    [toId, fromId]
  );
  return rowCount ?? 0;
}

export async function deleteCargo(id: number, db?: Queryable): Promise<boolean> {
  const conn = getDb(db);
  const { rowCount } = await conn.query('DELETE FROM cargos WHERE id = $1', [id]);
  return (rowCount ?? 0) > 0;
}

// --- Roles ---

export async function getAllRoles(db?: Queryable, incluirInactivos?: boolean): Promise<ConfigRol[]> {
  const conn = getDb(db);
  const query = incluirInactivos
    ? 'SELECT * FROM roles ORDER BY is_active DESC, nombre'
    : 'SELECT * FROM roles WHERE is_active = true ORDER BY nombre';
  const { rows } = await conn.query(query);
  return rows;
}

export async function getAllRolesIncludingInactive(db?: Queryable): Promise<ConfigRol[]> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT * FROM roles ORDER BY is_active DESC, nombre');
  return rows;
}

export async function createRole(
  nombre: string,
  db?: Queryable
): Promise<ConfigRol> {
  const conn = getDb(db);
  const { rows: [role] } = await conn.query(
    'INSERT INTO roles (nombre) VALUES ($1) RETURNING *',
    [nombre]
  );
  return role;
}

export async function updateRole(
  id: number,
  nombre: string,
  db?: Queryable
): Promise<ConfigRol | null> {
  const conn = getDb(db);
  const { rows: [role] } = await conn.query(
    'UPDATE roles SET nombre = $1 WHERE id = $2 RETURNING *',
    [nombre, id]
  );
  return role || null;
}

export async function getUserCountByRol(id: number, db?: Queryable): Promise<number> {
  const conn = getDb(db);
  const { rows: [row] } = await conn.query(
    'SELECT COUNT(*)::int AS count FROM usuarios WHERE rol_id = $1',
    [id]
  );
  return row.count;
}

export async function getAvailableRoles(excludeId: number, db?: Queryable): Promise<ConfigRol[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    'SELECT * FROM roles WHERE id != $1 AND is_active = true ORDER BY nombre',
    [excludeId]
  );
  return rows;
}

export async function migrateUsersRol(fromId: number, toId: number, db?: Queryable): Promise<number> {
  const conn = getDb(db);
  const { rowCount } = await conn.query(
    'UPDATE usuarios SET rol_id = $1 WHERE rol_id = $2',
    [toId, fromId]
  );
  return rowCount ?? 0;
}

export async function softDeleteRole(id: number, db?: Queryable): Promise<boolean> {
  const conn = getDb(db);
  const { rowCount } = await conn.query(
    'UPDATE roles SET is_active = false WHERE id = $1 AND is_active = true',
    [id]
  );
  return (rowCount ?? 0) > 0;
}

export async function reactivateRole(id: number, db?: Queryable): Promise<ConfigRol | null> {
  const conn = getDb(db);
  const { rows: [role] } = await conn.query(
    'UPDATE roles SET is_active = true WHERE id = $1 RETURNING *',
    [id]
  );
  return role || null;
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
