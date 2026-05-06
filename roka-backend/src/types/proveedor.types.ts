export interface Proveedor {
  id: number;
  rut: string | null;
  nombre: string;
  razon_social: string | null;
  direccion: string | null;
  telefono: string | null;
  correo: string | null;
  contacto_nombre: string | null;
  contacto_telefono: string | null;
  contacto_correo: string | null;
  condiciones_pago: string | null;
  condicion_despacho: string | null;
  plazo_entrega: string | null;
  moneda: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProveedorInput {
  rut?: string | null;
  nombre: string;
  razon_social?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  correo?: string | null;
  contacto_nombre?: string | null;
  contacto_telefono?: string | null;
  contacto_correo?: string | null;
  condiciones_pago?: string | null;
  condicion_despacho?: string | null;
  plazo_entrega?: string | null;
  moneda?: string | null;
}

export interface UpdateProveedorInput extends Partial<CreateProveedorInput> {
  is_active?: boolean;
}
