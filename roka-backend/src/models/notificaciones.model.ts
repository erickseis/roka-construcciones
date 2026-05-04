import { Queryable, getDb } from '../types';
import { Notificacion } from '../types/notificacion.types';

export async function getAllNotificaciones(
  userId: number,
  soloNoLeidas: boolean,
  limit: number,
  offset: number,
  db?: Queryable
): Promise<Notificacion[]> {
  const conn = getDb(db);
  const params: any[] = [userId];
  let query = `
    SELECT n.*,
           CONCAT(u.nombre, ' ', u.apellido) AS enviado_por_nombre
    FROM notificaciones n
    LEFT JOIN usuarios u ON u.id = n.enviado_por_usuario_id
    WHERE n.usuario_destino_id = $1
  `;

  if (soloNoLeidas) {
    query += ' AND n.leida = FALSE';
  }

  params.push(limit);
  params.push(offset);

  query += `
    ORDER BY n.created_at DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `;

  const { rows } = await conn.query(query, params);
  return rows;
}

export async function getUnreadCount(
  userId: number,
  db?: Queryable
): Promise<{ unread: number }> {
  const conn = getDb(db);
  const { rows: [result] } = await conn.query(
    `SELECT COUNT(*)::int AS unread
     FROM notificaciones
     WHERE usuario_destino_id = $1 AND leida = FALSE`,
    [userId]
  );
  return result || { unread: 0 };
}

export async function markAsLeida(
  id: number,
  userId: number,
  leida: boolean,
  db?: Queryable
): Promise<Notificacion | null> {
  const conn = getDb(db);
  const { rows: [updated] } = await conn.query(
    `UPDATE notificaciones
     SET leida = $1,
         leida_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END
     WHERE id = $2 AND usuario_destino_id = $3
     RETURNING *`,
    [leida, id, userId]
  );
  return updated || null;
}

export async function marcarTodasLeidas(
  userId: number,
  db?: Queryable
): Promise<number> {
  const conn = getDb(db);
  const { rowCount } = await conn.query(
    `UPDATE notificaciones
     SET leida = TRUE,
         leida_at = NOW()
     WHERE usuario_destino_id = $1 AND leida = FALSE`,
    [userId]
  );
  return rowCount || 0;
}
