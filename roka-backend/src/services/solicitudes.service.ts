import pool from '../db';
import * as solicitudModel from '../models/solicitudes.model';

export interface CreateSolicitudInput {
  proyecto_id: number;
  solicitante: string;
  fecha?: string;
  items: Array<{
    material_id?: number;
    nombre_material?: string;
    cantidad_requerida: number;
    unidad?: string;
  }>;
}

export interface SolicitudConItems {
  id: number;
  proyecto_id: number;
  solicitante: string;
  fecha: string;
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
      },
      db
    );

    // Create each item, resolving material name/unit from catalog when material_id is provided
    const items: any[] = [];
    for (const item of input.items) {
      let nombre_material = item.nombre_material || '';
      let unidad = item.unidad || '';

      if (item.material_id) {
        const { rows: material } = await client.query(
          `SELECT m.nombre, u.abreviatura
           FROM materiales m
           LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
           WHERE m.id = $1`,
          [item.material_id]
        );
        if (material.length > 0) {
          nombre_material = material[0].nombre;
          unidad = material[0].abreviatura;
        }
      }

      const createdItem = await solicitudModel.createSolicitudItem(
        {
          solicitud_id: solicitud.id,
          material_id: item.material_id || null,
          nombre_material,
          cantidad_requerida: item.cantidad_requerida,
          unidad,
        },
        db
      );

      items.push(createdItem);
    }

    await client.query('COMMIT');

    return { ...solicitud, items };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
