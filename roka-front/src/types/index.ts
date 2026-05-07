// ================================================
// Tipos del Sistema de Gestión de Compras
// ================================================

export interface Proyecto {
  id: number;
  nombre: string;
  ubicacion: string;
  estado: string;
  is_active?: boolean;
  fecha_inicio?: string;
  fecha_fin?: string;
  responsable_usuario_id?: number;
  responsable_nombre?: string;
  numero_licitacion?: string;
  descripcion_licitacion?: string;
  fecha_apertura_licitacion?: string;
  monto_referencial_licitacion?: number;
  archivo_licitacion_path?: string;
  archivo_licitacion_nombre?: string;
  updated_at?: string;
  created_at: string;
}

export interface ProyectoInput {
  nombre: string;
  ubicacion?: string;
  estado?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  responsable_usuario_id?: number;
  numero_licitacion?: string;
  descripcion_licitacion?: string;
  fecha_apertura_licitacion?: string;
  monto_referencial_licitacion?: number;
}

// --- Organizacional ---

export interface Rol {
  id: number;
  nombre: string;
}

export interface Departamento {
  id: number;
  nombre: string;
  descripcion?: string;
}

export interface Cargo {
  id: number;
  nombre: string;
  departamento_id: number;
  departamento_nombre?: string;
}

// --- Usuarios ---

export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  rut: string;
  correo: string;
  telefono?: string;
  departamento_id?: number;
  cargo_id?: number;
  rol_id?: number;
  departamento_nombre?: string;
  cargo_nombre?: string;
  rol_nombre?: string;
  is_active: boolean;
  created_at: string;
}

// --- Solicitudes de Material ---

export type SolicitudEstado = 'Pendiente' | 'Cotizando' | 'Aprobado';

export interface SolicitudItem {
  id: number;
  solicitud_id: number;
  material_id?: number | null;
  material_oficial_nombre?: string;
  material_sku?: string;
  nombre_material: string;
  cantidad_requerida: number;
  unidad: string;
  unidad_abreviatura?: string;
  codigo?: string | null;
}

export interface SolicitudItemInput {
  material_id?: number | null;
  nombre_material: string;
  cantidad_requerida: number;
  unidad: string;
}

export interface Solicitud {
  id: number;
  proyecto_id: number;
  proyecto_nombre?: string;
  solicitante: string;
  fecha: string;
  estado: SolicitudEstado;
  items?: SolicitudItem[];
  created_at: string;
  updated_at: string;
}

export interface SolicitudInput {
  proyecto_id: number;
  solicitante: string;
  fecha?: string;
  items: SolicitudItemInput[];
}

// --- Importación de Precios desde Archivo ---

export interface ParsedItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_neto_unitario: number;
  descuento_porcentaje: number;
  total_linea: number;
}

export interface ParsedQuotation {
  proveedor_rut: string;
  proveedor_nombre: string;
  proveedor_direccion: string | null;
  proveedor_telefono: string | null;
  proveedor_correo: string | null;
  numero_cov: string;
  fecha: string;
  vendedor: string | null;
  validez: string | null;
  items: ParsedItem[];
  condicion_pago: string | null;
  condicion_entrega: string | null;
  subtotal_neto: number;
  iva: number;
  total: number;
  observaciones: string | null;
  descuento_global_porcentaje: number | null;
  descuento_global_monto: number | null;
}

export interface ImportItemMatch {
  parsed: ParsedItem;
  solicitud_item: {
    id: number;
    solicitud_item_id: number;
    nombre_material: string;
    cantidad_requerida: number;
    unidad: string;
    codigo: string | null;
  } | null;
  match_tipo: 'exact_code' | 'similar_name' | 'none';
  cantidad_ok: boolean;
  warning: string | null;
}

export interface ImportPreviewResponse {
  parsed: ParsedQuotation;
  solicitud_cotizacion_id: number;
  solicitud_id: number;
  archivo_path: string;
  archivo_nombre: string;
  proveedor_catalogo: { id: number; nombre: string; rut: string } | null;
  validacion: {
    items_matched: ImportItemMatch[];
    items_unmatched: ParsedItem[];
    items_faltantes_en_sc: Array<{
      id: number;
      solicitud_item_id: number;
      nombre_material: string;
      cantidad_requerida: number;
      unidad: string;
      codigo: string | null;
    }>;
    resumen: {
      total_items_archivo: number;
      total_items_sc: number;
      total_matched: number;
      total_unmatched: number;
      total_faltantes: number;
      total_archivo: number;
      diferencia: number;
      warning: string | null;
    };
  };
}

// --- Órdenes de Compra ---

export type EstadoEntrega = 'Pendiente' | 'Recibido parcial' | 'Completado';
export type DescuentoTipo = 'none' | 'porcentaje' | 'monto';

