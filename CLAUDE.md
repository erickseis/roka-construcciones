# ROKA Plataforma - Documento de Contexto Integral para Agentes

## 1) Resumen Ejecutivo

ROKA es una plataforma backend para gestionar el ciclo de compras y control presupuestario en proyectos de construccion.

El flujo operativo principal es:

1. Se crea una solicitud de materiales para un proyecto.
2. Se generan una o mas cotizaciones asociadas a esa solicitud.
3. Una cotizacion se aprueba o rechaza.
4. Si se aprueba, se puede generar una orden de compra (OC).
5. La OC compromete presupuesto del proyecto (y opcionalmente de una categoria presupuestaria).
6. Se disparan notificaciones in-app para actores relevantes.

El backend esta implementado en Node.js + TypeScript + Express + PostgreSQL, con autenticacion JWT y un esquema de permisos por rol.

## 2) Arquitectura Tecnica

- **Servicio principal**: `roka-backend`
- **Servidor MCP** (agentes IA): `roka-mcp`
- **Entrada del servidor**: `roka-backend/src/index.ts`
- **Entrada del MCP**: `roka-mcp/src/index.ts`
- **Base de datos**: PostgreSQL via `pg` (`roka-backend/src/db.ts`)
- **Migraciones**: SQL versionado en `roka-backend/migrations/*.sql`, ejecutadas automaticamente al iniciar (`roka-backend/src/lib/migrations.ts`)
- **Autenticacion**: JWT Bearer token (`roka-backend/src/middleware/authMiddleware.ts`)
- **Autorizacion**: permisos por codigo (`roka-backend/src/middleware/permissions.ts`)

### 2.1 MCP Server (roka-mcp)

El proyecto incluye un servidor MCP (`roka-mcp/`) que expone todas las operaciones del backend como herramientas para agentes IA (Claude Desktop, Cursor, etc.).

- **Transportes**: Soporta **StreamableHTTP** (integrado en el servidor unificado) y **stdio** (standalone)
- **Integración**: El MCP server se monta automáticamente en `index.cjs` vía `mountMcpServer(app, '/api/mcp')` usando `StreamableHTTPServerTransport`
- **Inicio**: `node index.cjs` arranca Express + ROKA + Encuestas + MCP en un solo proceso
- **Cliente HTTP interno**: autentica con JWT contra `roka-backend` usando `ROKA_EMAIL`/`ROKA_PASSWORD` de `roka-mcp/.env`
- **Tools**: ~45 herramientas organizadas por modulo en `roka-mcp/src/tools/*.ts`
- **Build**: esbuild → `roka-mcp/dist/index.js`
- **Modo standalone**: `cd roka-mcp && npm run dev` (stdio) sigue disponible
- **Guia de conexion**: `roka-mcp/GUIA_CONEXION.md`

**IMPORTANTE — Regla de sincronizacion**: Cada vez que se modifique un endpoint del backend (nueva ruta, cambio de parametros, cambio de metodo HTTP, eliminacion de endpoint), se DEBE actualizar la tool MCP correspondiente en `roka-mcp/src/tools/`. La correspondencia es 1:1 por modulo:

| Archivo backend | Archivo MCP |
|-----------------|-------------|
| `roka-backend/src/routes/auth.ts` | `roka-mcp/src/tools/auth.ts` |
| `roka-backend/src/routes/proyectos.ts` | `roka-mcp/src/tools/proyectos.ts` |
| `roka-backend/src/routes/presupuestos.ts` | `roka-mcp/src/tools/presupuestos.ts` |
| `roka-backend/src/routes/solicitudes.ts` | `roka-mcp/src/tools/solicitudes.ts` |
| `roka-backend/src/routes/cotizaciones.ts` | `roka-mcp/src/tools/cotizaciones.ts` |
| `roka-backend/src/routes/ordenes.ts` | `roka-mcp/src/tools/ordenes.ts` |
| `roka-backend/src/routes/materiales.ts` | `roka-mcp/src/tools/materiales.ts` |
| `roka-backend/src/routes/proveedores.ts` | `roka-mcp/src/tools/proveedores.ts` |
| `roka-backend/src/routes/notificaciones.ts` | `roka-mcp/src/tools/notificaciones.ts` |
| `roka-backend/src/routes/dashboard.ts` | `roka-mcp/src/tools/dashboard.ts` |

