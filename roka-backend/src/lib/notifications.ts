import pool from '../db';

type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

export interface NotificationInput {
  usuario_destino_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  entidad_tipo?: string | null;
  entidad_id?: number | null;
  payload?: Record<string, any>;
  enviado_por_usuario_id?: number | null;
}

function getDb(db?: Queryable): Queryable {
  return db || (pool as Queryable);
}

export async function getActorDisplayName(userId: number, db?: Queryable): Promise<string> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT CONCAT(nombre, ' ', apellido) AS nombre_completo
     FROM usuarios
     WHERE id = $1`,
    [userId]
  );

  return rows[0]?.nombre_completo || 'Usuario del sistema';
}

export async function getUsersByRoleNames(roleNames: string[], db?: Queryable): Promise<number[]> {
  if (!roleNames.length) return [];

  const conn = getDb(db);
  const { rows } = await conn.query(
    `SELECT DISTINCT u.id
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     WHERE u.is_active = TRUE AND r.nombre = ANY($1::text[])`,
    [roleNames]
  );

  return rows.map(r => r.id as number);
}

export async function resolveRecipientUserIds(
  options: {
    creatorUserId?: number | null;
    roleNames?: string[];
    excludeUserId?: number | null;
  },
  db?: Queryable
): Promise<number[]> {
  const recipients = new Set<number>();

  if (options.creatorUserId) {
    recipients.add(options.creatorUserId);
  }

  const roleNames = options.roleNames || [];
  if (roleNames.length > 0) {
    const roleUsers = await getUsersByRoleNames(roleNames, db);
    for (const id of roleUsers) {
      recipients.add(id);
    }
  }

  if (options.excludeUserId) {
    recipients.delete(options.excludeUserId);
  }

  return Array.from(recipients);
}

export async function createNotifications(notifications: NotificationInput[], db?: Queryable): Promise<void> {
  if (!notifications.length) return;

  const conn = getDb(db);

  for (const n of notifications) {
    await conn.query(
      `INSERT INTO notificaciones
         (usuario_destino_id, tipo, titulo, mensaje, entidad_tipo, entidad_id, payload, enviado_por_usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [
        n.usuario_destino_id,
        n.tipo,
        n.titulo,
        n.mensaje,
        n.entidad_tipo || null,
        n.entidad_id || null,
        JSON.stringify(n.payload || {}),
        n.enviado_por_usuario_id || null,
      ]
    );
  }
}
