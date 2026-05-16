# Contratos Vigentes — ROKA Sistema Finanzas

## Schema de BD

### proyectos
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| nombre | VARCHAR(200) | NOT NULL |
| ubicacion | VARCHAR(300) | |
| estado | VARCHAR(50) | DEFAULT 'En Curso' |
| is_active | BOOLEAN | NOT NULL DEFAULT TRUE |
| fecha_inicio | DATE | |
| fecha_fin | DATE | |
| responsable_usuario_id | INT | FK → usuarios(id) ON DELETE SET NULL |
| numero_licitacion | VARCHAR | (mig 007) |
| descripcion_licitacion | TEXT | (mig 007) |
| fecha_apertura_licitacion | DATE | (mig 007) |
| monto_referencial_licitacion | DECIMAL | (mig 007) |
| archivo_licitacion_path | VARCHAR(500) | (mig 007) |
| archivo_licitacion_nombre | VARCHAR(200) | (mig 007) |
| mandante | VARCHAR | (mig 012) |
| moneda | VARCHAR | (mig 013) |
| plazo_ejecucion_dias | INT | (mig 018) |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### solicitudes_material
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| proyecto_id | INT | NOT NULL, FK → proyectos(id) |
| solicitante | VARCHAR(150) | NOT NULL |
| fecha | DATE | NOT NULL DEFAULT CURRENT_DATE |
| fecha_requerida | DATE | (mig 019) |
| estado | VARCHAR(30) | NOT NULL DEFAULT 'Pendiente', CHECK IN ('Pendiente','Cotizando','Aprobado') |
| presupuesto_categoria_id | INT | FK → presupuesto_categorias(id) ON DELETE SET NULL |
| created_by_usuario_id | INT | FK → usuarios(id) ON DELETE SET NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### solicitud_items
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| solicitud_id | INT | NOT NULL, FK → solicitudes_material(id) ON DELETE CASCADE |
| nombre_material | VARCHAR(200) | NOT NULL |
| cantidad_requerida | DECIMAL(12,2) | NOT NULL |
| unidad | VARCHAR(30) | NOT NULL |
| material_id | INT | FK → materiales(id) |
| codigo | VARCHAR | (mig 010) |

### solicitud_cotizacion (mig 016, mig 021)
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| solicitud_id | INT | NOT NULL, FK → solicitudes_material(id) |
| proveedor_id | INT | FK → proveedores(id) ON DELETE SET NULL |
| proveedor | VARCHAR(200) | NOT NULL |
| estado | VARCHAR(30) | NOT NULL DEFAULT 'Borrador', CHECK IN ('Borrador','Enviada','Respondida','Anulada') |
| observaciones | TEXT | |
| numero_cov | VARCHAR | (mig 021) Número de cotización de venta del proveedor |
| archivo_adjunto_path | VARCHAR(500) | (mig 021) Ruta del archivo importado |
| archivo_adjunto_nombre | VARCHAR(200) | (mig 021) Nombre del archivo original |
| created_by_usuario_id | INT | FK → usuarios(id) ON DELETE SET NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### solicitud_cotizacion_detalle (mig 016, mig 021)
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| solicitud_cotizacion_id | INT | NOT NULL, FK → solicitud_cotizacion(id) ON DELETE CASCADE |
| solicitud_item_id | INT | NOT NULL, FK → solicitud_items(id) |
| precio_unitario | DECIMAL(12,2) | (mig 021) Precio cotizado por el proveedor |
| subtotal | DECIMAL(14,2) | (mig 021) precio_unitario * cantidad |
| descuento_porcentaje | DECIMAL(5,2) | (mig 021) Descuento por línea |
| codigo_proveedor | VARCHAR | (mig 021) Código/SKU del proveedor |
| | | UNIQUE(solicitud_cotizacion_id, solicitud_item_id) |