Verificar build despues de cambios: `cd roka-mcp && npm run build`

### Scripts de ejecucion

**Servidor unificado** (`index.cjs` — Express + ROKA + Encuestas + MCP):

- `npm run dev:root`: desarrollo con nodemon
- `npm run start:root`: produccion con node

**ROKA backend standalone** (en `roka-backend/`):
- `npm run dev`: desarrollo con `tsx watch src/index.ts`
- `npm run build`: compila TypeScript
- `npm run start`: ejecuta `dist/index.js`

**MCP server standalone** (en `roka-mcp/`):
- `npm run dev`: desarrollo con `tsx src/index.ts` (stdio)
- `npm run build`: esbuild → `dist/index.js`
- `npm run start`: `node dist/index.js` (stdio)

### Variables de entorno relevantes

**ROKA backend** (`roka-backend/.env`):

- `DATABASE_URL`: cadena de conexion PostgreSQL
- `JWT_SECRET`: secreto para firma/verificacion JWT
- `PORT`: puerto del backend
- `CORS_ORIGIN`: origen permitido para frontend

**MCP server** (`roka-mcp/.env`):

- `ROKA_BACKEND_URL`: URL del backend (default: `http://localhost:3001`)
- `ROKA_API_PREFIX`: prefijo de API (default: `/api/roka/api/`)
- `ROKA_EMAIL`: email para autenticacion automatica
- `ROKA_PASSWORD`: contraseña para autenticacion automatica

## 3) Dominios Funcionales

### 3.1 Auth y Usuarios

- Login y sesion actual: `src/routes/auth.ts`
- Gestion de usuarios: `src/routes/users.ts`
- Catalogos organizacionales: departamentos, cargos, roles, permisos por rol en `src/routes/config.ts`

### 3.2 Proyectos y Presupuestos

- Proyectos (CRUD logico, metricas, y datos de licitacion): `src/routes/proyectos.ts`
- Campos de licitacion: numero, descripcion, fecha apertura, monto referencial, archivo
- Upload de licitaciones (PDF, Excel, CSV): `src/lib/upload.ts` con multer (20MB limit)
- Descarga de archivos: `GET /api/proyectos/:id/licitacion-archivo`
- Presupuestos por proyecto y categorias: `src/routes/presupuestos.ts`
- Compromisos presupuestarios y alertas de umbral/sobreconsumo: `src/routes/presupuestos.ts`

### 3.3 Compras

- Solicitudes de material: `src/routes/solicitudes.ts`
- Cotizaciones: `src/routes/cotizaciones.ts`
- Ordenes de compra: `src/routes/ordenes.ts`

### 3.4 Maestro de Materiales

- Materiales, unidades y categorias: `src/routes/materiales.ts`

### 3.5 Notificaciones y Dashboard

- Notificaciones in-app: `src/routes/notificaciones.ts` + `src/lib/notifications.ts`
- KPIs operativos: `src/routes/dashboard.ts`

## 4) Modelo de Datos y Migraciones

El esquema se construye incrementalmente con migraciones:

- `001_initial_schema.sql`: proyectos, solicitudes, items, cotizaciones, OC, seeds base.
- `002_auth_and_users.sql`: departamentos, roles, cargos, usuarios, admin inicial.
- `003_projects_and_budget.sql`: ampliaciones de proyecto, presupuesto por proyecto, categorias, movimientos, permisos/rol.
- `004_notifications.sql`: trazabilidad de creador y tabla `notificaciones`.
- `005_master_data_materials.sql`: unidades y maestro de materiales, link opcional de `solicitud_items` a `materiales`.
- `006_material_categories.sql`: normaliza categorias de materiales en tabla dedicada.
- `007_licitaciones.sql`: campos de licitacion en `proyectos` (numero, descripcion, fecha_apertura, monto_referencial, archivo_path, archivo_nombre).
- `008_proveedores.sql`: catalogo de proveedores, tabla `proveedores`, vinculo con cotizaciones.
- `009_ordenes_formato_comercial.sql`: formato comercial de OC (folio, descuentos, impuestos, totales).
- `010_codigo_solicitud_items.sql`: campo `codigo` en `solicitud_items`.
- `011_proveedores_condiciones.sql`: condiciones comerciales de proveedores (pago, despacho, plazo, moneda).
- `012_proyectos_mandante.sql`: campo `mandante` en proyectos.
- `013_proyectos_moneda.sql`: campo `moneda` en proyectos.
- `014_ordenes_manual.sql`: OC manual sin cotizacion (cotizacion_id nullable, campos de proveedor directo).
- `015_orden_compra_items.sql`: items detallados en OC.
- `016_solicitud_cotizacion.sql`: solicitud de cotizacion (envio a proveedor sin precios), migracion de datos existentes.
- `017_oc_mejoras.sql`: mejoras en OC (autorizado_por, solicitud_id, codigo_obra).
- `018_proyectos_plazo_ejecucion.sql`: campo `plazo_ejecucion_dias` en proyectos.
- `019_solicitudes_fecha_requerida.sql`: campo `fecha_requerida` en solicitudes.

