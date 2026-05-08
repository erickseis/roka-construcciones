import { Queryable, getDb } from '../types';
import {
  DashboardSolicitudesMensual,
  DashboardGastoPorProyecto,
  DashboardTiempoConversion,
  DashboardResumen,
  DashboardSolicitudUrgente,
} from '../types/dashboard.types';

export async function getSolicitudesMensual(
  db?: Queryable
): Promise<DashboardSolicitudesMensual> {
  const conn = getDb(db);
  const { rows: [result] } = await conn.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'Pendiente')::int AS pendientes,
      COUNT(*) FILTER (WHERE estado = 'Cotizando')::int AS cotizando,
      COUNT(*) FILTER (WHERE estado = 'Aprobado')::int AS aprobadas,
      COUNT(*) FILTER (WHERE estado IN ('Cotizando', 'Aprobado'))::int AS atendidas,
      COUNT(*)::int AS total
    FROM solicitudes_material
    WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
  `);
  return result;
}

export async function getGastoPorProyecto(
  db?: Queryable
): Promise<DashboardGastoPorProyecto[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(`
    SELECT
      p.nombre AS proyecto,
      COUNT(oc.id)::int AS total_ordenes,
      COALESCE(SUM(oc.total), 0)::numeric AS gasto_total,
      COALESCE(pp.monto_total, 0)::numeric AS presupuesto_total,
      COALESCE(SUM(oc.total), 0)::numeric AS presupuesto_usado,
      COALESCE(pp.monto_total - COALESCE(SUM(oc.total), 0), 0)::numeric AS presupuesto_disponible,
      COALESCE((COALESCE(SUM(oc.total), 0) / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso
    FROM proyectos p
    LEFT JOIN presupuestos_proyecto pp ON pp.proyecto_id = p.id
    LEFT JOIN solicitudes_material sm ON sm.proyecto_id = p.id
    LEFT JOIN solicitud_cotizacion sc ON sc.solicitud_id = sm.id AND sc.estado = 'Respondida'
    LEFT JOIN ordenes_compra oc ON oc.solicitud_cotizacion_id = sc.id
    GROUP BY p.id, p.nombre, pp.monto_total
    ORDER BY gasto_total DESC
  `);
  return rows;
}

export async function getTiempoConversion(
  db?: Queryable
): Promise<DashboardTiempoConversion> {
  const conn = getDb(db);
  const { rows: [result] } = await conn.query(`
    SELECT
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (oc.created_at - sm.created_at)) / 86400), 1), 0)
        AS promedio_dias,
      COALESCE(ROUND(MIN(EXTRACT(EPOCH FROM (oc.created_at - sm.created_at)) / 86400)::numeric, 1), 0)
        AS min_dias,
      COALESCE(ROUND(MAX(EXTRACT(EPOCH FROM (oc.created_at - sm.created_at)) / 86400)::numeric, 1), 0)
        AS max_dias
    FROM ordenes_compra oc
    JOIN solicitud_cotizacion sc ON sc.id = oc.solicitud_cotizacion_id
    JOIN solicitudes_material sm ON sm.id = sc.solicitud_id
  `);
  return result;
}

export async function getSolicitudesUrgentes(
  db?: Queryable
): Promise<DashboardSolicitudUrgente[]> {
  const conn = getDb(db);
  const { rows } = await conn.query(`
    SELECT 
      sm.id,
      sm.solicitante,
      sm.estado,
      sm.fecha_requerida,
      sm.created_at,
      p.nombre AS proyecto_nombre,
      p.id AS proyecto_id,
      (SELECT COUNT(*) FROM solicitud_items WHERE solicitud_id = sm.id)::int AS total_items,
      CASE 
        WHEN sm.fecha_requerida IS NULL THEN NULL
        ELSE sm.fecha_requerida - CURRENT_DATE
      END AS dias_restantes
    FROM solicitudes_material sm
    JOIN proyectos p ON p.id = sm.proyecto_id
    WHERE sm.estado IN ('Pendiente', 'Cotizando')
      AND sm.fecha_requerida IS NOT NULL
    ORDER BY sm.fecha_requerida ASC
    LIMIT 15
  `);
  return rows;
}

export async function getResumen(
  db?: Queryable
): Promise<DashboardResumen> {
  const conn = getDb(db);

  const [solicitudes, gasto, conversion, urgentes] = await Promise.all([
    conn.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'Pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'Cotizando')::int AS cotizando,
        COUNT(*) FILTER (WHERE estado = 'Aprobado')::int AS aprobadas,
        COUNT(*) FILTER (WHERE estado IN ('Cotizando', 'Aprobado'))::int AS atendidas,
        COUNT(*)::int AS total
      FROM solicitudes_material
      WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `),
    conn.query(`
      SELECT
        p.nombre AS proyecto,
        COUNT(oc.id)::int AS total_ordenes,
        COALESCE(SUM(oc.total), 0)::numeric AS gasto_total,
        COALESCE(pp.monto_total, 0)::numeric AS presupuesto_total,
        COALESCE(SUM(oc.total), 0)::numeric AS presupuesto_usado,
        COALESCE(pp.monto_total - COALESCE(SUM(oc.total), 0), 0)::numeric AS presupuesto_disponible,
        COALESCE((COALESCE(SUM(oc.total), 0) / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso
      FROM proyectos p
      LEFT JOIN presupuestos_proyecto pp ON pp.proyecto_id = p.id
      LEFT JOIN solicitudes_material sm ON sm.proyecto_id = p.id
      LEFT JOIN solicitud_cotizacion sc ON sc.solicitud_id = sm.id AND sc.estado = 'Respondida'
      LEFT JOIN ordenes_compra oc ON oc.solicitud_cotizacion_id = sc.id
      GROUP BY p.id, p.nombre, pp.monto_total
      ORDER BY gasto_total DESC
    `),
    conn.query(`
      SELECT
        COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (oc.created_at - sm.created_at)) / 86400), 1), 0)
          AS promedio_dias,
        COALESCE(ROUND(MIN(EXTRACT(EPOCH FROM (oc.created_at - sm.created_at)) / 86400)::numeric, 1), 0)
          AS min_dias,
        COALESCE(ROUND(MAX(EXTRACT(EPOCH FROM (oc.created_at - sm.created_at)) / 86400)::numeric, 1), 0)
          AS max_dias
      FROM ordenes_compra oc
      JOIN solicitud_cotizacion sc ON sc.id = oc.solicitud_cotizacion_id
      JOIN solicitudes_material sm ON sm.id = sc.solicitud_id
    `),
    conn.query(`
      SELECT 
        sm.id,
        sm.solicitante,
        sm.estado,
        sm.fecha_requerida,
        sm.created_at,
        p.nombre AS proyecto_nombre,
        p.id AS proyecto_id,
        (SELECT COUNT(*) FROM solicitud_items WHERE solicitud_id = sm.id)::int AS total_items,
        CASE 
          WHEN sm.fecha_requerida IS NULL THEN NULL
          ELSE sm.fecha_requerida - CURRENT_DATE
        END AS dias_restantes
      FROM solicitudes_material sm
      JOIN proyectos p ON p.id = sm.proyecto_id
      WHERE sm.estado IN ('Pendiente', 'Cotizando')
        AND sm.fecha_requerida IS NOT NULL
      ORDER BY sm.fecha_requerida ASC
      LIMIT 15
    `),
  ]);

  return {
    solicitudes_mensual: solicitudes.rows[0],
    gasto_por_proyecto: gasto.rows,
    tiempo_conversion: conversion.rows[0],
    solicitudes_urgentes: urgentes.rows,
  };
}

export async function getAllProyectosSimple(
  db?: Queryable
): Promise<{ id: number; nombre: string }[]> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT id, nombre FROM proyectos ORDER BY nombre');
  return rows;
}