export interface OrdenCompra {
  id: number;
  solicitud_cotizacion_id: number;
  fecha_emision: string;
  folio: string;
  condiciones_pago: string;
  plazo_entrega?: string;
  condiciones_entrega?: string;
  atencion_a?: string;
  observaciones?: string;
  descuento_tipo: DescuentoTipo;
  descuento_valor: number;
  descuento_monto: number;
  subtotal_neto: number;
  impuesto_monto: number;
  total_final: number;
  estado_entrega: EstadoEntrega;
  total: number;
  proveedor?: string;
  proveedor_rut?: string;
  proveedor_razon_social?: string;
  proveedor_direccion?: string;
  proveedor_telefono?: string;
  proveedor_correo?: string;
  proveedor_contacto_nombre?: string;
  proveedor_contacto_telefono?: string;
  proveedor_contacto_correo?: string;
  proyecto_nombre?: string;
  proyecto_ubicacion?: string;
  proyecto_numero_licitacion?: string;
  proyecto_descripcion_licitacion?: string;
  created_at: string;
  updated_at: string;
}

export interface OrdenCompraInput {
  solicitud_cotizacion_id: number;
  condiciones_pago?: string;
  folio?: string;
  descuento_tipo?: DescuentoTipo;
  descuento_valor?: number;
  plazo_entrega?: string;
  condiciones_entrega?: string;
  atencion_a?: string;
  observaciones?: string;
}

// --- Dashboard KPIs ---

export interface KPISolicitudesMensual {
  pendientes: number;
  atendidas: number;
  total: number;
}

export interface KPIGastoPorProyecto {
  proyecto: string;
  total_ordenes: number;
  gasto_total: number;
}

export interface KPITiempoConversion {
  promedio_dias: number;
  min_dias: number;
  max_dias: number;
}

export interface DashboardStats {
  solicitudes_mensual: KPISolicitudesMensual;
  gasto_por_proyecto: KPIGastoPorProyecto[];
  tiempo_conversion: KPITiempoConversion;
}

// --- Presupuestos ---

export interface PresupuestoCategoria {
  id: number;
  presupuesto_id: number;
  nombre: string;
  monto_asignado: number;
  monto_comprometido: number;
  monto_disponible?: number;
  porcentaje_uso?: number;
  created_at: string;
  updated_at: string;
}

export interface PresupuestoProyecto {
  id: number;
  proyecto_id: number;
  proyecto_nombre?: string;
  monto_total: number;
  monto_comprometido: number;
  monto_disponible?: number;
  porcentaje_uso?: number;
  umbral_alerta: number;
  estado: 'Borrador' | 'Vigente' | 'Cerrado';
  created_at: string;
  updated_at: string;
}

export interface PresupuestoDetalle extends PresupuestoProyecto {
  categorias: PresupuestoCategoria[];
}

export interface PresupuestoInput {
  proyecto_id: number;
  monto_total: number;
  umbral_alerta?: number;
  estado?: 'Borrador' | 'Vigente' | 'Cerrado';
  categorias?: Array<{ nombre: string; monto_asignado: number }>;
}

export interface PresupuestoAlerta {
  proyecto_id: number;
  proyecto_nombre: string;
  presupuesto_id: number;
  monto_total: number;
  monto_comprometido: number;
  umbral_alerta: number;
  porcentaje_uso: number;
  estado_alerta: 'OK' | 'Umbral alcanzado' | 'Sobreconsumo' | 'Sin presupuesto';
}

// --- Notificaciones ---

export type TipoNotificacion =
  | 'orden.generada'
  | 'presupuesto.umbral'
  | 'presupuesto.sobreconsumo';

export interface Notificacion {
  id: number;
  usuario_destino_id: number;
  tipo: TipoNotificacion | string;
  titulo: string;
  mensaje: string;
  entidad_tipo?: string;
  entidad_id?: number;
  payload?: Record<string, any>;
  enviado_por_usuario_id?: number;
  enviado_por_nombre?: string;
  leida: boolean;
  leida_at?: string;
  created_at: string;
}
// --- Materiales (Maestro) ---

export interface UnidadMedida {
  id: number;
  nombre: string;
  abreviatura: string;
  created_at: string;
}

export interface MaterialCategoria {
  id: number;
  nombre: string;
  descripcion?: string;
  created_at: string;
}

export interface Material {
  id: number;
  sku: string;
  nombre: string;
  descripcion?: string;
  unidad_medida_id: number;
  unidad_nombre?: string;
  unidad_abreviatura?: string;
  categoria_id?: number;
  categoria_nombre?: string;
  categoria?: string;
  precio_referencial?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MaterialInput {
  sku?: string;
  nombre: string;
  descripcion?: string;
  unidad_medida_id: number;
  categoria_id?: number | null;
  categoria?: string;
  precio_referencial?: number;
  is_active?: boolean;
}
