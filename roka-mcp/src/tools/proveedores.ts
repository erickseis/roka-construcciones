import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerProveedoresTools(server: McpServer, client: ApiClient) {
  server.tool(
    "listar_proveedores",
    "Lista todos los proveedores activos",
    {},
    async () => {
      const res = await client.get("proveedores");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_proveedor",
    "Obtiene el detalle de un proveedor por ID",
    {
      id: z.number().describe("ID del proveedor"),
    },
    async ({ id }) => {
      const res = await client.get(`proveedores/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_proveedor",
    "Crea un nuevo proveedor en el catálogo",
    {
      nombre: z.string().describe("Nombre del proveedor"),
      rut: z.string().optional().describe("RUT del proveedor"),
      razon_social: z.string().optional().describe("Razón social"),
      direccion: z.string().optional().describe("Dirección"),
      telefono: z.string().optional().describe("Teléfono"),
      correo: z.string().optional().describe("Correo electrónico"),
      contacto_nombre: z.string().optional().describe("Nombre de la persona de contacto"),
      contacto_telefono: z.string().optional().describe("Teléfono de contacto"),
      contacto_correo: z.string().optional().describe("Correo de contacto"),
    },
    async (args) => {
      const res = await client.post("proveedores", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "actualizar_proveedor",
    "Actualiza los datos de un proveedor",
    {
      id: z.number().describe("ID del proveedor"),
      rut: z.string().optional(),
      nombre: z.string().optional(),
      razon_social: z.string().optional(),
      direccion: z.string().optional(),
      telefono: z.string().optional(),
      correo: z.string().optional(),
      contacto_nombre: z.string().optional(),
      contacto_telefono: z.string().optional(),
      contacto_correo: z.string().optional(),
      is_active: z.boolean().optional(),
    },
    async ({ id, ...body }) => {
      const res = await client.put(`proveedores/${id}`, body);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "desactivar_proveedor",
    "Desactiva un proveedor (soft delete — no se elimina, solo se marca inactivo)",
    {
      id: z.number().describe("ID del proveedor a desactivar"),
    },
    async ({ id }) => {
      const res = await client.delete(`proveedores/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