### Entidades core (vision de negocio)

- `proyectos` (con campos: numero_licitacion, descripcion_licitacion, fecha_apertura_licitacion, monto_referencial_licitacion, archivo_licitacion_path, archivo_licitacion_nombre)
- `presupuestos_proyecto`
- `presupuesto_categorias`
- `presupuesto_movimientos`
- `solicitudes_material`
- `solicitud_items` (ahora auto-vincula nombre y unidad desde materiales maestro)
- `cotizaciones`
- `cotizacion_items`
- `ordenes_compra`
- `usuarios`, `roles`, `permisos`, `rol_permisos`
- `notificaciones`
- `materiales` (incluye precio_referencial usado en solicitudes), `unidades_medida`, `material_categorias`

## 5) Flujo End-to-End de la Aplicacion

## 5.1 Inicio y Base de Datos

1. El servidor carga variables de entorno.
2. Se inicializa Express + CORS + JSON parser.
3. Antes de montar rutas, corre `runMigrations()`.
4. Si una migracion falla, el proceso termina para proteger consistencia.

## 5.2 Autenticacion y Contexto de Usuario

1. Usuario hace `POST /api/auth/login` con `correo` + `password`.
2. Backend valida credenciales contra `usuarios` (incluye `is_active = true`).
3. Se retorna JWT con `id`, `correo`, `rol_id` y expiracion de 8 horas.
4. Endpoints protegidos usan `Authorization: Bearer <token>`.
5. `authMiddleware` decodifica token y adjunta `req.user`.

## 5.3 Autorizacion por Permiso

1. Endpoints sensibles aplican `requirePermission('codigo.permiso')`.
2. Se valida contra `rol_permisos` + `permisos` segun `rol_id` del usuario.
3. Si no tiene permiso: HTTP 403.

Permisos base definidos:

- `proyectos.view`, `proyectos.manage`
- `presupuestos.view`, `presupuestos.manage`
- `ordenes.create`
- `config.manage`
- `notificaciones.view`

## 5.3 Gestión de Licitaciones

Cada proyecto puede vincularse a un proceso de licitación:

- `POST /api/proyectos`: acepta `multipart/form-data` con archivo de licitación (PDF, Excel, CSV, max 20MB)
- Campos guardados en proyecto: `numero_licitacion`, `descripcion_licitacion`, `fecha_apertura_licitacion`, `monto_referencial_licitacion`
- Archivos almacenados en disco bajo `uploads/licitaciones/` con timestamp para unicidad
- `GET /api/proyectos/:id/licitacion-archivo`: descarga el archivo adjunto
- Frontend: UI colapsable en formulario de proyecto para agregar/editar datos de licitación
- Badge visual en tabla de proyectos indica presencia de licitación

## 5.4 Flujo de Compras

### Paso A: Solicitud de Material

- `POST /api/solicitudes`
- Requiere `proyecto_id`, `solicitante` e `items`.
- Crea encabezado en `solicitudes_material` + detalle en `solicitud_items` en transaccion.
- Estado inicial tipico: `Pendiente`.
- **Vínculo de materiales mejorado**: Si item tiene `material_id`, backend auto-busca y sobrescribe `nombre_material` y `unidad` desde catálogo maestro (garantiza consistencia de datos).
- En GET detalle, respuesta incluye `precio_referencial` del material para costeo.

