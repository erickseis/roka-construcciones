# RESUMEN DE MEMORIA — ROKA Plataforma

> Actualizado: 2026-05-09T10:00:00.000Z
> Estado: idle

## Últimas tareas completadas
1. `configurar-alertas-email-fecha-entrega` — ✅ Éxito
2. `eliminar-cotizaciones-venta` — ✅ Éxito
3. `solicitudes-pdf` — ✅ Éxito (pre-F2)
4. `refactorizacion-F0` — ✅ Éxito (pre-F2)
5. `refactorizacion-F2` — 🟡 En progreso (cambios sin commit, ver abajo)

---

## Progreso — Refactorización F2 (en curso)

### Objetivo
Extraer código duplicado de controladores a librerías compartidas, introducir manejo de errores consistente (AppError + errorHandler), y mejorar configuración de pool de PostgreSQL.

### Archivos creados (5)
| Archivo | LOC | Propósito |
|---------|-----|-----------|
| `roka-backend/src/lib/pdf-utils.ts` | 77 | Puppeteer singleton: `getBrowser()`, `htmlToPdf()`. Elimina duplicación entre ordenes.controller y solicitud_cotizacion.controller |
| `roka-backend/src/lib/html-templates.ts` | 28 | Helpers HTML: `fmtMoney()`, `fmtDate()`, `scape()`, `ROKA_LOGO_SVG`, `IVA_RATE`. Extraídos de controllers |
| `roka-backend/src/lib/errors.ts` | 24 | `AppError` class + factories: `BadRequest()`, `Unauthorized()`, `Forbidden()`, `NotFound()`, `Conflict()` |
| `roka-backend/src/lib/db-utils.ts` | 27 | `withTransaction<T>()` — helper para transacciones con pool.connect() + BEGIN/COMMIT/ROLLBACK + release en finally |
| `roka-backend/src/middleware/errorHandler.ts` | 25 | Global Express error handler: captura AppError (status code + mensaje), errores genéricos → 500 |

### Archivos modificados (8)
| Archivo | Cambio neto | Detalle |
|---------|-------------|---------|
| `roka-backend/src/controllers/ordenes.controller.ts` | −120 líneas | Ahora importa `htmlToPdf` de `lib/pdf-utils` y helpers de `lib/html-templates`. Eliminado código duplicado de generación PDF |
| `roka-backend/src/controllers/solicitud_cotizacion.controller.ts` | −112 líneas | Ídem: usa `lib/pdf-utils` y `lib/html-templates` |
| `roka-backend/src/controllers/solicitudes.controller.ts` | +263 líneas | Agrega `buildSolicitudHtml()` propia (antes dependía de cross-import desde ordenes.controller). Importa `htmlToPdf`, `fmtDate`, `scape`, `ROKA_LOGO_SVG` de libs |
| `roka-backend/src/app.ts` | +13 líneas | Agrega `errorHandler` middleware como último middleware |
| `roka-backend/src/controllers/presupuestos.controller.ts` | +15/−? | Proof of concept: `list()` y `comprometer()` usan `next(error)` en vez de `res.status(500).json()` |
| `roka-backend/src/services/presupuestos.service.ts` | −30 líneas | Proof of concept: usa `withTransaction()`, `BadRequest()`, `NotFound()`, `Conflict()` |
| `roka-backend/src/db.ts` | +24 líneas | Pool config mejorado: `max`, `min`, `idleTimeoutMillis`, `maxUses`, SSL configurable vía `DB_SSL=true` |
| `index.cjs` | +4 líneas | Bug fix: `dotenv.config()` movido ANTES de `require()` para que env vars estén disponibles al cargar módulos |

### Key decisions
- **AppError + errorHandler como infraestructura base**: Solo proof of concept en presupuestos (no refactor masivo de ~231 endpoints). Se aplicará gradualmente.
- **withTransaction()**: Usa `pool.connect()` + BEGIN/COMMIT/ROLLBACK + `client.release()` en finally. Tipado genérico `<T>`.
- **Pool config**: Producción usa `max=20, min=5`; desarrollo usa `max=10, min=2`. SSL opt-in via `DB_SSL=true`.
- **PDF utils**: Puppeteer singleton evita lanzar múltiples procesos. `htmlToPdf()` acepta `{html, landscape?, format?}`.

### No refactorizado aún (deuda técnica consciente)
- ~231 endpoints restantes siguen usando try/catch con `res.status(500).json()` directo
- Controladores de auth, config, dashboard, materiales, notificaciones, proyectos, proveedores, users no migrados a AppError
- Tests existentes (`solicitudes-html.test.ts`, `solicitudes-routes.test.ts`) no cubren las nuevas librerías

---

