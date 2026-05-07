import React, { useState, useRef } from 'react';
import { Modal } from '../ui/Modal';
import { importarCotizacionArchivo, confirmImportCotizacion } from '@/lib/api';
import { Upload, FileText, AlertCircle, CheckCircle, XCircle, Loader2, FileSpreadsheet, FileImage, File } from 'lucide-react';
import type { ImportPreviewResponse, ImportItemMatch, ParsedItem } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitudCotizacionId: number;
  solicitudId: number;
  proveedor: string;
  items: { id: number; solicitud_item_id: number; nombre_material: string; cantidad_requerida: number; unidad: string; codigo?: string | null }[];
  onSuccess: () => void;
}

type Stage = 'upload' | 'preview' | 'success';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export default function ImportarCotizacionVentaModal({
  isOpen,
  onClose,
  solicitudCotizacionId,
  solicitudId,
  proveedor,
  items,
  onSuccess,
}: Props) {
  const [stage, setStage] = useState<Stage>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [cotizacionId, setCotizacionId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setStage('upload');
    setSelectedFile(null);
    setError(null);
    setPreviewData(null);
    setCotizacionId(null);
    onClose();
  };

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Tipo de archivo no soportado. Use PDF, Excel o imágenes (PNG, JPG, WEBP)';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'El archivo excede el tamaño máximo de 20MB';
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      setFileMimeType('');
      return;
    }
    setError(null);
    setSelectedFile(file);
    setFileMimeType(file.type);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.add('border-blue-500', 'bg-blue-50');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) {
      dragRef.current.classList.remove('border-blue-500', 'bg-blue-50');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const result = await importarCotizacionArchivo(selectedFile, solicitudCotizacionId);
      setPreviewData(result);
      setStage('preview');
    } catch (err: any) {
      setError(err.message || 'Error al analizar el archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!previewData) return;
    setConfirming(true);
    setError(null);

    try {
      const matchedItems = previewData.validacion.items_matched.filter(m => m.solicitud_item !== null);
      const payload = {
        solicitud_id: solicitudId,
        solicitud_cotizacion_id: solicitudCotizacionId,
        archivo_path: previewData.archivo_path,
        archivo_nombre: previewData.archivo_nombre,
        proveedor_id: previewData.proveedor_catalogo?.id,
        proveedor_nombre: previewData.parsed.proveedor_nombre,
        numero_cov: previewData.parsed.numero_cov,
        metodo_importacion: fileMimeType.includes('pdf') ? 'pdf' : fileMimeType.includes('sheet') || fileMimeType.includes('excel') ? 'excel' : 'imagen',
        items: matchedItems.map(m => ({
          solicitud_item_id: m.solicitud_item!.solicitud_item_id,
          precio_unitario: m.parsed.precio_neto_unitario,
          descuento_porcentaje: m.parsed.descuento_porcentaje || 0,
          codigo_proveedor: m.parsed.codigo || '',
        })),
        datos_importados: {
          fecha: previewData.parsed.fecha,
          vendedor: previewData.parsed.vendedor,
          validez: previewData.parsed.validez,
          condicion_pago: previewData.parsed.condicion_pago,
          condicion_entrega: previewData.parsed.condicion_entrega,
          subtotal_neto: previewData.parsed.subtotal_neto,
          iva: previewData.parsed.iva,
          total_documento: previewData.parsed.total,
          descuento_global_porcentaje: previewData.parsed.descuento_global_porcentaje,
          descuento_global_monto: previewData.parsed.descuento_global_monto,
          observaciones: previewData.parsed.observaciones,
        },
      };

      const result = await confirmImportCotizacion(payload);
      setCotizacionId(result.id);
      setStage('success');
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Error al confirmar la importación');
    } finally {
      setConfirming(false);
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <File className="h-8 w-8 text-slate-400" />;
    if (selectedFile.type === 'application/pdf') return <FileText className="h-8 w-8 text-red-500" />;
    if (selectedFile.type.includes('spreadsheet') || selectedFile.type.includes('excel')) return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
    if (selectedFile.type.includes('image')) return <FileImage className="h-8 w-8 text-blue-500" />;
    return <File className="h-8 w-8 text-slate-400" />;
  };

  const getMatchIcon = (match: ImportItemMatch) => {
    if (match.match_tipo === 'exact_code') {
      return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    }
    if (match.match_tipo === 'similar_name') {
      return <AlertCircle className="h-5 w-5 text-amber-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  const getMatchLabel = (match: ImportItemMatch) => {
    if (match.match_tipo === 'exact_code') return 'Código exacto';
    if (match.match_tipo === 'similar_name') return 'Nombre similar';
    return 'Sin coincidencia';
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Upload Stage
  if (stage === 'upload') {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Importar Cotización de Venta" size="lg">
        <div className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
            <p className="font-medium">Sube la cotización en PDF, Excel o imagen</p>
            <p className="mt-1 text-blue-600">
              El sistema analizará automáticamente los ítems y los emparejará con la Solicitud de Cotización SC-{String(solicitudCotizacionId).padStart(3, '0')}
            </p>
          </div>

          <div
            ref={dragRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/50 ${
              selectedFile ? 'border-emerald-400 bg-emerald-50/50' : ''
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              {getFileIcon()}
              {selectedFile ? (
                <div>
                  <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    Arrastra un archivo aquí o <span className="text-blue-600">haz clic para seleccionar</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">PDF, Excel, PNG, JPG, WEBP (máx. 20MB)</p>
                </div>
              )}
            </div>
          </div>

          {selectedFile && (
            <button
              onClick={handleAnalyze}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando archivo...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Analizar archivo
                </>
              )}
            </button>
          )}
        </div>
      </Modal>
    );
  }

  // Preview Stage
  if (stage === 'preview' && previewData) {
    const { parsed, validacion, proveedor_catalogo } = previewData;
    const providerMatch = proveedor_catalogo && proveedor_catalogo.nombre.toLowerCase() === parsed.proveedor_nombre.toLowerCase();

    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Vista Previa de Importación" size="xl">
        <div className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Proveedor detectado</p>
              <div className="mt-1">
                <p className="text-sm font-bold text-slate-800">{parsed.proveedor_nombre}</p>
                <p className="text-xs text-slate-500">RUT: {parsed.proveedor_rut}</p>
                {providerMatch ? (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    <CheckCircle size={10} /> Coincide con catálogo
                  </span>
                ) : (
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                    <AlertCircle size={10} /> No coincide con proveedor SC
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">N° COV</p>
              <p className="text-sm font-bold text-slate-800">{parsed.numero_cov || 'No detectado'}</p>
              <p className="mt-2 text-[10px] font-bold uppercase text-slate-400">Fecha</p>
              <p className="text-xs text-slate-600">{parsed.fecha || 'No detectada'}</p>
            </div>
          </div>

          {/* Matched Items Table */}
          {validacion.items_matched.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Ítems emparejados ({validacion.items_matched.length})
                </h4>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-500 w-8">Est.</th>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Código Prov.</th>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Descripción (Archivo)</th>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Material SC</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Cant.</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-500">UM</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-500">P. Unit.</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Dsct%</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validacion.items_matched.map((match, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="px-2 py-2" title={getMatchLabel(match)}>
                          {getMatchIcon(match)}
                        </td>
                        <td className="px-2 py-2 font-mono text-slate-600">{match.parsed.codigo || '-'}</td>
                        <td className="px-2 py-2 text-slate-700 max-w-[150px] truncate" title={match.parsed.descripcion}>
                          {match.parsed.descripcion}
                        </td>
                        <td className="px-2 py-2 text-slate-700">
                          {match.solicitud_item ? (
                            <span className={!match.cantidad_ok ? 'text-amber-600' : ''}>
                              {match.solicitud_item.nombre_material}
                            </span>
                          ) : (
                            <span className="text-red-500">No encontrado</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right font-mono">
                          <span className={!match.cantidad_ok ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                            {match.parsed.cantidad.toLocaleString()}
                          </span>
                          {match.solicitud_item && match.parsed.cantidad !== match.solicitud_item.cantidad_requerida && (
                            <span className="block text-[9px] text-slate-400">
                              SC: {match.solicitud_item.cantidad_requerida}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right text-slate-500">{match.parsed.unidad}</td>
                        <td className="px-2 py-2 text-right font-mono font-medium text-slate-800">
                          {formatCurrency(match.parsed.precio_neto_unitario)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-600">
                          {match.parsed.descuento_porcentaje > 0 ? `${match.parsed.descuento_porcentaje}%` : '-'}
                        </td>
                        <td className="px-2 py-2 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(match.parsed.total_linea)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unmatched Items */}
          {validacion.items_unmatched.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Ítems sin coincidencia en SC ({validacion.items_unmatched.length})
                </h4>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50/50 overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-red-100/50">
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-red-600">Código</th>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-red-600">Descripción</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-red-600">Cant.</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-red-600">Precio</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-red-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validacion.items_unmatched.map((item, idx) => (
                      <tr key={idx} className="border-t border-red-100">
                        <td className="px-2 py-2 font-mono text-slate-600">{item.codigo || '-'}</td>
                        <td className="px-2 py-2 text-slate-700">{item.descripcion}</td>
                        <td className="px-2 py-2 text-right font-mono">{item.cantidad.toLocaleString()}</td>
                        <td className="px-2 py-2 text-right font-mono">{formatCurrency(item.precio_neto_unitario)}</td>
                        <td className="px-2 py-2 text-right font-mono font-bold">{formatCurrency(item.total_linea)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Missing Items from SC */}
          {validacion.items_faltantes_en_sc.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Ítems de SC no encontrados en el archivo ({validacion.items_faltantes_en_sc.length})
                </h4>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 overflow-hidden">
                <table className="min-w-full text-xs">
                  <thead className="bg-amber-100/50">
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-amber-700">Código</th>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-amber-700">Material</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase text-amber-700">Cant. SC</th>
                      <th className="px-2 py-2 text-left text-[10px] font-bold uppercase text-amber-700">UM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validacion.items_faltantes_en_sc.map((item) => (
                      <tr key={item.id} className="border-t border-amber-100">
                        <td className="px-2 py-2 font-mono text-slate-600">{item.codigo || '-'}</td>
                        <td className="px-2 py-2 text-slate-700">{item.nombre_material}</td>
                        <td className="px-2 py-2 text-right font-mono">{item.cantidad_requerida.toLocaleString()}</td>
                        <td className="px-2 py-2 text-slate-500">{item.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Financial Summary */}
          <div className="rounded-lg bg-slate-50 p-4">
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-600">Resumen Financiero</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Subtotal Neto</p>
                <p className="text-lg font-mono font-bold text-slate-800">{formatCurrency(parsed.subtotal_neto)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">IVA (19%)</p>
                <p className="text-lg font-mono font-bold text-slate-600">{formatCurrency(parsed.iva)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400">Total</p>
                <p className="text-lg font-mono font-black text-blue-700">{formatCurrency(parsed.total)}</p>
              </div>
            </div>
          </div>

          {/* Validation Summary */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[10px] text-slate-500">Total ítems archivo</p>
              <p className="font-bold text-slate-800">{validacion.resumen.total_items_archivo}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
              <p className="text-[10px] text-emerald-600">Emparejados</p>
              <p className="font-bold text-emerald-700">{validacion.resumen.total_matched}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50/50 p-2">
              <p className="text-[10px] text-red-600">Sin coincidencia</p>
              <p className="font-bold text-red-700">{validacion.resumen.total_unmatched}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2">
              <p className="text-[10px] text-amber-600">Faltantes en SC</p>
              <p className="font-bold text-amber-700">{validacion.resumen.total_faltantes}</p>
            </div>
          </div>

          {/* Warning */}
          {validacion.resumen.warning && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              <AlertCircle size={14} />
              <span>{validacion.resumen.warning}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between border-t border-slate-100 pt-4">
            <button
              onClick={() => setStage('upload')}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              ← Volver a subir
            </button>
            <div className="flex gap-3">
              <button onClick={handleClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || validacion.items_matched.length === 0}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-60"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Confirmar y crear Cotización
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // Success Stage
  if (stage === 'success') {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="¡Importación Exitosa!" size="md">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Cotización creada correctamente</h3>
          <p className="mt-2 text-sm text-slate-600">
            Cotización #{cotizacionId ? String(cotizacionId).padStart(3, '0') : '---'} generada desde archivo
          </p>
          <p className="mt-4 text-xs text-slate-400">Esta ventana se cerrará automáticamente...</p>
        </div>
      </Modal>
    );
  }

  return null;
}