### ordenes_compra
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| solicitud_cotizacion_id | INT | FK → solicitud_cotizacion(id) ON DELETE SET NULL (mig 021, reemplaza cotizacion_id) |
| fecha_emision | DATE | NOT NULL DEFAULT CURRENT_DATE |
| condiciones_pago | VARCHAR(300) | |
| estado_entrega | VARCHAR(50) | NOT NULL DEFAULT 'Pendiente', CHECK IN ('Pendiente','Recibido parcial','Completado') |
| total | DECIMAL(14,2) | NOT NULL |
| folio | VARCHAR(60) | NOT NULL (mig 009) |
| descuento_tipo | VARCHAR(20) | DEFAULT 'none' (mig 009) |
| descuento_valor | DECIMAL(14,2) | DEFAULT 0 (mig 009) |
| descuento_monto | DECIMAL(14,2) | DEFAULT 0 (mig 009) |
| subtotal_neto | DECIMAL(14,2) | (mig 009) |
| impuesto_monto | DECIMAL(14,2) | (mig 009) |
| total_final | DECIMAL(14,2) | (mig 009) |
| plazo_entrega | VARCHAR(120) | (mig 009) |
| condiciones_entrega | VARCHAR(300) | (mig 009) |
| atencion_a | VARCHAR(150) | (mig 009) |
| observaciones | TEXT | (mig 009) |
| created_by_usuario_id | INT | FK → usuarios(id) ON DELETE SET NULL |
| autorizado_por_usuario_id | INT | FK → usuarios(id) (mig 017) |
| solicitud_id | INT | FK → solicitudes_material(id) (mig 017) |
| codigo_obra | VARCHAR | (mig 017) |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### orden_compra_items (mig 015)
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| orden_compra_id | INT | NOT NULL, FK → ordenes_compra(id) ON DELETE CASCADE |
| nombre_material | VARCHAR(300) | NOT NULL |
| cantidad | DECIMAL(12,2) | NOT NULL |
| unidad | VARCHAR(30) | NOT NULL |
| precio_unitario | DECIMAL(12,2) | NOT NULL |
| subtotal | DECIMAL(14,2) | NOT NULL |
| codigo | VARCHAR(60) | |
| created_at | TIMESTAMP | DEFAULT NOW() |

### presupuestos_proyecto
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| proyecto_id | INT | NOT NULL UNIQUE, FK → proyectos(id) ON DELETE CASCADE |
| monto_total | DECIMAL(14,2) | NOT NULL CHECK (>0) |
| monto_comprometido | DECIMAL(14,2) | NOT NULL DEFAULT 0 CHECK (>=0) |
| umbral_alerta | DECIMAL(5,2) | NOT NULL DEFAULT 80 CHECK (>0 AND <=100) |
| estado | VARCHAR(30) | NOT NULL DEFAULT 'Vigente', CHECK IN ('Borrador','Vigente','Cerrado') |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### presupuesto_categorias
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| presupuesto_id | INT | NOT NULL, FK → presupuestos_proyecto(id) ON DELETE CASCADE |
| nombre | VARCHAR(120) | NOT NULL |
| monto_asignado | DECIMAL(14,2) | NOT NULL CHECK (>0) |
| monto_comprometido | DECIMAL(14,2) | NOT NULL DEFAULT 0 CHECK (>=0) |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |
| | | UNIQUE(presupuesto_id, nombre) |

### presupuesto_movimientos
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| presupuesto_id | INT | NOT NULL, FK → presupuestos_proyecto(id) ON DELETE CASCADE |
| categoria_id | INT | FK → presupuesto_categorias(id) ON DELETE SET NULL |
| orden_compra_id | INT | UNIQUE, FK → ordenes_compra(id) ON DELETE SET NULL |
| tipo | VARCHAR(20) | NOT NULL CHECK IN ('Compromiso','Ajuste') |
| monto | DECIMAL(14,2) | NOT NULL |
| descripcion | TEXT | |
| created_by | INT | FK → usuarios(id) ON DELETE SET NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

