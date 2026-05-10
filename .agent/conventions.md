# Convenciones del Proyecto

## Estructura de carpetas

```
raíz/
├── index.cjs                 # Servidor unificado (Express + ROKA + Encuestas + MCP)
├── roka-backend/
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── app.ts            # createRokaApp() — monta rutas
│   │   ├── db.ts             # Pool de PostgreSQL
│   │   ├── routes/           # ~14 archivos de rutas
│   │   ├── middleware/       # authMiddleware, permissions
│   │   └── lib/              # migrations, notifications, upload
│   └── migrations/           # 020 archivos SQL versionados
├── roka-front/
│   └── src/
│       ├── App.tsx           # Entry point React
│       ├── components/       # auth/, chat/, cotizaciones/, dashboard/, layout/, materiales/, ordenes/, presupuestos/, proveedores/, proyectos/, solicitudes/, ui/
│       ├── pages/            # Vistas enrutadas
│       ├── hooks/            # Custom hooks
│       ├── context/          # React context providers
│       ├── lib/              # Utilidades, API client
│       ├── types/            # TypeScript types/DTOs
│       └── utils/
├── roka-mcp/
│   └── src/
│       ├── index.ts          # Entry point MCP
│       └── tools/            # 10 módulos de herramientas (1:1 con backend routes)
└── uploads/                  # Archivos subidos (licitaciones, cotizaciones)
```

## Nomenclatura

