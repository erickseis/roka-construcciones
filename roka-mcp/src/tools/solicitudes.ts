import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";

export function registerSolicitudesTools(server: McpServer, client: ApiClient) {
  server.tool(
    "listar_solicitudes",
    "Lista todas las solicitudes de material con filtros opcionales",
    {
      proyecto_id: z.number().optional().describe("Filtrar por ID de proyecto"),
      estado: z.string().optional().describe("Filtrar por estado (Pendiente, Cotizando, Aprobado)"),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.proyecto_id) params.set("proyecto_id", String(args.proyecto_id));
      if (args.estado) params.set("estado", args.estado);
      const qs = params.toString();
      const res = await client.get(`solicitudes${qs ? "?" + qs : ""}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "ver_solicitud",
    "Obtiene el detalle de una solicitud con sus ítems, incluyendo precios referenciales",
    {
      id: z.number().describe("ID de la solicitud"),
    },
    async ({ id }) => {
      const res = await client.get(`solicitudes/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "crear_solicitud",
    "Crea una nueva solicitud de materiales con sus ítems",
    {
      proyecto_id: z.number().describe("ID del proyecto"),
      solicitante: z.string().describe("Nombre del solicitante"),
      fecha: z.string().optional().describe("Fecha de la solicitud (YYYY-MM-DD)"),
      fecha_requerida: z.string().optional().describe("Fecha en que se necesita el material en terreno (YYYY-MM-DD)"),
      items: z
        .array(
          z.object({
            material_id: z.number().optional().describe("ID del material del catálogo (opcional)"),
            nombre_material: z.string().describe("Nombre del material"),
            cantidad_requerida: z.number().describe("Cantidad requerida"),
            unidad: z.string().describe("Unidad de medida"),
            codigo: z.string().optional().describe("Código o SKU del material (opcional, ej: MAL0151). Se mostrará en la OC."),
          })
        )
        .describe("Lista de ítems solicitados"),
    },
    async (args) => {
      const res = await client.post("solicitudes", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "cambiar_estado_solicitud",
    "Cambia el estado de una solicitud de material",
    {
      id: z.number().describe("ID de la solicitud"),
      estado: z.enum(["Pendiente", "Cotizando", "Aprobado"]).describe("Nuevo estado"),
    },
    async ({ id, estado }) => {
      const res = await client.patch(`solicitudes/${id}/estado`, { estado });
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "eliminar_solicitud",
    "Elimina una solicitud de material y sus ítems",
    {
      id: z.number().describe("ID de la solicitud a eliminar"),
    },
    async ({ id }) => {
      const res = await client.delete(`solicitudes/${id}`);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );

  server.tool(
    "generar_pdf_solicitud",
    "Genera el PDF real de una Solicitud de Materiales desde el sistema. Retorna URL de descarga directa. Siempre que el usuario pida ver o descargar una Solicitud como PDF, DEBES llamar esta herramienta en lugar de inventar la estructura.",
    {
      id: z.number().describe("ID de la solicitud"),
    },
    async ({ id }) => {
      const publicBase = (
        process.env.ROKA_PUBLIC_URL ||
        process.env.ROKA_BACKEND_URL ||
        "http://localhost:3001"
      ).replace(/\/+$/, "");
      const apiPrefix = process.env.ROKA_API_PREFIX || "/api/roka/api/";
      const apiRoot = apiPrefix.replace(/\/+$/, "");

      try {
        const res = await client.get<{
          url: string;
          filename: string;
          size: number;
        }>(`solicitudes/${id}/pdf-link`);

        const pdfUrl = `${publicBase}${res.data.url}`;
        const htmlUrl = `${publicBase}${apiRoot}/solicitudes/${id}/exportar`;

        const msg = [
          `**PDF generado exitosamente desde el sistema**`,
          ``,
          `Archivo: ${res.data.filename} (${(res.data.size / 1024).toFixed(1)} KB)`,
          `URL descarga PDF: ${pdfUrl}`,
          `URL vista HTML (idéntica al frontend): ${htmlUrl}`,
          ``,
          `👉 Para ver el PDF: abre la URL de descarga.`,
          `👉 Para impresión idéntica al frontend: abre la URL HTML en el browser y usa Ctrl+P.`,
        ].join('\n');

        return {
          content: [{ type: "text", text: msg }],
        };
      } catch (pdfError) {
        console.error('PDF solicitud falló, usando fallback:', pdfError);
        const exportUrl = `${publicBase}${apiRoot}/solicitudes/${id}/exportar`;

        return {
          content: [
            {
              type: "text",
              text: `⚠️ No se pudo generar PDF (servidor sin Chrome). La solicitud real existe en el sistema.

Para ver la solicitud de materiales:
1. Abre directamente: ${exportUrl}
2. O consulta los datos reales con: ver_solicitud({ id: ${id} })

**No fabriques ni inventes datos de la solicitud** — consulta siempre desde el sistema usando los tools disponibles.`,
            },
          ],
        };
      }
    }
  );
}
