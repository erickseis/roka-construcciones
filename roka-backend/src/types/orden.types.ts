import { Queryable } from './index';

export interface OrdenCompra {
  id: number;
  solicitud_cotizacion_id: number | null;
  proyecto_id: number | null;
  proveedor: string | null;
  proveedor_rut: string | null;
  proveedor_direccion: string | null;
  proveedor_telefono: string | null;
  proveedor_correo: string | null;
  condiciones_pago: string | null;
  total: number;
  folio: string | null;
  descuento_tipo: string;
  descuento_valor: number;
  descuento_monto: number;
  subtotal_neto: number;
  impuesto_monto: number;
  total_final: number;
  plazo_entrega: string | null;
  condiciones_entrega: string | null;
  atencion_a: string | null;
  observaciones: string | null;
  estado_entrega: string;
  created_by_usuario_id: number | null;
  autorizado_por_usuario_id?: number | null;
  solicitud_id?: number | null;
  codigo_obra?: string | null;
  created_at: Date;
  updated_at: Date;
  proyecto_nombre?: string;
}

export interface OrdenCompraDetalle extends OrdenCompra {
  sc_total: number;
  solicitante: string;
  fecha_solicitud: string;
  solicitud_estado: string;
  proyecto_ubicacion: string | null;
  proyecto_numero_licitacion: string | null;
  proyecto_numero_obra?: string | null;
  proyecto_descripcion_licitacion: string | null;
  proveedor_rut: string | null;
  proveedor_razon_social: string | null;
  proveedor_direccion: string | null;
  proveedor_telefono: string | null;
  proveedor_correo: string | null;
  proveedor_contacto_nombre: string | null;
  proveedor_contacto_telefono: string | null;
  proveedor_contacto_correo: string | null;
  autorizado_por_nombre: string | null;
  proveedor_id: number | null;
}

export interface OrdenItem {
  id: number;
  solicitud_cotizacion_detalle_id?: number;
  solicitud_item_id: number;
  precio_unitario: number;
  subtotal: number;
  descuento_porcentaje?: number;
  codigo_proveedor?: string;
  nombre_material?: string;
  cantidad_requerida?: number;
  unidad?: string;
  material_sku?: string;
}

export interface GenerarOCInput {
  solicitud_cotizacion_id: number;
  condiciones_pago?: string;
  folio?: string;
  descuento_tipo?: string;
  descuento_valor?: number;
  plazo_entrega?: string;
  condiciones_entrega?: string;
  atencion_a?: string;
  observaciones?: string;
  autorizado_por_usuario_id?: number | null;
  codigo_obra?: string;
}
