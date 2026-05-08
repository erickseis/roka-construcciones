import { Queryable, getDb } from '../types';
import { PresupuestoProyecto, PresupuestoCategoria, PresupuestoAlerta, CreatePresupuestoInput } from '../types/presupuesto.types';

const PRESUPUESTO_SELECT = `
  SELECT
    pp.*,
    p.nombre AS proyecto_nombre,
    p.estado AS proyecto_estado,
    COALESCE(oc_agg.gasto_total, 0)::numeric AS gasto_total,
    COALESCE((COALESCE(oc_agg.gasto_total, 0) / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso,
    (pp.monto_total - COALESCE(oc_agg.gasto_total, 0))::numeric AS monto_disponible
  FROM presupuestos_proyecto pp
  JOIN proyectos p ON p.id = pp.proyecto_id
  LEFT JOIN (
    SELECT p2.id AS proyecto_id,
           COALESCE(SUM(oc.total), 0) AS gasto_total
    FROM proyectos p2
    LEFT JOIN solicitudes_material sm ON sm.proyecto_id = p2.id
    LEFT JOIN solicitud_cotizacion sc ON sc.solicitud_id = sm.id AND sc.estado = 'Respondida'
    LEFT JOIN ordenes_compra oc ON oc.solicitud_cotizacion_id = sc.id
    GROUP BY p2.id
  ) oc_agg ON oc_agg.proyecto_id = p.id
`;

const CATEGORIA_SELECT = `
  SELECT
    pc.*,
    (pc.monto_asignado - pc.monto_comprometido)::numeric AS monto_disponible,
    COALESCE((pc.monto_comprometido / NULLIF(pc.monto_asignado, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso
  FROM presupuesto_categorias pc
`;

export async function getAllPresupuestos(): Promise<PresupuestoProyecto[]> {
  const db = getDb();
  const { rows } = await db.query(
    `${PRESUPUESTO_SELECT} ORDER BY p.nombre`
  );
  return rows;
}

export async function getPresupuestoByProyecto(proyectoId: number): Promise<(PresupuestoProyecto & { categorias?: PresupuestoCategoria[] }) | null> {
  const db = getDb();
  const { rows: [presupuesto] } = await db.query(
    `${PRESUPUESTO_SELECT} AND pp.proyecto_id = $1`,
    [proyectoId]
  );

  if (!presupuesto) return null;

  const { rows: categorias } = await db.query(
    `${CATEGORIA_SELECT} WHERE pc.presupuesto_id = $1 ORDER BY pc.nombre`,
    [presupuesto.id]
  );

  return { ...presupuesto, categorias };
}

export async function getCategoriasByPresupuesto(presupuestoId: number): Promise<PresupuestoCategoria[]> {
  const db = getDb();
  const { rows } = await db.query(
    `${CATEGORIA_SELECT} WHERE pc.presupuesto_id = $1 ORDER BY pc.nombre`,
    [presupuestoId]
  );
  return rows;
}

export async function getPresupuestoById(id: number): Promise<PresupuestoProyecto | null> {
  const db = getDb();
  const { rows: [row] } = await db.query('SELECT * FROM presupuestos_proyecto WHERE id = $1', [id]);
  return row || null;
}

export async function getCategoriaById(id: number): Promise<PresupuestoCategoria | null> {
  const db = getDb();
  const { rows: [row] } = await db.query('SELECT * FROM presupuesto_categorias WHERE id = $1', [id]);
  return row || null;
}

export async function getPresupuestoForUpdate(id: number, db: Queryable): Promise<{
  id: number;
  proyecto_id: number;
  monto_total: number;
  monto_comprometido: number;
  umbral_alerta: number;
  proyecto_nombre?: string;
} | null> {
  const { rows: [presupuesto] } = await db.query(
    `SELECT pp.*, p.nombre AS proyecto_nombre
     FROM presupuestos_proyecto pp
     JOIN proyectos p ON p.id = pp.proyecto_id
     WHERE pp.id = $1
     FOR UPDATE`,
    [id]
  );

  return presupuesto || null;
}

export async function getCategoriaForUpdate(id: number, presupuestoId: number, db: Queryable): Promise<{
  id: number;
  presupuesto_id: number;
  nombre: string;
  monto_asignado: number;
  monto_comprometido: number;
} | null> {
  const { rows: [categoria] } = await db.query(
    `SELECT * FROM presupuesto_categorias WHERE id = $1 AND presupuesto_id = $2 FOR UPDATE`,
    [id, presupuestoId]
  );

  return categoria || null;
}

export async function checkExistingPresupuesto(proyectoId: number, db?: Queryable): Promise<number | null> {
  const conn = getDb(db);
  const { rows } = await conn.query(
    'SELECT id FROM presupuestos_proyecto WHERE proyecto_id = $1',
    [proyectoId]
  );
  return rows[0]?.id || null;
}

export async function createPresupuesto(data: CreatePresupuestoInput, db?: Queryable): Promise<PresupuestoProyecto> {
  const conn = getDb(db);
  const { rows: [presupuesto] } = await conn.query(
    `INSERT INTO presupuestos_proyecto (proyecto_id, monto_total, umbral_alerta, estado)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.proyecto_id, data.monto_total, data.umbral_alerta || 80, data.estado || 'Vigente']
  );

  return presupuesto;
}

export async function createCategoria(data: {
  presupuesto_id: number;
  nombre: string;
  monto_asignado: number;
}, db?: Queryable): Promise<PresupuestoCategoria> {
  const conn = getDb(db);
  const { rows: [categoria] } = await conn.query(
    `INSERT INTO presupuesto_categorias (presupuesto_id, nombre, monto_asignado)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.presupuesto_id, data.nombre, data.monto_asignado]
  );

  return categoria;
}

