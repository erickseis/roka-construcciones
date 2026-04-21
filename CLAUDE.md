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
- **Entrada del servidor**: `roka-backend/src/index.ts`
- **Base de datos**: PostgreSQL via `pg` (`roka-backend/src/db.ts`)
- **Migraciones**: SQL versionado en `roka-backend/migrations/*.sql`, ejecutadas automaticamente al iniciar (`roka-backend/src/lib/migrations.ts`)
- **Autenticacion**: JWT Bearer token (`roka-backend/src/middleware/authMiddleware.ts`)
- **Autorizacion**: permisos por codigo (`roka-backend/src/middleware/permissions.ts`)

### Scripts de ejecucion

Definidos en `roka-backend/package.json`:

- `npm run dev`: desarrollo con `tsx watch src/index.ts`
- `npm run build`: compila TypeScript
- `npm run start`: ejecuta `dist/index.js`

### Variables de entorno relevantes

Referencia: `roka-backend/.env.example`

- `DATABASE_URL`: cadena de conexion PostgreSQL
- `JWT_SECRET`: secreto para firma/verificacion JWT
- `PORT`: puerto del backend
- `CORS_ORIGIN`: origen permitido para frontend

## 3) Dominios Funcionales

### 3.1 Auth y Usuarios

- Login y sesion actual: `src/routes/auth.ts`
- Gestion de usuarios: `src/routes/users.ts`
- Catalogos organizacionales: departamentos, cargos, roles, permisos por rol en `src/routes/config.ts`

### 3.2 Proyectos y Presupuestos

- Proyectos (CRUD logico y metricas): `src/routes/proyectos.ts`
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

### Entidades core (vision de negocio)

- `proyectos`
- `presupuestos_proyecto`
- `presupuesto_categorias`
- `presupuesto_movimientos`
- `solicitudes_material`
- `solicitud_items`
- `cotizaciones`
- `cotizacion_items`
- `ordenes_compra`
- `usuarios`, `roles`, `permisos`, `rol_permisos`
- `notificaciones`
- `materiales`, `unidades_medida`, `material_categorias`

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

## 5.4 Flujo de Compras

### Paso A: Solicitud de Material

- `POST /api/solicitudes`
- Requiere `proyecto_id`, `solicitante` e `items`.
- Crea encabezado en `solicitudes_material` + detalle en `solicitud_items` en transaccion.
- Estado inicial tipico: `Pendiente`.

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

## 5.6 Notificaciones In-App

Modulo implementado con:

- `GET /api/notificaciones`
- `GET /api/notificaciones/unread-count`
- `PATCH /api/notificaciones/:id/leida`
- `PATCH /api/notificaciones/marcar-todas-leidas`

Usa `notificaciones` con `payload` JSONB para contexto flexible por evento.

## 5.7 Dashboard

KPIs expuestos en `src/routes/dashboard.ts`:

- Solicitudes del mes: pendientes vs atendidas
- Gasto por proyecto
- Tiempo de conversion Solicitud -> OC
- Endpoint compuesto: `/api/dashboard/resumen`

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

- `GET /api/proyectos`
- `GET /api/proyectos/:id`
- `POST /api/proyectos`
- `PATCH /api/proyectos/:id`
- `PATCH /api/proyectos/:id/active`

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

## 9.2 Antes de modificar logica critica

- Verificar impacto en estados de flujo.
- Verificar impacto en presupuesto comprometido y movimientos.
- Verificar eventos de notificacion relacionados.
- Preferir transacciones para cambios multi-tabla.
- Mantener compatibilidad con permisos por rol.

## 9.3 Invariantes que no deben romperse

- Una cotizacion no aprobada no debe generar OC.
- Una cotizacion no puede tener mas de una OC.
- No se debe comprometer presupuesto sobre el disponible.
- Alertas deben dispararse al cruzar umbral y/o 100%.

## 9.4 Mejoras recomendadas (backlog tecnico)

- Homogeneizar proteccion de endpoints con auth + permisos.
- Endurecer configuracion: eliminar secretos/URLs fallback en produccion.
- Agregar suite de tests de flujo (Solicitud -> Cotizacion -> OC -> Presupuesto).
- Estandarizar manejo de errores y auditoria de eventos.

## 10) Contexto Minimo que un Agente Debe Retener

Si un agente solo retiene una cosa, debe retener esto:

- ROKA es un sistema transaccional de compras para proyectos, donde la OC es el hito que compromete presupuesto y dispara trazabilidad/notificaciones.
- El flujo esta gobernado por estados, permisos por rol y validaciones de disponibilidad presupuestaria.
- La consistencia de datos depende de transacciones y del orden correcto del flujo de negocio.
