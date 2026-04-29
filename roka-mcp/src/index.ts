import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createAuthManager } from "./auth.js";
import { ApiClient, ApiError } from "./client.js";

import { registerAuthTools } from "./tools/auth.js";
import { registerProyectosTools } from "./tools/proyectos.js";
import { registerPresupuestosTools } from "./tools/presupuestos.js";
import { registerSolicitudesTools } from "./tools/solicitudes.js";
import { registerCotizacionesTools } from "./tools/cotizaciones.js";
import { registerOrdenesTools } from "./tools/ordenes.js";
import { registerMaterialesTools } from "./tools/materiales.js";
import { registerProveedoresTools } from "./tools/proveedores.js";
import { registerNotificacionesTools } from "./tools/notificaciones.js";
import { registerDashboardTools } from "./tools/dashboard.js";

async function main() {
  const backendUrl = process.env.ROKA_BACKEND_URL || "http://localhost:3001";
  const envEmail = process.env.ROKA_EMAIL;
  const envPassword = process.env.ROKA_PASSWORD;

  const auth = createAuthManager(backendUrl);

  try {
    await auth.ensureAuthenticated(envEmail, envPassword);
    console.error("[roka-mcp] Autenticado exitosamente en el backend ROKA");
  } catch (e) {
    console.error(
      "[roka-mcp] No se pudo autenticar automáticamente. Configure ROKA_EMAIL y ROKA_PASSWORD o use la herramienta 'login'."
    );
  }

  // Rebuild client each time to pick up current token from auth.state
  function getLiveClient(): ApiClient {
    return auth.getClient();
  }

  // Wrap client calls to auto-retry on 401 by trying stored credentials
  function createResilientClient(getClient: () => ApiClient) {
    async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401 && envEmail && envPassword) {
          await auth.login(envEmail, envPassword);
          return await fn();
        }
        throw e;
      }
    }

    return {
      get: <T = unknown>(path: string) =>
        withRetry(() => getClient().get<T>(path)),
      post: <T = unknown>(path: string, body?: unknown) =>
        withRetry(() => getClient().post<T>(path, body)),
      patch: <T = unknown>(path: string, body?: unknown) =>
        withRetry(() => getClient().patch<T>(path, body)),
      put: <T = unknown>(path: string, body?: unknown) =>
        withRetry(() => getClient().put<T>(path, body)),
      delete: <T = unknown>(path: string) =>
        withRetry(() => getClient().delete<T>(path)),
    };
  }

  const api = createResilientClient(getLiveClient);

  const server = new McpServer({
    name: "roka-mcp",
    version: "1.0.0",
    description:
      "MCP server para ROKA Plataforma - gestión de compras y presupuestos para proyectos de construcción",
  });

  registerAuthTools(server, auth, api);
  registerProyectosTools(server, api);
  registerPresupuestosTools(server, api);
  registerSolicitudesTools(server, api);
  registerCotizacionesTools(server, api);
  registerOrdenesTools(server, api);
  registerMaterialesTools(server, api);
  registerProveedoresTools(server, api);
  registerNotificacionesTools(server, api);
  registerDashboardTools(server, api);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[roka-mcp] MCP server iniciado exitosamente");
}

main().catch((err) => {
  console.error("[roka-mcp] Error fatal:", err);
  process.exit(1);
});
