import pool from '../db';
import { getDb, Queryable } from '../types';
import { parseCotizacionFile } from '../lib/cotizacion-parser';
import {
  ParsedQuotation,
  ParsedItem,
  ImportPreviewResponse,
  ConfirmImportInput,
  SCItemForMatch,
  ImportItemMatch,
} from '../types/cotizacion-import.types';
import { Cotizacion } from '../types/cotizacion.types';
import { createCotizacion, createCotizacionItem } from '../models/cotizaciones.model';
import { getSolicitudCotizacionById } from '../models/solicitud_cotizacion.model';

/**
 * Obtiene los items de una solicitud de cotización
 */
async function getSCItems(solicitudCotizacionId: number): Promise<SCItemForMatch[]> {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT 
      scd.solicitud_item_id as id,
      scd.solicitud_item_id,
      si.nombre_material,
      si.cantidad_requerida,
      si.unidad,
      si.codigo
    FROM solicitud_cotizacion_detalle scd
    JOIN solicitud_items si ON si.id = scd.solicitud_item_id
    WHERE scd.solicitud_cotizacion_id = $1
    ORDER BY scd.id
  `, [solicitudCotizacionId]);

  return rows;
}

/**
 * Busca un proveedor en el catálogo por RUT
 */
async function findProveedorByRut(rut: string, db?: Queryable): Promise<{ id: number; nombre: string; rut: string } | null> {
  const conn = getDb(db);
  // Normalizar RUT: quitar puntos y guiones para comparación
  const rutNormalized = rut.replace(/[.\-]/g, '').toUpperCase();

  const { rows: [proveedor] } = await conn.query(
    `SELECT id, nombre, rut FROM proveedores WHERE REPLACE(REPLACE(REPLACE(rut, '.', ''), '-', ''), ' ', '') = $1 AND is_active = true`,
    [rutNormalized]
  );

  return proveedor || null;
}

/**
 * Calcula similitud entre dos strings (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Distancia de Levenshtein simple
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(len1, len2);
  return maxLen === 0 ? 1 : 1 - matrix[len1][len2] / maxLen;
}

/**
 * Matching de un item parseado con los items de la SC
 */
function matchItem(parsedItem: ParsedItem, scItems: SCItemForMatch[]): ImportItemMatch {
  // 1. Buscar por código exacto
  const exactCodeMatch = scItems.find(sc => 
    sc.codigo && parsedItem.codigo && 
    sc.codigo.toLowerCase().trim() === parsedItem.codigo.toLowerCase().trim()
  );

  if (exactCodeMatch) {
    const cantidadOk = Math.abs(exactCodeMatch.cantidad_requerida - parsedItem.cantidad) < 0.01;
    return {
      parsed: parsedItem,
      solicitud_item: exactCodeMatch,
      match_tipo: 'exact_code',
      cantidad_ok: cantidadOk,
      warning: !cantidadOk ? `Cantidad diferente: SC=${exactCodeMatch.cantidad_requerida}, Archivo=${parsedItem.cantidad}` : null,
    };
  }

  // 2. Buscar por nombre similar
  let bestMatch: SCItemForMatch | null = null;
  let bestSimilarity = 0;

  for (const scItem of scItems) {
    const similarity = calculateSimilarity(scItem.nombre_material, parsedItem.descripcion);
    if (similarity > bestSimilarity && similarity >= 0.5) {
      bestSimilarity = similarity;
      bestMatch = scItem;
    }
  }

  if (bestMatch) {
    const cantidadOk = Math.abs(bestMatch.cantidad_requerida - parsedItem.cantidad) < 0.01;
    return {
      parsed: parsedItem,
      solicitud_item: bestMatch,
      match_tipo: 'similar_name',
      cantidad_ok: cantidadOk,
      warning: !cantidadOk ? `Cantidad diferente: SC=${bestMatch.cantidad_requerida}, Archivo=${parsedItem.cantidad}` : null,
    };
  }

  // 3. No hay match
  return {
    parsed: parsedItem,
    solicitud_item: null,
    match_tipo: 'none',
    cantidad_ok: false,
    warning: 'No se encontró coincidencia en la solicitud de cotización',
  };
}

/**
 * Importa y valida un archivo de cotización
 */
export async function importarYValidar(
  filePath: string,
  mimetype: string,
  solicitudCotizacionId: number,
  originalName: string
): Promise<ImportPreviewResponse> {
  // 1. Obtener datos de la SC
  const sc = await getSolicitudCotizacionById(solicitudCotizacionId);
  if (!sc) {
    throw Object.assign(new Error('Solicitud de cotización no encontrada'), { statusCode: 404 });
  }

  // 2. Parsear el archivo
  const parsed = await parseCotizacionFile(filePath, mimetype);

  // 3. Buscar proveedor en catálogo
  const proveedorCatalogo = await findProveedorByRut(parsed.proveedor_rut);

  // 4. Obtener items de la SC
  const scItems = await getSCItems(solicitudCotizacionId);

  // 5. Matching de items
  const itemsMatched: ImportItemMatch[] = [];
  const itemsUnmatched: ParsedItem[] = [];

  for (const parsedItem of parsed.items) {
    const match = matchItem(parsedItem, scItems);
    if (match.solicitud_item) {
      itemsMatched.push(match);
    } else {
      itemsUnmatched.push(parsedItem);
    }
  }

  // 6. Items faltantes en el archivo (items de SC que no están en el archivo)
  const matchedScItemIds = new Set(itemsMatched.map(m => m.solicitud_item!.solicitud_item_id));
  const itemsFaltantesEnSc = scItems.filter(sc => !matchedScItemIds.has(sc.solicitud_item_id));

  // 7. Calcular resumen
  const totalArchivo = parsed.items.reduce((sum, item) => sum + item.total_linea, 0);
  const totalItemsSc = scItems.length;

  let warning: string | null = null;
  if (itemsUnmatched.length > 0) {
    warning = `${itemsUnmatched.length} ítem(s) del archivo no coinciden con la SC`;
  }
  if (itemsFaltantesEnSc.length > 0) {
    warning = warning ? `${warning}, ${itemsFaltantesEnSc.length} ítem(s) de la SC no están en el archivo` : `${itemsFaltantesEnSc.length} ítem(s) de la SC no están en el archivo`;
  }

  return {
    parsed,
    solicitud_cotizacion_id: solicitudCotizacionId,
    solicitud_id: sc.solicitud_id,
    proveedor_catalogo: proveedorCatalogo,
    archivo_path: filePath,
    archivo_nombre: originalName,
    validacion: {
      items_matched: itemsMatched,
      items_unmatched: itemsUnmatched,
      items_faltantes_en_sc: itemsFaltantesEnSc,
      resumen: {
        total_items_archivo: parsed.items.length,
        total_items_sc: totalItemsSc,
        total_matched: itemsMatched.length,
        total_unmatched: itemsUnmatched.length,
        total_faltantes: itemsFaltantesEnSc.length,
        total_archivo: totalArchivo,
        diferencia: parsed.items.length - totalItemsSc,
        warning,
      },
    },
  };
}

/**
 * Confirma la importación y crea la cotización
 */
export async function confirmarImportacion(
  input: ConfirmImportInput,
  usuarioId: number | null
): Promise<Cotizacion> {
  const {
    solicitud_id,
    solicitud_cotizacion_id,
    archivo_path,
    archivo_nombre,
    proveedor_id,
    proveedor_nombre,
    numero_cov,
    metodo_importacion,
    items,
    datos_importados,
  } = input;

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Verificar que la SC existe y no está Respondida
    const { rows: [sc] } = await client.query(
      `SELECT * FROM solicitud_cotizacion WHERE id = $1`,
      [solicitud_cotizacion_id]
    );

    if (!sc) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Solicitud de cotización no encontrada'), { statusCode: 404 });
    }

    if (sc.estado === 'Respondida' || sc.estado === 'Anulada') {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('La solicitud de cotización ya está procesada'), { statusCode: 400 });
    }

    // 2. Verificar que la solicitud existe
    const { rows: [solicitud] } = await client.query(
      'SELECT * FROM solicitudes_material WHERE id = $1',
      [solicitud_id]
    );

    if (!solicitud) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Solicitud de materiales no encontrada'), { statusCode: 404 });
    }

    // 3. Verificar número de cotización único
    if (numero_cov && numero_cov !== 'SIN-NUMERO') {
      const { rows: [existing] } = await client.query(
        'SELECT id FROM cotizaciones WHERE numero_cov = $1',
        [numero_cov]
      );

      if (existing) {
        await client.query('ROLLBACK');
        throw Object.assign(new Error(`Ya existe una cotización con el número ${numero_cov}`), { statusCode: 400 });
      }
    }

    // 4. Validar que los items existen en la SC
    const itemIds = items.map(i => i.solicitud_item_id);
    const { rows: scItems } = await client.query(
      `SELECT si.id, si.cantidad_requerida 
       FROM solicitud_items si
       JOIN solicitud_cotizacion_detalle scd ON scd.solicitud_item_id = si.id
       WHERE scd.solicitud_cotizacion_id = $1 AND si.id = ANY($2::int[])`,
      [solicitud_cotizacion_id, itemIds]
    );

    if (scItems.length !== items.length) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Algunos ítems no pertenecen a la solicitud de cotización'), { statusCode: 400 });
    }

    // 5. Calcular total
    let total = 0;
    const validatedItems: Array<{
      solicitud_item_id: number;
      precio_unitario: number;
      subtotal: number;
      descuento_porcentaje: number;
      codigo_proveedor: string;
    }> = [];

    const scItemMap = new Map(scItems.map(r => [r.id, r]));

    for (const item of items) {
      const scItem = scItemMap.get(item.solicitud_item_id);
      const descuento = item.descuento_porcentaje || 0;
      const subtotal = (scItem?.cantidad_requerida || 0) * item.precio_unitario * (1 - descuento / 100);
      total += subtotal;
      validatedItems.push({
        solicitud_item_id: item.solicitud_item_id,
        precio_unitario: item.precio_unitario,
        subtotal,
        descuento_porcentaje: item.descuento_porcentaje,
        codigo_proveedor: item.codigo_proveedor,
      });
    }

    // 6. Crear la cotización con los nuevos campos
    const cotizacion = await createCotizacion(
      {
        solicitud_id,
        solicitud_cotizacion_id,
        proveedor_id: proveedor_id || null,
        proveedor: proveedor_nombre,
        total,
        created_by_usuario_id: usuarioId,
        numero_cov,
        imported_from_file: true,
        metodo_importacion,
        datos_importados,
        archivo_adjunto_path: archivo_path,
        archivo_adjunto_nombre: archivo_nombre,
      },
      client
    );

    // 7. Crear los items de cotización con los nuevos campos
    for (const item of validatedItems) {
      await createCotizacionItem(
        {
          cotizacion_id: cotizacion.id,
          solicitud_item_id: item.solicitud_item_id,
          precio_unitario: item.precio_unitario,
          subtotal: item.subtotal,
          descuento_porcentaje: item.descuento_porcentaje,
          codigo_proveedor: item.codigo_proveedor,
        },
        client
      );
    }

    // 8. Marcar la SC como Respondida
    await client.query(
      `UPDATE solicitud_cotizacion SET estado = 'Respondida', updated_at = NOW() WHERE id = $1`,
      [solicitud_cotizacion_id]
    );

    // 9. Cambiar estado de la solicitud a 'Cotizando' si está Pendiente
    if (solicitud.estado === 'Pendiente') {
      await client.query(
        `UPDATE solicitudes_material SET estado = 'Cotizando', updated_at = NOW() WHERE id = $1 AND estado = 'Pendiente'`,
        [solicitud_id]
      );
    }

    await client.query('COMMIT');
    return cotizacion;
  } catch (error: any) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}