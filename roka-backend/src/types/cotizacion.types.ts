import { Queryable } from './index';

export interface Cotizacion {
  id: number;
  solicitud_id: number;
  solicitud_cotizacion_id: number | null;
  proveedor_id: number | null;
  proveedor: string;
  total: number;
  estado: string;
  archivo_adjunto_path: string | null;
  archivo_adjunto_nombre: string | null;
  created_by_usuario_id: number | null;
  created_at: Date;
  updated_at: Date;
  solicitante?: string;
  proyecto_nombre?: string;
  fecha_solicitud?: string;
  numero_cov?: string | null;
  imported_from_file?: boolean;
  datos_importados?: Record<string, any> | null;
  metodo_importacion?: string;
}

export interface CotizacionItem {
  id: number;
  cotizacion_id: number;
  solicitud_item_id: number;
  precio_unitario: number;
  subtotal: number;
  nombre_material?: string;
  cantidad_requerida?: number;
  unidad?: string;
  descuento_porcentaje?: number;
  codigo_proveedor?: string | null;
}

export interface CreateCotizacionInput {
  solicitud_id: number;
  solicitud_cotizacion_id?: number;
  proveedor_id?: number;
  proveedor?: string;
  items: Array<{
    solicitud_item_id: number;
    precio_unitario: number;
    descuento_porcentaje?: number;
    codigo_proveedor?: string;
  }>;
  archivo_adjunto_path?: string;
  archivo_adjunto_nombre?: string;
  numero_cov?: string;
  imported_from_file?: boolean;
  metodo_importacion?: 'manual' | 'pdf' | 'excel' | 'imagen';
  datos_importados?: Record<string, any>;
}

export interface ValidatedCotizacionItem {
  solicitud_item_id: number;
  precio_unitario: number;
  subtotal: number;
}
