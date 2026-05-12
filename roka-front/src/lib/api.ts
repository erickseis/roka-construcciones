// ================================================
// API Client — Funciones centralizadas de fetch
// ================================================

const API_BASE = import.meta.env.VITE_API_URL + '/roka/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('roka_token');

  const headers: HeadersInit = options?.headers as HeadersInit || {};

  if (!headers['Content-Type'] || headers['Content-Type'] !== 'multipart/form-data') {
    headers['Content-Type'] = 'application/json';
  } else {
    delete headers['Content-Type'];
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
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

export const getAuthPermisos = () => fetchApi<string[]>('/auth/permisos');

// ---- Usuarios ----
export const getUsers = () => fetchApi<any[]>('/users');
export const createUser = (data: any) =>
  fetchApi<any>('/users', { method: 'POST', body: JSON.stringify(data) });
export const updateUser = (id: number, data: any) =>
  fetchApi<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteUser = (id: number) =>
  fetchApi<any>(`/users/${id}`, { method: 'DELETE' });
export const updateUserPassword = (id: number, password: string) =>
  fetchApi<any>(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });

// ---- Configuración Estructural ----
export const getDepartamentos = () => fetchApi<any[]>('/config/departamentos');
export const createDepartamento = (data: any) =>
  fetchApi<any>('/config/departamentos', { method: 'POST', body: JSON.stringify(data) });
export const updateDepartamento = (id: number, data: any) =>
  fetchApi<any>(`/config/departamentos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteDepartamento = (id: number, migrar_a_id?: number) =>
  fetchApi<any>(`/config/departamentos/${id}`, { method: 'DELETE', body: JSON.stringify({ migrar_a_id }) });

export const getCargos = () => fetchApi<any[]>('/config/cargos');
export const createCargo = (data: any) =>
  fetchApi<any>('/config/cargos', { method: 'POST', body: JSON.stringify(data) });
export const updateCargo = (id: number, data: any) =>
  fetchApi<any>(`/config/cargos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCargo = (id: number, migrar_a_id?: number) =>
  fetchApi<any>(`/config/cargos/${id}`, { method: 'DELETE', body: JSON.stringify({ migrar_a_id }) });

export const getRoles = (params?: { incluir_inactivos?: boolean }) => {
  const qs = params?.incluir_inactivos ? '?incluir_inactivos=true' : '';
  return fetchApi<any[]>(`/config/roles${qs}`);
};
export const createRole = (data: any) =>
  fetchApi<any>('/config/roles', { method: 'POST', body: JSON.stringify(data) });
export const updateRole = (id: number, data: any) =>
  fetchApi<any>(`/config/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRole = (id: number, migrar_a_id?: number) =>
  fetchApi<any>(`/config/roles/${id}`, { method: 'DELETE', body: JSON.stringify({ migrar_a_id }) });
export const reactivateRole = (id: number) =>
  fetchApi<any>(`/config/roles/${id}/reactivar`, { method: 'PATCH' });

export const getConfigPermisos = () => fetchApi<any[]>('/config/permisos');

export const getPermisosByRol = (rolId: number) => fetchApi<string[]>(`/config/roles/${rolId}/permisos`);

export const updatePermisosByRol = (rolId: number, codigos: string[]) =>
  fetchApi<any>(`/config/roles/${rolId}/permisos`, {
    method: 'PUT',
    body: JSON.stringify({ codigos }),
  });

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

export const createProyecto = (data: any) => {
  if (data instanceof FormData) {
    const token = localStorage.getItem('roka_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}/proyectos`, {
      method: 'POST',
      body: data,
      headers,
    }).then(res => {
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    });
  }
  return fetchApi<any>('/proyectos', { method: 'POST', body: JSON.stringify(data) });
};