### usuarios
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| nombre | VARCHAR(100) | NOT NULL |
| apellido | VARCHAR(100) | NOT NULL |
| rut | VARCHAR(15) | UNIQUE NOT NULL |
| correo | VARCHAR(150) | UNIQUE NOT NULL |
| telefono | VARCHAR(20) | |
| departamento_id | INT | FK → departamentos(id) ON DELETE SET NULL |
| cargo_id | INT | FK → cargos(id) ON DELETE SET NULL |
| rol_id | INT | FK → roles(id) ON DELETE SET NULL |
| password_hash | VARCHAR(255) | NOT NULL |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### departamentos
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| nombre | VARCHAR(100) | UNIQUE NOT NULL |
| descripcion | TEXT | |
| created_at | TIMESTAMP | DEFAULT NOW() |

### roles
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| nombre | VARCHAR(50) | UNIQUE NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

### cargos
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| nombre | VARCHAR(100) | NOT NULL |
| departamento_id | INT | FK → departamentos(id) ON DELETE CASCADE |
| created_at | TIMESTAMP | DEFAULT NOW() |

### permisos
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| codigo | VARCHAR(80) | UNIQUE NOT NULL |
| descripcion | VARCHAR(255) | |

### rol_permisos
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| rol_id | INT | NOT NULL, FK → roles(id) ON DELETE CASCADE |
| permiso_id | INT | NOT NULL, FK → permisos(id) ON DELETE CASCADE |
| | | UNIQUE(rol_id, permiso_id) |

### notificaciones
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| usuario_destino_id | INT | NOT NULL, FK → usuarios(id) ON DELETE CASCADE |
| tipo | VARCHAR(80) | NOT NULL |
| titulo | VARCHAR(180) | NOT NULL |
| mensaje | TEXT | NOT NULL |
| entidad_tipo | VARCHAR(50) | |
| entidad_id | INT | |
| payload | JSONB | NOT NULL DEFAULT '{}' |
| enviado_por_usuario_id | INT | FK → usuarios(id) ON DELETE SET NULL |
| leida | BOOLEAN | NOT NULL DEFAULT FALSE |
| leida_at | TIMESTAMP | |
| created_at | TIMESTAMP | DEFAULT NOW() |

### materiales
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| sku | VARCHAR(50) | UNIQUE |
| nombre | VARCHAR(200) | NOT NULL |
| descripcion | TEXT | |
| unidad_medida_id | INT | FK → unidades_medida(id) |
| categoria | VARCHAR(100) | |
| categoria_id | INT | FK → material_categorias(id) (mig 006) |
| precio_referencial | DECIMAL(12,2) | |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### unidades_medida
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| nombre | VARCHAR(50) | NOT NULL |
| abreviatura | VARCHAR(10) | NOT NULL |
| created_at | TIMESTAMP | DEFAULT NOW() |

### material_categorias
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| nombre | VARCHAR(100) | NOT NULL UNIQUE |
| descripcion | TEXT | |
| created_at | TIMESTAMP | DEFAULT NOW() |

### proveedores
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| rut | VARCHAR(15) | UNIQUE |
| nombre | VARCHAR(200) | NOT NULL |
| razon_social | VARCHAR(300) | |
| direccion | TEXT | |
| telefono | VARCHAR(20) | |
| correo | VARCHAR(150) | |
| contacto_nombre | VARCHAR(150) | |
| contacto_telefono | VARCHAR(20) | |
| contacto_correo | VARCHAR(150) | |
| condiciones_pago | VARCHAR | (mig 011) |
| condicion_despacho | VARCHAR | (mig 011) |
| plazo_entrega | VARCHAR | (mig 011) |
| moneda | VARCHAR | (mig 011) |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

