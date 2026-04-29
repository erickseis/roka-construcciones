export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    const msg = typeof body === "object" && body !== null && "error" in body
      ? String((body as Record<string, unknown>).error)
      : `HTTP ${status}`;
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

const API_PREFIX = process.env.ROKA_API_PREFIX || "/api/";

function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const clean = path.replace(/^\/+/, "");
  return `${base}${API_PREFIX}${clean}`;
}

export function createApiClient(
  baseUrl: string,
  getToken: () => string | null
) {
  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const url = buildUrl(baseUrl, path);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data: T;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = (await res.json()) as T;
    } else {
      data = (await res.text()) as unknown as T;
    }

    if (!res.ok) {
      throw new ApiError(res.status, data);
    }

    return { ok: true, status: res.status, data };
  }

  return {
    get<T = unknown>(path: string) {
      return request<T>("GET", path);
    },
    post<T = unknown>(path: string, body?: unknown) {
      return request<T>("POST", path, body);
    },
    patch<T = unknown>(path: string, body?: unknown) {
      return request<T>("PATCH", path, body);
    },
    put<T = unknown>(path: string, body?: unknown) {
      return request<T>("PUT", path, body);
    },
    delete<T = unknown>(path: string) {
      return request<T>("DELETE", path);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
