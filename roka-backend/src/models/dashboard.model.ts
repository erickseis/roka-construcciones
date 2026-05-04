import { Queryable, getDb } from '../types';
import {
  DashboardSolicitudesMensual,
  DashboardGastoPorProyecto,
  DashboardTiempoConversion,
  DashboardResumen,
} from '../types/dashboard.types';

export async function getSolicitudesMensual(
  db?: Queryable
): Promise<DashboardSolicitudesMensual> {
  const conn = getDb(db);
  const { rows: [result] } = await conn.query(`
    SELECT
      COUNT(*) FILTER (WHERE estado = 'Pendiente')::int AS pendientes,
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
      COALESCE(SUM(oc.total), 0)::numeric AS gasto_total
    FROM proyectos p
    LEFT JOIN solicitudes_material sm ON sm.proyecto_id = p.id
    LEFT JOIN cotizaciones c ON c.solicitud_id = sm.id AND c.estado = 'Aprobada'
    LEFT JOIN ordenes_compra oc ON oc.cotizacion_id = c.id
    GROUP BY p.id, p.nombre
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
    JOIN cotizaciones c ON c.id = oc.cotizacion_id
    JOIN solicitudes_material sm ON sm.id = c.solicitud_id
  `);
  return result;
}

export async function getResumen(
  db?: Queryable
): Promise<DashboardResumen> {
  const conn = getDb(db);

  const [solicitudes, gasto, conversion] = await Promise.all([
    conn.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'Pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE estado IN ('Cotizando', 'Aprobado'))::int AS atendidas,
        COUNT(*)::int AS total
      FROM solicitudes_material
      WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `),
    conn.query(`
      SELECT
        p.nombre AS proyecto,
        COUNT(oc.id)::int AS total_ordenes,
        COALESCE(SUM(oc.total), 0)::numeric AS gasto_total
      FROM proyectos p
      LEFT JOIN solicitudes_material sm ON sm.proyecto_id = p.id
      LEFT JOIN cotizaciones c ON c.solicitud_id = sm.id AND c.estado = 'Aprobada'
      LEFT JOIN ordenes_compra oc ON oc.cotizacion_id = c.id
      GROUP BY p.id, p.nombre
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
      JOIN cotizaciones c ON c.id = oc.cotizacion_id
      JOIN solicitudes_material sm ON sm.id = c.solicitud_id
    `),
  ]);

  return {
    solicitudes_mensual: solicitudes.rows[0],
    gasto_por_proyecto: gasto.rows,
    tiempo_conversion: conversion.rows[0],
  };
}

export async function getAllProyectosSimple(
  db?: Queryable
): Promise<{ id: number; nombre: string }[]> {
  const conn = getDb(db);
  const { rows } = await conn.query('SELECT id, nombre FROM proyectos ORDER BY nombre');
  return rows;
}