### alerta_email_config (mig 032)
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| habilitada | BOOLEAN | NOT NULL DEFAULT FALSE |
| umbral_tipo | VARCHAR(10) | NOT NULL DEFAULT 'horas', CHECK ('horas','dias') |
| umbral_valor | INTEGER | NOT NULL DEFAULT 48 |
| recordatorios_habilitados | BOOLEAN | NOT NULL DEFAULT FALSE |
| recordatorios_cantidad | INTEGER | NOT NULL DEFAULT 3 |
| recordatorios_frecuencia_hs | INTEGER | NOT NULL DEFAULT 24 |
| destinatarios_usuario_ids | INTEGER[] | NOT NULL DEFAULT '{}' |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |
| | | Seed inicial: id=1, habilitada=FALSE, umbral_tipo='horas', umbral_valor=48 |

### alerta_email_log (mig 032)
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| solicitud_id | INTEGER | NOT NULL, FK → solicitudes_material(id) ON DELETE CASCADE |
| usuario_destino_id | INTEGER | NOT NULL, FK → usuarios(id) ON DELETE CASCADE |
| tipo_alerta | VARCHAR(20) | NOT NULL ('umbral', 'recordatorio') |
| numero_envio | INTEGER | NOT NULL DEFAULT 1 |
| enviado_at | TIMESTAMP | NOT NULL DEFAULT NOW() |
| | | UNIQUE(solicitud_id, usuario_destino_id, tipo_alerta, numero_envio) |
| | | INDEX idx_alerta_email_log_solicitud(solicitud_id) |
| | | INDEX idx_alerta_email_log_enviado(enviado_at) |

### email_notification_eventos
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| codigo | VARCHAR | UNIQUE NOT NULL |
| nombre | VARCHAR | NOT NULL |
| descripcion | TEXT | |
| habilitado | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |

Eventos registrados: `solicitud.creada`, `cotizacion.creada`, `sc.envio_proveedor`, `oc.envio_proveedor`, `solicitud.cotizando` (mig 031), `alerta.fecha_entrega`.

### email_logs
| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | SERIAL | PK |
| evento_codigo | VARCHAR | NOT NULL |
| destinatario | VARCHAR | NOT NULL |
| asunto | VARCHAR | |
| estado | VARCHAR | ('enviado', 'fallido') |
| error_msg | TEXT | |
| entidad_tipo | VARCHAR | |
| entidad_id | INTEGER | |
| created_at | TIMESTAMP | DEFAULT NOW() |

## Endpoints API

### Auth
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/auth/login | Login (correo + password → JWT) |
| GET | /api/auth/me | Perfil usuario autenticado (authMiddleware) |

### Usuarios
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/users | Listar usuarios (authMiddleware) |
| POST | /api/users | Crear usuario |
| DELETE | /api/users/:id | Eliminar usuario (authMiddleware) |

### Config
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/config/departamentos | Listar departamentos |
| POST | /api/config/departamentos | Crear departamento |
| GET | /api/config/cargos | Listar cargos |
| POST | /api/config/cargos | Crear cargo |
| GET | /api/config/roles | Listar roles |
| GET | /api/config/permisos | Listar permisos (authMiddleware + requirePermission 'config.manage') |
| GET | /api/config/roles/:id/permisos | Ver permisos de rol |
| PUT | /api/config/roles/:id/permisos | Actualizar permisos de rol |

### Proyectos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/proyectos | Listar proyectos (authMiddleware + requirePermission 'proyectos.view') |
| GET | /api/proyectos/:id | Ver proyecto (authMiddleware + requirePermission) |
| GET | /api/proyectos/:id/licitacion-archivo | Descargar archivo de licitación |
| POST | /api/proyectos | Crear proyecto (multipart/form-data, archivo_licitacion opcional) |
| PATCH | /api/proyectos/:id | Actualizar proyecto |
| PATCH | /api/proyectos/:id/active | Activar/Desactivar proyecto |
| POST | /api/proyectos/:id/procesar-materiales | Procesar Excel de materiales y crear solicitud |

