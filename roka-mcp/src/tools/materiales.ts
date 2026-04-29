import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerMaterialesTools(server: McpServer, client: ApiClient) {
  server.tool(
    "listar_materiales",
    "Lista todos los materiales del catálogo maestro con filtros opcionales",
    {
      categoria_id: z.number().optional().describe("Filtrar por ID de categoría"),
      q: z.string().optional().describe("Buscar por nombre o SKU"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.categoria_id) params.set("categoria_id", String(args.categoria_id));
      if (args.q) params.set("q", args.q);
      const qs = params.toString();
      const res = await client.get(`materiales${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_material",
    "Obtiene el detalle de un material del catálogo",
    {
      id: z.number().describe("ID del material"),
    },
    async ({ id }) => {
      const res = await client.get(`materiales/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_material",
    "Crea un nuevo material en el catálogo maestro",
    {
      nombre: z.string().describe("Nombre del material"),
      unidad_medida_id: z.number().describe("ID de la unidad de medida"),
      sku: z.string().optional().describe("SKU o código único"),
      descripcion: z.string().optional().describe("Descripción del material"),
      categoria_id: z.number().optional().describe("ID de la categoría"),
      categoria: z.string().optional().describe("Nombre de categoría (texto libre)"),
      precio_referencial: z.number().optional().describe("Precio referencial"),
    },
    async (args) => {
      const res = await client.post("materiales", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_material",
    "Actualiza un material del catálogo maestro",
    {
      id: z.number().describe("ID del material"),
      nombre: z.string().optional(),
      unidad_medida_id: z.number().optional(),
      sku: z.string().optional(),
      descripcion: z.string().optional(),
      categoria_id: z.number().optional(),
      precio_referencial: z.number().optional(),
      is_active: z.boolean().optional(),
    },
    async ({ id, ...body }) => {
      const res = await client.put(`materiales/${id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "eliminar_material",
    "Elimina un material del catálogo (solo si no está siendo usado en solicitudes)",
    {
      id: z.number().describe("ID del material a eliminar"),
    },
    async ({ id }) => {
      const res = await client.delete(`materiales/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "listar_unidades_medida",
    "Lista todas las unidades de medida disponibles",
    {},
    async () => {
      const res = await client.get("materiales/unidades");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_unidad_medida",
    "Crea una nueva unidad de medida",
    {
      nombre: z.string().describe("Nombre de la unidad (ej: Metro cúbico)"),
      abreviatura: z.string().describe("Abreviatura (ej: m³)"),
    },
    async (args) => {
      const res = await client.post("materiales/unidades", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_unidad_medida",
    "Actualiza una unidad de medida existente",
    {
      id: z.number().describe("ID de la unidad"),
      nombre: z.string().describe("Nuevo nombre"),
      abreviatura: z.string().describe("Nueva abreviatura"),
    },
    async ({ id, ...body }) => {
      const res = await client.put(`materiales/unidades/${id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "eliminar_unidad_medida",
    "Elimina una unidad de medida (solo si no está siendo usada por materiales)",
    {
      id: z.number().describe("ID de la unidad a eliminar"),
    },
    async ({ id }) => {
      const res = await client.delete(`materiales/unidades/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "listar_categorias_material",
    "Lista todas las categorías de materiales",
    {},
    async () => {
      const res = await client.get("materiales/categorias");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_categoria_material",
    "Crea una nueva categoría de materiales",
    {
      nombre: z.string().describe("Nombre de la categoría"),
      descripcion: z.string().optional().describe("Descripción de la categoría"),
    },
    async (args) => {
      const res = await client.post("materiales/categorias", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_categoria_material",
    "Actualiza una categoría de materiales",
    {
      id: z.number().describe("ID de la categoría"),
      nombre: z.string(),
      descripcion: z.string().optional(),
    },
    async ({ id, ...body }) => {
      const res = await client.put(`materiales/categorias/${id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "eliminar_categoria_material",
    "Elimina una categoría de materiales (solo si no tiene materiales asociados)",
    {
      id: z.number().describe("ID de la categoría a eliminar"),
    },
    async ({ id }) => {
      const res = await client.delete(`materiales/categorias/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "listar_materiales_solicitados",
    "Lista todos los ítems solicitados históricamente con información de proyecto",
    {
      proyecto_id: z.number().optional().describe("Filtrar por proyecto"),
      q: z.string().optional().describe("Buscar por nombre del material"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.proyecto_id) params.set("proyecto_id", String(args.proyecto_id));
      if (args.q) params.set("q", args.q);
      const qs = params.toString();
      const res = await client.get(`materiales/solicitados${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
