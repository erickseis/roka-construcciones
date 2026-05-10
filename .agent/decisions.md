# Decisiones de Arquitectura (ADRs)

<!-- Formato por entrada:
## <fecha> — <título corto>
**Contexto:** <por qué surgió>
**Decisión:** <qué se eligió>
**Alternativas descartadas:** <breve>
**Consecuencias:** <qué implica>
**Tarea origen:** <id>
-->

## 2026-05-07 — Inicialización del registro de decisiones
**Contexto:** Se crea el sistema de memoria persistente `.agent/` para el proyecto.
**Decisión:** Usar formato ADR ligero con append-only en `decisions.md`.
**Alternativas descartadas:** Archivos individuales por ADR (sobreingeniería para esta etapa).
**Consecuencias:** Todas las decisiones vivirán en un solo archivo hasta que supere ~500 líneas, momento en que se sugerirá archivar entradas antiguas.
**Tarea origen:** inicializacion

## 2026-05-07 — ADR-002: Eliminación de Cotizaciones de Venta como entidad separada
**Contexto:** El sistema tenía dos conceptos paralelos y confusos: "Solicitud de Cotización" (envío a proveedor, sin precios) + "Cotización de Venta" (respuesta con precios). Esto generaba tablas redundantes, endpoints duplicados, y confusión en el flujo. Además los usuarios confundían ambos tipos de "cotizaciones" constantemente.
**Decisión:** Eliminar las tablas `cotizaciones` y `cotizacion_items` completamente. El flujo de precios se absorbe en `solicitud_cotizacion_detalle` (nuevas columnas: `precio_unitario`, `subtotal`, `descuento_porcentaje`, `codigo_proveedor`). `solicitud_cotizacion` ahora puede contener el `numero_cov` y archivos adjuntos del proveedor. Las órdenes de compra referencian `solicitud_cotizacion_id` en lugar de `cotizacion_id`.
**Alternativas descartadas:** (a) Mantener ambas entidades con mejor naming — no resolvía la duplicación funcional. (b) Renombrar "Cotización de Venta" a "Respuesta de Cotización" — aún dejaba dos tablas para un solo concepto.
**Consecuencias:** Se eliminan 2 tablas, ~8 endpoints REST, ~5 tools MCP, y múltiples componentes frontend. La SC ahora cubre el flujo completo: envío sin precios → recepción con precios → aprobación → generación de OC. Se requiere migración 021 para migrar datos existentes. Las tools MCP de importación de archivos se renombraron para apuntar a SC. Los endpoints de importación (`/api/solicitud-cotizacion/importar`) quedan pendientes de implementar en backend.
**Tarea origen:** eliminar-cotizaciones-venta

## 2026-05-07 — ADR-003: Importación de archivos de respuesta se mueve a Solicitud de Cotización
**Contexto:** La funcionalidad de importar archivos PDF/Excel de proveedores con IA estaba acoplada a la tabla `cotizaciones`. Al eliminar esta tabla, la funcionalidad debía migrarse.
**Decisión:** Los endpoints de importación ahora operan sobre `solicitud_cotizacion`: `POST /api/solicitud-cotizacion/importar` (parsea archivo y devuelve vista previa) y `POST /api/solicitud-cotizacion/importar/confirmar` (crea la respuesta con precios en SC). Las tools MCP se renombraron consecuentemente: `importar_cotizacion_venta_desde_archivo` → `importar_respuesta_cotizacion_desde_archivo` y `confirmar_importacion_cotizacion` → `confirmar_importacion_respuesta_cotizacion`.
**Alternativas descartadas:** Eliminar la funcionalidad de importación por completo — era valiosa y los usuarios ya la usaban.
**Consecuencias:** Los endpoints de importación en backend aún no existen (deuda técnica). Las tools MCP apuntan a rutas que el backend todavía no implementa. Esto debe resolverse en una tarea futura.
**Tarea origen:** eliminar-cotizaciones-venta

## 2026-05-08 — ADR-004: Scheduler polling para alertas de email por fecha de entrega
**Contexto:** Se necesitaba un mecanismo que monitoreara solicitudes de materiales próximas a su `fecha_requerida` y enviara alertas por email automáticamente. No existía un sistema de colas/tareas programadas en el backend.
**Decisión:** Implementar un scheduler inline con `setInterval` (polling cada 30 min) dentro del proceso Express, alojado en `src/lib/email-alertas.ts`. El scheduler consulta `alerta_email_config` para obtener configuración, detecta solicitudes en ventana de tiempo, y envía emails vía el módulo existente `email.ts`. Los envíos se registran en `alerta_email_log` con protección `UNIQUE` para evitar duplicados por concurrencia.
**Alternativas descartadas:** (a) Bull/bull-board con Redis — sobreingeniería para una sola tarea periódica. (b) Cron externo (crontab, systemd timer) — añade dependencia de infraestructura. (c) node-cron — misma complejidad que setInterval para este caso de uso.
**Consecuencias:** El scheduler se ejecuta en el mismo proceso que Express. Si el backend se reinicia, el scheduler pierde estado en memoria pero persiste el log. La migración debe ejecutarse antes de iniciar el scheduler (issue conocido ALERTA-02). El intervalo es configurable vía `ALERT_EMAIL_INTERVAL_MS`. Se añadieron migraciones 031 (evento email para solicitud.cotizando) y 032 (tablas alerta_email_config y alerta_email_log).
**Tarea origen:** configurar-alertas-email-fecha-entrega
