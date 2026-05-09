import { Queryable, getDb } from '../types';
import { SolicitudCotizacion, SolicitudCotizacionDetalle, SolicitudCotizacionFilters } from '../types/solicitudCotizacion.types';

export async function getAllSolicitudesCotizacion(filters: SolicitudCotizacionFilters): Promise<SolicitudCotizacion[]> {
  const db = getDb();
  let query = `
    SELECT sc.*, sm.solicitante, p.nombre AS proyecto_nombre, p.numero_obra AS proyecto_numero_obra,
           sm.fecha AS fecha_solicitud, sm.estado AS solicitud_estado,
           (SELECT COUNT(*) FROM solicitud_cotizacion_detalle WHERE solicitud_cotizacion_id = sc.id) AS total_items,
           (SELECT oc.id FROM ordenes_compra oc WHERE oc.solicitud_cotizacion_id = sc.id LIMIT 1) AS orden_id
    FROM solicitud_cotizacion sc
    JOIN solicitudes_material sm ON sm.id = sc.solicitud_id
    JOIN proyectos p ON p.id = sm.proyecto_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.solicitud_id) {
    params.push(filters.solicitud_id);
    query += ` AND sc.solicitud_id = $${params.length}`;
  }
  if (filters.estado) {
    params.push(filters.estado);
    query += ` AND sc.estado = $${params.length}`;
  }
  if (filters.proveedor) {
    params.push(`%${filters.proveedor}%`);
    query += ` AND sc.proveedor ILIKE $${params.length}`;
  }
  if (filters.proyecto_id) {
    params.push(filters.proyecto_id);
    query += ` AND sm.proyecto_id = $${params.length}`;
  }

  query += ' ORDER BY sc.created_at DESC';

  const { rows } = await db.query(query, params);
  return rows;
}

export async function getSolicitudCotizacionById(id: number): Promise<(SolicitudCotizacion & { total_items?: number }) | null> {
  const db = getDb();
  const { rows: [sc] } = await db.query(`
    SELECT sc.*, sm.solicitante, p.nombre AS proyecto_nombre, p.numero_obra AS proyecto_numero_obra,
           sm.fecha AS fecha_solicitud, sm.estado AS solicitud_estado,
           prov.rut AS prov_rut,
           prov.correo AS prov_correo,
           prov.telefono AS prov_telefono,
           prov.direccion AS prov_direccion,
           prov.condiciones_pago AS prov_condiciones_pago,
           prov.condicion_despacho AS prov_condicion_despacho,
           prov.plazo_entrega AS prov_plazo_entrega,
           prov.contacto_nombre AS prov_contacto_nombre,
           prov.contacto_correo AS prov_contacto_correo,
           prov.contacto_telefono AS prov_contacto_telefono,
           (SELECT COUNT(*) FROM solicitud_cotizacion_detalle WHERE solicitud_cotizacion_id = sc.id) AS total_items,
           (SELECT oc.id FROM ordenes_compra oc WHERE oc.solicitud_cotizacion_id = sc.id LIMIT 1) AS orden_id,
           NULLIF(CONCAT(u_env.nombre, ' ', u_env.apellido), ' ') AS enviado_by_nombre,
           NULLIF(CONCAT(u_res.nombre, ' ', u_res.apellido), ' ') AS respondido_by_nombre,
           NULLIF(CONCAT(u_apr.nombre, ' ', u_apr.apellido), ' ') AS aprobado_by_nombre,
           NULLIF(CONCAT(u_rec.nombre, ' ', u_rec.apellido), ' ') AS rechazado_by_nombre
    FROM solicitud_cotizacion sc
    JOIN solicitudes_material sm ON sm.id = sc.solicitud_id
    JOIN proyectos p ON p.id = sm.proyecto_id
    LEFT JOIN proveedores prov ON prov.id = sc.proveedor_id
    LEFT JOIN usuarios u_env ON u_env.id = sc.enviado_by_usuario_id
    LEFT JOIN usuarios u_res ON u_res.id = sc.respondido_by_usuario_id
    LEFT JOIN usuarios u_apr ON u_apr.id = sc.aprobado_by_usuario_id
    LEFT JOIN usuarios u_rec ON u_rec.id = sc.rechazado_by_usuario_id
    WHERE sc.id = $1
  `, [id]);
  return sc || null;
}

export async function getSolicitudCotizacionDetalle(scId: number): Promise<SolicitudCotizacionDetalle[]> {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT scd.*, si.nombre_material, si.cantidad_requerida, si.unidad, si.codigo
    FROM solicitud_cotizacion_detalle scd
    JOIN solicitud_items si ON si.id = scd.solicitud_item_id
    WHERE scd.solicitud_cotizacion_id = $1
    ORDER BY scd.id
  `, [scId]);
  return rows;
}