### Paso B: Cotizaciones

- `POST /api/cotizaciones`
- Valida que los items cotizados correspondan a la solicitud.
- Calcula subtotales y total.
- Inserta en `cotizaciones` y `cotizacion_items` en transaccion.
- Si solicitud estaba `Pendiente`, pasa a `Cotizando`.

### Paso C: Aprobacion/Rechazo de Cotizacion

- `PATCH /api/cotizaciones/:id/aprobar`
- `PATCH /api/cotizaciones/:id/rechazar`
- Solo procesa cotizaciones en estado `Pendiente`.
- Actualiza estado y dispara notificaciones a creadores/roles operativos.

### Paso D: Generacion de Orden de Compra

- `POST /api/ordenes` (permiso `ordenes.create`)
- Requisitos:
  - cotizacion existe
  - cotizacion en estado `Aprobada`
  - no exista OC previa para esa cotizacion
  - presupuesto del proyecto disponible
  - si aplica, categoria presupuestaria con saldo disponible
- En una sola transaccion:
  - crea OC
  - compromete monto en `presupuestos_proyecto`
  - compromete en `presupuesto_categorias` (si corresponde)
  - registra `presupuesto_movimientos`
  - actualiza solicitud a `Aprobado`
  - crea notificaciones de OC y alertas de presupuesto (umbral/sobreconsumo)

### Paso E: Seguimiento de Entrega

- `PATCH /api/ordenes/:id/entrega`
- Estados permitidos de entrega: `Pendiente`, `Recibido parcial`, `Completado`.

## 5.5 Flujo Presupuestario

Ademas del compromiso automatico por OC, existe compromiso manual:

- `POST /api/presupuestos/comprometer`
- Valida saldo de presupuesto (y categoria opcional).
- Registra movimiento `Compromiso`.
- Si cruza umbral o 100%, envia notificaciones.

Tambien se expone:

- listado de presupuestos
- detalle por proyecto con categorias
- administracion de categorias
- alertas de uso (`/api/presupuestos/alertas/listado`)

## 5.6 Visibilidad del Flujo (FlowStepper)

Componente visual que indica progreso en el pipeline de compras:

- **Ubicación frontend**: `roka-front/src/components/ui/FlowStepper.tsx`
- **Pasos**: Solicitud → Cotización → Orden de Compra → Entrega
- **Integración**: visible en modales de detalle de solicitudes, cotizaciones y órdenes
- **Props**: `currentStep`, `estado`, `tipo` (solicitud|cotizacion|orden)
- **Beneficio**: usuario ve claramente en qué fase está cada documento del pipeline

## 5.7 Notificaciones In-App

Modulo implementado con:

- `GET /api/notificaciones`
- `GET /api/notificaciones/unread-count`
- `PATCH /api/notificaciones/:id/leida`
- `PATCH /api/notificaciones/marcar-todas-leidas`

Usa `notificaciones` con `payload` JSONB para contexto flexible por evento.

## 5.8 Dashboard

KPIs expuestos en `src/routes/dashboard.ts`:

- Solicitudes del mes: pendientes vs atendidas
- Gasto por proyecto
- Tiempo de conversion Solicitud -> OC
- Endpoint compuesto: `/api/dashboard/resumen`
- `GET /api/dashboard/proyectos`

## 6) Estados y Reglas de Negocio Criticas

### Solicitudes

- Estados validos: `Pendiente`, `Cotizando`, `Aprobado`.

### Cotizaciones

- Estados validos: `Pendiente`, `Aprobada`, `Rechazada`.

### Ordenes de Compra

- Estado de entrega: `Pendiente`, `Recibido parcial`, `Completado`.

### Presupuesto

- El monto comprometido no debe exceder disponible.
- No se puede bajar `monto_total` por debajo del comprometido actual.
- No se puede bajar `monto_asignado` de categoria por debajo del comprometido actual.
- No se permite eliminar categorias con monto comprometido > 0.
- No se permite duplicar OC para la misma cotizacion.

### Integridad transaccional

Operaciones multi-tabla importantes corren con `BEGIN/COMMIT/ROLLBACK` para garantizar consistencia.

