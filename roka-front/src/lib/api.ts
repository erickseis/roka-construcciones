// ================================================
// API Client — Funciones centralizadas de fetch
// ================================================

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('roka_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    // Si el token es inválido o expiró, podríamos limpiar la sesión
    if (res.status === 401 && token) {
      localStorage.removeItem('roka_token');
      window.location.href = '/login';
    }
    throw new Error(error.error || `Error ${res.status}`);
  }
  return res.json();
}

// ---- Auth ----
export const login = (credentials: any) => 
  fetchApi<any>('/auth/login', { method: 'POST', body: JSON.stringify(credentials) });

export const getMe = () => fetchApi<any>('/auth/me');

// ---- Usuarios ----
export const getUsers = () => fetchApi<any[]>('/users');
export const createUser = (data: any) => 
  fetchApi<any>('/users', { method: 'POST', body: JSON.stringify(data) });
export const deleteUser = (id: number) => 
  fetchApi<any>(`/users/${id}`, { method: 'DELETE' });

// ---- Configuración Estructural ----
export const getDepartamentos = () => fetchApi<any[]>('/config/departamentos');
export const createDepartamento = (data: any) => 
  fetchApi<any>('/config/departamentos', { method: 'POST', body: JSON.stringify(data) });

export const getCargos = () => fetchApi<any[]>('/config/cargos');
export const createCargo = (data: any) => 
  fetchApi<any>('/config/cargos', { method: 'POST', body: JSON.stringify(data) });

export const getRoles = () => fetchApi<any[]>('/config/roles');

// ---- Proyectos ----
export const getProyectos = () => fetchApi<any[]>('/dashboard/proyectos');
export const getProyectosAdmin = (params?: { estado?: string; is_active?: boolean }) => {
  const query = new URLSearchParams();
  if (params?.estado) query.set('estado', params.estado);
  if (typeof params?.is_active !== 'undefined') query.set('is_active', String(params.is_active));
  const qs = query.toString();
  return fetchApi<any[]>(`/proyectos${qs ? `?${qs}` : ''}`);
};
export const getProyecto = (id: number) => fetchApi<any>(`/proyectos/${id}`);
export const createProyecto = (data: any) =>
  fetchApi<any>('/proyectos', { method: 'POST', body: JSON.stringify(data) });
export const updateProyecto = (id: number, data: any) =>
  fetchApi<any>(`/proyectos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const updateProyectoActive = (id: number, is_active: boolean) =>
  fetchApi<any>(`/proyectos/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });

// ---- Presupuestos ----
export const getPresupuestos = () => fetchApi<any[]>('/presupuestos');
export const getPresupuestoProyecto = (proyectoId: number) =>
  fetchApi<any>(`/presupuestos/proyecto/${proyectoId}`);
export const createPresupuesto = (data: any) =>
  fetchApi<any>('/presupuestos', { method: 'POST', body: JSON.stringify(data) });
