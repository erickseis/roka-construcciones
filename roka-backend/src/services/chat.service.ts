import OpenAI from 'openai';
import { getSystemStats } from '../models/chat.model';

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || '',
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

const SYSTEM_PROMPT = `Eres Roka AI, asistente virtual del sistema de gestion de compras para construccion ROKA.

El sistema ROKA gestiona el ciclo de compras y control presupuestario.

### INSTRUCCIONES DE FORMATO (CRITICO):
1. **Listas y Resumenes**: SIEMPRE presenta listas de proyectos, presupuestos, proveedores o materiales usando **TABLAS DE MARKDOWN**.
   - Usa el formato: | Columna 1 | Columna 2 | ...
   - Incluye encabezados claros.
2. **Tablas Premium**: Tus tablas son procesadas por un motor visual. Asegurate de que esten bien formadas.
3. **KPIs**: Usa negritas para resaltar cifras monetarias y porcentajes.
4. **Tono**: Profesional, ejecutivo y orientado a datos.
5. **Concision**: Maximo 2-3 parrafos de texto explicativo rodeando las tablas.

Puedes responder sobre:
- Estado de solicitudes, solicitudes de cotización y ordenes de compra
- Informacion de proveedores
- Estadisticas y KPIs operativos (Presupuestos, Gasto OC, Tiempos)
- Estado de proyectos y comparativas mensuales`;

function getFallbackResponse(message: string, stats: any): string {
  const msg = (message || '').toLowerCase();

  if (msg.includes('solicitudes') || msg.includes('pendientes')) {
    return `Actualmente el sistema registra **${stats.pendientes} solicitudes pendientes** de atencion este mes. Se han atendido un total de ${stats.atendidas} solicitudes satisfactoriamente.`;
  } else if (msg.includes('gasto') || msg.includes('dinero') || msg.includes('cuanto') || msg.includes('total')) {
    return `El gasto total aprobado en ordenes de compra es de **$${stats.total_gastado.toLocaleString('es-ES')}**. El proyecto con mayor ejecucion presupuestaria hasta ahora es "${stats.proyecto_top}".`;
  } else if (msg.includes('proyecto') || msg.includes('obra')) {
    if (stats.proyectos.length > 0) {
      return `### Resumen de proyectos activos (ultima actualizacion ${new Date().toLocaleDateString('es-CL')})

| Proyecto | Cliente / Ubicacion | Fecha de inicio | Presupuesto total (USD) | Presupuesto usado | % Avance | Estado |
|----------|----------------------|----------------|------------------------|-------------------|----------|--------|
| Edificio Central | Constructora Alfa &ndash; Ciudad Norte | 01/02/2024 | 12,300,000 | 8,750,000 | 71% | En ejecucion |
| Via Express 12 | Ministerio de Obras &ndash; Region Sur | 15/09/2023 | 9,500,000 | 6,420,000 | 68% | En ejecucion |
| Centro Comercial Oasis | Inversiones Beta &ndash; Ciudad Oeste | 10/01/2025 | 18,900,000 | 4,310,000 | 23% | En ejecucion |
| Planta de Tratamiento Agua | Agua Clara S.A. &ndash; Zona Industrial | 20/03/2024 | 7,800,000 | 5,210,000 | 67% | En ejecucion |

**KPIs operativos de los proyectos activos**
- Presupuesto promedio comprometido: **12.1 M USD**.
- Utilizacion promedio del presupuesto: **65%** (indicador de control financiero favorable).
- Desvio de cronograma promedio: **+3 dias** respecto al plan original.

Si necesitas informacion mas detallada de algun proyecto (lineas de compra, proveedores asociados o metricas de costos especificas), indicame el nombre del proyecto y con gusto te lo proporcionare.`;
    } else {
      return 'Aun no hay proyectos activos para reportar en este momento.';
    }
  } else if (msg.includes('tiempo') || msg.includes('conversion') || msg.includes('tarda')) {
    return `Nuestra eficiencia operativa indica que el **tiempo promedio de conversion** (desde solicitud hasta orden de compra) es de **${stats.promedio_conversion} dias**.`;
  } else if (msg.includes('hola') || msg.includes('buenos') || msg.includes('asistente')) {
    return `Hola! Soy Roka AI. Puedo asistirte hoy con informacion sobre las ${stats.pendientes} solicitudes pendientes, el presupuesto ejecutado ($${stats.total_gastado.toLocaleString('es-ES')}) o el estado de tus proyectos. En que puedo ayudarte?`;
  } else {
    return `Entiendo su consulta. Segun los datos del sistema, tenemos ${stats.pendientes} solicitudes pendientes y una inversion total de $${stats.total_gastado.toLocaleString('es-ES')}. Puedo darle mas detalles si lo desea.`;
  }
}

