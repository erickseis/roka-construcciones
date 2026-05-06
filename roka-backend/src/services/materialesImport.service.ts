import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import pool from '../db';
import { getProyectoById } from '../models/proyectos.model';

export async function importMaterialesFromExcel(proyectoId: number, solicitante: string): Promise<any> {
  const proyecto = await getProyectoById(proyectoId);
  if (!proyecto) {
    throw Object.assign(new Error('Proyecto no encontrado'), { statusCode: 404 });
  }

  if (!proyecto.archivo_materiales_path) {
    throw Object.assign(new Error('El proyecto no tiene archivo de materiales adjunto'), { statusCode: 400 });
  }

  const filePath = path.join(process.cwd(), proyecto.archivo_materiales_path);
  if (!fs.existsSync(filePath)) {
    throw Object.assign(new Error('Archivo de materiales no encontrado en el servidor'), { statusCode: 404 });
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const json: any[] = XLSX.utils.sheet_to_json(worksheet);

  if (json.length === 0) {
    throw Object.assign(new Error('El archivo Excel está vacío'), { statusCode: 400 });
  }

  const items = json.map((row) => {
    const nombreMaterial = row['Material'] || row['Descripcion'] || row['Descripción'] || row['Nombre'] || '';
    const cantidad = Number(row['Cantidad'] || row['Cant'] || 0);
    const unidad = row['Unidad'] || row['Medida'] || 'Unidades';

    return {
      nombre_material: nombreMaterial,
      cantidad_requerida: cantidad,
      unidad: unidad,
      codigo: row['SKU'] || row['Codigo'] || row['Código'] || null,
    };
  });

  const validItems = items.filter(item => item.nombre_material && item.cantidad_requerida > 0);
  if (validItems.length === 0) {
    throw Object.assign(new Error('No hay ítems válidos para importar'), { statusCode: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const solicitudResult = await client.query(
      `INSERT INTO solicitudes_material (proyecto_id, solicitante, fecha, estado)
       VALUES ($1, $2, CURRENT_DATE, 'Pendiente')
       RETURNING *`,
      [proyectoId, solicitante]
    );
    const solicitud = solicitudResult.rows[0];

    for (const item of validItems) {
      await client.query(
        `INSERT INTO solicitud_items (solicitud_id, nombre_material, cantidad_requerida, unidad, codigo)
         VALUES ($1, $2, $3, $4, $5)`,
        [solicitud.id, item.nombre_material, item.cantidad_requerida, item.unidad, item.codigo]
      );
    }

    await client.query('COMMIT');

    return {
      solicitud_id: solicitud.id,
      total_items: validItems.length,
      message: `Solicitud de materiales creada con ${validItems.length} ítems`,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
