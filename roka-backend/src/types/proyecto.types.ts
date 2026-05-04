export interface Proyecto {
  id: number;
  nombre: string;
  ubicacion: string | null;
  estado: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  responsable_usuario_id: number | null;
  numero_licitacion: string | null;
  descripcion_licitacion: string | null;
  fecha_apertura_licitacion: string | null;
  monto_referencial_licitacion: number | null;
  archivo_licitacion_path: string | null;
  archivo_licitacion_nombre: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  responsable_nombre?: string;
}

export interface ProyectoConDetalle extends Proyecto {
  resumen_presupuesto: {
    monto_total: number;
    monto_comprometido: number;
    monto_disponible: number;
    porcentaje_uso: number;
  };
  metricas: {
    total_solicitudes: number;
    total_cotizaciones: number;
    total_ordenes: number;
    gasto_total_oc: number;
  };
}

export interface CreateProyectoInput {
  nombre: string;
  ubicacion?: string | null;
  estado?: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  responsable_usuario_id?: number | null;
  numero_licitacion?: string | null;
  descripcion_licitacion?: string | null;
  fecha_apertura_licitacion?: string | null;
  monto_referencial_licitacion?: number | null;
  archivo_licitacion_path?: string | null;
  archivo_licitacion_nombre?: string | null;
}