export async function updatePresupuesto(id: number, data: {
  monto_total?: number;
  umbral_alerta?: number;
  estado?: string;
}): Promise<PresupuestoProyecto | null> {
  const db = getDb();
  const { rows: [current] } = await db.query(
    'SELECT * FROM presupuestos_proyecto WHERE id = $1',
    [id]
  );

  if (!current) return null;

  const nextMontoTotal = typeof data.monto_total !== 'undefined' ? Number(data.monto_total) : Number(current.monto_total);
  if (nextMontoTotal < Number(current.monto_comprometido)) {
    throw new Error('El monto total no puede ser menor al comprometido actual');
  }

  const { rows: sumRows } = await db.query('SELECT SUM(monto_asignado) as total FROM presupuesto_categorias WHERE presupuesto_id = $1', [id]);
  const totalAsignadoCategorias = Number(sumRows[0].total || 0);
  if (nextMontoTotal < totalAsignadoCategorias) {
    throw new Error(`El monto total no puede ser menor a la suma de las categorías asignadas (${totalAsignadoCategorias.toLocaleString('es-CL')})`);
  }

  const { rows: [updated] } = await db.query(
    `UPDATE presupuestos_proyecto
     SET
       monto_total = COALESCE($1, monto_total),
       umbral_alerta = COALESCE($2, umbral_alerta),
       estado = COALESCE($3, estado),
       updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [data.monto_total ?? null, data.umbral_alerta ?? null, data.estado ?? null, id]
  );

  return updated;
}

export async function updateCategoria(categoriaId: number, data: {
  nombre?: string;
  monto_asignado?: number;
}): Promise<PresupuestoCategoria | null> {
  const db = getDb();
  const { rows: [current] } = await db.query(
    'SELECT * FROM presupuesto_categorias WHERE id = $1',
    [categoriaId]
  );

  if (!current) return null;

  const nextMontoAsignado = typeof data.monto_asignado !== 'undefined' ? Number(data.monto_asignado) : Number(current.monto_asignado);
  if (nextMontoAsignado < Number(current.monto_comprometido)) {
    throw new Error('Monto asignado no puede ser menor al comprometido actual');
  }

  const { rows: [updated] } = await db.query(
    `UPDATE presupuesto_categorias
     SET
       nombre = COALESCE($1, nombre),
       monto_asignado = COALESCE($2, monto_asignado),
       updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [data.nombre ?? null, data.monto_asignado ?? null, categoriaId]
  );

  return updated;
}

export async function deleteCategoria(categoriaId: number): Promise<boolean> {
  const db = getDb();
  const { rows: [categoria] } = await db.query(
    'SELECT * FROM presupuesto_categorias WHERE id = $1',
    [categoriaId]
  );

  if (!categoria) return false;
  if (Number(categoria.monto_comprometido) > 0) {
    throw new Error('No se puede eliminar una categoría con monto comprometido');
  }

  await db.query('DELETE FROM presupuesto_categorias WHERE id = $1', [categoriaId]);
  return true;
}

export async function commitPresupuesto(id: number, monto: number, db?: Queryable): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `UPDATE presupuestos_proyecto
     SET monto_comprometido = monto_comprometido + $1, updated_at = NOW()
     WHERE id = $2`,
    [monto, id]
  );
}

export async function commitCategoria(id: number, monto: number, db?: Queryable): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `UPDATE presupuesto_categorias
     SET monto_comprometido = monto_comprometido + $1, updated_at = NOW()
     WHERE id = $2`,
    [monto, id]
  );
}

export async function insertMovimiento(data: {
  presupuesto_id: number;
  categoria_id?: number | null;
  orden_compra_id?: number | null;
  tipo: string;
  monto: number;
  descripcion?: string;
  created_by?: number | null;
}, db?: Queryable): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `INSERT INTO presupuesto_movimientos
     (presupuesto_id, categoria_id, orden_compra_id, tipo, monto, descripcion, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      data.presupuesto_id,
      data.categoria_id || null,
      data.orden_compra_id || null,
      data.tipo,
      data.monto,
      data.descripcion || 'Compromiso de presupuesto',
      data.created_by || null,
    ]
  );
}

export async function getAlertasListado(): Promise<PresupuestoAlerta[]> {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT
      p.id AS proyecto_id,
      p.nombre AS proyecto_nombre,
      pp.id AS presupuesto_id,
      pp.monto_total,
      pp.monto_comprometido,
      pp.umbral_alerta,
      COALESCE((pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso,
      CASE
        WHEN pp.monto_total = 0 THEN 'Sin presupuesto'
        WHEN (pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100 >= 100 THEN 'Sobreconsumo'
        WHEN (pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100 >= pp.umbral_alerta THEN 'Umbral alcanzado'
        ELSE 'OK'
      END AS estado_alerta
    FROM presupuestos_proyecto pp
    JOIN proyectos p ON p.id = pp.proyecto_id
    ORDER BY porcentaje_uso DESC
  `);

  return rows;
}
