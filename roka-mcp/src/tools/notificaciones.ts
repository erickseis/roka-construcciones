import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerNotificacionesTools(server: McpServer, client: ApiClient) {
  server.tool(
    "listar_notificaciones",
    "Lista las notificaciones del usuario autenticado",
    {
      solo_no_leidas: z.boolean().optional().describe("Mostrar solo notificaciones no leídas"),
      limit: z.number().optional().describe("Cantidad máxima (20 por defecto, máximo 100)"),
      offset: z.number().optional().describe("Offset para paginación"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.solo_no_leidas) params.set("solo_no_leidas", "true");
      if (args.limit) params.set("limit", String(args.limit));
      if (args.offset) params.set("offset", String(args.offset));
      const qs = params.toString();
      const res = await client.get(`notificaciones${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "contar_no_leidas",
    "Cuenta las notificaciones no leídas del usuario autenticado",
    {},
    async () => {
      const res = await client.get("notificaciones/unread-count");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "marcar_notificacion_leida",
    "Marca una notificación como leída o no leída",
    {
      id: z.number().describe("ID de la notificación"),
      leida: z.boolean().optional().describe("true para marcar como leída (por defecto), false para no leída"),
    },
    async ({ id, leida = true }) => {
      const res = await client.patch(`notificaciones/${id}/leida`, { leida });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "marcar_todas_leidas",
    "Marca todas las notificaciones no leídas del usuario como leídas",
    {},
    async () => {
      const res = await client.patch("notificaciones/marcar-todas-leidas");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