## 7) Seguridad y Acceso

## 7.1 Autenticacion

- JWT firmado con `JWT_SECRET`.
- Token con expiracion de 8 horas.
- Header esperado: `Authorization: Bearer ...`.

## 7.2 Autorizacion

- Permisos por rol via tablas `permisos` y `rol_permisos`.
- Middleware reusable: `requirePermission(codigo)`.

## 7.3 Observaciones de seguridad para agentes

Hay endpoints sin proteccion estricta que un agente debe considerar riesgo y priorizar segun roadmap:

- Algunos endpoints de `solicitudes`, `materiales`, `dashboard` y partes de `config/users` operan sin `authMiddleware` o tienen comentarios de auth deshabilitada.
- Existe fallback de `JWT_SECRET` y `DATABASE_URL` por defecto para entorno local; en produccion debe ser obligatorio usar secretos reales.

## 8) API Map Rapido (por modulo)

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Users

- `GET /api/users`
- `POST /api/users`
- `DELETE /api/users/:id`

### Config

- `GET/POST /api/config/departamentos`
- `GET/POST /api/config/cargos`
- `GET /api/config/roles`
- `GET /api/config/permisos`
- `GET/PUT /api/config/roles/:id/permisos`

### Proyectos

- `GET /api/proyectos` — listar todos (con filtros estado, is_active)
- `GET /api/proyectos/:id` — detalle con resumen presupuesto y metricas
- `POST /api/proyectos` — crear (acepta `multipart/form-data` con archivo_licitacion)
- `PATCH /api/proyectos/:id` — actualizar (acepta `multipart/form-data` con archivo_licitacion)
- `PATCH /api/proyectos/:id/active` — activar/desactivar
- `GET /api/proyectos/:id/licitacion-archivo` — descargar archivo de licitacion adjunto

### Presupuestos

- `GET /api/presupuestos`
- `GET /api/presupuestos/proyecto/:proyectoId`
- `POST /api/presupuestos`
- `PATCH /api/presupuestos/:id`
- `POST /api/presupuestos/:id/categorias`
- `PATCH /api/presupuestos/categorias/:categoriaId`
- `DELETE /api/presupuestos/categorias/:categoriaId`
- `GET /api/presupuestos/alertas/listado`
- `POST /api/presupuestos/comprometer`

### Solicitudes

- `GET /api/solicitudes`
- `GET /api/solicitudes/:id`
- `POST /api/solicitudes`
- `PATCH /api/solicitudes/:id/estado`
- `DELETE /api/solicitudes/:id`

### Cotizaciones

- `GET /api/cotizaciones`
- `GET /api/cotizaciones/:id`
- `POST /api/cotizaciones`
- `PATCH /api/cotizaciones/:id/aprobar`
- `PATCH /api/cotizaciones/:id/rechazar`

### Ordenes

- `GET /api/ordenes`
- `GET /api/ordenes/:id`
- `POST /api/ordenes`
- `PATCH /api/ordenes/:id/entrega`

### Materiales

- Unidades: `GET/POST/PUT/DELETE /api/materiales/unidades...`
- Categorias: `GET/POST/PUT/DELETE /api/materiales/categorias...`
- Solicitados: `GET /api/materiales/solicitados`
- Maestro: `GET /api/materiales`, `GET /api/materiales/:id`, `POST /api/materiales`, `PUT /api/materiales/:id`, `DELETE /api/materiales/:id`

### Notificaciones

- `GET /api/notificaciones`
- `GET /api/notificaciones/unread-count`
- `PATCH /api/notificaciones/:id/leida`
- `PATCH /api/notificaciones/marcar-todas-leidas`

### Dashboard

- `GET /api/dashboard/solicitudes-mensual`
- `GET /api/dashboard/gasto-por-proyecto`
- `GET /api/dashboard/tiempo-conversion`
- `GET /api/dashboard/resumen`
- `GET /api/dashboard/proyectos`

## 9) Guia Operativa para Agentes (Playbook)

## 9.1 Para entender rapido el sistema

