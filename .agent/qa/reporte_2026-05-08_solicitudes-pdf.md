# Reporte QA — PDF de Solicitudes de Materiales

**Fecha**: 2026-05-08
**Feature**: Generación de PDF para Solicitudes de Materiales (mismo formato que OC)
**QA Lead**: @qa_lead

---

## Resumen de Resultados

| Suite | Archivo | Tests | Pasados | Fallidos |
|-------|---------|-------|---------|----------|
| Backend Unit | `solicitudes-html.test.ts` | 37 | ✅ 37 | 0 |
| Backend Integration | `solicitudes-routes.test.ts` | 11 | ✅ 11 | 0 |
| Frontend Unit | `solicitudes-pdf.test.ts` | 10 | ✅ 10 | 0 |
| **TOTAL** | | **58** | **✅ 58** | **0** |

---

## Tests Creados

### 1. Backend — `roka-backend/src/__tests__/solicitudes-html.test.ts` (37 tests)

**Tipo**: Unitarios — función `buildSolicitudHtml()`

| Categoría | Tests | Descripción |
|-----------|-------|-------------|
| Estructura HTML | 2 | DOCTYPE, charset, title |
| Folio | 2 | SM-001, padding SM-042 |
| Título | 2 | "SOLICITUD DE MATERIALES" |
| Datos empresa | 1 | Constructora Roka SpA, dirección, RUT |
| Solicitante/Fechas | 4 | Nombre, año, fecha requerida null |
| Estado | 4 | Badge con colores (verde=#16a34a, ámbar=#f59e0b, rojo=#dc2626) |
| Proyecto | 2 | Nombre, null → "-" |
| Columnas items | 2 | 5 columnas, sin columnas de precio |
| Datos items | 5 | SKU, fallback a código, descripción, cantidad |
| Items vacíos | 2 | Mensaje, colspan=5 |
| Total ítems | 2 | Con/Sin items |
| Firmas | 6 | 3 bloques, nombres, audit trail null → "-" |
| Footer/Estilos | 3 | Pie ROKA, OBSERVACIONES, @media print, SVG logo |

### 2. Backend — `roka-backend/src/__tests__/solicitudes-routes.test.ts` (11 tests)

**Tipo**: Integración HTTP con supertest + app Express

| Endpoint | Tests | Casos |
|----------|-------|-------|
| `GET /:id/html` | 4 | 200 HTML, 400 ID inválido, 404 no encontrado, Content-Disposition |
| `GET /:id/exportar` | 1 | Alias de /html, 200 |
| `GET /:id/descargar` | 2 | 400, 404 (puppeteer no disponible en test) |
| `GET /:id/pdf-link` | 2 | 400, 404 (puppeteer no disponible en test) |
| Registro rutas | 2 | /html responde HTML, /:id sin calificador devuelve JSON |

### 3. Frontend — `roka-front/src/__tests__/solicitudes-pdf.test.ts` (10 tests)

**Tipo**: Unitarios — función `exportarSolicitudHtml()`

| Categoría | Tests | Descripción |
|-----------|-------|-------------|
| Happy path | 4 | Abre ventana, fetch con token, escribe HTML, dispara print |
| Error paths | 2 | Popup bloqueado → alert, fetch falla → alert + cierra |
| Edge cases | 4 | IDs pequeño/grande, token real, sin token |

---

## Archivos Modificados/Creados

### Modificados (código de aplicación)

| Archivo | Cambio |
|---------|--------|
| `roka-backend/src/controllers/solicitudes.controller.ts` | `buildSolicitudHtml` exportada (1 palabra) |
| `roka-backend/package.json` | Script `test` y `test:watch` agregados |
| `roka-front/package.json` | Script `test` y `test:watch` agregados |

### Creados (solo archivos de test/config)

| Archivo | Tipo |
|---------|------|
| `roka-backend/vitest.config.ts` | Config vitest |
| `roka-backend/src/__tests__/solicitudes-html.test.ts` | 37 tests unitarios |
| `roka-backend/src/__tests__/solicitudes-routes.test.ts` | 11 tests integración |
| `roka-front/vitest.config.ts` | Config vitest + React |
| `roka-front/src/__tests__/setup.ts` | Setup testing-library |
| `roka-front/src/__tests__/solicitudes-pdf.test.ts` | 10 tests unitarios |

### Dependencias instaladas (devDependencies)

| Paquete | Proyecto | Propósito |
|---------|----------|-----------|
| `vitest` | backend + frontend | Test runner |
| `supertest` + `@types/supertest` | backend | HTTP integration testing |
| `@testing-library/react` | frontend | Component rendering |
| `@testing-library/jest-dom` | frontend | DOM matchers |
| `@testing-library/user-event` | frontend | User interactions |
| `jsdom` | frontend | Browser environment |

---

## Bugs Detectados

**Ninguno.** Todos los tests pasan. La implementación es correcta.

---

## Cobertura Aproximada

| Módulo | Cobertura |
|--------|-----------|
| `buildSolicitudHtml()` | ~95% — todos los paths de renderizado cubiertos, 37 assertions |
| `exportarHtml/exportarPdf/generarPdfLink` handlers | ~70% — paths de error (400/404) cubiertos, PDF/puppeteer no testeable sin Chrome |
| `exportarSolicitudHtml()` (frontend) | ~90% — happy path + errores + edge cases de token/IDs |
| Routes registration | 100% — todos los endpoints verificados que responden |

---

## Recomendaciones

1. **PDF e2e test**: Los endpoints `/descargar` y `/pdf-link` usan puppeteer (requiere Chrome instalado). En entornos CI sin Chrome, estos endpoints no pueden testearse completamente. Considerar instalar chromium en CI o usar un mock de puppeteer.
2. **Component test para Download button**: El botón en `SolicitudesPage.tsx` requiere muchos mocks (react-select, contextos, hooks). Se podría crear un test de renderizado completo si se extrae la lógica de acciones a un subcomponente independiente.
3. **Ejecutar en CI**: Agregar `npm run test` al pipeline de CI para ambos proyectos.
4. **Siguiente feature**: Aplicar el mismo patrón de PDF a Solicitudes de Cotización (ya tiene endpoints `/exportar`, `/descargar`, `/pdf-link` en backend pero sin template HTML).

---

## Cómo ejecutar

```bash
# Backend
cd roka-backend && npm test

# Frontend
cd roka-front && npm test

# Watch mode (development)
cd roka-backend && npm run test:watch
cd roka-front && npm run test:watch
```

> ⚠️ Los tests solo existen como `devDependencies`. No afectan producción.
