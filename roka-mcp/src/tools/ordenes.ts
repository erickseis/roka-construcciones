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
    "Genera una orden de compra a partir de una solicitud de cotización respondida. Compromete presupuesto automáticamente.",
    {
      solicitud_cotizacion_id: z.number().describe("ID de la solicitud de cotización respondida"),
      condiciones_pago: z.string().optional().describe("Condiciones de pago (Neto 30 días por defecto)"),
      folio: z.string().optional().describe("Folio personalizado (se genera automáticamente si no se especifica)"),
      descuento_tipo: z.enum(["none", "porcentaje", "monto"]).optional().describe("Tipo de descuento"),
      descuento_valor: z.number().optional().describe("Valor del descuento"),
      plazo_entrega: z.string().optional().describe("Plazo de entrega"),
      condiciones_entrega: z.string().optional().describe("Condiciones de entrega"),
      atencion_a: z.string().optional().describe("Atención a (persona de contacto)"),
      observaciones: z.string().optional().describe("Observaciones adicionales"),
      autorizado_por_usuario_id: z.number().optional().describe("ID del usuario que autoriza la OC"),
      codigo_obra: z.string().optional().describe("Código de obra (si no se especifica, se usa el N° de licitación del proyecto)"),
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
    "generar_pdf_orden_compra",
    "OBLIGATORIO: Genera el PDF real de una Orden de Compra desde el sistema. Retorna URL de descarga directa. NO inventes ni fabriques datos de la OC — usa esta herramienta para obtener el PDF auténtico. Siempre que el usuario pida ver o descargar una OC como PDF, DEBES llamar esta herramienta en lugar de inventar la estructura.",
    {
      id: z.number().describe("ID de la orden de compra"),
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
        }>(`ordenes/${id}/pdf-link`);

        // PDF se sirve desde /uploads (static file en raíz del servidor)
        const pdfUrl = `${publicBase}${res.data.url}`;
        // HTML usar prefijo API
        const htmlUrl = `${publicBase}${apiRoot}/ordenes/${id}/exportar`;

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
        console.error('PDF falló, usando fallback:', pdfError);
        const exportUrl = `${publicBase}${apiRoot}/ordenes/${id}/exportar`;

        return {
          content: [
            {
              type: "text",
              text: `⚠️ No se pudo generar PDF (servidor sin Chrome). La OC real existe en el sistema.

Para ver la orden de compra:
1. Abre directamente: ${exportUrl}
2. O consulta los datos reales con: roka:ver_orden({ id: ${id} })

**No fabriques ni inventes datos de la OC** — consulta siempre desde el sistema usando los tools disponibles.`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "crear_orden_compra_manual",
    "Crea una orden de compra manual/esporádica sin solicitud ni cotización previa. Para urgencias de terreno. Compromete presupuesto automáticamente si existe.",
    {
      proyecto_id: z.number().describe("ID del proyecto"),
      proveedor: z.string().describe("Nombre del proveedor"),
      proveedor_rut: z.string().optional().describe("RUT del proveedor"),
      proveedor_direccion: z.string().optional().describe("Dirección del proveedor"),
      proveedor_telefono: z.string().optional().describe("Teléfono del proveedor"),
      proveedor_correo: z.string().optional().describe("Correo del proveedor"),
      items: z.array(z.object({
        nombre_material: z.string().describe("Nombre del material"),
        cantidad: z.number().describe("Cantidad"),
        unidad: z.string().describe("Unidad de medida"),
        precio_unitario: z.number().describe("Precio unitario"),
        codigo: z.string().optional().describe("Código o SKU"),
      })).describe("Lista de ítems a comprar"),
      condiciones_pago: z.string().optional().describe("Condiciones de pago"),
      plazo_entrega: z.string().optional().describe("Plazo de entrega"),
      condiciones_entrega: z.string().optional().describe("Condiciones de entrega"),
      atencion_a: z.string().optional().describe("Atención a (persona de contacto)"),
      observaciones: z.string().optional().describe("Observaciones adicionales"),
      descuento_tipo: z.enum(["none", "porcentaje", "monto"]).optional().describe("Tipo de descuento"),
      descuento_valor: z.number().optional().describe("Valor del descuento"),
      folio: z.string().optional().describe("Folio personalizado"),
      solicitud_id: z.number().optional().describe("ID de solicitud de materiales para trazabilidad (opcional)"),
      codigo_obra: z.string().optional().describe("Código de obra directo (si no se especifica, se usa el N° de licitación del proyecto)"),
    },
    async (args) => {
      const res = await client.post("ordenes/manual", args);
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