1. Revisar `src/index.ts` para mapa de modulos.
2. Revisar migraciones en orden para entender modelo y evolucion.
3. Revisar middlewares de auth/permisos.
4. Revisar rutas de compras (`solicitudes`, `cotizaciones`, `ordenes`) y presupuesto (`presupuestos`).
5. Revisar `roka-mcp/src/tools/` para entender que herramientas expone el servidor MCP.

## 9.2 Antes de modificar logica critica

- Verificar impacto en estados de flujo (incluyendo en FlowStepper visual).
- Verificar impacto en presupuesto comprometido y movimientos.
- Verificar eventos de notificacion relacionados.
- Preferir transacciones para cambios multi-tabla.
- Mantener compatibilidad con permisos por rol.
- Cuando se modifique material_id en solicitud_items, recordar que el backend ahora auto-vincula nombre y unidad: esto garantiza consistencia pero requiere cuidado si se modifica el comportamiento.
- **NUEVO**: Si el cambio en una ruta modifica parametros, metodo HTTP, o agrega/quita endpoints, actualizar la tool MCP correspondiente en `roka-mcp/src/tools/` (ver tabla en seccion 2.1). Luego correr `cd roka-mcp && npm run build`.

## 9.3 Invariantes que no deben romperse

- Una cotizacion no aprobada no debe generar OC.
- Una cotizacion no puede tener mas de una OC.
- No se debe comprometer presupuesto sobre el disponible.
- Alertas deben dispararse al cruzar umbral y/o 100%.

## 9.4 Cambios Recientes (Licitaciones y UX)

**Implementados a partir de migration 007:**

- **Licitaciones en Proyectos**: Cada proyecto puede adjuntar archivo de licitación (PDF/Excel/CSV) y guardar datos: número, descripción, fecha apertura, monto referencial. Backend usa multer para upload seguro.
- **Auto-vínculo de Materiales**: En solicitudes, si item tiene `material_id`, backend auto-busca catálogo y sobrescribe `nombre_material` y `unidad`. Elimina inconsistencias de texto libre.
- **Precio Referencial en Solicitudes**: GET detalle ahora incluye `precio_referencial` del material, permitiendo al frontend mostrar subtotales y total estimado.
- **FlowStepper Visual**: Componente nuevo que muestra progreso Solicitud→Cotización→OC→Entrega. Integrado en detalles de solicitudes, cotizaciones y órdenes.
- **Reorganización Sidebar**: "Gestiona Materiales" → "Catálogo de Materiales", movido a Administración (datos maestros, no operacional diario).

**Cambios en el Frontend:**
- Nuevas props en Proyecto: numero_licitacion, descripcion_licitacion, fecha_apertura_licitacion, monto_referencial_licitacion
- Detalle de solicitud enriquecido: muestra precio, subtotal, total estimado, cotizaciones relacionadas
- Modales de detalle incluyen FlowStepper para visibilidad de flujo

## 9.5 Mejoras recomendadas (backlog tecnico)

- Homogeneizar proteccion de endpoints con auth + permisos (solicitudes, materiales, dashboard aun sin authMiddleware).
- Endurecer configuracion: eliminar secretos/URLs fallback en produccion.
- Agregar suite de tests de flujo (Solicitud -> Cotizacion -> OC -> Presupuesto).
- Estandarizar manejo de errores y auditoria de eventos.
- **Pendiente**: Parser automatico de PDFs de licitacion para extraer items (requiere OCR o plantillas estructuradas).
- **Pendiente**: Integración más profunda de licitación con solicitudes (vincular automáticamente items de licitación a nuevas solicitudes).

## 10) Contexto Minimo que un Agente Debe Retener

Si un agente solo retiene una cosa, debe retener esto:

- ROKA es un sistema transaccional de compras para proyectos de construccion, donde la OC es el hito que compromete presupuesto y dispara trazabilidad/notificaciones.
- El flujo esta gobernado por estados (Solicitud→Cotización→OC→Entrega), permisos por rol, validaciones presupuestarias, y vínculo de materiales desde catálogo maestro.
- Cada proyecto puede adjuntar documentos de licitación para compliance/traceabilidad.
- La consistencia de datos depende de transacciones, auto-vinculación de materiales, y el orden correcto del flujo de negocio.
- Frontend proporciona visibilidad clara del pipeline mediante FlowStepper, detalles enriquecidos con costos, y navegación intuitiva.
