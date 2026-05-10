# Bitácora de Tareas

<!-- Formato por entrada:
## <fecha> — <id>: <título>
**Resumen:** <2-3 líneas>
**Archivos tocados:** <lista>
**Resultado QA:** <pasa/falla>
**Notas:** <gotchas, deuda dejada>
-->

## 2026-05-07 — eliminar-cotizaciones-venta: Eliminación de Cotizaciones de Venta
**Resumen:** Se eliminaron las tablas `cotizaciones` y `cotizacion_items` (DROP TABLE en migración 021). La funcionalidad de precios migró a `solicitud_cotizacion_detalle` (nuevas columnas: precio_unitario, subtotal, descuento_porcentaje, codigo_proveedor). `ordenes_compra.cotizacion_id` se reemplazó por `solicitud_cotizacion_id`. Se eliminaron ~8 endpoints REST, ~5 tools MCP, y múltiples componentes/strings en frontend. Las queries de dashboard, métricas y chat se adaptaron para usar SC con estado `Respondida` en lugar de `Aprobada`.
**Archivos tocados:** `migrations/021_remove_cotizaciones_venta.sql`, `roka-backend/src/routes/ordenes/ordenes.controller.ts`, `roka-backend/src/models/proyectos.model.ts`, `roka-backend/src/models/dashboard.model.ts`, `roka-backend/src/models/chat.model.ts`, `roka-backend/src/types/orden.types.ts`, `roka-backend/src/services/chat.service.ts`, `roka-front/src/pages/OrdenesPage.tsx`, `roka-front/src/components/ordenes/OCPreviewModal.tsx`, `roka-front/src/components/ui/FlowStepper.tsx`, `roka-front/src/components/solicitudes/SolicitudCotizacionDetailModal.tsx`, `roka-front/src/components/layout/Header.tsx`, `roka-front/src/components/chat/CopilotPanel.tsx`, `roka-front/src/components/chat/RokaChatbot.tsx`, `roka-front/src/pages/ProveedoresPage.tsx`, `roka-mcp/src/tools/cotizaciones.ts`, `roka-mcp/src/tools/ordenes.ts`
**Resultado QA:** Pasa (sin referencias residuales a cotizaciones/cotizacion_id en backend, frontend ni MCP)
**Notas:** Los endpoints de importación de archivos para SC (`/api/solicitud-cotizacion/importar` y `/importar/confirmar`) no existen aún en backend. Las tools MCP apuntan a estas rutas pero fallarán hasta que se implementen. `CotizacionesPage.tsx` quedó como wrapper muerto (no se importa en App.tsx) — se puede eliminar después. Se mantuvo el nombre `total_cotizaciones` en métricas de proyecto por compatibilidad semántica con SCs.

## 2026-05-08 — configurar-alertas-email-fecha-entrega: Reportes de implementación recibidos
**Resumen:** Se recibieron y archivaron los reportes de programador_backend, programador_frontend y revisor_código para el módulo de alertas de email por fecha de entrega. Backend: 1 archivo creado (email-alertas.ts, 255 LOC) + 4 modificados, build OK. Frontend: 1 archivo creado (EmailAlertasTab.tsx) + 2 modificados, build OK. Revisor emitió APPROVED con 2 issues menores (bucle infinito si usuario sin correo, scheduler antes de migraciones).
**Archivos tocados:** `roka-backend/src/lib/email-alertas.ts`, `roka-backend/src/routes/email-config.routes.ts`, `roka-backend/src/lib/email.ts`, `roka-backend/src/index.ts`, `roka-backend/src/app.ts`, `roka-front/src/pages/config/EmailAlertasTab.tsx`, `roka-front/src/lib/api.ts`, `roka-front/src/pages/config/ConfigPage.tsx`
**Resultado QA:** Pendiente (fase avanzada a verificacion)
**Notas:** Issues menores: (1) bucle infinito si usuario no tiene correo en email-alertas.ts L192-203, (2) scheduler inicia antes de migraciones en app.ts L50. Ambos son optimizaciones, no blockers.

## 2026-05-08 — configurar-alertas-email-fecha-entrega: Cierre — ✅ ÉXITO
**Resumen:** Plan completado e implementado. Módulo de configuración de alertas de email por fecha de entrega de solicitudes funcionando. Backend: 1 archivo creado (email-alertas.ts con scheduler polling cada 30 min), 4 modificados (email-config.routes.ts +3 endpoints, email.ts +buildAlertaFechaEntregaHtml, index.ts, app.ts), 2 migraciones (031 + 032). Frontend: 1 archivo creado (EmailAlertasTab.tsx), 2 modificados (api.ts, ConfigPage.tsx). Builds backend y frontend OK. QA smoke test: 3 endpoints 200 OK, scheduler iniciado. Revisor: APPROVED.
**Archivos tocados:**
  - BD: `migrations/031_email_event_solicitud_cotizando.sql`, `migrations/032_alerta_email_config.sql`
  - Backend: `src/lib/email-alertas.ts` (creado), `src/routes/email-config.routes.ts`, `src/lib/email.ts`, `src/index.ts`, `src/app.ts`
  - Frontend: `src/pages/config/EmailAlertasTab.tsx` (creado), `src/lib/api.ts`, `src/pages/config/ConfigPage.tsx`
**Resultado QA:** ✅ APROBADO (build backend OK, build frontend OK, migraciones OK, smoke test 3 endpoints 200 OK, scheduler OK)
**Notas:** Issues conocidos registrados en known_issues.md: ALERTA-01 (bucle infinito si usuario sin correo), ALERTA-02 (scheduler inicia antes de migraciones). Ambos son optimizaciones, no blockers. El plan queda archivado en `.agent/plans/configurar-alertas-email-fecha-entrega.md`.

## 2026-05-09 — configurar-alertas-email-fecha-entrega: QA reporte archivado
**Resumen:** Se recibió y archivó el reporte QA con 9 pruebas de endpoints (7 ✅, 1 ⚠️ BUG, 1 ✅). Veredicto: APROBADO CON OBSERVACIONES. Se registraron 2 bugs nuevos (ALERTA-BUG-01: validación destinatarios vacíos, ALERTA-BUG-02: dual init del scheduler) y 1 duplicado (ALERTA-BUG-03 → ALERTA-01 existente).
**Archivos tocados:** `.agent/qa/reporte_2026-05-09_alertas-email.md`, `.agent/known_issues.md`
**Resultado QA:** ✅ APROBADO CON OBSERVACIONES
**Notas:** ALERTA-BUG-01 requiere corrección en PUT handler para rechazar con 400 si habilitada=true sin destinatarios. ALERTA-BUG-02 es estético (eliminar dual init). Reporte archivado en `.agent/qa/reporte_2026-05-09_alertas-email.md`.
