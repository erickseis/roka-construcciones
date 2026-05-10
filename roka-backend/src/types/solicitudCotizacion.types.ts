import { Queryable } from './index';

export interface SolicitudCotizacion {
  id: number;
  solicitud_id: number;
  proveedor_id: number | null;
  proveedor: string;
  estado: string;
  observaciones: string | null;
  created_by_usuario_id: number | null;
  created_at: Date;
  updated_at: Date;
  proyecto_nombre?: string;
  solicitante?: string;
  fecha_solicitud?: string;
  solicitud_estado?: string;
}

export interface SolicitudCotizacionDetalle {
  id: number;
  solicitud_cotizacion_id: number;
  solicitud_item_id: number;
  nombre_material?: string;
  cantidad_requerida?: number;
  unidad?: string;
}

export interface SolicitudCotizacionConItems extends SolicitudCotizacion {
  items: SolicitudCotizacionDetalle[];
}

export interface CreateSolicitudCotizacionInput {
  solicitud_id: number;
  proveedor_id?: number;
  proveedor?: string;
  solicitud_item_ids: number[];
  observaciones?: string;
}

export interface BatchCreateSolicitudCotizacionInput {
  solicitud_id: number;
  asignaciones: {
    proveedor_id?: number;
    proveedor: string;
    solicitud_item_ids: number[];
  }[];
  observaciones?: string;
}

export interface SolicitudCotizacionFilters {
  solicitud_id?: number;
  estado?: string;
  proveedor?: string;
  proyecto_id?: number;
}