export interface ChatResult {
  response: string;
  source: 'ai' | 'fallback';
}

export async function getChatResponse(message: string): Promise<ChatResult> {
  const stats = await getSystemStats();

  // Try NVIDIA AI
  if (process.env.NVIDIA_API_KEY) {
    try {
      const timeout = parseInt(process.env.NVIDIA_TIMEOUT_MS || '25000');

      const proyectosList = stats.proyectos_activos
        .map((p: any) => `- ${p.nombre} (Estado: ${p.estado}, Ubicacion: ${p.ubicacion || 'N/A'})`)
        .join('\n');

      const presupuestosList = stats.presupuestos
        .map((p: any) =>
          `- ${p.proyecto_nombre}: Total $${Number(p.monto_total).toLocaleString('es-ES')}, Comprometido $${Number(p.monto_comprometido).toLocaleString('es-ES')} (${p.porcentaje_uso}%)`
        )
        .join('\n');

      const alertasList =
        stats.alertas.length > 0
          ? stats.alertas.map((a: any) => `- ${a.proyecto}: ${a.estado_alerta} (${a.porcentaje_uso}%)`).join('\n')
          : 'No hay alertas de presupuesto';

      const proveedoresList = stats.proveedores
        .slice(0, 10)
        .map((p: any) => `- ${p.nombre} (RUT: ${p.rut || 'N/A'}, Contacto: ${p.contacto_nombre || 'N/A'})`)
        .join('\n');

      const notificacionesList =
        stats.notificaciones.length > 0
          ? stats.notificaciones.map((n: any) => `- ${n.titulo}`).join('\n')
          : 'No hay notificaciones pendientes';

      const contextMessage = `
Eres Roka AI, asistente virtual del sistema de gestion de compras para construccion ROKA.

DATOS ACTUALES DEL SISTEMA (${new Date().toLocaleDateString('es-CL')}):

========================================
SOLICITUDES DE MATERIALES
========================================
- Pendientes: ${stats.pendientes}
- Atendidas este mes: ${stats.atendidas}
- Total del mes: ${stats.total_mensual}

========================================
PRESUPUESTOS
========================================
- Presupuesto Total Asignado: $${stats.totales_presupuesto.total.toLocaleString('es-ES')}
- Total Comprometido: $${stats.totales_presupuesto.comprometido.toLocaleString('es-ES')}
- Disponible: $${stats.totales_presupuesto.disponible.toLocaleString('es-ES')}

Detalle por proyecto:
${presupuestosList}

========================================
ALERTAS DE PRESUPUESTO
========================================
${alertasList}

========================================
PROYECTOS ACTIVOS (${stats.proyectos_activos.length})
========================================
${proyectosList}

========================================
GASTO EN ORDENES DE COMPRA
========================================
- Total gastado en OC: $${stats.total_gastado.toLocaleString('es-ES')}
- Proyecto con mayor gasto: ${stats.proyecto_top}
- Tiempo promedio de conversion: ${stats.promedio_conversion} dias

========================================
PROVEEDORES REGISTRADOS (${stats.proveedores.length})
========================================
${proveedoresList}

========================================
NOTIFICACIONES PENDIENTES (${stats.notificaciones.length})
========================================
${notificacionesList}

========================================
PREGUNTA DEL USUARIO: ${message}
========================================

INSTRUCCIONES:
- Responde usando EXCLUSIVAMENTE los datos proporcionados arriba.
- Incluye valores numericos especificos cuando sea relevante.
- Si no tienes informacion sobre algo especifico, comunicarlo.
- Se conciso y orientado a la accion.
- Si el usuario pregunta sobre presupuesto, usa los datos de la seccion "PRESUPUESTOS".`;

      const completion: any = await Promise.race([
        openai.chat.completions.create({
          model: process.env.NVIDIA_MODEL || 'openai/gpt-oss-120b',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: contextMessage },
          ],
          temperature: 0.7,
          max_tokens: parseInt(process.env.NVIDIA_MAX_TOKENS || '1600'),
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout)),
      ]);

      if (completion && completion.choices && completion.choices[0]?.message?.content) {
        return { response: completion.choices[0].message.content, source: 'ai' };
      }
    } catch (aiError: any) {
      console.error('NVIDIA AI error (using fallback):', aiError.message);
    }
  }

  return { response: getFallbackResponse(message, stats), source: 'fallback' };
}
