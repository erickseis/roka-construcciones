# ROKA MCP Server

Servidor MCP (Model Context Protocol) para la plataforma ROKA. Permite a agentes de IA (Claude Desktop, Cursor, etc.) interactuar con el backend de compras y presupuestos mediante herramientas tipadas.

## Requisitos

- Node.js >= 22
- Backend ROKA corriendo (por defecto en `http://localhost:3001`)
- Credenciales de un usuario con permisos en la plataforma

## Instalación

```bash
cd roka-mcp
npm install
npm run build
```

## Configuración

Copia el archivo de variables de entorno y edita las credenciales:

```bash
cp .env.example .env
```

Edita `.env`:

```env
ROKA_BACKEND_URL=http://localhost:3001
ROKA_EMAIL=admin@roka.com
ROKA_PASSWORD=tu_contraseña
```

## Uso con Claude Desktop

Agrega lo siguiente a tu archivo `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "roka": {
      "command": "npx",
      "args": ["tsx", "ruta/absoluta/a/roka-mcp/src/index.ts"],
      "env": {
        "ROKA_BACKEND_URL": "http://localhost:3001",
        "ROKA_EMAIL": "admin@roka.com",
        "ROKA_PASSWORD": "tu_contraseña"
      }
    }
  }
}
```

### Alternativa con el build compilado

```json
{
  "mcpServers": {
    "roka": {
      "command": "node",
      "args": ["ruta/absoluta/a/roka-mcp/dist/index.js"],
      "env": {
        "ROKA_BACKEND_URL": "http://localhost:3001",
        "ROKA_EMAIL": "admin@roka.com",
        "ROKA_PASSWORD": "tu_contraseña"
      }
    }
  }
}
```

## Herramientas disponibles

El servidor expone ~45 herramientas organizadas por módulo:

### Auth
| Tool | Descripción |
|------|-------------|
| `login` | Iniciar sesión con correo y contraseña |
| `quien_soy` | Perfil del usuario autenticado |

### Proyectos
| Tool | Descripción |
|------|-------------|
| `listar_proyectos` | Listar proyectos con filtros |
| `ver_proyecto` | Detalle con presupuesto y métricas |
| `crear_proyecto` | Crear proyecto (con datos de licitación) |
| `actualizar_proyecto` | Actualizar datos de proyecto |
| `activar_desactivar_proyecto` | Activar/desactivar proyecto |

### Presupuestos
| Tool | Descripción |
|------|-------------|
| `listar_presupuestos` | Listar todos los presupuestos |
| `ver_presupuesto_proyecto` | Detalle con categorías |
| `crear_presupuesto` | Crear presupuesto |
| `actualizar_presupuesto` | Modificar presupuesto |
| `crear_categoria_presupuesto` | Agregar categoría |
| `actualizar_categoria_presupuesto` | Modificar categoría |
| `eliminar_categoria_presupuesto` | Eliminar categoría |
| `ver_alertas_presupuesto` | Alertas de umbral/sobreconsumo |
| `comprometer_presupuesto` | Comprometer monto manualmente |

### Solicitudes
| Tool | Descripción |
|------|-------------|
| `listar_solicitudes` | Listar solicitudes con filtros |
| `ver_solicitud` | Detalle con ítems y precios |
| `crear_solicitud` | Crear solicitud con ítems |
| `cambiar_estado_solicitud` | Cambiar estado |
| `eliminar_solicitud` | Eliminar solicitud |

### Cotizaciones
| Tool | Descripción |
|------|-------------|
| `listar_cotizaciones` | Listar cotizaciones |
| `ver_cotizacion` | Detalle con ítems cotizados |
| `crear_cotizacion` | Crear cotización |
| `aprobar_cotizacion` | Aprobar cotización pendiente |
| `rechazar_cotizacion` | Rechazar cotización pendiente |

### Órdenes de Compra
| Tool | Descripción |
|------|-------------|
| `listar_ordenes` | Listar órdenes de compra |
| `ver_orden` | Detalle completo |
| `crear_orden_compra` | Generar OC desde cotización aprobada |
| `actualizar_entrega_orden` | Actualizar estado de entrega |

### Materiales
| Tool | Descripción |
|------|-------------|
| `listar_materiales` | Catálogo de materiales |
| `ver_material` | Detalle de material |
| `crear_material` | Crear material |
| `actualizar_material` | Actualizar material |
| `eliminar_material` | Eliminar material |
| `listar_unidades_medida` | Listar unidades |
| `crear_unidad_medida` | Crear unidad |
| `listar_categorias_material` | Listar categorías |
| `listar_materiales_solicitados` | Historial de ítems solicitados |

### Proveedores
| Tool | Descripción |
|------|-------------|
| `listar_proveedores` | Listar proveedores activos |
| `ver_proveedor` | Detalle de proveedor |
| `crear_proveedor` | Crear proveedor |
| `actualizar_proveedor` | Actualizar proveedor |
| `desactivar_proveedor` | Desactivar proveedor |

### Notificaciones
| Tool | Descripción |
|------|-------------|
| `listar_notificaciones` | Listar notificaciones |
| `contar_no_leidas` | Contar no leídas |
| `marcar_notificacion_leida` | Marcar como leída |
| `marcar_todas_leidas` | Marcar todas como leídas |

### Dashboard
| Tool | Descripción |
|------|-------------|
| `resumen_dashboard` | KPIs completos (solicitudes, gasto, conversión) |
| `solicitudes_mensuales` | Solicitudes pendientes vs atendidas |
| `gasto_por_proyecto` | Gasto por proyecto |
| `tiempo_conversion` | Tiempo promedio solicitud → OC |

## Scripts

```bash
npm run dev       # Ejecutar en modo desarrollo (tsx con hot reload)
npm run build     # Compilar con esbuild → dist/index.js
npm start         # Ejecutar build compilado
```

## Arquitectura

```
roka-mcp/                    (cliente MCP)
    │  stdio (JSON-RPC)
    │  tools → llamadas HTTP
    ▼
roka-backend/                (REST API existente)
    │  PostgreSQL
    ▼
roka_construcciones DB
```

El MCP server no modifica el backend. Es un cliente HTTP que autentica con JWT y expone todas las operaciones como herramientas MCP tipadas con Zod.
