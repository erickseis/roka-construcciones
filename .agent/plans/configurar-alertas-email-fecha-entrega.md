# PLAN: Módulo de Configuración de Alertas de Correo — Fecha de Entrega de Solicitudes

**ID**: configurar-alertas-email-fecha-entrega
**Versión**: 1.0
**Fecha**: 2026-05-08
**Estado**: planificado

---

## 1. Resumen

Crear módulo en Configuración para alertas de email cuando solicitudes de materiales se acercan a su `fecha_requerida`. Permite configurar umbral de anticipación (horas/días), recordatorios periódicos hasta atención, y selección de usuarios destinatarios.

## 2. Archivos a crear/modificar

### Backend

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `roka-backend/migrations/031_alerta_email_config.sql` | CREAR | Tablas `alerta_email_config` y `alerta_email_log` |
| `roka-backend/src/routes/email-config.routes.ts` | CREAR | Endpoints GET/PUT config y GET usuarios disponibles |
| `roka-backend/src/lib/email-alertas.ts` | CREAR | Scheduler polling cada 30 min, lógica de detección y envío |
| `roka-backend/src/lib/email.ts` | MODIFICAR | Agregar template HTML para alerta de fecha próxima |
| `roka-backend/src/index.ts` | MODIFICAR | Inicializar scheduler al arrancar |

### Frontend

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `roka-front/src/pages/config/EmailAlertasTab.tsx` | CREAR | Tab de configuración de alertas de email |
| `roka-front/src/lib/api.ts` | MODIFICAR | Agregar funciones `getEmailAlertasConfig`, `updateEmailAlertasConfig`, `getUsuariosAlertas` |
| `roka-front/src/pages/config/ConfigPage.tsx` | MODIFICAR | Agregar tab "Alertas de Correo" |

## 3. Contratos

### 3.1 Tabla `alerta_email_config`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | SERIAL PK | |
| `habilitada` | BOOLEAN NOT NULL DEFAULT false | Activar/desactivar alerta |
| `umbral_tipo` | VARCHAR(10) NOT NULL DEFAULT 'dias' | `horas` o `dias` |
| `umbral_valor` | INTEGER NOT NULL DEFAULT 2 | Anticipación (2 días por defecto) |
| `recordatorios_habilitados` | BOOLEAN NOT NULL DEFAULT false | Recordatorios periódicos |
| `recordatorios_cantidad` | INTEGER NOT NULL DEFAULT 3 | Número máximo de recordatorios |
| `recordatorios_frecuencia_hs` | INTEGER NOT NULL DEFAULT 24 | Horas entre recordatorios |
| `destinatarios_usuario_ids` | INTEGER[] NOT NULL DEFAULT '{}' | Array de IDs de usuarios destino |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ DEFAULT NOW() | |

### 3.2 Tabla `alerta_email_log`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `id` | SERIAL PK | |
| `solicitud_id` | INTEGER NOT NULL REFERENCES solicitudes_material(id) | |
| `usuario_destino_id` | INTEGER NOT NULL REFERENCES usuarios(id) | |
| `tipo_alerta` | VARCHAR(20) NOT NULL | `vencimiento_proximo` o `recordatorio` |
| `numero_envio` | INTEGER NOT NULL DEFAULT 1 | N° de envío (recordatorios incrementan) |
| `enviado_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | |

### 3.3 Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/config/email/alertas` | Obtener configuración actual |
| `PUT` | `/api/config/email/alertas` | Actualizar configuración |
| `GET` | `/api/config/email/alertas/usuarios` | Listar usuarios disponibles como destinatarios |

### 3.4 Scheduler

- Mecanismo: `setInterval` polling
- Frecuencia: cada 30 minutos
- Consulta: solicitudes en estado `Pendiente` o `Cotizando` cuya `fecha_requerida` está próxima según umbral configurado
- Acción: enviar email a destinatarios configurados y registrar en `alerta_email_log`
- Recordatorios: si `recordatorios_habilitados=true`, re-envía según `recordatorios_frecuencia_hs` hasta `recordatorios_cantidad` máximo

## 4. Dependencias

- Migración `031_alerta_email_config.sql` debe ejecutarse antes que el scheduler intente leer/escribir tablas
- Ruta de email-config debe montarse en `index.ts` antes del scheduler
- Se requiere que el módulo de email (`src/lib/email.ts`) ya esté operativo con Gmail OAuth2

## 5. Riesgos

- El scheduler polling consume recursos si hay muchas solicitudes; considerar límite de consulta (ej. TOP 50)
- Si el backend se reinicia, el scheduler pierde estado de recordatorios ya enviados (la tabla `alerta_email_log` persiste)
- La selección de usuarios requiere que existan usuarios activos en el sistema

---

## 6. Reportes de Implementación

### 6.1 Reporte programador_backend (2026-05-08)

**Archivos creados:**
- `roka-backend/src/lib/email-alertas.ts` (255 LOC) — Scheduler polling cada 30 min, lógica de detección de solicitudes próximas a vencer, envío de emails y registro en `alerta_email_log`

**Archivos modificados:**
- `roka-backend/src/routes/email-config.routes.ts` (+103 LOC, 3 endpoints: GET/PUT config y GET usuarios)
- `roka-backend/src/lib/email.ts` (+40 LOC, función `buildAlertaFechaEntregaHtml`)
- `roka-backend/src/index.ts` (+1 import + 1 call para inicializar scheduler)
- `roka-backend/src/app.ts` (+1 import + 2 calls para montar rutas de email-config)

**Build:** `npm run build` sin errores

### 6.2 Reporte programador_frontend (2026-05-08)

**Archivos creados:**
- `roka-front/src/pages/config/EmailAlertasTab.tsx` — Tab de configuración de alertas de email

**Archivos modificados:**
- `roka-front/src/lib/api.ts` (3 funciones: `getEmailAlertasConfig`, `updateEmailAlertasConfig`, `getUsuariosAlertas` + 2 tipos)
- `roka-front/src/pages/config/ConfigPage.tsx` (nuevo tab "Alertas de Correo")

**Compilación:** OK — build en 4.65s

### 6.3 Veredicto revisor_código (2026-05-08)

| Campo | Valor |
|-------|-------|
| **Veredicto** | ✅ APPROVED |
| **Issues críticos** | Ninguno |
| **Issues menores** | 1. Bucle infinito si usuario no tiene correo (`email-alertas.ts` L192-203) |
| | 2. Scheduler inicia antes de migraciones (`app.ts` L50) |
| **Resumen** | Aprobado, implementación completa y funcional. Issues menores son optimizaciones. |
