import { Queryable, getDb } from '../types';
import { UsuarioPublic } from '../types/usuario.types';

export interface CreateUserInput {
  nombre: string;
  apellido: string;
  rut: string;
  correo: string;
  telefono?: string;
  departamento_id?: number;
  cargo_id?: number;
  rol_id?: number;
  password_hash: string;
}

export interface ExistingUserCheck {
  id: number;
  rut: string;
  correo: string;
}

export async function getAllUsers(db?: Queryable): Promise<UsuarioPublic[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(`
    SELECT
      u.id, u.nombre, u.apellido, u.rut, u.correo, u.telefono, u.is_active,
      d.nombre as departamento_nombre,
      c.nombre as cargo_nombre,
      r.nombre as rol_nombre,
      u.departamento_id, u.cargo_id, u.rol_id
    FROM usuarios u
    LEFT JOIN departamentos d ON d.id = u.departamento_id
    LEFT JOIN cargos c ON c.id = u.cargo_id
    LEFT JOIN roles r ON r.id = u.rol_id
    ORDER BY u.created_at DESC
  `);
  return rows;
}

export async function findExistingUser(
  rut: string,
  correo: string,
  db?: Queryable
): Promise<ExistingUserCheck[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    'SELECT id, rut, correo FROM usuarios WHERE rut = $1 OR correo = $2',
    [rut, correo]
  );
  return rows;
}

export async function createUser(
  data: CreateUserInput,
  db?: Queryable
): Promise<UsuarioPublic> {
  const conn = getDb(db);
  const { rows: [newUser] } = await conn.query(
    `INSERT INTO usuarios (
      nombre, apellido, rut, correo, telefono,
      departamento_id, cargo_id, rol_id, password_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, nombre, apellido, rut, correo`,
    [
      data.nombre, data.apellido, data.rut, data.correo, data.telefono,
      data.departamento_id, data.cargo_id, data.rol_id, data.password_hash,
    ]
  );
  return newUser;
}

export async function softDeleteUser(
  id: number,
  db?: Queryable
): Promise<void> {
  const conn = getDb(db);
  await conn.query('UPDATE usuarios SET is_active = false WHERE id = $1', [id]);
}

export interface UpdateUserInput {
  nombre?: string;
  apellido?: string;
  rut?: string;
  correo?: string;
  telefono?: string | null;
  departamento_id?: number | null;
  cargo_id?: number | null;
  rol_id?: number | null;
}

export async function updateUser(
  id: number,
  data: UpdateUserInput,
  db?: Queryable
): Promise<UsuarioPublic | null> {
  const conn = getDb(db);
  const { rows: [current] } = await conn.query(
    'SELECT * FROM usuarios WHERE id = $1',
    [id]
  );
  if (!current) return null;

  const { rows: [updated] } = await conn.query(
    `UPDATE usuarios SET
      nombre = COALESCE($1, nombre),
      apellido = COALESCE($2, apellido),
      rut = COALESCE($3, rut),
      correo = COALESCE($4, correo),
      telefono = COALESCE($5, telefono),
      departamento_id = COALESCE($6, departamento_id),
      cargo_id = COALESCE($7, cargo_id),
      rol_id = COALESCE($8, rol_id),
      updated_at = NOW()
     WHERE id = $9
     RETURNING id, nombre, apellido, rut, correo, telefono,
       departamento_id, cargo_id, rol_id, is_active, created_at, updated_at`,
    [
      data.nombre ?? null, data.apellido ?? null, data.rut ?? null,
      data.correo ?? null, data.telefono ?? null,
      data.departamento_id ?? null, data.cargo_id ?? null, data.rol_id ?? null,
      id,
    ]
  );
  return updated;
}

export async function updatePassword(
  id: number,
  password_hash: string,
  db?: Queryable
): Promise<boolean> {
  const conn = getDb(db);
  const { rowCount } = await conn.query(
    'UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [password_hash, id]
  );
  return (rowCount ?? 0) > 0;
}
