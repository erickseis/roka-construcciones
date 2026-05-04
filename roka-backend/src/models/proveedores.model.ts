import { Queryable, getDb } from '../types';
import { Proveedor, CreateProveedorInput, UpdateProveedorInput } from '../types/proveedor.types';

export async function getAllProveedores(onlyActive = true, db?: Queryable): Promise<Proveedor[]> {
  const conn = getDb(db);
  let query = 'SELECT * FROM proveedores WHERE 1=1';
  const params: any[] = [];
  if (onlyActive) {
    params.push(true);
    query += ` AND is_active = $${params.length}`;
  }
  query += ' ORDER BY nombre ASC';
  const { rows } = await conn.query(query, params);
  return rows;
}

export async function getProveedorById(id: number, db?: Queryable): Promise<Proveedor | null> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT * FROM proveedores WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function createProveedor(data: CreateProveedorInput, db?: Queryable): Promise<Proveedor> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `INSERT INTO proveedores (
      rut, nombre, razon_social, direccion, telefono, correo,
      contacto_nombre, contacto_telefono, contacto_correo
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      data.rut || null, data.nombre, data.razon_social || null, data.direccion || null,
      data.telefono || null, data.correo || null, data.contacto_nombre || null,
      data.contacto_telefono || null, data.contacto_correo || null,
    ]
  );
  return rows[0];
}

export async function updateProveedor(id: number, data: UpdateProveedorInput, db?: Queryable): Promise<Proveedor | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `UPDATE proveedores
     SET rut = $1, nombre = $2, razon_social = $3, direccion = $4,
         telefono = $5, correo = $6, contacto_nombre = $7,
         contacto_telefono = $8, contacto_correo = $9, is_active = $10,
         updated_at = NOW()
     WHERE id = $11
     RETURNING *`,
    [
      data.rut || null, data.nombre, data.razon_social || null, data.direccion || null,
      data.telefono || null, data.correo || null, data.contacto_nombre || null,
      data.contacto_telefono || null, data.contacto_correo || null,
      data.is_active ?? true, id,
    ]
  );
  return rows[0] || null;
}

export async function softDeleteProveedor(id: number, db?: Queryable): Promise<boolean> {
  const conn = getDb(db);
  const { rowCount } = await conn.query(
    'UPDATE proveedores SET is_active = false, updated_at = NOW() WHERE id = $1',
    [id]
  );
  return (rowCount ?? 0) > 0;
}
