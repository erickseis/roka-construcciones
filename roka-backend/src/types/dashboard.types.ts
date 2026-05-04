export interface DashboardSolicitudesMensual {
  pendientes: number;
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

export interface DashboardResumen {
  solicitudes_mensual: DashboardSolicitudesMensual;
  gasto_por_proyecto: DashboardGastoPorProyecto[];
  tiempo_conversion: DashboardTiempoConversion;
}
