import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";
import type { AuthManager } from "../auth.js";

export function registerOrdenesTools(server: McpServer, auth: AuthManager, client: ApiClient) {
  server.tool(
    "listar_ordenes",
    "Lista todas las órdenes de compra con filtros opcionales",
    {
      estado_entrega: z.string().optional().describe("Filtrar por estado de entrega (Pendiente, Recibido parcial, Completado)"),
      proyecto_id: z.number().optional().describe("Filtrar por ID de proyecto"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.estado_entrega) params.set("estado_entrega", args.estado_entrega);
      if (args.proyecto_id) params.set("proyecto_id", String(args.proyecto_id));
      const qs = params.toString();
      const res = await client.get(`ordenes${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_orden",
    "Obtiene el detalle de una orden de compra con items, proveedor y proyecto",
    {
      id: z.number().describe("ID de la orden de compra"),
    },
    async ({ id }) => {
      const res = await client.get(`ordenes/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_orden_compra",
    "Genera una orden de compra a partir de una cotización aprobada. Compromete presupuesto automáticamente.",
    {
      cotizacion_id: z.number().describe("ID de la cotización aprobada"),
      condiciones_pago: z.string().optional().describe("Condiciones de pago (Neto 30 días por defecto)"),
      folio: z.string().optional().describe("Folio personalizado (se genera automáticamente si no se especifica)"),
      descuento_tipo: z.enum(["none", "porcentaje", "monto"]).optional().describe("Tipo de descuento"),
      descuento_valor: z.number().optional().describe("Valor del descuento"),
      plazo_entrega: z.string().optional().describe("Plazo de entrega"),
      condiciones_entrega: z.string().optional().describe("Condiciones de entrega"),
      atencion_a: z.string().optional().describe("Atención a (persona de contacto)"),
      observaciones: z.string().optional().describe("Observaciones adicionales"),
    },
    async (args) => {
      const res = await client.post("ordenes", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_entrega_orden",
    "Actualiza el estado de entrega de una orden de compra",
    {
      id: z.number().describe("ID de la orden de compra"),
      estado_entrega: z.enum(["Pendiente", "Recibido parcial", "Completado"]).describe("Nuevo estado de entrega"),
    },
    async ({ id, estado_entrega }) => {
      const res = await client.patch(`ordenes/${id}/entrega`, { estado_entrega });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "descargar_orden_compra",
    "Genera link de descarga de Orden de Compra como PDF con logo, items y firmas. El usuario hace click en el link para descargar el PDF.",
    {
      id: z.number().describe("ID de la orden de compra a descargar"),
    },
    async ({ id }) => {
      // ROKA_PUBLIC_URL: URL que el browser del usuario puede acceder (producción)
      // Si no está configurada, usa ROKA_BACKEND_URL (funciona para localhost)
      const publicBase = (
        process.env.ROKA_PUBLIC_URL ||
        process.env.ROKA_BACKEND_URL ||
        "http://localhost:3001"
      ).replace(/\/+$/, "");
      const apiPrefix = (process.env.ROKA_API_PREFIX || "/api/roka/api/").replace(/\/+$/, "");

      const pdfUrl = `${publicBase}${apiPrefix}/ordenes/${id}/descargar`;
      const htmlRes = await client.get<string>(`ordenes/${id}/exportar?pdfUrl=${encodeURIComponent(pdfUrl)}`);
      const html = typeof htmlRes.data === "string" ? htmlRes.data : JSON.stringify(htmlRes.data);

      return {
        content: [{ type: "text", text: html }],
      };
    }
  );
}
