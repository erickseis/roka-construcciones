import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerCotizacionesTools(server: McpServer, client: ApiClient) {
  // ==========================================
  // Solicitudes de Cotización (envío a proveedor, sin precios)
  // ==========================================

  server.tool(
    "listar_solicitudes_cotizacion",
    "Lista las solicitudes de cotización (envío a proveedor, sin precios)",
    {
      solicitud_id: z.number().optional().describe("Filtrar por ID de solicitud de materiales"),
      estado: z.string().optional().describe("Filtrar por estado (Borrador, Enviada, Respondida, Anulada)"),
      proveedor: z.string().optional().describe("Filtrar por nombre de proveedor"),
      proyecto_id: z.number().optional().describe("Filtrar por ID de proyecto"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.solicitud_id) params.set("solicitud_id", String(args.solicitud_id));
      if (args.estado) params.set("estado", args.estado);
      if (args.proveedor) params.set("proveedor", args.proveedor);
      if (args.proyecto_id) params.set("proyecto_id", String(args.proyecto_id));
      const qs = params.toString();
      const res = await client.get(`solicitud-cotizacion${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_solicitud_cotizacion",
    "Obtiene el detalle de una solicitud de cotización con sus ítems (sin precios)",
    {
      id: z.number().describe("ID de la solicitud de cotización"),
    },
    async ({ id }) => {
      const res = await client.get(`solicitud-cotizacion/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_solicitud_cotizacion",
    "Crea una solicitud de cotización para un proveedor específico (sin precios). Asigna qué ítems de la solicitud de materiales se le piden.",
    {
      solicitud_id: z.number().describe("ID de la solicitud de materiales"),
      proveedor_id: z.number().optional().describe("ID del proveedor del catálogo (opcional)"),
      proveedor: z.string().optional().describe("Nombre del proveedor (si no usa ID del catálogo)"),
      solicitud_item_ids: z.array(z.number()).describe("IDs de los ítems de la solicitud a cotizar"),
      observaciones: z.string().optional().describe("Observaciones para el proveedor"),
    },
    async (args) => {
      const res = await client.post("solicitud-cotizacion", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_solicitudes_cotizacion_batch",
    "Crea múltiples solicitudes de cotización desde una solicitud de materiales, asignando diferentes ítems a diferentes proveedores",
    {
      solicitud_id: z.number().describe("ID de la solicitud de materiales"),
      asignaciones: z.array(z.object({
        proveedor_id: z.number().optional().describe("ID del proveedor del catálogo"),
        proveedor: z.string().describe("Nombre del proveedor"),
        solicitud_item_ids: z.array(z.number()).describe("IDs de los ítems a asignar a este proveedor"),
      })).describe("Lista de asignaciones por proveedor"),
      observaciones: z.string().optional(),
    },
    async (args) => {
      const res = await client.post("solicitud-cotizacion/batch", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "cambiar_estado_solicitud_cotizacion",
    "Cambia el estado de una solicitud de cotización: Borrador, Enviada, Respondida, Anulada",
    {
      id: z.number().describe("ID de la solicitud de cotización"),
      estado: z.enum(["Borrador", "Enviada", "Respondida", "Anulada"]).describe("Nuevo estado"),
    },
    async ({ id, estado }) => {
      const res = await client.patch(`solicitud-cotizacion/${id}/estado`, { estado });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  // ==========================================
  // Importación de Respuestas de Cotización desde Archivos
  // ==========================================

  server.tool(
    "importar_respuesta_cotizacion_desde_archivo",
    "Importa una respuesta de cotización desde un archivo PDF, Excel o imagen del proveedor. Parsea el archivo con IA, extrae ítems y precios, y los valida contra la solicitud de cotización enviada al proveedor. Retorna una vista previa con matching de ítems para confirmación.",
    {
      archivo_path: z.string().describe("Ruta del archivo en el servidor (PDF, Excel o imagen)"),
      solicitud_cotizacion_id: z.number().describe("ID de la solicitud de cotización a la cual vincular la respuesta"),
    },
    async ({ archivo_path, solicitud_cotizacion_id }) => {
      const res = await client.post("solicitud-cotizacion/importar", {
        archivo_path,
        solicitud_cotizacion_id,
      });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "confirmar_importacion_respuesta_cotizacion",
    "Confirma la importación de una respuesta de cotización previamente validada. Crea la cotización con los datos del archivo importado, vincula los ítems a la solicitud de cotización, y marca la SC como Respondida.",
    {
      solicitud_id: z.number().describe("ID de la solicitud de materiales"),
      solicitud_cotizacion_id: z.number().describe("ID de la solicitud de cotización"),
      archivo_path: z.string().describe("Ruta del archivo importado"),
      archivo_nombre: z.string().describe("Nombre del archivo importado"),
      proveedor_id: z.number().optional().describe("ID del proveedor del catálogo (si se encontró match)"),
      proveedor_nombre: z.string().describe("Nombre del proveedor"),
      numero_cov: z.string().describe("Número de cotización de venta del proveedor"),
      metodo_importacion: z.enum(["pdf", "excel", "imagen"]).describe("Método de importación"),
      items: z.array(z.object({
        solicitud_item_id: z.number().optional().nullable().describe("ID del ítem de la solicitud (null para ítems extra)"),
        precio_unitario: z.number().describe("Precio unitario cotizado"),
        descuento_porcentaje: z.number().optional().describe("Porcentaje de descuento"),
        codigo_proveedor: z.string().optional().describe("Código del proveedor"),
        nombre_extraido: z.string().optional().describe("Nombre extraído del material (para ítems manuales/extra)"),
        cantidad_extraida: z.number().optional().describe("Cantidad extraída (para ítems manuales/extra)"),
        unidad_extraida: z.string().optional().describe("Unidad extraída (para ítems manuales/extra)"),
      })).describe("Lista de ítems confirmados"),
      datos_importados: z.record(z.any()).optional().describe("Datos adicionales importados del archivo"),
    },
    async (args) => {
      const res = await client.post("solicitud-cotizacion/importar/confirmar", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}