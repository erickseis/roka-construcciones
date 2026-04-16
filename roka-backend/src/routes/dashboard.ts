import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// GET /api/dashboard/solicitudes-mensual
// KPI: Solicitudes pendientes vs atendidas en el mes actual
router.get('/solicitudes-mensual', async (_req: Request, res: Response) => {
  try {
    const { rows: [result] } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estado = 'Pendiente')::int AS pendientes,
        COUNT(*) FILTER (WHERE estado IN ('Cotizando', 'Aprobado'))::int AS atendidas,
        COUNT(*)::int AS total
      FROM solicitudes_material
      WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
    `);
    res.json(result);
  } catch (error) {
    console.error('Error KPI solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener KPI de solicitudes' });
  }
});

// GET /api/dashboard/gasto-por-proyecto
// KPI: Gasto total aprobado en OCs por proyecto
router.get('/gasto-por-proyecto', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
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
    res.json(rows);
  } catch (error) {
    console.error('Error KPI gasto:', error);
    res.status(500).json({ error: 'Error al obtener KPI de gasto' });
  }
});

// GET /api/dashboard/tiempo-conversion
// KPI: Tiempo promedio de conversión (Solicitud → OC) en días
router.get('/tiempo-conversion', async (_req: Request, res: Response) => {
  try {
    const { rows: [result] } = await pool.query(`
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
    res.json(result);
  } catch (error) {
    console.error('Error KPI conversión:', error);
    res.status(500).json({ error: 'Error al obtener KPI de conversión' });
  }
});

// GET /api/dashboard/resumen
// Un endpoint compuesto que retorna todos los KPIs de una vez
router.get('/resumen', async (_req: Request, res: Response) => {
  try {
    const [solicitudes, gasto, conversion] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE estado = 'Pendiente')::int AS pendientes,
          COUNT(*) FILTER (WHERE estado IN ('Cotizando', 'Aprobado'))::int AS atendidas,
          COUNT(*)::int AS total
        FROM solicitudes_material
        WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
      `),
      pool.query(`
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
      pool.query(`
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
      `)
    ]);

    res.json({
      solicitudes_mensual: solicitudes.rows[0],
      gasto_por_proyecto: gasto.rows,
      tiempo_conversion: conversion.rows[0],
    });
  } catch (error) {
    console.error('Error dashboard resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen del dashboard' });
  }
});

// GET /api/proyectos — Listar proyectos (auxiliar)
router.get('/proyectos', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM proyectos ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
});

export default router;
