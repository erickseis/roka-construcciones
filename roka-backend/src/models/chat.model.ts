import pool from '../db';

export interface SystemStats {
  pendientes: number;
  atendidas: number;
  total_mensual: number;
  total_gastado: number;
  proyectos: string[];
  proyecto_top: string;
  promedio_conversion: number;
  proyectos_activos: any[];
  presupuestos: any[];
  alertas: any[];
  proveedores: any[];
  notificaciones: any[];
  totales_presupuesto: {
    total: number;
    comprometido: number;
    disponible: number;
  };
}

export async function getSystemStats(): Promise<SystemStats> {
  const [solicitudes, gasto, conversion, proyectos, presupuestos, alertas, proveedores, notificaciones] =
    await Promise.all([
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
            AS promedio_dias
        FROM ordenes_compra oc
        JOIN cotizaciones c ON c.id = oc.cotizacion_id
        JOIN solicitudes_material sm ON sm.id = c.solicitud_id
      `),
      pool.query(`
        SELECT nombre, estado, fecha_inicio, ubicacion
        FROM proyectos WHERE is_active = true ORDER BY nombre LIMIT 20
      `),
      pool.query(`
        SELECT pp.monto_total, pp.monto_comprometido, pp.estado,
               p.nombre as proyecto_nombre,
               COALESCE((pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso
        FROM presupuestos_proyecto pp
        JOIN proyectos p ON p.id = pp.proyecto_id
        ORDER BY p.nombre
      `),
      pool.query(`
        SELECT p.nombre as proyecto,
               COALESCE((pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso,
               CASE
                 WHEN pp.monto_total = 0 THEN 'Sin presupuesto'
                 WHEN (pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100 >= 100 THEN 'Sobreconsumo'
                 WHEN (pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100 >= COALESCE(pp.umbral_alerta, 80) THEN 'Umbral alcanzado'
                 ELSE 'OK'
               END AS estado_alerta
        FROM presupuestos_proyecto pp
        JOIN proyectos p ON p.id = pp.proyecto_id
        WHERE pp.estado IN ('Vigente', 'Borrador')
          AND (
            (pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100 >= 100
            OR (pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100 >= COALESCE(pp.umbral_alerta, 80)
          )
        ORDER BY porcentaje_uso DESC
        LIMIT 10
      `),
      pool.query(`
        SELECT nombre, rut, contacto_nombre, telefono, correo
        FROM proveedores WHERE is_active = true ORDER BY nombre LIMIT 20
      `),
      pool.query(`
        SELECT titulo, mensaje, created_at
        FROM notificaciones
        WHERE leida = false ORDER BY created_at DESC LIMIT 5
      `),
    ]);

  const totalPresupuesto = presupuestos.rows.reduce((s: number, p: any) => s + Number(p.monto_total), 0);
  const totalComprometido = presupuestos.rows.reduce((s: number, p: any) => s + Number(p.monto_comprometido), 0);
  const totalDisponible = totalPresupuesto - totalComprometido;

  return {
    pendientes: solicitudes.rows[0]?.pendientes || 0,
    atendidas: solicitudes.rows[0]?.atendidas || 0,
    total_mensual: solicitudes.rows[0]?.total || 0,
    total_gastado: gasto.rows.reduce((s: number, p: any) => s + Number(p.gasto_total), 0),
    proyectos: gasto.rows.map((r: any) => r.proyecto),
    proyecto_top: gasto.rows[0]?.proyecto || 'N/A',
    promedio_conversion: conversion.rows[0]?.promedio_dias || 0,
    proyectos_activos: proyectos.rows,
    presupuestos: presupuestos.rows,
    alertas: alertas.rows,
    proveedores: proveedores.rows,
    notificaciones: notificaciones.rows,
    totales_presupuesto: {
      total: totalPresupuesto,
      comprometido: totalComprometido,
      disponible: totalDisponible,
    },
  };
}
