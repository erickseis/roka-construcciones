export interface ConfigDepartamento {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface ConfigCargo {
  id: number;
  nombre: string;
  departamento_id: number;
  departamento_nombre?: string;
}

export interface ConfigRol {
  id: number;
  nombre: string;
}

export interface Permiso {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
}
