# Plan: eliminar-cotizaciones-venta

## Objetivo
Eliminar la funcionalidad de "cotizaciones de venta" (cotizaciones + cotizacion_items) porque las solicitudes de cotización ya manejan el flujo completo.

## Cambios principales
1. **BD (migración 021)**: Agregar precio_unitario, subtotal, descuento_porcentaje, codigo_proveedor a solicitud_cotizacion_detalle. Agregar solicitud_cotizacion_id a ordenes_compra. Migrar datos existentes. DROP cotizaciones y cotizacion_items.
2. **Backend**: Eliminar rutas/controladores/servicios/tipos de cotizaciones. Migrar importación a SC. Modificar OC para usar solicitud_cotizacion_id.
3. **Frontend**: Eliminar componentes de cotizaciones de venta. Modificar sidebar, rutas, ÓrdenesPage, FlowStepper, api.ts, tipos.
4. **MCP**: Eliminar tools de cotizaciones. Modificar crear_orden_compra. Mover importación a SC.

## Riesgos
- Cotizaciones sin SC vinculada (datos huérfanos)
- OCs existentes con cotizacion_id (migrar a solicitud_cotizacion_id)
- Migración no reversible (DROP TABLE)

## Decisiones
- ADR-002: Eliminar cotizaciones de venta como entidad separada
- ADR-003: Migrar importación a SC, precios en solicitud_cotizacion_detalle
