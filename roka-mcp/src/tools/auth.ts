import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient } from "../client.js";
import { AuthManager } from "../auth.js";

export function registerAuthTools(server: McpServer, auth: AuthManager, api: ApiClient) {
  server.tool(
    "login",
    "Inicia sesión en la plataforma ROKA con correo y contraseña. Actualiza el token de sesión para todas las herramientas subsecuentes.",
    {
      correo: z.string().describe("Correo electrónico del usuario"),
      password: z.string().describe("Contraseña del usuario"),
    },
    async ({ correo, password }) => {
      const user = await auth.login(correo, password);
      return {
        content: [{ type: "text", text: JSON.stringify(user, null, 2) }],
      };
    }
  );

  server.tool(
    "quien_soy",
    "Obtiene el perfil del usuario autenticado actualmente",
    {},
    async () => {
      const res = await api.get("auth/me");
      return {
        content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
      };
    }
  );
}