export const updateProyecto = (id: number, data: any) => {
  if (data instanceof FormData) {
    const token = localStorage.getItem('roka_token');
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${API_BASE}/proyectos/${id}`, {
      method: 'PATCH',
      body: data,
      headers,
    }).then(res => {
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    });
  }
  return fetchApi<any>(`/proyectos/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
};

export const updateProyectoActive = (id: number, is_active: boolean) =>
  fetchApi<any>(`/proyectos/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active }),
  });

export const downloadLicitacionArchivo = (id: number, nombreArchivo: string) => {
  const token = localStorage.getItem('roka_token');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}/proyectos/${id}/licitacion-archivo`, { headers })
    .then(res => {
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      a.click();
      window.URL.revokeObjectURL(url);
    });
};

export const downloadMaterialesArchivo = (id: number, nombreArchivo: string) => {
  const token = localStorage.getItem('roka_token');
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(`${API_BASE}/proyectos/${id}/materiales-archivo`, { headers })
    .then(res => {
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      a.click();
      window.URL.revokeObjectURL(url);
    });
};

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

export const exportarSolicitudHtml = (id: number) => {
  const baseUrl = import.meta.env.VITE_API_URL + '/roka/api';
  const token = localStorage.getItem('roka_token') || '';
  const url = `${baseUrl}/solicitudes/${id}/html`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Por favor permite ventanas emergentes para imprimir el documento.');
    return;
  }

  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.text())
    .then(html => {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.addEventListener('load', () => { win.focus(); win.print(); });
    })
    .catch(() => {
      win.close();
      alert('Error al generar el documento para imprimir.');
    });
};

// ---- Solicitudes de Cotización ----
export const getSolicitudesCotizacion = (params?: { solicitud_id?: number; estado?: string; proveedor?: string; proyecto_id?: number }) => {
  const query = new URLSearchParams();
  if (params?.solicitud_id) query.set('solicitud_id', String(params.solicitud_id));
  if (params?.estado) query.set('estado', params.estado);
  if (params?.proveedor) query.set('proveedor', params.proveedor);
  if (params?.proyecto_id) query.set('proyecto_id', String(params.proyecto_id));
  const qs = query.toString();
  return fetchApi<any[]>(`/solicitud-cotizacion${qs ? `?${qs}` : ''}`);
};

export const getSolicitudCotizacion = (id: number) => fetchApi<any>(`/solicitud-cotizacion/${id}`);

export const createSolicitudCotizacion = (data: any) =>
  fetchApi<any>('/solicitud-cotizacion', { method: 'POST', body: JSON.stringify(data) });

export const createBatchSolicitudesCotizacion = (data: any) =>
  fetchApi<any>('/solicitud-cotizacion/batch', { method: 'POST', body: JSON.stringify(data) });

export const changeSolicitudCotizacionEstado = (id: number, estado: string) =>
  fetchApi<any>(`/solicitud-cotizacion/${id}/estado`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });

export const deleteSolicitudCotizacion = (id: number) =>
  fetchApi<any>(`/solicitud-cotizacion/${id}`, { method: 'DELETE' });

export const descargarSolicitudCotizacionPdf = (id: number) => {
  const baseUrl = import.meta.env.VITE_API_URL + '/roka/api';
  // Open in new window - the browser will handle the PDF download
  window.open(`${baseUrl}/solicitud-cotizacion/${id}/descargar`, '_blank');
};

export const importarRespuestaSC = (solicitudCotizacionId: number, file: File) => {
  const formData = new FormData();
  formData.append('solicitud_cotizacion_id', String(solicitudCotizacionId));
  formData.append('archivo_sc', file);
  const baseUrl = import.meta.env.VITE_API_URL + '/roka/api';
  const token = localStorage.getItem('roka_token');
  return fetch(`${baseUrl}/solicitud-cotizacion/importar`, {
    method: 'POST',
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: formData,
  }).then(res => {
    if (!res.ok) return res.json().then(err => { throw new Error(err.error || 'Error al importar'); });
    return res.json();
  });
};

