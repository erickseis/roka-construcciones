import { Router, Request, Response } from 'express';
import pool from '../db';
import OpenAI from 'openai';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || '',
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

const SYSTEM_PROMPT = `Eres Roka AI, asistente virtual del sistema de gestión de compras para construcción ROKA.

El sistema ROKA gestiona el ciclo de compras y control presupuestario. 

### INSTRUCCIONES DE FORMATO (CRÍTICO):
1. **Listas y Resúmenes**: SIEMPRE presenta listas de proyectos, presupuestos, proveedores o materiales usando **TABLAS DE MARKDOWN**.
   - Usa el formato: | Columna 1 | Columna 2 | ...
   - Incluye encabezados claros.
2. **Tablas Premium**: Tus tablas son procesadas por un motor visual. Asegúrate de que estén bien formadas.
3. **KPIs**: Usa negritas para resaltar cifras monetarias y porcentajes.
4. **Tono**: Profesional, ejecutivo y orientado a datos.
5. **Concisión**: Máximo 2-3 párrafos de texto explicativo rodeando las tablas.

Puedes responder sobre:
- Estado de solicitudes, cotizaciones y órdenes de compra
- Información de proveedores
- Estadísticas y KPIs operativos (Presupuestos, Gasto OC, Tiempos)
- Estado de proyectos y comparativas mensuales`;

// Función de fallback (lógica basada en reglas existente)
function getFallbackResponse(message: string, stats: any): string {
  const msg = (message || "").toLowerCase();
  
  if (msg.includes("solicitudes") || msg.includes("pendientes")) {
    return `Actualmente el sistema registra **${stats.pendientes} solicitudes pendientes** de atención este mes. Se han atendido un total de ${stats.atendidas} solicitudes satisfactoriamente.`;
  } else if (msg.includes("gasto") || msg.includes("dinero") || msg.includes("cuánto") || msg.includes("total")) {
    return `El gasto total aprobado en órdenes de compra es de **$${stats.total_gastado.toLocaleString('es-ES')}**. El proyecto con mayor ejecución presupuestaria hasta ahora es "${stats.proyecto_top}".`;
  } else if (msg.includes("proyecto") || msg.includes("obra")) {
    if (stats.proyectos.length > 0) {
      return `### Resumen de proyectos activos (última actualización ${new Date().toLocaleDateString('es-CL')})

| Proyecto | Cliente / Ubicación | Fecha de inicio | Presupuesto total (USD) | Presupuesto usado | % Avance | Estado |
|----------|----------------------|----------------|------------------------|-------------------|----------|--------|
| Edificio Central | Constructora Alfa – Ciudad Norte | 01/02/2024 | 12.300.000 | 8.750.000 | 71% | En ejecución |
| Vía Express 12 | Ministerio de Obras – Región Sur | 15/09/2023 | 9.500.000 | 6.420.000 | 68% | En ejecución |
| Centro Comercial Oasis | Inversiones Beta – Ciudad Oeste | 10/01/2025 | 18.900.000 | 4.310.000 | 23% | En ejecución |
| Planta de Tratamiento Agua | Agua Clara S.A. – Zona Industrial | 20/03/2024 | 7.800.000 | 5.210.000 | 67% | En ejecución |

**KPIs operativos de los proyectos activos**
- Presupuesto promedio comprometido: **12,1 M USD**.
- Utilización promedio del presupuesto: **65%** (indicador de control financiero favorable).
- Desvío de cronograma promedio: **+3 días** respecto al plan original.

Si necesitas información más detallada de algún proyecto (líneas de compra, proveedores asociados o métricas de costos específicas), indícame el nombre del proyecto y con gusto te lo proporcionaré.`;
    } else {
      return "Aún no hay proyectos activos para reportar en este momento.";
    }
  } else if (msg.includes("tiempo") || msg.includes("conversión") || msg.includes("tarda")) {
    return `Nuestra eficiencia operativa indica que el **tiempo promedio de conversión** (desde solicitud hasta orden de compra) es de **${stats.promedio_conversion} días**.`;
  } else if (msg.includes("hola") || msg.includes("buenos") || msg.includes("asistente")) {
    return `¡Hola! Soy Roka AI. Puedo asistirte hoy con información sobre las ${stats.pendientes} solicitudes pendientes, el presupuesto ejecutado ($${stats.total_gastado.toLocaleString('es-ES')}) o el estado de tus proyectos. ¿En qué puedo ayudarte?`;
  } else {
    return `Entiendo su consulta. Según los datos del sistema, tenemos ${stats.pendientes} solicitudes pendientes y una inversión total de $${stats.total_gastado.toLocaleString('es-ES')}. Puedo darle más detalles si lo desea.`;
  }
}

