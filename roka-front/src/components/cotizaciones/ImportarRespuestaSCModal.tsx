import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Upload, Check, AlertCircle, Loader2, AlertTriangle, FileText, Building2 } from 'lucide-react';
import { importarRespuestaSC, confirmarImportacionSC } from '@/lib/api';
import { showAlert, showToast } from '@/lib/alerts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitudCotizacionId: number;
  scItems: any[];
  solicitudData?: any;
  onSuccess: () => void;
}

type MatchConfidence = 'high' | 'medium' | 'low' | 'none';

const confidenceBadge: Record<MatchConfidence, { bg: string; text: string; label: string; border: string }> = {
  high: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Match exacto', border: 'border-emerald-400' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Match parcial', border: 'border-amber-400' },
  low: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'Match bajo', border: 'border-orange-400' },
  none: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: 'Sin respuesta', border: 'border-red-400' },
};

interface EditedPrices {
  [index: number]: number;
}

export default function ImportarRespuestaSCModal({ isOpen, onClose, solicitudCotizacionId, scItems, solicitudData, onSuccess }: Props) {
  const [step, setStep] = useState<'upload' | 'processing' | 'preview' | 'confirming'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [editedPrices, setEditedPrices] = useState<EditedPrices>({});
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preview) setEditedPrices({});
  }, [preview]);

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setStep('processing');
    try {
      const result = await importarRespuestaSC(solicitudCotizacionId, file);
      setPreview(result);
      setStep('preview');
      showToast({
        title: 'Cotización importada correctamente',
        icon: 'success'
      });
    } catch (err: any) {
      showAlert({
        title: 'Error de Importación',
        text: err.message || 'Error al procesar la respuesta del proveedor.',
        icon: 'error'
      });
      setStep('upload');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setStep('confirming');
    setError(null);
    try {
      const confirmedItems = preview.items
        .filter((item: any, idx: number) => item.solicitud_item_id && (editedPrices[idx] !== undefined || item.precio_unitario))
        .map((item: any, idx: number) => {
          const price = editedPrices[idx] !== undefined ? editedPrices[idx] : item.precio_unitario;
          return {
            solicitud_item_id: item.solicitud_item_id,
            precio_unitario: price,
            descuento_porcentaje: item.descuento_porcentaje,
            codigo_proveedor: item.codigo_proveedor,
          };
        });

      await confirmarImportacionSC({
        solicitud_cotizacion_id: solicitudCotizacionId,
        archivo_path: preview.archivo_path,
        archivo_nombre: preview.archivo_nombre,
        numero_cov: preview.numero_cov,
        proveedor_nombre: preview.proveedor_nombre,
        items: confirmedItems,
      });

      onSuccess();
      onClose();
      setStep('upload');
      setFile(null);
      setPreview(null);
      setEditedPrices({});
    } catch (err: any) {
      setError(err.message || 'Error al confirmar importación');
      setStep('preview');
    }
  };

  const handlePriceEdit = (index: number, value: number) => {
    setEditedPrices(prev => ({ ...prev, [index]: value }));
  };

  const formatCLP = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency', currency: 'CLP',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(value);
  };

  const getItemPrice = (item: any, index: number): number => {
    return editedPrices[index] !== undefined ? editedPrices[index] : (item.precio_unitario || 0);
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setError(null);
    onClose();
  };

  const buildComparison = () => {
    if (!preview?.items) return { matched: [], unmatched: [] };
    const providerItems = preview.items as any[];

    const matched = scItems.map((scItem: any) => {
      const provItem = providerItems.find((pi: any) => pi.solicitud_item_id === scItem.solicitud_item_id);
      const provIdx = provItem ? providerItems.indexOf(provItem) : -1;
      return { scItem, provItem: provItem || null, provIdx };
    });

    const matchedIds = new Set(providerItems.filter((pi: any) => pi.solicitud_item_id).map((pi: any) => pi.solicitud_item_id));
    const unmatched = providerItems
      .map((pi: any, idx: number) => ({ provItem: pi, provIdx: idx }))
      .filter(({ provItem }) => !provItem.solicitud_item_id || !matchedIds.has(provItem.solicitud_item_id) || provItem.match_confidence === 'none');

    return { matched, unmatched };
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}
      title="Cargar Respuesta del Proveedor"
      subtitle="Importa la cotización de venta recibida del proveedor"
      size={step === 'preview' ? '3xl' : 'lg'}>

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 text-center hover:border-amber-400 dark:hover:border-amber-500 transition-colors">
            <Upload size={32} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Arrastra o selecciona el archivo de cotización</p>
            <p className="text-xs text-slate-400 mt-1">PDF, Excel, CSV o imagen (máx 20MB)</p>
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileRef.current?.click()}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600">
              Seleccionar archivo
            </button>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{file.name}</span>
              <button onClick={handleUpload}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
                Procesar archivo
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative mb-4">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-amber-500" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Upload size={20} className="text-amber-500" />
            </div>
          </div>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Procesando archivo...</p>
          <p className="mt-1 text-xs text-slate-400">Analizando documento con IA (Nemotron Omni)</p>
        </div>
      )}

      {step === 'preview' && preview && (() => {
        const { matched, unmatched } = buildComparison();
        const matchedCount = matched.filter(m => m.provItem && m.provItem.match_confidence !== 'none').length;
        const unmatchedCount = scItems.length - matchedCount;
        const totalCalculated = preview.items?.reduce((sum: number, item: any, idx: number) => {
          const price = getItemPrice(item, idx);
          return sum + price * (item.cantidad_extraida || 1);
        }, 0) || 0;

        return (
          <div className="space-y-4">
            {/* Header de Trazabilidad: Proyecto y Proveedor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={14} className="text-slate-400" />
                  <p className="text-[10px] font-bold uppercase text-slate-500">Trazabilidad del Proyecto</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="block text-[10px] text-slate-400">Proyecto</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{solicitudData?.proyecto_nombre || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Solicitud Original</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {solicitudData ? `SOL-${String(solicitudData.solicitud_id).padStart(3, '0')}` : '-'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[10px] text-slate-400">Solicitud de Cotización</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {solicitudData ? `SC-${String(solicitudData.id).padStart(3, '0')}` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-blue-50/50 dark:bg-blue-900/10 p-4 border border-blue-100 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-blue-400" />
                    <p className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Datos Cotización (Proveedor)</p>
                  </div>
                  {/* Moneda vinculada al proveedor (CLP por defecto) */}
                  <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    Moneda: CLP
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="col-span-2">
                    <span className="block text-[10px] text-slate-400">Razón Social Proveedor</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{preview.proveedor_nombre || solicitudData?.proveedor || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">N° Cotización</span>
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{preview.numero_cov || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">RUT Proveedor</span>
                    <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{preview.proveedor_rut || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Condiciones Pago</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{preview.condiciones_pago || '-'}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Total Documento</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCLP(preview.monto_total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen de match */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex-1 text-[11px] font-medium text-slate-500">Resumen de Análisis OCR:</div>
              <div className="flex gap-4">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ {matchedCount} Cotizados</span>
                <span className="text-xs font-bold text-red-500 dark:text-red-400">✗ {unmatchedCount} Faltantes</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-4 border-l pl-4 border-slate-300">Total Calculado: {formatCLP(totalCalculated)}</span>
              </div>
            </div>

            {/* Tabla Moderna */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th colSpan={3} className="p-3 border-b border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20">📋 Solicitado por Proyecto</th>
                    <th colSpan={5} className="p-3 border-b border-l border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/20">🏷️ Cotizado por Proveedor</th>
                  </tr>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2">Material / Descripción</th>
                    <th className="px-3 py-2 w-16 text-center">Cant.</th>
                    <th className="px-3 py-2 w-16 text-center">Unidad</th>
                    
                    <th className="px-3 py-2 border-l border-slate-200 dark:border-slate-700 w-24 text-center">Nivel Match</th>
                    <th className="px-3 py-2">Descripción Cotizada</th>
                    <th className="px-3 py-2 w-24 text-right">P. Unitario</th>
                    <th className="px-3 py-2 w-16 text-center">Desc.</th>
                    <th className="px-3 py-2 w-24 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="text-xs align-top divide-y divide-slate-100 dark:divide-slate-800">
                  {matched.map(({ scItem, provItem, provIdx }, idx) => {
                    const confidence = provItem?.match_confidence as MatchConfidence || 'none';
                    const hasMatch = provItem && confidence !== 'none';
                    const badge = confidenceBadge[confidence];

                    return (
                      <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${!hasMatch ? 'bg-slate-50/50 dark:bg-slate-800/20' : ''}`}>
                        {/* Solicitud Column */}
                        <td className="px-3 py-3 text-slate-800 dark:text-slate-200 font-medium">
                          <div className="flex flex-col">
                            <span>{scItem.nombre_material}</span>
                            {scItem.codigo && (
                              <span className="text-[10px] font-mono text-slate-500 mt-0.5">Cód: {scItem.codigo}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400">
                          {scItem.cantidad_requerida}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500">
                          {scItem.unidad}
                        </td>

                        {/* Proveedor Column */}
                        <td className="px-3 py-3 border-l border-slate-100 dark:border-slate-800 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-[9px] font-bold uppercase ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {hasMatch ? (
                            <div>
                              <span className="text-slate-800 dark:text-slate-200 font-medium block">
                                {provItem.nombre_extraido}
                              </span>
                              <div className="flex gap-2 text-[10px] text-slate-500 mt-1">
                                <span>Cant: {provItem.cantidad_extraida || '-'}</span>
                                <span>Unid: {provItem.unidad_extraida || '-'}</span>
                                {provItem.codigo_proveedor && <span>Cód: {provItem.codigo_proveedor}</span>}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No cotizado</span>
                          )}
                        </td>
                        
                        {/* Precios */}
                        <td className="px-3 py-2 text-right">
                          {hasMatch ? (
                            <input
                              type="number"
                              value={getItemPrice(provItem, provIdx)}
                              onChange={(e) => handlePriceEdit(provIdx, parseFloat(e.target.value) || 0)}
                              className="w-full max-w-[80px] text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus:border-amber-500 focus:outline-none"
                              min="0" step="1"
                            />
                          ) : '-'}
                        </td>
                        <td className="px-3 py-3 text-center text-slate-500">
                          {hasMatch && provItem.descuento_porcentaje ? `${provItem.descuento_porcentaje}%` : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {hasMatch ? formatCLP(getItemPrice(provItem, provIdx) * (provItem.cantidad_extraida || 1)) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Ítems adicionales (No solicitados) */}
                  {unmatched.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={8} className="px-3 py-2 bg-orange-50 dark:bg-orange-900/20 text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400">
                          Ítems adicionales en cotización (No solicitados)
                        </td>
                      </tr>
                      {unmatched.map(({ provItem, provIdx }, idx) => (
                        <tr key={`u-${idx}`} className="bg-orange-50/30 dark:bg-orange-900/10">
                          <td colSpan={3} className="px-3 py-2 text-slate-400 text-center italic">-</td>
                          <td className="px-3 py-2 border-l border-slate-200 dark:border-slate-700 text-center">
                            <span className="inline-block px-2 py-1 rounded text-[9px] font-bold uppercase bg-slate-200 text-slate-600">
                              Extra
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-slate-700 dark:text-slate-300 font-medium block">{provItem.nombre_extraido}</span>
                            <div className="flex gap-2 text-[10px] text-slate-500 mt-0.5">
                              <span>Cant: {provItem.cantidad_extraida || '-'}</span>
                              <span>Unid: {provItem.unidad_extraida || '-'}</span>
                              {provItem.codigo_proveedor && <span>Cód: {provItem.codigo_proveedor}</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600">
                            {formatCLP(provItem.precio_unitario)}
                          </td>
                          <td className="px-3 py-2 text-center text-slate-500">
                            {provItem.descuento_porcentaje ? `${provItem.descuento_porcentaje}%` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-600">
                            {formatCLP(provItem.precio_unitario * (provItem.cantidad_extraida || 1))}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-400">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => { setStep('upload'); setPreview(null); setEditedPrices({}); }}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                ← Volver
              </button>
              <button onClick={handleConfirm}
                disabled={matchedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                <Check size={14} /> Confirmar y Guardar Precios ({matchedCount})
              </button>
            </div>
          </div>
        );
      })()}

      {step === 'confirming' && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-amber-500 mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Guardando precios y actualizando solicitud...</p>
        </div>
      )}
    </Modal>
  );
}
