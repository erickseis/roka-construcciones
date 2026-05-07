/**
 * Estructura de un ítem parseado del archivo del proveedor
 */
export interface ParsedItem {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precio_neto_unitario: number;
  descuento_porcentaje: number;
  total_linea: number;
}

/**
 * Estructura completa parseada del documento de cotización
 */
export interface ParsedQuotation {
  proveedor_rut: string;
  proveedor_nombre: string;
  proveedor_direccion: string | null;
  proveedor_telefono: string | null;
  proveedor_correo: string | null;
  numero_cov: string;
  fecha: string;
  vendedor: string | null;
  validez: string | null;
  items: ParsedItem[];
  condicion_pago: string | null;
  condicion_entrega: string | null;
  subtotal_neto: number;
  iva: number;
  total: number;
  observaciones: string | null;
  descuento_global_porcentaje: number | null;
  descuento_global_monto: number | null;
}

/**
 * Ítem de la SC para matching
 */
export interface SCItemForMatch {
  id: number;
  solicitud_item_id: number;
  nombre_material: string;
  cantidad_requerida: number;
  unidad: string;
  codigo: string | null;
}

/**
 * Resultado de matching de un ítem
 */
export interface ImportItemMatch {
  parsed: ParsedItem;
  solicitud_item: SCItemForMatch | null;
  match_tipo: 'exact_code' | 'similar_name' | 'none';
  cantidad_ok: boolean;
  warning: string | null;
}

/**
 * Respuesta del endpoint de parseo/validación (preview)
 */
export interface ImportPreviewResponse {
  parsed: ParsedQuotation;
  solicitud_cotizacion_id: number;
  solicitud_id: number;
  proveedor_catalogo: { id: number; nombre: string; rut: string } | null;
  archivo_path: string;
  archivo_nombre: string;
  validacion: {
    items_matched: ImportItemMatch[];
    items_unmatched: ParsedItem[];
    items_faltantes_en_sc: SCItemForMatch[];
    resumen: {
      total_items_archivo: number;
      total_items_sc: number;
      total_matched: number;
      total_unmatched: number;
      total_faltantes: number;
      total_archivo: number;
      diferencia: number;
      warning: string | null;
    };
  };
}

/**
 * Input para confirmar y crear la cotización importada
 */
export interface ConfirmImportInput {
  solicitud_id: number;
  solicitud_cotizacion_id: number;
  archivo_path: string;
  archivo_nombre: string;
  proveedor_id?: number;
  proveedor_nombre: string;
  numero_cov: string;
  metodo_importacion: 'pdf' | 'excel' | 'imagen';
  items: Array<{
    solicitud_item_id: number;
    precio_unitario: number;
    descuento_porcentaje: number;
    codigo_proveedor: string;
  }>;
  datos_importados: Record<string, any>;
}