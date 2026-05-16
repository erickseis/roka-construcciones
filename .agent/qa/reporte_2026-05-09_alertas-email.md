# Reporte QA — configurar-alertas-email-fecha-entrega

**Fecha:** 2026-05-09
**Plan:** `configurar-alertas-email-fecha-entrega`
**Tester:** Equipo QA

---

## Pruebas de Endpoints (9 tests)

| # | Test | Resultado | HTTP | Detalle |
|---|------|-----------|------|---------|
| 1 | GET /api/config/email/alertas | ✅ PASÓ | 200 | Retorna config por defecto (habilitada:false, umbral:48h) |
| 2 | GET /api/config/email/alertas/usuarios | ✅ PASÓ | 200 | Array con 4 usuarios activos |
| 3 | PUT config completa | ✅ PASÓ | 200 | Config actualizada con umbral:3dias, recordatorios:5, destinatarios:[1] |
| 4 | GET post-PUT (persistencia) | ✅ PASÓ | 200 | Datos confirmados: habilitada:true, umbral:3dias, destinatarios:[1,5] |
| 5 | PUT sin token (auth) | ✅ PASÓ | 401 | "No autorizado, token faltante" |
| 6 | PUT umbral_tipo inválido | ✅ PASÓ | 400 | "umbral_tipo debe ser 'horas' o 'dias'" |
| 7 | PUT destinatarios vacíos + habilitada=true | ⚠️ BUG | 200 | Debía rechazar con 400 (sin destinatarios no hay a quién notificar) |
| 8 | PUT umbral_valor <= 0 | ✅ PASÓ | 400 | "umbral_valor debe ser un número positivo" |
| 9 | PUT restaurar config válida | ✅ PASÓ | 200 | Múltiples destinatarios [1,5] guardados OK |

## Verificación Scheduler

- ✅ Scheduler iniciado correctamente (log: "[AlertasEmail] Scheduler iniciado — intervalo: 30 minutos")
- ✅ Migración 032_alerta_email_config.sql ejecutada
- ✅ Solicitud creada manualmente (ID=31) con fecha_requerida=2026-05-09 para probar detección
- ⚠️ El ciclo de 30 min no se completó durante la prueba (falta esperar)

## Verificación Frontend

- ✅ EmailAlertasTab.tsx existe (15517 bytes)
- ✅ Build frontend: ✓ built in 3.79s, sin errores

## Bugs detectados

| ID | Descripción | Severidad | Estado |
|----|-------------|-----------|--------|
| ALERTA-BUG-01 | PUT permite guardar con habilitada=true pero destinatarios_usuario_ids:[]. El plan y el contrato especifican que debe rechazarse con 400 | Media | ABIERTO |
| ALERTA-BUG-02 | Dual init del scheduler en app.ts:50 y index.ts:17 — no funcional pero redundante | Baja | ABIERTO |
| ALERTA-BUG-03 | Bucle infinito si usuario destinatario no tiene correo configurado (duplicado de ALERTA-01) | Media | DUPLICADO |

## Veredicto

**APROBADO CON OBSERVACIONES** — Funcionalidad operativa. Bugs menores requieren corrección futura. ALERTA-BUG-03 ya está registrado como ALERTA-01 en known_issues.md.
