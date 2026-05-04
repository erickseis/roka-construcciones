export interface UnidadMedida {
  id: number;
  nombre: string;
  abreviatura: string;
}

export interface MaterialCategoria {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface Material {
  id: number;
  sku: string | null;
  nombre: string;
  descripcion: string | null;
  unidad_medida_id: number;
  categoria_id: number | null;
  categoria: string | null;
  precio_referencial: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  unidad_nombre?: string;
  unidad_abreviatura?: string;
  categoria_nombre?: string;
}

export interface SolicitudItemJoined {
  id: number;
  solicitud_id: number;
  material_id: number | null;
  nombre_material: string;
  cantidad_requerida: number;
  unidad: string;
  proyecto_id?: number;
  proyecto_nombre?: string;
  solicitante?: string;
  fecha?: string;
  estado?: string;
}
