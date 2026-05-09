import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ResilientClient } from "../index.js";

export function registerEmailConfigTools(server: McpServer, client: ResilientClient) {
  server.tool(
    "listar_eventos_email",
    "Lista los eventos de notificación por email y su estado habilitado/deshabilitado",
    {},
    async () => {
      const res = await client.get("config/email/eventos");
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_evento_email",
    "Habilita o deshabilita un evento de notificación por email",
    {
      codigo: z.string().describe("Código del evento (ej: solicitud.creada, cotizacion.creada, sc.envio_proveedor, oc.envio_proveedor)"),
      habilitado: z.boolean().describe("true para habilitar, false para deshabilitar"),
    },
    async ({ codigo, habilitado }) => {
      const res = await client.patch(`config/email/eventos/${codigo}`, { habilitado });
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "obtener_config_email_sistema",
    "Obtiene la configuración de email del sistema (Gmail OAuth2). Los campos sensibles aparecen enmascarados.",
    {},
    async () => {
      const res = await client.get("config/email/sistema");
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "obtener_logs_email",
    "Lista los últimos emails enviados por el sistema",
    {
      limit: z.number().optional().describe("Cantidad máxima de registros (por defecto 50, máximo 100)"),
    },
    async ({ limit }) => {
      const qs = limit ? `?limit=${limit}` : "";
      const res = await client.get(`config/email/logs${qs}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "enviar_sc_proveedor",
    "Envía una Solicitud de Cotización al proveedor por correo electrónico. Requiere que el evento sc.envio_proveedor esté habilitado.",
    {
      id: z.number().describe("ID de la solicitud de cotización"),
    },
    async ({ id }) => {
      const res = await client.post(`solicitud-cotizacion/${id}/enviar-proveedor`);
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );

  server.tool(
    "enviar_oc_proveedor",
    "Envía una Orden de Compra al proveedor por correo electrónico. Requiere que el evento oc.envio_proveedor esté habilitado.",
    {
      id: z.number().describe("ID de la orden de compra"),
    },
    async ({ id }) => {
      const res = await client.post(`ordenes/${id}/enviar-proveedor`);
      return {
        content: [{ type: "text", text: JSON.stringify(res, null, 2) }],
      };
    }
  );
}
