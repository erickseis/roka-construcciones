export interface Notificacion {
  id: number;
  usuario_destino_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  entidad_tipo: string | null;
  entidad_id: number | null;
  payload: Record<string, any> | null;
  leida: boolean;
  leida_at: Date | null;
  enviado_por_usuario_id: number | null;
  created_at: Date;
  enviado_por_nombre?: string;
}
