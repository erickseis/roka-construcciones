import { Queryable, getDb } from '../types';
import { Usuario, UsuarioPublic } from '../types/usuario.types';

export async function findUserByEmail(correo: string, db?: Queryable): Promise<Usuario | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT u.*, r.nombre as rol_nombre
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     WHERE u.correo = $1 AND u.is_active = true`,
    [correo]
  );
  return rows[0] || null;
}

export async function findUserById(id: number, db?: Queryable): Promise<UsuarioPublic | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT u.id, u.nombre, u.apellido, u.rut, u.correo, u.rol_id,
            u.departamento_id, u.cargo_id, u.is_active, u.created_at, u.updated_at,
            r.nombre as rol_nombre
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     WHERE u.id = $1`,
    [id]
  );
  return rows[0] || null;
}
