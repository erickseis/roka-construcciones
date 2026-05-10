# Issues Conocidos

<!-- Formato por entrada:
## [ABIERTO] <id> — <título>
**Síntoma:** ...
**Workaround:** ...
**Detectado en:** <tarea origen>

## [RESUELTO] <id> — <título>
... (cuando se resuelva, marcar y agregar "Resuelto en")
-->

## [RESUELTO] AUTH-01 — Endpoints sin protección de autenticación
**Síntoma:** Varios endpoints en `solicitudes`, `materiales`, `dashboard` y partes de `config/users` operan sin `authMiddleware`. Cualquier request sin token puede acceder/modificar datos. Se aplicó `authMiddleware` a los 36 endpoints que carecían de protección.
**Workaround:** Ninguno desde el sistema. Requiere que el deploy exponga el backend solo en red interna/VPN.
**Detectado en:** inicializacion
**Resuelto en:** refactorizacion-F1

## [RESUELTO] SEC-02 — Secretos con fallback hardcodeado
**Síntoma:** `JWT_SECRET` y `DATABASE_URL` tienen valores por defecto para entorno local. Si no se configuran en producción, se usan los fallback que son públicos.
**Workaround:** Asegurar que `.env` en producción tenga valores reales.
**Detectado en:** inicializacion
**Resuelto en:** refactorizacion-F0 — Fallbacks eliminados. La aplicación falla inmediatamente si faltan variables de entorno.

## [ABIERTO] CONSIST-03 — Falta suite de tests automatizados
**Síntoma:** Tests unitarios e integración creados para PDF de solicitudes (58 tests). Falta cobertura para flujo completo de compras (Solicitud → Cotización → OC → Presupuesto). Los errores de regresión pueden no detectarse temprano.
**Workaround:** Pruebas manuales para el flujo completo.
**Detectado en:** inicializacion
**Nota:** Cobertura parcial agregada en refactorizacion-F0 (58 tests para PDF de solicitudes).

## [ABIERTO] ALERTA-01 — Bucle infinito potencial si usuario destino sin correo
**Síntoma:** En `email-alertas.ts` L192-203, la función `sendAlertaEmail` verifica si `getUserEmailById(userId)` retorna null y retorna early. Sin embargo, si la función lanzara una excepción en lugar de retornar null, podría generarse un bucle infinito en el scheduler (el error se captura en L102 pero no se detiene el ciclo). Adicionalmente, si todos los usuarios configurados carecen de correo, el scheduler sigue ejecutándose cada 30 min sin efecto.
**Workaround:** Asegurar que todos los usuarios destinatarios tengan correo configurado. Mejora: agregar contador de reintentos fallidos y deshabilitar automáticamente si no hay destinatarios válidos.
**Detectado en:** configurar-alertas-email-fecha-entrega

## [RESUELTO] ALERTA-02 — Scheduler inicia antes de que las migraciones completen
**Síntoma:** En `app.ts` L50, el scheduler `startAlertScheduler()` se invoca antes de que `runMigrations()` termine su ejecución. Si las migraciones 031/032 no se han ejecutado, el scheduler falla al consultar tablas que aún no existen.
**Workaround:** Ninguno en entorno local (migraciones corren rápido). En producción con muchas migraciones, es posible un race condition breve. Mejora: mover el scheduler después del await de runMigrations().
**Detectado en:** configurar-alertas-email-fecha-entrega
**Resuelto en:** refactorizacion-F0 — Verificado: scheduler solo se llama en `index.ts:17` dentro del `.then()` después de `runMigrations()`. La llamada duplicada en `app.ts` no existe.

## [ABIERTO] SC-IMPORT-01 — Endpoints de importación de respuesta para SC no implementados en backend
**Síntoma:** Las tools MCP `importar_respuesta_cotizacion_desde_archivo` y `confirmar_importacion_respuesta_cotizacion` apuntan a `POST /api/solicitud-cotizacion/importar` y `POST /api/solicitud-cotizacion/importar/confirmar`, pero estas rutas no existen en el backend. Cualquier intento de importar un archivo PDF/Excel de proveedor fallará.
**Workaround:** Crear manualmente la respuesta con precios a través del endpoint de creación de SC.
**Detectado en:** eliminar-cotizaciones-venta

## [ABIERTO] ALERTA-BUG-01 — PUT alertas permite habilitada=true con destinatarios vacíos
**Síntoma:** El endpoint `PUT /api/config/email/alertas` acepta `habilitada: true` con `destinatarios_usuario_ids: []` y responde 200 en vez de 400. Sin destinatarios no hay a quién notificar.
**Workaround:** Ninguno. Asegurar que siempre se envíe al menos un destinatario al habilitar.
**Detectado en:** configurar-alertas-email-fecha-entrega (QA)

## [RESUELTO] ALERTA-BUG-02 — Dual init del scheduler de alertas
**Síntoma:** El scheduler `startAlertScheduler()` se invoca tanto en `app.ts:50` como en `index.ts:17`. No causa fallos funcionales (el segundo arranque detecta que ya corre y se salta), pero es código redundante.
**Workaround:** Eliminar la invocación duplicada. Mantener solo la de `app.ts` o solo la de `index.ts`.
**Detectado en:** configurar-alertas-email-fecha-entrega (QA)
**Resuelto en:** refactorizacion-F0 — Verificado: no existe duplicado. El scheduler solo se inicia en `index.ts:17`.

## [ABIERTO] SEC-03 — CORS origen permite solo localhost:3000
**Síntoma:** CORS habilitado con `CORS_ORIGIN` que default a `http://localhost:3000`. En producción, el frontend puede estar en un dominio diferente y las requests serán rechazadas.
**Workaround:** Configurar `CORS_ORIGIN` en `.env` de producción con el dominio correcto.
**Detectado en:** refactorizacion-F0
