import { Queryable } from './index';

export interface Solicitud {
  id: number;
  proyecto_id: number;
  solicitante: string;
  fecha: string;
  estado: string;
  created_at: Date;
  updated_at: Date;
  proyecto_nombre?: string;
  total_items?: number;
  presupuesto_categoria_id?: number | null;
}

export interface SolicitudItem {
  id: number;
  solicitud_id: number;
  material_id: number | null;
  nombre_material: string;
  cantidad_requerida: number;
  unidad: string;
  material_oficial_nombre?: string;
  material_sku?: string;
  precio_referencial?: number;
  unidad_abreviatura?: string;
}

export interface CreateSolicitudInput {
  proyecto_id: number;
  solicitante: string;
  fecha?: string;
  items: Array<{
    material_id?: number;
    nombre_material?: string;
    cantidad_requerida: number;
    unidad?: string;
  }>;
}

export interface UpdateEstadoInput {
  estado: 'Pendiente' | 'Cotizando' | 'Aprobado';
}