export async function createSolicitudCotizacion(data: {
  solicitud_id: number;
  proveedor_id: number | null;
  proveedor: string;
  estado: string;
  observaciones: string | null;
  created_by_usuario_id: number | null;
}, db?: Queryable): Promise<SolicitudCotizacion> {
  const conn = getDb(db);
  const { rows: [sc] } = await conn.query(
    `INSERT INTO solicitud_cotizacion (solicitud_id, proveedor_id, proveedor, estado, observaciones, created_by_usuario_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [data.solicitud_id, data.proveedor_id, data.proveedor, data.estado, data.observaciones, data.created_by_usuario_id]
  );
  return sc;
}

export async function createSolicitudCotizacionDetalle(data: {
  solicitud_cotizacion_id: number;
  solicitud_item_id: number;
}, db?: Queryable): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `INSERT INTO solicitud_cotizacion_detalle (solicitud_cotizacion_id, solicitud_item_id) VALUES ($1, $2)`,
    [data.solicitud_cotizacion_id, data.solicitud_item_id]
  );
}

export async function createBatchSolicitudCotizacionDetalle(
  scId: number,
  solicitudItemIds: number[],
  db?: Queryable
): Promise<void> {
  const conn = getDb(db);
  for (let i = 0; i < solicitudItemIds.length; i += 500) {
    const chunk = solicitudItemIds.slice(i, i + 500);
    const placeholders = chunk.map((_, j) => `($1, $${j + 2})`).join(', ');
    await conn.query(
      `INSERT INTO solicitud_cotizacion_detalle (solicitud_cotizacion_id, solicitud_item_id) VALUES ${placeholders}`,
      [scId, ...chunk]
    );
  }
}

export async function updateSolicitudCotizacionEstado(id: number, estado: string, changedByUsuarioId?: number | null, db?: Queryable): Promise<SolicitudCotizacion | null> {
  const conn = getDb(db);
  let setClauses = `estado = $1, updated_at = NOW()`;
  const params: any[] = [estado, id];
  
  if (changedByUsuarioId != null) {
    const paramIdx = params.length + 1;
    if (estado === 'Enviada') {
      setClauses += `, enviado_by_usuario_id = $${paramIdx}, enviado_at = NOW()`;
      params.push(changedByUsuarioId);
    } else if (estado === 'Respondida') {
      setClauses += `, respondido_by_usuario_id = $${paramIdx}, respondido_at = NOW()`;
      params.push(changedByUsuarioId);
    } else if (estado === 'Anulada') {
      setClauses += `, rechazado_by_usuario_id = $${paramIdx}, rechazado_at = NOW()`;
      params.push(changedByUsuarioId);
    }
  }
  
  const { rows: [sc] } = await conn.query(
    `UPDATE solicitud_cotizacion SET ${setClauses} WHERE id = $2 RETURNING *`,
    params
  );
  return sc || null;
}

export async function deleteSolicitudCotizacion(id: number, db?: Queryable): Promise<boolean> {
  const conn = getDb(db);
  
  // Obtenemos el solicitud_id antes de borrar
  const { rows: [sc] } = await conn.query('SELECT solicitud_id, estado FROM solicitud_cotizacion WHERE id = $1', [id]);
  if (!sc) return false;

  // Permitir eliminar en cualquier estado excepto 'Respondida' (que ya tiene precios)
  const estadoLower = (sc.estado || '').toLowerCase();
  if (estadoLower === 'respondida') {
    return false;
  }

  const { rowCount } = await conn.query(
    `DELETE FROM solicitud_cotizacion WHERE id = $1`,
    [id]
  );

  if ((rowCount || 0) > 0) {
    // Verificar si quedan cotizaciones activas para esta solicitud
    const { rows: [{ count }] } = await conn.query(
      `SELECT COUNT(*) as count FROM solicitud_cotizacion WHERE solicitud_id = $1 AND LOWER(estado) NOT IN ('anulada')`,
      [sc.solicitud_id]
    );

    if (Number(count) === 0) {
      // Si no quedan cotizaciones activas, volver a estado Pendiente
      await conn.query(
        "UPDATE solicitudes_material SET estado = 'Pendiente', updated_at = NOW() WHERE id = $1 AND estado != 'Anulada'",
        [sc.solicitud_id]
      );
    }
    return true;
  }
  
  return false;
}

export async function checkAllItemsCovered(solicitudId: number, db?: Queryable): Promise<boolean> {
  const conn = getDb(db);
  const { rows: [{ total }] } = await conn.query(
    'SELECT COUNT(*) as total FROM solicitud_items WHERE solicitud_id = $1',
    [solicitudId]
  );
  if (Number(total) === 0) return false;

  const { rows: [{ covered }] } = await conn.query(`
    SELECT COUNT(DISTINCT scd.solicitud_item_id) as covered
    FROM solicitud_cotizacion_detalle scd
    JOIN solicitud_cotizacion sc ON sc.id = scd.solicitud_cotizacion_id
    WHERE sc.solicitud_id = $1 AND sc.estado != 'Anulada'
  `, [solicitudId]);

  return Number(covered) >= Number(total);
}

export async function updateSolicitudEstadoIfPendiente(
  solicitudId: number,
  changedByUsuarioId?: number | null,
  db?: Queryable
): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `UPDATE solicitudes_material 
     SET estado = 'Cotizando', updated_at = NOW(), 
         estado_changed_by_usuario_id = $2, estado_changed_at = NOW()
     WHERE id = $1 AND estado = 'Pendiente'`,
    [solicitudId, changedByUsuarioId ?? null]
  );
}

export async function updateDetalleConPrecios(
  detalleId: number,
  data: {
    precio_unitario: number;
    descuento_porcentaje?: number;
    codigo_proveedor?: string;
  },
  db?: Queryable
): Promise<void> {
  const conn = getDb(db);
  const subtotal = data.descuento_porcentaje && data.descuento_porcentaje > 0
    ? data.precio_unitario * (1 - data.descuento_porcentaje / 100)
    : data.precio_unitario;

  await conn.query(
    `UPDATE solicitud_cotizacion_detalle 
     SET precio_unitario = $1, 
         subtotal = $2, 
         descuento_porcentaje = COALESCE($3, descuento_porcentaje),
         codigo_proveedor = $4
     WHERE id = $5`,
    [data.precio_unitario, subtotal, data.descuento_porcentaje ?? null, data.codigo_proveedor ?? null, detalleId]
  );
}

export async function getDetalleConPrecios(scId: number): Promise<any[]> {
  const db = getDb();
  const { rows } = await db.query(`
    SELECT scd.*, si.nombre_material, si.cantidad_requerida, si.unidad
    FROM solicitud_cotizacion_detalle scd
    JOIN solicitud_items si ON si.id = scd.solicitud_item_id
    WHERE scd.solicitud_cotizacion_id = $1
    ORDER BY scd.id
  `, [scId]);
  return rows;
}

export async function updateSCArchivo(
  scId: number,
  archivoPath: string,
  archivoNombre: string,
  db?: Queryable
): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `UPDATE solicitud_cotizacion 
     SET archivo_adjunto_path = $1, archivo_adjunto_nombre = $2, updated_at = NOW()
     WHERE id = $3`,
    [archivoPath, archivoNombre, scId]
  );
}

export async function updateSCNumeroCov(scId: number, numeroCov: string, db?: Queryable): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `UPDATE solicitud_cotizacion SET numero_cov = $1, updated_at = NOW() WHERE id = $2`,
    [numeroCov, scId]
  );
}

export async function updateSCRespuestaProveedor(
  scId: number,
  data: { numero_cov?: string | null; condiciones_pago_cov?: string | null; plazo_entrega_cov?: string | null },
  db?: Queryable
): Promise<void> {
  const conn = getDb(db);
  await conn.query(
    `UPDATE solicitud_cotizacion
     SET numero_cov = COALESCE($1, numero_cov),
         condiciones_pago_cov = COALESCE($2, condiciones_pago_cov),
         plazo_entrega_cov = COALESCE($3, plazo_entrega_cov),
         updated_at = NOW()
     WHERE id = $4`,
    [data.numero_cov || null, data.condiciones_pago_cov || null, data.plazo_entrega_cov || null, scId]
  );
}
