import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerCotizacionesTools(server: McpServer, client: ApiClient) {
  server.tool(
    "listar_cotizaciones",
    "Lista todas las cotizaciones con filtros opcionales",
    {
      solicitud_id: z.number().optional().describe("Filtrar por ID de solicitud"),
      estado: z.string().optional().describe("Filtrar por estado (Pendiente, Aprobada, Rechazada)"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.solicitud_id) params.set("solicitud_id", String(args.solicitud_id));
      if (args.estado) params.set("estado", args.estado);
      const qs = params.toString();
      const res = await client.get(`cotizaciones${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_cotizacion",
    "Obtiene el detalle de una cotización con sus ítems cotizados y precios",
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
    "Crea una nueva cotización para una solicitud, con precios por ítem",
    {
      solicitud_id: z.number().describe("ID de la solicitud de material"),
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
    "Aprueba una cotización pendiente. Dispara notificaciones a roles operativos.",
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
    "Rechaza una cotización pendiente. Dispara notificaciones a roles operativos.",
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