## Contratos (resumen)
- **Base de datos**: PostgreSQL, ~25 tablas (proyectos, presupuestos, solicitudes, solicitud_cotizacion, ordenes_compra, usuarios, roles, permisos, materiales, proveedores, notificaciones, alertas)
- **Migraciones**: 032 SQL versionados (001→032)
- **Endpoints REST**: ~50+ endpoints agrupados en 11 módulos (auth, users, config, proyectos, presupuestos, solicitudes, solicitud-cotizacion, ordenes, materiales, proveedores, notificaciones, dashboard, email-config)
- **Tools MCP**: ~45 herramientas en 10 módulos (1:1 con rutas backend)

---

## Decisiones recientes
| Fecha | Decisión |
|-------|----------|
| 2026-05-07 | ADR-001: Inicialización sistema de memoria `.agent/` |
| 2026-05-07 | ADR-002: Eliminar Cotizaciones de Venta como entidad separada (absorbidas en SC) |
| 2026-05-07 | ADR-003: Importación de archivos de respuesta se mueve a Solicitud de Cotización |
| 2026-05-08 | ADR-004: Scheduler polling para alertas de email por fecha de entrega |

---

## Convenciones clave
- **Backend**: Express + TypeScript, controladores en `src/controllers/`, servicios en `src/services/`, helpers en `src/lib/`
- **Frontend**: React 19 + Tailwind CSS v4 + Vite 6, componentes en `src/components/`
- **MCP**: Correspondencia 1:1 backend routes ↔ tools, verificar build tras cambios
- **BD**: snake_case, migraciones versionadas `NNN_descripcion.sql`
- **Transacciones**: Ahora con `withTransaction()` (via `db-utils.ts`) preferido sobre pool.query manual
- **Errores**: `AppError` + `errorHandler` middleware (nuevo, adopción gradual)

---

## Archivos relevantes
| Ruta | Rol |
|------|-----|
| `roka-backend/src/index.ts` | Entry point backend |
| `roka-backend/src/app.ts` | createRokaApp() — monta rutas + errorHandler |
| `roka-backend/src/db.ts` | Pool PostgreSQL configurable |
| `roka-backend/src/lib/pdf-utils.ts` | Puppeteer singleton (F2) |
| `roka-backend/src/lib/html-templates.ts` | Helpers HTML compartidos (F2) |
| `roka-backend/src/lib/errors.ts` | AppError + factories (F2) |
| `roka-backend/src/lib/db-utils.ts` | withTransaction helper (F2) |
| `roka-backend/src/middleware/errorHandler.ts` | Global error handling (F2) |
| `roka-backend/src/lib/email-alertas.ts` | Scheduler polling alertas |
| `roka-backend/src/lib/email.ts` | Notificaciones email + templates HTML |
| `roka-backend/src/lib/migrations.ts` | Ejecutor de migraciones al iniciar |
| `roka-backend/src/lib/notifications.ts` | Notificaciones in-app |
| `roka-backend/src/controllers/ordenes.controller.ts` | OC CRUD + PDF generation |
| `roka-backend/src/controllers/solicitud_cotizacion.controller.ts` | SC CRUD + PDF generation |
| `roka-backend/src/controllers/solicitudes.controller.ts` | Solicitudes + PDF + buildSolicitudHtml |
| `roka-backend/src/services/presupuestos.service.ts` | Presupuesto + compromisos (proof of concept AppError) |
| `index.cjs` | Servidor unificado Express + ROKA + Encuestas + MCP |
| `roka-mcp/src/tools/*.ts` | 10 módulos de herramientas MCP |

---

## Issues abiertos
| ID | Título | Severidad |
|----|--------|-----------|
| CONSIST-03 | Falta suite de tests automatizados (solo 58 tests de PDF solicitudes) | Media |
| ALERTA-01 | Bucle infinito potencial si usuario destino sin correo | Baja |
| SC-IMPORT-01 | Endpoints de importación de respuesta para SC no implementados en backend | Alta |
| ALERTA-BUG-01 | PUT alertas permite habilitada=true con destinatarios vacíos | Media |
| SEC-03 | CORS origen permite solo localhost:3000 | Media |

---

## Comandos de desarrollo
| Acción | Comando | Directorio |
|--------|---------|------------|
| Dev backend | `npm run dev` | `roka-backend/` |
| Dev frontend | `npm run dev` | `roka-front/` |
| Dev unificado | `npm run dev:root` | `./` |
| Build backend | `npm run build` | `roka-backend/` |
| Build frontend | `npm run build` | `roka-front/` |
| Build MCP | `npm run build` | `roka-mcp/` |
| Tests backend | `npx vitest run` | `roka-backend/` |
| Tests frontend | `npx vitest run` | `roka-front/` |

**Puertos**: Backend `:3001`, Frontend `:5173`, MCP montado en `/api/mcp` del unificado.
**Frontend marker**: ROKA frontend sirve en `http://localhost:5173`.