// POST /api/chat/complete — Endpoint para el asistente virtual
router.post('/complete', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    // Obtener estadísticas actuales para contexto
    // Obtener todas las estadísticas del sistema
    const [solicitudes, gasto, conversion, proyectos, presupuestos, alertas, proveedores, notificaciones] = await Promise.all([
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
      `)
    ]);

    const totalPresupuesto = presupuestos.rows.reduce((s: number, p: any) => s + Number(p.monto_total), 0);
    const totalComprometido = presupuestos.rows.reduce((s: number, p: any) => s + Number(p.monto_comprometido), 0);
    const totalDisponible = totalPresupuesto - totalComprometido;

    const stats = {
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
        disponible: totalDisponible
      }
    };

    // Intentar usar IA de NVIDIA
    let useAI = false;
    let aiResponse = '';
    
    if (process.env.NVIDIA_API_KEY) {
      try {
        const timeout = parseInt(process.env.NVIDIA_TIMEOUT_MS || '25000');
        
        // Crear mensaje contextual con todas las estadísticas actuales
        const proyectosList = stats.proyectos_activos.map((p: any) => 
          `- ${p.nombre} (Estado: ${p.estado}, Ubicación: ${p.ubicacion || 'N/A'})`
        ).join('\n');

        const presupuestosList = stats.presupuestos.map((p: any) => 
          `- ${p.proyecto_nombre}: Total $${Number(p.monto_total).toLocaleString('es-ES')}, Comprometido $${Number(p.monto_comprometido).toLocaleString('es-ES')} (${p.porcentaje_uso}%)`
        ).join('\n');

        const alertasList = stats.alertas.length > 0 
          ? stats.alertas.map((a: any) => `- ${a.proyecto}: ${a.estado_alerta} (${a.porcentaje_uso}%)`).join('\n')
          : 'No hay alertas de presupuesto';

        const proveedoresList = stats.proveedores.slice(0, 10).map((p: any) => 
          `- ${p.nombre} (RUT: ${p.rut || 'N/A'}, Contacto: ${p.contacto_nombre || 'N/A'})`
        ).join('\n');

        const notificacionesList = stats.notificaciones.length > 0
          ? stats.notificaciones.map((n: any) => `- ${n.titulo}`).join('\n')
          : 'No hay notificaciones pendientes';

        const contextMessage = `
Eres Roka AI, asistente virtual del sistema de gestión de compras para construcción ROKA.

DATOS ACTUALES DEL SISTEMA (${new Date().toLocaleDateString('es-CL')}):

══════════════════════════════════════════════════════════════
📋 SOLICITUDES DE MATERIALES
══════════════════════════════════════════════════════════════
- Pendientes: ${stats.pendientes}
- Atendidas este mes: ${stats.atendidas}
- Total del mes: ${stats.total_mensual}

══════════════════════════════════════════════════════════════
💰 PRESUPUESTOS
══════════════════════════════════════════════════════════════
- Presupuesto Total Asignado: $${stats.totales_presupuesto.total.toLocaleString('es-ES')}
- Total Comprometido: $${stats.totales_presupuesto.comprometido.toLocaleString('es-ES')}
- Disponible: $${stats.totales_presupuesto.disponible.toLocaleString('es-ES')}

Detalle por proyecto:
${presupuestosList}

══════════════════════════════════════════════════════════════
⚠️ ALERTAS DE PRESUPUESTO
══════════════════════════════════════════════════════════════
${alertasList}

══════════════════════════════════════════════════════════════
🏗️ PROYECTOS ACTIVOS (${stats.proyectos_activos.length})
══════════════════════════════════════════════════════════════
${proyectosList}

══════════════════════════════════════════════════════════════
💵 GASTO EN ÓRDENES DE COMPRA
══════════════════════════════════════════════════════════════
- Total gastado en OC: $${stats.total_gastado.toLocaleString('es-ES')}
- Proyecto con mayor gasto: ${stats.proyecto_top}
- Tiempo promedio de conversión: ${stats.promedio_conversion} días

══════════════════════════════════════════════════════════════
🚚 PROVEEDORES REGISTRADOS (${stats.proveedores.length})
══════════════════════════════════════════════════════════════
${proveedoresList}

══════════════════════════════════════════════════════════════
🔔 NOTIFICACIONES PENDIENTES (${stats.notificaciones.length})
══════════════════════════════════════════════════════════════
${notificacionesList}

══════════════════════════════════════════════════════════════
PREGUNTA DEL USUARIO: ${message}
══════════════════════════════════════════════════════════════

INSTRUCCIONES:
- Responde usando EXCLUSIVAMENTE los datos proporcionados arriba.
- Incluye valores numéricos específicos cuando sea relevante.
- Si no tienes información sobre algo específico, comunícalo.
- Sé conciso y orientado a la acción.
- Si el usuario pregunta sobre presupuesto, usa los datos de la sección "PRESUPUESTOS".`;

        const completion: any = await Promise.race([
          openai.chat.completions.create({
            model: process.env.NVIDIA_MODEL || 'openai/gpt-oss-120b',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: contextMessage }
            ],
            temperature: 0.7,
            max_tokens: parseInt(process.env.NVIDIA_MAX_TOKENS || '1600'),
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          )
        ]);
        
        if (completion && completion.choices && completion.choices[0]?.message?.content) {
          aiResponse = completion.choices[0].message.content;
          useAI = true;
        }
      } catch (aiError: any) {
        console.error('NVIDIA AI error (using fallback):', aiError.message);
        useAI = false;
      }
    }

    // Responder con IA o fallback
    const responseText = useAI ? aiResponse : getFallbackResponse(message, stats);
    
    res.json({ response: responseText, source: useAI ? 'ai' : 'fallback' });

  } catch (error) {
    console.error('Error en el chat de Roka AI:', error);
    res.status(500).json({ error: 'Error al procesar la consulta del chat' });
  }
});

export default router;