### Presupuestos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/presupuestos | Listar presupuestos |
| GET | /api/presupuestos/proyecto/:proyectoId | Ver presupuesto por proyecto |
| POST | /api/presupuestos | Crear presupuesto |
| PATCH | /api/presupuestos/:id | Actualizar presupuesto |
| POST | /api/presupuestos/:id/categorias | Agregar categoría |
| PATCH | /api/presupuestos/categorias/:categoriaId | Actualizar categoría |
| DELETE | /api/presupuestos/categorias/:categoriaId | Eliminar categoría |
| GET | /api/presupuestos/alertas/listado | Listar alertas de presupuesto |
| POST | /api/presupuestos/comprometer | Comprometer presupuesto manual |

### Solicitudes
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/solicitudes | Listar solicitudes |
| GET | /api/solicitudes/:id | Ver solicitud |
| POST | /api/solicitudes | Crear solicitud |
| PATCH | /api/solicitudes/:id/estado | Cambiar estado |
| DELETE | /api/solicitudes/:id | Eliminar solicitud |

### Solicitud de Cotización
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/solicitud-cotizacion | Listar SC |
| GET | /api/solicitud-cotizacion/:id | Ver SC |
| POST | /api/solicitud-cotizacion | Crear SC |
| POST | /api/solicitud-cotizacion/batch | Crear SC en lote |
| PATCH | /api/solicitud-cotizacion/:id/estado | Cambiar estado SC |
| DELETE | /api/solicitud-cotizacion/:id | Eliminar SC |
| GET | /api/solicitud-cotizacion/:id/exportar | Exportar HTML |
| GET | /api/solicitud-cotizacion/:id/descargar | Descargar PDF |
| GET | /api/solicitud-cotizacion/:id/pdf-link | Link de PDF |

### Cotizaciones de Venta — ELIMINADO (mig 021)
Las tablas `cotizaciones` y `cotizacion_items` fueron eliminadas. El flujo de precios se absorbió en `solicitud_cotizacion` y `solicitud_cotizacion_detalle`.
Todos los endpoints `/api/cotizaciones` fueron removidos.

#### Endpoints de importación pendientes (⚠️)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/solicitud-cotizacion/importar | Importar respuesta desde archivo (PENDIENTE de implementar) |
| POST | /api/solicitud-cotizacion/importar/confirmar | Confirmar importación de respuesta (PENDIENTE de implementar) |

### Órdenes de Compra
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/ordenes | Listar órdenes |
| GET | /api/ordenes/:id | Ver orden |
| POST | /api/ordenes | Crear OC desde solicitud de cotización respondida (requirePermission 'ordenes.create') |
| POST | /api/ordenes/manual | Crear OC manual/sin cotización |
| PATCH | /api/ordenes/:id/entrega | Actualizar estado entrega |
| GET | /api/ordenes/:id/exportar | Exportar HTML |
| GET | /api/ordenes/:id/descargar | Descargar PDF |
| GET | /api/ordenes/:id/pdf-link | Link de descarga PDF |

### Materiales
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/materiales/unidades | Listar unidades |
| POST | /api/materiales/unidades | Crear unidad |
| PUT | /api/materiales/unidades/:id | Actualizar unidad |
| DELETE | /api/materiales/unidades/:id | Eliminar unidad |
| GET | /api/materiales/categorias | Listar categorías |
| POST | /api/materiales/categorias | Crear categoría |
| PUT | /api/materiales/categorias/:id | Actualizar categoría |
| DELETE | /api/materiales/categorias/:id | Eliminar categoría |
| GET | /api/materiales/solicitados | Listar materiales solicitados históricamente |
| GET | /api/materiales | Listar materiales |
| GET | /api/materiales/:id | Ver material |
| POST | /api/materiales | Crear material |
| PUT | /api/materiales/:id | Actualizar material |
| DELETE | /api/materiales/:id | Eliminar material |

