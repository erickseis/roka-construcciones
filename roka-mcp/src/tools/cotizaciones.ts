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
  // Cotizaciones de Venta (respuesta del proveedor con precios)
  // ==========================================

  server.tool(
    "listar_cotizaciones",
    "Lista todas las cotizaciones de venta (respuesta del proveedor con precios). Filtros opcionales.",
    {
      solicitud_id: z.number().optional().describe("Filtrar por ID de solicitud"),
      estado: z.string().optional().describe("Filtrar por estado (Pendiente, Aprobada, Rechazada)"),
      solicitud_cotizacion_id: z.number().optional().describe("Filtrar por ID de solicitud de cotización"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.solicitud_id) params.set("solicitud_id", String(args.solicitud_id));
      if (args.estado) params.set("estado", args.estado);
      if (args.solicitud_cotizacion_id) params.set("solicitud_cotizacion_id", String(args.solicitud_cotizacion_id));
      const qs = params.toString();
      const res = await client.get(`cotizaciones${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_cotizacion",
    "Obtiene el detalle de una cotización de venta con sus ítems cotizados y precios",
    {
      id: z.number().describe("ID de la cotización"),
    },
    async ({ id }) => {
      const res = await client.get(`cotizaciones/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_cotizacion",
    "Crea una cotización de venta (respuesta del proveedor con precios). Opcionalmente puede vincularse a una solicitud de cotización.",
    {
      solicitud_id: z.number().describe("ID de la solicitud de material"),
      solicitud_cotizacion_id: z.number().optional().describe("ID de la solicitud de cotización (opcional, para vincular respuesta)"),
      proveedor_id: z.number().optional().describe("ID del proveedor del catálogo (opcional)"),
      proveedor: z.string().optional().describe("Nombre del proveedor (si no usa ID del catálogo)"),
      items: z
        .array(
          z.object({
            solicitud_item_id: z.number().describe("ID del ítem de la solicitud"),
            precio_unitario: z.number().describe("Precio unitario cotizado"),
          })
        )
        .describe("Lista de ítems con su precio unitario cotizado"),
    },
    async (args) => {
      const res = await client.post("cotizaciones", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "aprobar_cotizacion",
    "Aprueba una cotización de venta pendiente. Dispara notificaciones a roles operativos.",
    {
      id: z.number().describe("ID de la cotización a aprobar"),
    },
    async ({ id }) => {
      const res = await client.patch(`cotizaciones/${id}/aprobar`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "rechazar_cotizacion",
    "Rechaza una cotización de venta pendiente. Dispara notificaciones a roles operativos.",
    {
      id: z.number().describe("ID de la cotización a rechazar"),
    },
    async ({ id }) => {
      const res = await client.patch(`cotizaciones/${id}/rechazar`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
