# Guía de Conexión — ROKA MCP Server

Esta guía explica cómo conectar un cliente MCP (Claude Desktop, Cursor, etc.) al servidor MCP de ROKA para interactuar con la plataforma mediante un agente de IA.

---

## Índice

1. [¿Qué es ROKA MCP?](#1-qué-es-roka-mcp)
2. [Requisitos previos](#2-requisitos-previos)
3. [Instalación del MCP Server](#3-instalación-del-mcp-server)
4. [Conexión con Claude Desktop](#4-conexión-con-claude-desktop)
5. [Conexión con otros clientes MCP](#5-conexión-con-otros-clientes-mcp)
6. [Verificar que funciona](#6-verificar-que-funciona)
7. [Tabla completa de herramientas](#7-tabla-completa-de-herramientas)
8. [Flujos de ejemplo](#8-flujos-de-ejemplo)
9. [Solución de problemas](#9-solución-de-problemas)
10. [Seguridad](#10-seguridad)

---

## 1. ¿Qué es ROKA MCP?

ROKA MCP es un servidor que implementa el **Model Context Protocol (MCP)** para exponer todas las operaciones de la plataforma ROKA como herramientas que un agente de IA puede invocar.

| Sin MCP | Con MCP |
|---------|---------|
| El agente solo puede leer código y archivos | El agente puede consultar proyectos, crear solicitudes, aprobar cotizaciones, generar OCs... |
| Interacción limitada al sistema de archivos | Acceso completo a los datos de negocio de ROKA |
| Sin contexto del estado real del sistema | Ve presupuestos, alertas, notificaciones, KPIs en tiempo real |

### Arquitectura

```
Claude Desktop ── stdio (JSON-RPC) ──► roka-mcp ── HTTP + JWT ──► roka-backend ──► PostgreSQL
```

El MCP server es un **cliente HTTP** del backend. No modifica ni accede directamente a la base de datos. Toda validación de negocio sigue residiendo en el backend.

---

## 2. Requisitos previos

- **Node.js >= 22** instalado
- **Backend ROKA corriendo** (por defecto `http://localhost:3001`)
- **Credenciales válidas** de un usuario con permisos en la plataforma
- **Claude Desktop** instalado (u otro cliente MCP compatible)

### Verificar que el backend responde

```bash
curl http://localhost:3001/api/health
# Debe devolver: {"status":"ok","timestamp":"..."}
```

### Verificar credenciales

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"correo":"admin@roka.com","password":"tu_password"}'
# Debe devolver: {"message":"Login exitoso","token":"...","user":{...}}
```

---

## 3. Instalación del MCP Server

```bash
cd roka-mcp
npm install
npm run build
```

Esto genera `dist/index.js` (bundle compilado con esbuild, ~757 KB).

### Variables de entorno

Copia el ejemplo y configura tus credenciales:

```bash
cp .env.example .env
```

Edita `.env`:

```env
ROKA_BACKEND_URL=http://localhost:3001
ROKA_EMAIL=admin@roka.com
ROKA_PASSWORD=tu_contraseña
```

---

## 4. Conexión con Claude Desktop

### 4.1 Encontrar el archivo de configuración

| Sistema operativo | Ruta |
|-------------------|------|
| **macOS** | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Windows** | `%APPDATA%\Claude\claude_desktop_config.json` |
| **Linux** | `~/.config/Claude/claude_desktop_config.json` |

Si no existe, créalo.

### 4.2 Agregar el servidor ROKA

Agrega el bloque `roka` dentro de `mcpServers`:

#### Opción A: Con tsx (desarrollo, recomendado)

```json
{
  "mcpServers": {
    "roka": {
      "command": "npx",
      "args": [
        "tsx",
        "/home/tu_usuario/Documentos/MIRAMAR/roka sistema finanzas/roka-mcp/src/index.ts"
      ],
      "env": {
        "ROKA_BACKEND_URL": "http://localhost:3001",
        "ROKA_EMAIL": "admin@roka.com",
        "ROKA_PASSWORD": "tu_contraseña"
      }
    }
  }
}
```

#### Opción B: Con el build compilado (producción)

```json
{
  "mcpServers": {
     "roka": {
      "command": "npx",
      "args": [
        "tsx",
        "/home/ericks/Documentos/MIRAMAR/roka sistema finanzas/roka-mcp/src/index.ts"
      ],
      "env": {
        "ROKA_BACKEND_URL": "http://localhost:3001",
        "ROKA_API_PREFIX": "/api/roka/api/",
        "ROKA_EMAIL": "admin@roka.com",
        "ROKA_PASSWORD": "admin123"
      }
    }
  }
}
```

> **Importante**: La ruta en `args` debe ser **absoluta**. No uses `~`, usa la ruta completa.

### 4.3 Reiniciar Claude Desktop

Cierra completamente Claude Desktop y vuelve a abrirlo.

Para verificar que el servidor se conectó, busca el ícono de herramientas (🔌 o martillo) en la interfaz. Al hacer clic deberías ver las ~45 herramientas de ROKA disponibles.

---

## 5. Conexión con otros clientes MCP

### 5.1 Cursor

En Cursor, la configuración MCP está en:
- `Settings → Features → MCP → Add new MCP server`

Usa la misma configuración JSON que para Claude Desktop.

### 5.2 Otros clientes (VS Code + Continue, Zed, etc.)

Cualquier cliente que soporte MCP con transporte `stdio` funciona con la misma configuración. El comando es:

```bash
npx tsx ruta/absoluta/a/roka-mcp/src/index.ts
```

Con variables de entorno:

```bash
ROKA_BACKEND_URL=http://localhost:3001 \
ROKA_EMAIL=admin@roka.com \
ROKA_PASSWORD=... \
npx tsx ruta/absoluta/a/roka-mcp/src/index.ts
```

---

## 6. Verificar que funciona

Una vez conectado, puedes pedirle al agente:

> "Muéstrame el resumen del dashboard de ROKA"

El agente debería invocar la herramienta `resumen_dashboard` y mostrarte los KPIs.

Otras pruebas rápidas:

| Prompt de prueba | Herramienta que invoca |
|------------------|----------------------|
| "¿Cuántos proyectos hay en ROKA?" | `listar_proyectos` |
| "¿Hay alertas de presupuesto?" | `ver_alertas_presupuesto` |
| "¿Qué materiales tengo en el catálogo?" | `listar_materiales` |
| "¿Tengo notificaciones pendientes?" | `contar_no_leidas` |

---

## 7. Tabla completa de herramientas

### Auth
| Herramienta | Descripción | Parámetros |
|-------------|-------------|------------|
| `login` | Iniciar sesión manualmente | `correo`, `password` |
| `quien_soy` | Perfil del usuario autenticado | — |

### Proyectos
| Herramienta | Parámetros |
|-------------|------------|
| `listar_proyectos` | `estado?`, `is_active?` |
| `ver_proyecto` | `id` |
| `crear_proyecto` | `nombre`, `ubicacion?`, `estado?`, `fecha_inicio?`, `fecha_fin?`, `responsable_usuario_id?`, `numero_licitacion?`, `descripcion_licitacion?`, `fecha_apertura_licitacion?`, `monto_referencial_licitacion?` |
| `actualizar_proyecto` | `id` + campos opcionales |
| `activar_desactivar_proyecto` | `id`, `is_active` |

### Presupuestos
| Herramienta | Parámetros |
|-------------|------------|
| `listar_presupuestos` | — |
| `ver_presupuesto_proyecto` | `proyecto_id` |
| `crear_presupuesto` | `proyecto_id`, `monto_total`, `umbral_alerta?`, `estado?`, `categorias?` |
| `actualizar_presupuesto` | `id`, `monto_total?`, `umbral_alerta?`, `estado?` |
| `crear_categoria_presupuesto` | `presupuesto_id`, `nombre`, `monto_asignado` |
| `actualizar_categoria_presupuesto` | `categoria_id`, `nombre?`, `monto_asignado?` |
| `eliminar_categoria_presupuesto` | `categoria_id` |
| `ver_alertas_presupuesto` | — |
| `comprometer_presupuesto` | `presupuesto_id`, `monto`, `categoria_id?`, `descripcion?` |

### Solicitudes
| Herramienta | Parámetros |
|-------------|------------|
| `listar_solicitudes` | `proyecto_id?`, `estado?` |
| `ver_solicitud` | `id` |
| `crear_solicitud` | `proyecto_id`, `solicitante`, `fecha?`, `items[]` |
| `cambiar_estado_solicitud` | `id`, `estado` |
| `eliminar_solicitud` | `id` |

### Cotizaciones
| Herramienta | Parámetros |
|-------------|------------|
| `listar_cotizaciones` | `solicitud_id?`, `estado?` |
| `ver_cotizacion` | `id` |
| `crear_cotizacion` | `solicitud_id`, `proveedor_id?`, `proveedor?`, `items[]` |
| `aprobar_cotizacion` | `id` |
| `rechazar_cotizacion` | `id` |

### Órdenes de Compra
| Herramienta | Parámetros |
|-------------|------------|
| `listar_ordenes` | `estado_entrega?`, `proyecto_id?` |
| `ver_orden` | `id` |
| `crear_orden_compra` | `cotizacion_id`, `condiciones_pago?`, `folio?`, `descuento_tipo?`, `descuento_valor?`, `plazo_entrega?`, `condiciones_entrega?`, `atencion_a?`, `observaciones?` |
| `actualizar_entrega_orden` | `id`, `estado_entrega` |

### Materiales
| Herramienta | Parámetros |
|-------------|------------|
| `listar_materiales` | `categoria_id?`, `q?` |
| `ver_material` | `id` |
| `crear_material` | `nombre`, `unidad_medida_id`, `sku?`, `descripcion?`, `categoria_id?`, `precio_referencial?` |
| `actualizar_material` | `id` + campos opcionales |
| `eliminar_material` | `id` |
| `listar_unidades_medida` | — |
| `crear_unidad_medida` | `nombre`, `abreviatura` |
| `actualizar_unidad_medida` | `id`, `nombre`, `abreviatura` |
| `eliminar_unidad_medida` | `id` |
| `listar_categorias_material` | — |
| `crear_categoria_material` | `nombre`, `descripcion?` |
| `actualizar_categoria_material` | `id`, `nombre`, `descripcion?` |
| `eliminar_categoria_material` | `id` |
| `listar_materiales_solicitados` | `proyecto_id?`, `q?` |

### Proveedores
| Herramienta | Parámetros |
|-------------|------------|
| `listar_proveedores` | — |
| `ver_proveedor` | `id` |
| `crear_proveedor` | `nombre`, `rut?`, `razon_social?`, `direccion?`, `telefono?`, `correo?`, `contacto_nombre?`, `contacto_telefono?`, `contacto_correo?` |
| `actualizar_proveedor` | `id` + campos opcionales |
| `desactivar_proveedor` | `id` |

### Notificaciones
| Herramienta | Parámetros |
|-------------|------------|
| `listar_notificaciones` | `solo_no_leidas?`, `limit?`, `offset?` |
| `contar_no_leidas` | — |
| `marcar_notificacion_leida` | `id`, `leida?` |
| `marcar_todas_leidas` | — |

### Dashboard
| Herramienta | Parámetros |
|-------------|------------|
| `resumen_dashboard` | — |
| `solicitudes_mensuales` | — |
| `gasto_por_proyecto` | — |
| `tiempo_conversion` | — |

---

## 8. Flujos de ejemplo

### 8.1 Crear una solicitud de materiales

```
Usuario: "Necesito crear una solicitud de materiales para el proyecto 'Edificio Norte'.
          Los items son: 100 bolsas de cemento, 50 varillas de fierro de 12mm."

Agente:
  1. listar_proyectos(q="Edificio Norte")     → obtiene proyecto_id = 3
  2. listar_materiales(q="cemento")            → obtiene material_id = 5, unidad = "bolsa"
  3. listar_materiales(q="fierro")             → obtiene material_id = 8, unidad = "varilla"
  4. crear_solicitud({
       proyecto_id: 3,
       solicitante: "Agente IA",
       items: [
         { material_id: 5, nombre_material: "Cemento", cantidad_requerida: 100, unidad: "bolsa" },
         { material_id: 8, nombre_material: "Fierro 12mm", cantidad_requerida: 50, unidad: "varilla" }
       ]
     })
```

### 8.2 Generar una orden de compra

```
Usuario: "Aprueba la cotización #5 y genera la orden de compra."

Agente:
  1. aprobar_cotizacion(id=5)
  2. crear_orden_compra({
       cotizacion_id: 5,
       condiciones_pago: "Neto 30 días",
       plazo_entrega: "2 semanas"
     })
  3. ver_orden(id=...) → confirma que se creó
```

### 8.3 Monitorear presupuesto

```
Usuario: "¿Cómo va el presupuesto del proyecto 'Obra Sur'?"

Agente:
  1. ver_presupuesto_proyecto(proyecto_id=2)
     → monto_total: 50,000,000
     → monto_comprometido: 32,500,000
     → porcentaje_uso: 65%
     → categorias: [...]
  2. ver_alertas_presupuesto()
     → Ningún proyecto en alerta roja
```

---

## 9. Solución de problemas

### El servidor no aparece en Claude Desktop

1. Verifica que la ruta en `args` es **absoluta** y correcta
2. Revisa que `npx` y `node` están en tu PATH
3. Cierra **completamente** Claude Desktop (no solo la ventana) y reábrelo
4. Revisa los logs de MCP:
   - macOS: `~/Library/Logs/Claude/`
   - El archivo `mcp-server-roka.log` contiene los errores

### Error "No se pudo autenticar automáticamente"

El MCP server muestra este mensaje si:
- Las variables de entorno `ROKA_EMAIL` / `ROKA_PASSWORD` no están configuradas
- Las credenciales son incorrectas
- El backend no está corriendo

**Solución**: Usa la herramienta `login` manualmente después de conectarte:
```
Usuario: "Inicia sesión en ROKA con admin@roka.com y contraseña XXXX"
```

### Error 401 en las herramientas

El token JWT expiró (8 horas de vida). El MCP server intenta re-autenticar automáticamente. Si falla, usa la herramienta `login` de nuevo.

### Error de permisos (403)

El usuario configurado en `ROKA_EMAIL` no tiene los permisos necesarios para ciertas operaciones. Revisa los permisos del rol asignado en la plataforma.

### El backend cambió y las herramientas fallan

Si se agregaron/quitaron/renombraron endpoints en el backend, las herramientas MCP deben actualizarse. Ver [CLAUDE.md](../CLAUDE.md) sección MCP para instrucciones.

---

## 10. Seguridad

- **Las credenciales viajan en variables de entorno**, no en el código fuente
- El MCP server **nunca expone el token JWT** a través de las herramientas
- El archivo `.env` está en `.gitignore` para no commitear credenciales
- Usa un usuario con los **permisos mínimos necesarios** para las operaciones que delegarás al agente
- Considera crear un **usuario dedicado** para el agente MCP (ej: `agente-mcp@roka.com`) con rol y permisos acotados
