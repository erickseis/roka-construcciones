export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  rut: string;
  correo: string;
  password_hash: string;
  rol_id: number;
  departamento_id: number | null;
  cargo_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  rol_nombre?: string;
}

export interface UsuarioPublic {
  id: number;
  nombre: string;
  apellido: string;
  rut: string;
  correo: string;
  rol_id: number;
  departamento_id: number | null;
  cargo_id: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  rol_nombre?: string;
}

export interface LoginInput {
  correo: string;
  password: string;
}

export interface LoginResult {
  message: string;
  token: string;
  user: UsuarioPublic;
}

export interface JwtPayload {
  id: number;
  correo: string;
  rol_id: number;
}