export const updatePresupuesto = (id: number, data: any) =>
  fetchApi<any>(`/presupuestos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const createPresupuestoCategoria = (presupuestoId: number, data: any) =>
  fetchApi<any>(`/presupuestos/${presupuestoId}/categorias`, { method: 'POST', body: JSON.stringify(data) });
export const updatePresupuestoCategoria = (categoriaId: number, data: any) =>
  fetchApi<any>(`/presupuestos/categorias/${categoriaId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deletePresupuestoCategoria = (categoriaId: number) =>
  fetchApi<any>(`/presupuestos/categorias/${categoriaId}`, { method: 'DELETE' });
export const getAlertasPresupuesto = () => fetchApi<any[]>('/presupuestos/alertas/listado');

// ---- Solicitudes ----
export const getSolicitudes = (params?: { proyecto_id?: number; estado?: string }) => {
  const query = new URLSearchParams();
  if (params?.proyecto_id) query.set('proyecto_id', String(params.proyecto_id));
  if (params?.estado) query.set('estado', params.estado);
  const qs = query.toString();
  return fetchApi<any[]>(`/solicitudes${qs ? `?${qs}` : ''}`);
};

export const getSolicitud = (id: number) => fetchApi<any>(`/solicitudes/${id}`);

export const createSolicitud = (data: any) =>
  fetchApi<any>('/solicitudes', { method: 'POST', body: JSON.stringify(data) });

export const updateSolicitudEstado = (id: number, estado: string) =>
  fetchApi<any>(`/solicitudes/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });

export const deleteSolicitud = (id: number) =>
  fetchApi<any>(`/solicitudes/${id}`, { method: 'DELETE' });

// ---- Cotizaciones ----
export const getCotizaciones = (params?: { solicitud_id?: number; estado?: string }) => {
  const query = new URLSearchParams();
  if (params?.solicitud_id) query.set('solicitud_id', String(params.solicitud_id));
  if (params?.estado) query.set('estado', params.estado);
  const qs = query.toString();
  return fetchApi<any[]>(`/cotizaciones${qs ? `?${qs}` : ''}`);
};

export const getCotizacion = (id: number) => fetchApi<any>(`/cotizaciones/${id}`);

export const createCotizacion = (data: any) =>
  fetchApi<any>('/cotizaciones', { method: 'POST', body: JSON.stringify(data) });

export const aprobarCotizacion = (id: number) =>
  fetchApi<any>(`/cotizaciones/${id}/aprobar`, { method: 'PATCH' });

export const rechazarCotizacion = (id: number) =>
  fetchApi<any>(`/cotizaciones/${id}/rechazar`, { method: 'PATCH' });

// ---- Órdenes de Compra ----
export const getOrdenes = (params?: { estado_entrega?: string; proyecto_id?: number }) => {
  const query = new URLSearchParams();
  if (params?.estado_entrega) query.set('estado_entrega', params.estado_entrega);
  if (params?.proyecto_id) query.set('proyecto_id', String(params.proyecto_id));
  const qs = query.toString();
  return fetchApi<any[]>(`/ordenes${qs ? `?${qs}` : ''}`);
};

export const getOrden = (id: number) => fetchApi<any>(`/ordenes/${id}`);

export const generarOrden = (data: { cotizacion_id: number; condiciones_pago?: string }) =>
  fetchApi<any>('/ordenes', { method: 'POST', body: JSON.stringify(data) });

export const updateEstadoEntrega = (id: number, estado_entrega: string) =>
  fetchApi<any>(`/ordenes/${id}/entrega`, {
    method: 'PATCH',
    body: JSON.stringify({ estado_entrega }),
  });

// ---- Notificaciones ----
export const getNotificaciones = (params?: { solo_no_leidas?: boolean; limit?: number; offset?: number }) => {
  const query = new URLSearchParams();
  if (typeof params?.solo_no_leidas !== 'undefined') query.set('solo_no_leidas', String(params.solo_no_leidas));
  if (typeof params?.limit !== 'undefined') query.set('limit', String(params.limit));
  if (typeof params?.offset !== 'undefined') query.set('offset', String(params.offset));
  const qs = query.toString();
  return fetchApi<any[]>(`/notificaciones${qs ? `?${qs}` : ''}`);
};

export const getUnreadNotificacionesCount = () =>
  fetchApi<{ unread: number }>('/notificaciones/unread-count');

export const marcarNotificacionLeida = (id: number, leida = true) =>
  fetchApi<any>(`/notificaciones/${id}/leida`, {
    method: 'PATCH',
    body: JSON.stringify({ leida }),
  });

export const marcarTodasNotificacionesLeidas = () =>
  fetchApi<{ updated: number }>('/notificaciones/marcar-todas-leidas', { method: 'PATCH' });

// ---- Dashboard ----
export const getDashboardResumen = () => fetchApi<any>('/dashboard/resumen');
export const getKPISolicitudesMensual = () => fetchApi<any>('/dashboard/solicitudes-mensual');
export const getKPIGastoPorProyecto = () => fetchApi<any[]>('/dashboard/gasto-por-proyecto');
export const getKPITiempoConversion = () => fetchApi<any>('/dashboard/tiempo-conversion');
