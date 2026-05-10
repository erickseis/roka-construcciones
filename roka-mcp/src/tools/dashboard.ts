import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerDashboardTools(server: McpServer, client: ApiClient) {
  server.tool(
    "resumen_dashboard",
    "Obtiene un resumen completo del dashboard: solicitudes del mes, gasto por proyecto y tiempo de conversión",
    {},
    async () => {
      const res = await client.get("dashboard/resumen");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "solicitudes_mensuales",
    "KPI de solicitudes del mes actual: pendientes vs atendidas",
    {},
    async () => {
      const res = await client.get("dashboard/solicitudes-mensual");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "gasto_por_proyecto",
    "Gasto total aprobado en órdenes de compra por proyecto",
    {},
    async () => {
      const res = await client.get("dashboard/gasto-por-proyecto");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "tiempo_conversion",
    "Tiempo promedio de conversión de solicitud a orden de compra en días",
    {},
    async () => {
      const res = await client.get("dashboard/tiempo-conversion");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "solicitudes_urgentes",
    "Lista solicitudes de materiales ordenadas por fecha de entrega más próxima a vencer. Muestra solicitudes Pendiente/Cotizando con fecha_requerida, indicando días restantes y urgencia.",
    {},
    async () => {
      const res = await client.get("dashboard/solicitudes-urgentes");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
