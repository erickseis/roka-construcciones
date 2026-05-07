import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerProyectosTools(server: McpServer, client: ApiClient) {
  server.tool(
    "listar_proyectos",
    "Lista todos los proyectos con filtros opcionales por estado y actividad",
    {
      estado: z.string().optional().describe("Filtrar por estado (Planificación, En ejecución, Finalizado)"),
      is_active: z.boolean().optional().describe("Filtrar por proyectos activos/inactivos"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.estado) params.set("estado", args.estado);
      if (args.is_active !== undefined) params.set("is_active", String(args.is_active));
      const qs = params.toString();
      const res = await client.get(`proyectos${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_proyecto",
    "Obtiene el detalle completo de un proyecto incluyendo resumen de presupuesto y métricas",
    {
      id: z.number().describe("ID del proyecto"),
    },
    async ({ id }) => {
      const res = await client.get(`proyectos/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

server.tool(
    "crear_proyecto",
    "Crea un nuevo proyecto con datos opcionales de licitacion",
    {
      nombre: z.string().describe("Nombre del proyecto"),
      ubicacion: z.string().optional().describe("Ubicación del proyecto"),
      estado: z.string().optional().describe("Estado inicial (Planificación por defecto)"),
      fecha_inicio: z.string().optional().describe("Fecha de inicio (YYYY-MM-DD)"),
      fecha_fin: z.string().optional().describe("Fecha de fin (YYYY-MM-DD)"),
      responsable_usuario_id: z.number().optional().describe("ID del usuario responsable"),
      numero_licitacion: z.string().optional().describe("Número de licitacion"),
      descripcion_licitacion: z.string().optional().describe("Descripción de la licitacion"),
      fecha_apertura_licitacion: z.string().optional().describe("Fecha de apertura de licitacion"),
      monto_referencial_licitacion: z.number().optional().describe("Monto de Adjudicación (obra)"),
      mandante: z.string().optional().describe("Mandante - fuente de financiamiento del proyecto"),
      moneda: z.string().optional().describe("Moneda del proyecto (CLP, USD, UF, etc)"),
      plazo_ejecucion_dias: z.number().optional().describe("Plazo de ejecución en días corridos"),
    },
    async (args) => {
      const res = await client.post("proyectos", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "procesar_materiales_proyecto",
    "Procesa el archivo Excel de materiales adjunto a un proyecto y crea una solicitud de materiales",
    {
      id: z.number().describe("ID del proyecto"),
      solicitante: z.string().describe("Nombre del solicitante para la solicitud de materiales"),
    },
    async ({ id, solicitante }) => {
      const res = await client.post(`proyectos/${id}/procesar-materiales`, { solicitante });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_proyecto",
    "Actualiza los datos de un proyecto existente",
    {
      id: z.number().describe("ID del proyecto a actualizar"),
      nombre: z.string().optional(),
      ubicacion: z.string().optional(),
      estado: z.string().optional(),
      fecha_inicio: z.string().optional(),
      fecha_fin: z.string().optional(),
      responsable_usuario_id: z.number().optional(),
      numero_licitacion: z.string().optional(),
      descripcion_licitacion: z.string().optional(),
      fecha_apertura_licitacion: z.string().optional(),
      monto_referencial_licitacion: z.number().optional(),
      mandante: z.string().optional().describe("Mandante - fuente de financiamiento del proyecto"),
      moneda: z.string().optional().describe("Moneda del proyecto"),
      plazo_ejecucion_dias: z.number().optional().describe("Plazo de ejecución en días corridos"),
    },
    async ({ id, ...body }) => {
      const res = await client.patch(`proyectos/${id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "activar_desactivar_proyecto",
    "Activa o desactiva un proyecto",
    {
      id: z.number().describe("ID del proyecto"),
      is_active: z.boolean().describe("true para activar, false para desactivar"),
    },
    async ({ id, is_active }) => {
      const res = await client.patch(`proyectos/${id}/active`, { is_active });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
