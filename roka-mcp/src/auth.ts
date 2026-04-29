import { ApiClient, ApiError, createApiClient } from "./client.js";

interface AuthState {
  token: string | null;
  user: Record<string, unknown> | null;
}

export function createAuthManager(baseUrl: string) {
  const state: AuthState = { token: null, user: null };

  function getToken(): string | null {
    return state.token;
  }

  function getClient(): ApiClient {
    return createApiClient(baseUrl, getToken);
  }

  async function login(email: string, password: string): Promise<Record<string, unknown>> {
    const unauthenticatedClient = createApiClient(baseUrl, () => null);
    const res = await unauthenticatedClient.post<{
      token: string;
      user: Record<string, unknown>;
    }>("auth/login", { correo: email, password });

    state.token = res.data.token;
    state.user = res.data.user;
    return res.data.user;
  }

  async function ensureAuthenticated(email?: string, password?: string): Promise<ApiClient> {
    if (state.token) {
      return getClient();
    }

    if (!email || !password) {
      throw new Error(
        "No hay sesión activa. Configure ROKA_EMAIL y ROKA_PASSWORD en las variables de entorno."
      );
    }

    await login(email, password);
    return getClient();
  }

  async function refreshIfNeeded(): Promise<void> {
    try {
      const client = getClient();
      await client.get("auth/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        state.token = null;
        state.user = null;
      }
    }
  }

  return {
    getToken,
    getClient,
    login,
    ensureAuthenticated,
    refreshIfNeeded,
    get state() {
      return state;
    },
  };
}

export type AuthManager = ReturnType<typeof createAuthManager>;
