import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createAuthManager } from "./auth.js";
import { ApiClient, ApiError } from "./client.js";
import type { AuthManager } from "./auth.js";

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
import { registerEmailConfigTools } from "./tools/email-config.js";

export type ResilientClient = ReturnType<typeof createResilientClient>;

export function createResilientClient(auth: AuthManager) {
  const envEmail = process.env.ROKA_EMAIL;
  const envPassword = process.env.ROKA_PASSWORD;

  function getLiveClient(): ApiClient {
    return auth.getClient();
  }

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
      withRetry(() => getLiveClient().get<T>(path)),
    post: <T = unknown>(path: string, body?: unknown) =>
      withRetry(() => getLiveClient().post<T>(path, body)),
    patch: <T = unknown>(path: string, body?: unknown) =>
      withRetry(() => getLiveClient().patch<T>(path, body)),
    put: <T = unknown>(path: string, body?: unknown) =>
      withRetry(() => getLiveClient().put<T>(path, body)),
    delete: <T = unknown>(path: string) =>
      withRetry(() => getLiveClient().delete<T>(path)),
  };
}

export async function createAuth() {
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

  return auth;
}

function registerAllTools(server: McpServer, auth: AuthManager, api: ResilientClient) {
  registerAuthTools(server, auth, api);
  registerProyectosTools(server, api);
  registerPresupuestosTools(server, api);
  registerSolicitudesTools(server, api);
  registerCotizacionesTools(server, api);
  registerOrdenesTools(server, auth, api);
  registerMaterialesTools(server, api);
  registerProveedoresTools(server, api);
  registerNotificacionesTools(server, api);
  registerDashboardTools(server, api);
  registerEmailConfigTools(server, api);
}

function createMcpServer() {
  return new McpServer({
    name: "roka-mcp",
    version: "1.0.0",
    description:
      "MCP server para ROKA Plataforma - gestión de compras y presupuestos para proyectos de construcción",
  });
}

/**
 * Mounts the MCP server on an Express app at the given path using StreamableHTTP transport.
 * Call after the Express app is ready (app.listen).
 */
export async function mountMcpServer(app: { post: Function; get: Function }, path: string) {
  const auth = await createAuth();
  const api = createResilientClient(auth);
  const server = createMcpServer();

  registerAllTools(server, auth, api);

  const transport = new StreamableHTTPServerTransport();
  await server.connect(transport);

  app.post(path, (req: unknown, res: unknown) => {
    const r = req as Record<string, unknown>;
    transport.handleRequest(r as never, res as never, r.body);
  });

  app.get(path, (req: unknown, res: unknown) => {
    transport.handleRequest(req as never, res as never);
  });

  console.error(`[roka-mcp] MCP server montado en ${path}`);
  return server;
}

// --- Stdio standalone mode (unchanged behavior) ---

async function main() {
  const auth = await createAuth();
  const api = createResilientClient(auth);
  const server = createMcpServer();

  registerAllTools(server, auth, api);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[roka-mcp] MCP server iniciado exitosamente");
}

// Only run stdio mode when executed directly (not when imported from index.cjs)
const isStandalone = process.argv[1]?.endsWith('dist/index.js') || process.argv[1]?.endsWith('src/index.ts');
if (isStandalone) {
  main().catch((err) => {
    console.error("[roka-mcp] Error fatal:", err);
    process.exit(1);
  });
}