- **Archivos backend**: `kebab-case` para rutas (`solicitudes.routes.ts`), `camelCase` para middleware (`authMiddleware.ts`)
- **Archivos frontend**: `PascalCase` para componentes (`Sidebar.tsx`, `FlowStepper.tsx`)
- **Módulos MCP**: igual que backend (`solicitudes.ts`, `cotizaciones.ts`)
- **Base de datos**: `snake_case` para tablas y columnas (`solicitudes_material`, `created_by_usuario_id`)
- **Migraciones**: `NNN_descripcion.sql` (3 dígitos, numeración secuencial)
- **Nombres de módulo en rutas**: plural en español (`solicitudes`, `proyectos`, `ordenes`)
- **Variables de entorno**: UPPER_SNAKE_CASE (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`)

## Patrón backend

- **Framework**: Express.js 4.x sobre Node.js
- **Lenguaje**: TypeScript 5.8 (strict mode, ES2022 target, CommonJS modules)
- **Rutas**: Cada archivo en `routes/` exporta un `Router` con controladores inline o importados
- **Controladores**: Funciones `(req: Request, res: Response) => Promise<void>` con try/catch (no siempre consistente)
- **Middleware de auth**: `authMiddleware` decodifica JWT y adjunta `req.user`
- **Middleware de permisos**: `requirePermission('codigo.permiso')` valida contra `rol_permisos`
- **Base de datos**: PostgreSQL via `pg` (sin ORM), consultas SQL directas con `pool.query()`
- **Migraciones**: Ejecutadas al iniciar con `runMigrations()`, transaccionales dentro de `BEGIN/COMMIT`
- **Transacciones**: Uso manual de `BEGIN/COMMIT/ROLLBACK` para operaciones multi-tabla
- **Uploads**: `multer` para multipart/form-data, archivos en `uploads/` con timestamp

## Patrón frontend

- **Framework**: React 19 + TypeScript
- **Build tool**: Vite 6.x
- **Estilos**: Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Routing**: React Router v7 (`react-router-dom`)
- **Animaciones**: `motion` (Framer Motion v12)
- **Gráficos**: `recharts` v3
- **Iconos**: `lucide-react`
- **Componentes UI**: Reutilizables en `components/ui/` (FlowStepper, BudgetChart, etc.)
- **Estado**: React Context para auth/sesión, hooks locales para datos de dominio
- **Cliente API**: Funciones fetch en `src/lib/`, con token JWT en header `Authorization: Bearer`
- **Hojas de cálculo**: `xlsx` para import/export Excel

## Librerías clave

| Librería | Versión | Uso |
|----------|---------|-----|
| express | ^4.21.2 | Framework HTTP backend |
| pg | ^8.20.0 | Driver PostgreSQL |
| jsonwebtoken | ^9.0.3 | Autenticación JWT |
| bcryptjs | ^3.0.3 | Hash de contraseñas |
| multer | ^2.1.1 | Upload de archivos |
| puppeteer-core | ^24.42.0 | Generación de PDFs |
| pdf-parse | ^2.4.5 | Extracción de texto de PDFs |
| openai | ^4.104.0 | Integración IA/chat |
| xlsx | ^0.18.5 | Lectura/escritura Excel |
| @modelcontextprotocol/sdk | ^1.29.0 | MCP server |
| zod | ^3.25.76 | Validación de esquemas en MCP |
| react | ^19.0.0 | UI |
| tailwindcss | ^4.1.14 | Estilos |
| vite | ^6.2.0 | Build tool frontend |
| recharts | ^3.8.1 | Gráficos dashboard |

## MCP Server — Sincronización

- Correspondencia 1:1 entre rutas backend y tools MCP:
  - `auth.routes.ts` ↔ `auth.ts`
  - `solicitudes.routes.ts` ↔ `solicitudes.ts`
  - `solicitud-cotizacion.routes.ts` ↔ `cotizaciones.ts` (tools renombradas, mig 021)
  - `ordenes.routes.ts` ↔ `ordenes.ts`
  - `presupuestos.routes.ts` ↔ `presupuestos.ts`
  - `proyectos.routes.ts` ↔ `proyectos.ts`
  - `materiales.routes.ts` ↔ `materiales.ts`
  - `proveedores.routes.ts` ↔ `proveedores.ts`
  - `notificaciones.routes.ts` ↔ `notificaciones.ts`
  - `dashboard.routes.ts` ↔ `dashboard.ts`
- Cada cambio en backend debe reflejarse en MCP y verificarse con `cd roka-mcp && npm run build`
- Transportes: StreamableHTTP (integrado) y stdio (standalone)
- **Nota mig 021**: La ruta `cotizaciones.routes.ts` fue eliminada. Las tools en `cotizaciones.ts` ahora operan sobre `solicitud-cotizacion`.

## Módulo de Email y Alertas

- **Rutas**: `email-config.routes.ts` agrupa toda la configuración de email bajo `/api/config/email/*`:
  - `/eventos` — CRUD de eventos de notificación email
  - `/sistema` — Configuración SMTP/OAuth2
  - `/test` — Envío de prueba
  - `/logs` — Historial de envíos
  - `/alertas` — Configuración de alertas de fecha de entrega
  - `/alertas/usuarios` — Usuarios disponibles como destinatarios
- **Scheduler**: `email-alertas.ts` implementa polling con `setInterval` (default 30 min, configurable vía `ALERT_EMAIL_INTERVAL_MS`)
- **Log de envíos**: `alerta_email_log` con UNIQUE(solicitud_id, usuario_destino_id, tipo_alerta, numero_envio) para protección contra duplicados
- **Plantillas HTML**: `email.ts` contiene funciones `build*Html()` para cada tipo de notificación

## Anti-patrones a evitar

- ❌ Endpoints sin protección de auth (varios en solicitudes, materiales, dashboard aún sin middleware)
- ❌ Fallback de `JWT_SECRET` y `DATABASE_URL` hardcodeados en producción
- ❌ No validar saldo de presupuesto ANTES de comprometer (rompe invariante financiero)
- ❌ Duplicar OC para la misma solicitud de cotización respondida (viola integridad de flujo)
- ❌ Eliminar categorías con monto comprometido > 0 (rompe integridad presupuestaria)
- ❌ Operaciones multi-tabla sin transacciones (pérdida de consistencia)
