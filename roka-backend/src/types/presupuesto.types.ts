export interface PresupuestoProyecto {
  id: number;
  proyecto_id: number;
  monto_total: number;
  monto_comprometido: number;
  umbral_alerta: number;
  estado: string;
  created_at: Date;
  updated_at: Date;
  proyecto_nombre?: string;
  proyecto_estado?: string;
  gasto_total?: number;
  porcentaje_uso?: number;
  monto_disponible?: number;
}

export interface PresupuestoCategoria {
  id: number;
  presupuesto_id: number;
  nombre: string;
  monto_asignado: number;
  monto_comprometido: number;
  created_at: Date;
  updated_at: Date;
  monto_disponible?: number;
  porcentaje_uso?: number;
}

export interface PresupuestoAlerta {
  proyecto_id: number;
  proyecto_nombre: string;
  presupuesto_id: number;
  monto_total: number;
  monto_comprometido: number;
  umbral_alerta: number;
  porcentaje_uso: number;
  estado_alerta: string;
}

export interface CreatePresupuestoInput {
  proyecto_id: number;
  monto_total: number;
  umbral_alerta?: number;
  estado?: string;
  categorias?: Array<{ nombre: string; monto_asignado: number }>;
}

export interface ComprometerInput {
  presupuesto_id: number;
  categoria_id?: number;
  monto: number;
  descripcion?: string;
}
