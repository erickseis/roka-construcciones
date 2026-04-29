import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerPresupuestosTools(server: McpServer, client: ApiClient) {
  server.tool(
    "listar_presupuestos",
    "Lista todos los presupuestos por proyecto con porcentaje de uso y disponible",
    {},
    async () => {
      const res = await client.get("presupuestos");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_presupuesto_proyecto",
    "Obtiene el detalle del presupuesto de un proyecto con sus categorías",
    {
      proyecto_id: z.number().describe("ID del proyecto"),
    },
    async ({ proyecto_id }) => {
      const res = await client.get(`presupuestos/proyecto/${proyecto_id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_presupuesto",
    "Crea un presupuesto para un proyecto con sus categorías opcionales",
    {
      proyecto_id: z.number().describe("ID del proyecto"),
      monto_total: z.number().describe("Monto total del presupuesto"),
      umbral_alerta: z.number().optional().describe("Porcentaje de umbral para alertas (80 por defecto)"),
      estado: z.string().optional().describe("Estado del presupuesto (Vigente por defecto)"),
      categorias: z
        .array(z.object({ nombre: z.string(), monto_asignado: z.number() }))
        .optional()
        .describe("Categorías presupuestarias"),
    },
    async (args) => {
      const res = await client.post("presupuestos", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_presupuesto",
    "Actualiza monto total, umbral o estado de un presupuesto",
    {
      id: z.number().describe("ID del presupuesto"),
      monto_total: z.number().optional(),
      umbral_alerta: z.number().optional(),
      estado: z.string().optional(),
    },
    async ({ id, ...body }) => {
      const res = await client.patch(`presupuestos/${id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_categoria_presupuesto",
    "Agrega una categoría a un presupuesto existente",
    {
      presupuesto_id: z.number().describe("ID del presupuesto"),
      nombre: z.string().describe("Nombre de la categoría"),
      monto_asignado: z.number().describe("Monto asignado a la categoría"),
    },
    async ({ presupuesto_id, ...body }) => {
      const res = await client.post(`presupuestos/${presupuesto_id}/categorias`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_categoria_presupuesto",
    "Actualiza el nombre o monto asignado de una categoría presupuestaria",
    {
      categoria_id: z.number().describe("ID de la categoría"),
      nombre: z.string().optional(),
      monto_asignado: z.number().optional(),
    },
    async ({ categoria_id, ...body }) => {
      const res = await client.patch(`presupuestos/categorias/${categoria_id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "eliminar_categoria_presupuesto",
    "Elimina una categoría presupuestaria (solo si no tiene monto comprometido)",
    {
      categoria_id: z.number().describe("ID de la categoría a eliminar"),
    },
    async ({ categoria_id }) => {
      const res = await client.delete(`presupuestos/categorias/${categoria_id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_alertas_presupuesto",
    "Lista las alertas de presupuesto: proyectos con umbral alcanzado o sobreconsumo",
    {},
    async () => {
      const res = await client.get("presupuestos/alertas/listado");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "comprometer_presupuesto",
    "Compromete manualmente un monto del presupuesto de un proyecto (opcionalmente de una categoría)",
    {
      presupuesto_id: z.number().describe("ID del presupuesto"),
      monto: z.number().describe("Monto a comprometer"),
      categoria_id: z.number().optional().describe("ID de la categoría (opcional)"),
      descripcion: z.string().optional().describe("Descripción del compromiso"),
    },
    async (args) => {
      const res = await client.post("presupuestos/comprometer", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