export const confirmarImportacionSC = (data: {
  solicitud_cotizacion_id: number;
  archivo_path?: string;
  archivo_nombre?: string;
  numero_cov?: string;
  condiciones_pago?: string;
  plazo_entrega?: string;
  descuento_global?: number;
  proveedor_nombre?: string;
  items: Array<{
    solicitud_item_id?: number | null;
    precio_unitario: number;
    descuento_porcentaje?: number;
    codigo_proveedor?: string;
    nombre_extraido?: string;
    cantidad_extraida?: number;
    unidad_extraida?: string;
  }>;
}) =>
  fetchApi<any>('/solicitud-cotizacion/importar/confirmar', {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ---- Órdenes de Compra ----
export const getOrdenes = (params?: { estado_entrega?: string; proyecto_id?: number }) => {
  const query = new URLSearchParams();
  if (params?.estado_entrega) query.set('estado_entrega', params.estado_entrega);
  if (params?.proyecto_id) query.set('proyecto_id', String(params.proyecto_id));
  const qs = query.toString();
  return fetchApi<any[]>(`/ordenes${qs ? `?${qs}` : ''}`);
};

export const getOrden = (id: number) => fetchApi<any>(`/ordenes/${id}`);

export const generarOrden = (data: {
  solicitud_cotizacion_id: number;
  condiciones_pago?: string;
  folio?: string;
  numero_cov?: string;
  descuento_tipo?: 'none' | 'porcentaje' | 'monto';
  descuento_valor?: number;
  plazo_entrega?: string;
  condiciones_entrega?: string;
  atencion_a?: string;
  observaciones?: string;
}) =>
  fetchApi<any>('/ordenes', { method: 'POST', body: JSON.stringify(data) });

export const createOrdenManual = (data: {
  proyecto_id: number;
  proveedor: string;
  proveedor_rut?: string;
  proveedor_direccion?: string;
  proveedor_telefono?: string;
  proveedor_correo?: string;
  items: { nombre_material: string; cantidad: number; unidad: string; precio_unitario: number; codigo?: string }[];
  condiciones_pago?: string;
  plazo_entrega?: string;
  condiciones_entrega?: string;
  atencion_a?: string;
  observaciones?: string;
  descuento_tipo?: 'none' | 'porcentaje' | 'monto';
  descuento_valor?: number;
  folio?: string;
  solicitud_id?: number;
  codigo_obra?: string;
}) =>
  fetchApi<any>('/ordenes/manual', { method: 'POST', body: JSON.stringify(data) });

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
// ---- Materiales y Unidades ----
export const getMaterialesMaster = (params?: { q?: string; categoria?: string }) => {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.categoria) query.set('categoria', params.categoria);
  const qs = query.toString();
  return fetchApi<any[]>(`/materiales${qs ? `?${qs}` : ''}`);
};

// ---- Unidades de Medida ----
export const getUnidadesMedida = () => fetchApi<any[]>('/materiales/unidades');

export const createUnidadMedida = (data: { nombre: string; abreviatura: string }) =>
  fetchApi<any>('/materiales/unidades', { method: 'POST', body: JSON.stringify(data) });

export const updateUnidadMedida = (id: number, data: { nombre: string; abreviatura: string }) =>
  fetchApi<any>(`/materiales/unidades/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteUnidadMedida = (id: number) =>
  fetchApi<any>(`/materiales/unidades/${id}`, { method: 'DELETE' });

export const createMaterialMaster = (data: any) =>
  fetchApi<any>('/materiales', { method: 'POST', body: JSON.stringify(data) });

export const updateMaterialMaster = (id: number, data: any) =>
  fetchApi<any>(`/materiales/${id}`, { method: 'PUT', body: JSON.stringify(data) });

// ---- Categorías de Materiales ----
export const getMaterialCategorias = () => fetchApi<any[]>('/materiales/categorias');

export const getMaterialesSolicitados = (params?: { q?: string; proyecto_id?: number }) => {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.proyecto_id) query.set('proyecto_id', String(params.proyecto_id));
  const qs = query.toString();
  return fetchApi<any[]>(`/materiales/solicitados${qs ? `?${qs}` : ''}`);
};

export const createMaterialCategoria = (data: { nombre: string; descripcion?: string }) =>
  fetchApi<any>('/materiales/categorias', { method: 'POST', body: JSON.stringify(data) });

export const updateMaterialCategoria = (id: number, data: { nombre: string; descripcion?: string }) =>
  fetchApi<any>(`/materiales/categorias/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteMaterialCategoria = (id: number) =>
  fetchApi<any>(`/materiales/categorias/${id}`, { method: 'DELETE' });

// ---- Proveedores ----
export const getProveedores = () => fetchApi<any[]>('/proveedores');

export const getProveedor = (id: number) => fetchApi<any>(`/proveedores/${id}`);

export const createProveedor = (data: any) =>
  fetchApi<any>('/proveedores', { method: 'POST', body: JSON.stringify(data) });

export const updateProveedor = (id: number, data: any) =>
  fetchApi<any>(`/proveedores/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteProveedor = (id: number) =>
  fetchApi<any>(`/proveedores/${id}`, { method: 'DELETE' });

// ---- Notificaciones Email ----
export const getEmailNotificationEventos = () =>
  fetchApi<any[]>('/config/email/eventos');

export const updateEmailNotificationEvento = (codigo: string, habilitado: boolean) =>
  fetchApi<any>(`/config/email/eventos/${codigo}`, {
    method: 'PATCH',
    body: JSON.stringify({ habilitado }),
  });

export const getEmailSystemConfig = () =>
  fetchApi<Record<string, string>>('/config/email/sistema');

export const updateEmailSystemConfig = (config: Record<string, string>) =>
  fetchApi<any>('/config/email/sistema', { method: 'PUT', body: JSON.stringify(config) });

export const testEmailConnection = (destinatario: string) =>
  fetchApi<any>('/config/email/test', { method: 'POST', body: JSON.stringify({ destinatario }) });

export const getEmailLogs = (limit?: number) =>
  fetchApi<any[]>(`/config/email/logs${limit ? `?limit=${limit}` : ''}`);

export const enviarSCProveedor = (id: number) =>
  fetchApi<any>(`/solicitud-cotizacion/${id}/enviar-proveedor`, { method: 'POST' });

export const enviarOCProveedor = (id: number) =>
  fetchApi<any>(`/ordenes/${id}/enviar-proveedor`, { method: 'POST' });

// ---- Alertas de Fecha de Entrega ----
export interface AlertaEmailConfig {
  id: number;
  habilitada: boolean;
  umbral_tipo: 'horas' | 'dias';
  umbral_valor: number;
  recordatorios_habilitados: boolean;
  recordatorios_cantidad: number;
  recordatorios_frecuencia_hs: number;
  destinatarios_usuario_ids: number[];
  created_at: string;
  updated_at: string;
}

export interface UsuarioAlerta {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
}

export const getEmailAlertasConfig = () =>
  fetchApi<AlertaEmailConfig>('/config/email/alertas');

export const updateEmailAlertasConfig = (data: Partial<AlertaEmailConfig>) =>
  fetchApi<AlertaEmailConfig>('/config/email/alertas', { method: 'PUT', body: JSON.stringify(data) });

export const getUsuariosAlertas = () =>
  fetchApi<UsuarioAlerta[]>('/config/email/alertas/usuarios');

// ---- Configuración de Triage ----
export const getTriageConfig = () => fetchApi<any[]>('/config/triage');

export const updateTriageConfig = (codigo: string, valor: number) =>
  fetchApi<any>('/config/triage', { method: 'PUT', body: JSON.stringify({ codigo, valor }) });
