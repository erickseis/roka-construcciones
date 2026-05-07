import pool from '../db';
import * as solicitudModel from '../models/solicitudes.model';

export interface CreateSolicitudInput {
  proyecto_id: number;
  solicitante: string;
  fecha?: string;
  fecha_requerida?: string | null;
  items: Array<{
    material_id?: number;
    nombre_material?: string;
    cantidad_requerida: number;
    unidad?: string;
    codigo?: string;
  }>;
}

export interface SolicitudConItems {
  id: number;
  proyecto_id: number;
  solicitante: string;
  fecha: string;
  fecha_requerida?: string | null;
  estado: string;
  created_at: Date;
  updated_at: Date;
  items: any[];
}

export async function crearSolicitudConItems(input: CreateSolicitudInput): Promise<SolicitudConItems> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const db = { query: client.query.bind(client) };

    // Create the solicitud header
    const solicitud = await solicitudModel.createSolicitud(
      {
        proyecto_id: input.proyecto_id,
        solicitante: input.solicitante,
        fecha: input.fecha || new Date().toISOString().split('T')[0],
        fecha_requerida: input.fecha_requerida || null,
      },
      db
    );

    // Batch resolve material names from catalog (1 query for all items)
    const materialIds = input.items
      .map(it => it.material_id)
      .filter((id): id is number => id != null);

    const materialCache = new Map<number, { nombre: string; abreviatura: string }>();
    if (materialIds.length > 0) {
      const { rows } = await client.query(
        `SELECT m.id, m.nombre, u.abreviatura
         FROM materiales m
         LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
         WHERE m.id = ANY($1::int[])`,
        [materialIds]
      );
      for (const r of rows) {
        materialCache.set(r.id, { nombre: r.nombre, abreviatura: r.abreviatura });
      }
    }

    // Build item data in memory (no DB queries)
    const itemData: Array<{
      material_id: number | null;
      nombre_material: string;
      cantidad_requerida: number;
      unidad: string;
      codigo: string | null;
    }> = [];
    for (const item of input.items) {
      let nombre_material = item.nombre_material || '';
      let unidad = item.unidad || '';
      if (item.material_id && materialCache.has(item.material_id)) {
        const mat = materialCache.get(item.material_id)!;
        nombre_material = mat.nombre;
        unidad = mat.abreviatura;
      }
      itemData.push({
        material_id: item.material_id || null,
        nombre_material,
        cantidad_requerida: item.cantidad_requerida,
        unidad,
        codigo: item.codigo || null,
      });
    }

    // Multi-row INSERT with chunking (333 per chunk to stay under PG 32767 param limit with 6 params/row)
    const CHUNK_SIZE = 333;
    const allInsertedIds: number[] = [];
    for (let i = 0; i < itemData.length; i += CHUNK_SIZE) {
      const chunk = itemData.slice(i, i + CHUNK_SIZE);
      const placeholders = chunk.map((_, j) => {
        const base = j * 6;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
      });
      const values = chunk.flatMap(d => [
        solicitud.id,
        d.material_id,
        d.nombre_material,
        d.cantidad_requerida,
        d.unidad,
        d.codigo,
      ]);
      const { rows } = await client.query(
        `INSERT INTO solicitud_items (solicitud_id, material_id, nombre_material, cantidad_requerida, unidad, codigo)
         VALUES ${placeholders.join(', ')} RETURNING id`,
        values
      );
      allInsertedIds.push(...rows.map(r => r.id));
    }

    // Retrieve items in guaranteed order
    const { rows: items } = await client.query(
      `SELECT * FROM solicitud_items WHERE id = ANY($1::int[]) ORDER BY id`,
      [allInsertedIds]
    );

    await client.query('COMMIT');

    return { ...solicitud, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