### Proveedores
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/proveedores | Listar proveedores |
| GET | /api/proveedores/:id | Ver proveedor |
| POST | /api/proveedores | Crear proveedor |
| PUT | /api/proveedores/:id | Actualizar proveedor |
| DELETE | /api/proveedores/:id | Eliminar proveedor |

### Notificaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/notificaciones | Listar notificaciones |
| GET | /api/notificaciones/unread-count | Contar no leídas |
| PATCH | /api/notificaciones/:id/leida | Marcar leída/no leída |
| PATCH | /api/notificaciones/marcar-todas-leidas | Marcar todas leídas |

### Dashboard
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/dashboard/solicitudes-mensual | KPI solicitudes del mes |
| GET | /api/dashboard/gasto-por-proyecto | Gasto por proyecto |
| GET | /api/dashboard/tiempo-conversion | Tiempo conversión promedio |
| GET | /api/dashboard/resumen | Resumen compuesto |
| GET | /api/dashboard/proyectos | Proyectos dashboard |

### Email / Alertas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/config/email/eventos | Listar eventos de notificación email con estado (auth + config.manage) |
| PATCH | /api/config/email/eventos/:codigo | Habilitar/deshabilitar evento |
| GET | /api/config/email/sistema | Obtener configuración SMTP/OAuth2 (tokens enmascarados) |
| PUT | /api/config/email/sistema | Guardar configuración SMTP/OAuth2 |
| POST | /api/config/email/test | Enviar email de prueba |
| GET | /api/config/email/logs | Log de envíos recientes (limit query param, default 50, max 100) |
| GET | /api/config/email/alertas | Obtener configuración de alertas de fecha de entrega |
| PUT | /api/config/email/alertas | Actualizar configuración de alertas |
| GET | /api/config/email/alertas/usuarios | Listar usuarios activos como destinatarios posibles |

### Chat / IA
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /api/chat/complete | Chat con IA completions |

### Health
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | /api/health | Health check |

## Tipos compartidos

### Estados de flujo
- **Solicitud**: `Pendiente` → `Cotizando` → `Aprobado`
- **Solicitud Cotización**: `Borrador` → `Enviada` → `Respondida` | `Anulada`
- **Orden Compra (entrega)**: `Pendiente` → `Recibido parcial` → `Completado`
- **Presupuesto**: `Borrador` → `Vigente` → `Cerrado`

### Permisos base
- `proyectos.view`, `proyectos.manage`
- `presupuestos.view`, `presupuestos.manage`
- `ordenes.create`
- `config.manage`
- `notificaciones.view`

### DTOs comunes
- **LoginRequest**: `{ correo, password }`
- **LoginResponse**: `{ token, usuario }`
- **Usuario**: `{ id, nombre, apellido, correo, rol_id, ... }`
- **SolicitudCreate**: `{ proyecto_id, solicitante, items: [{ material_id?, nombre_material, cantidad_requerida, unidad, codigo? }] }`
- **SolicitudCotizacionResponse (creación con precios)**: `{ solicitud_id, solicitud_cotizacion_id?, proveedor_id?, proveedor?, numero_cov, items: [{ solicitud_item_id, precio_unitario, descuento_porcentaje, codigo_proveedor }] }`
- **OCManualCreate**: `{ proyecto_id, proveedor, items: [{ nombre_material, cantidad, unidad, precio_unitario, codigo? }], ... }`

## Última actualización
2026-05-08 — Módulo de alertas de email por fecha de entrega (tarea: configurar-alertas-email-fecha-entrega). Nuevas tablas: alerta_email_config, alerta_email_log. Nuevos endpoints de email-config (eventos, sistema, test, logs, alertas). Scheduler polling cada 30 min. Migraciones 031 y 032.
