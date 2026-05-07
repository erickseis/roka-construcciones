export interface DashboardSolicitudesMensual {
  pendientes: number;
  cotizando: number;
  aprobadas: number;
  atendidas: number;
  total: number;
}

export interface DashboardGastoPorProyecto {
  proyecto: string;
  total_ordenes: number;
  gasto_total: number;
}

export interface DashboardTiempoConversion {
  promedio_dias: number;
  min_dias: number;
  max_dias: number;
}

export interface DashboardSolicitudUrgente {
  id: number;
  solicitante: string;
  estado: string;
  fecha_requerida: string | null;
  created_at: string;
  proyecto_nombre: string;
  proyecto_id: number;
  total_items: number;
  dias_restantes: number | null;
}

export interface DashboardResumen {
  solicitudes_mensual: DashboardSolicitudesMensual;
  gasto_por_proyecto: DashboardGastoPorProyecto[];
  tiempo_conversion: DashboardTiempoConversion;
  solicitudes_urgentes: DashboardSolicitudUrgente[];
}
