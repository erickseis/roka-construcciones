import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Upload, Check, AlertCircle, Loader2, AlertTriangle, FileText, Building2 } from 'lucide-react';
import { importarRespuestaSC, confirmarImportacionSC, getProveedores } from '@/lib/api';
import ProveedorModal from '../proveedores/ProveedorModal';
import CreatableSelect from 'react-select/creatable';
import { showAlert, showToast } from '@/lib/alerts';
import { formatCLP } from '@/lib/utils';

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
  const [editedDiscounts, setEditedDiscounts] = useState<Record<number, number>>({});
  const [descuentoGlobalPct, setDescuentoGlobalPct] = useState<number>(0);
  const [editedProviderData, setEditedProviderData] = useState<{
    proveedor_nombre?: string;
    numero_cov?: string;
    proveedor_rut?: string;
    condiciones_pago?: string;
  }>({});
  const [localInputs, setLocalInputs] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      getProveedores().then(data => setProveedores(data || []));
    }
  }, [isOpen]);

  useEffect(() => {
    if (preview) {
      setEditedPrices({});
      setEditedDiscounts({});
      setDescuentoGlobalPct(0);
      setEditedProviderData({
        proveedor_nombre: preview.proveedor_nombre || solicitudData?.proveedor || '',
        numero_cov: preview.numero_cov || '',
        proveedor_rut: preview.proveedor_rut || '',
        condiciones_pago: preview.condiciones_pago || '',
      });
    }
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
          const desc = editedDiscounts[idx] !== undefined ? editedDiscounts[idx] : item.descuento_porcentaje;
          return {
            solicitud_item_id: item.solicitud_item_id,
            precio_unitario: price,
            descuento_porcentaje: desc,
            codigo_proveedor: item.codigo_proveedor,
          };
        });

      await confirmarImportacionSC({
        solicitud_cotizacion_id: solicitudCotizacionId,
        archivo_path: preview.archivo_path,
        archivo_nombre: preview.archivo_nombre,
        numero_cov: editedProviderData.numero_cov !== undefined ? editedProviderData.numero_cov : preview.numero_cov,
        condiciones_pago: editedProviderData.condiciones_pago !== undefined ? editedProviderData.condiciones_pago : preview.condiciones_pago,
        plazo_entrega: preview.plazo_entrega,
        descuento_global: descuentoGlobalPct > 0 ? descuentoGlobalPct : undefined,
        proveedor_nombre: editedProviderData.proveedor_nombre !== undefined ? editedProviderData.proveedor_nombre : preview.proveedor_nombre,
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

  const getItemPrice = (item: any, index: number): number => {
    return editedPrices[index] !== undefined ? editedPrices[index] : (item.precio_unitario || 0);
  };

  const getItemDiscount = (item: any, index: number): number => {
    return editedDiscounts[index] !== undefined ? editedDiscounts[index] : Number(item.descuento_porcentaje || 0);
  };

  const handleDiscountEdit = (index: number, value: number) => {
    setEditedDiscounts(prev => ({ ...prev, [index]: value }));
  };

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setError(null);
    setEditedPrices({});
    setEditedDiscounts({});
    setDescuentoGlobalPct(0);
    setEditedProviderData({});
    setLocalInputs({});
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
      size={step === 'preview' ? '3xl' : 'xl'}>

      {step === 'upload' && (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-8 text-center hover:border-amber-400 dark:hover:border-amber-500 transition-colors">
            <Upload size={32} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Arrastra o selecciona el archivo de cotización</p>
            <p className="text-xs text-slate-400 mt-1">PDF, Excel, CSV o imagen (máx 20MB)</p>
            <input ref={fileRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileRef.current?.click()}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 cursor-pointer">
              Seleccionar archivo
            </button>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{file.name}</span>
              <button onClick={handleUpload}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer">
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
        const subtotal = preview.items?.reduce((sum: number, item: any, idx: number) => {
          const price = getItemPrice(item, idx);
          const desc = getItemDiscount(item, idx) / 100;
          return sum + price * (item.cantidad_extraida || 1) * (1 - desc);
        }, 0) || 0;
        const descuentoGlobalMonto = subtotal * (descuentoGlobalPct / 100);
        const totalCalculated = subtotal - descuentoGlobalMonto;

        return (
          <div className="space-y-4">
            {/* Warnings de validación post-OCR */}
            {preview.warnings && preview.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/30 p-4">
                <div className="flex items-start gap-2">
                  <span className="text-lg">⚠️</span>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-amber-900 dark:text-amber-400 mb-2">
                      Advertencias de validación
                    </p>
                    <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-500/80">
                      {preview.warnings.map((w: string, i: number) => (
                        <li key={i} className="flex gap-1.5">
                          <span>•</span>
                          <span>{w}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

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
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{solicitudData?.proyecto_nombre || '-'}</span>
                      {solicitudData?.proyecto_numero_obra && (
                        <span className="text-[10px] font-mono text-slate-400">N° {solicitudData.proyecto_numero_obra}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Solicitud de Materiales</span>
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

              <div className="rounded-xl bg-blue-50/50 dark:bg-blue-950/20 p-4 border border-blue-100 dark:border-blue-900/30">
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
                  <div className="col-span-2 group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="block text-[10px] text-slate-400">Razón Social Proveedor</span>
                      <button type="button" onClick={() => setShowProveedorModal(true)} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        + Registrar proveedor
                      </button>
                    </div>
                    <CreatableSelect
                      isClearable
                      menuPortalTarget={document.body}
                      menuPosition="fixed"
                      placeholder="Seleccionar o escribir proveedor..."
                      options={proveedores.map(p => ({ value: p.nombre, label: p.nombre, isExisting: true }))}
                      styles={{
                        control: (base: any, state: any) => ({
                          ...base,
                          minHeight: '28px',
                          fontSize: '14px',
                          fontWeight: '600',
                          border: 'none',
                          borderBottom: '1px solid transparent',
                          borderRadius: '0',
                          backgroundColor: 'transparent',
                          boxShadow: 'none',
                          padding: 0,
                          '&:hover': { borderBottom: '1px solid #cbd5e1' },
                        }),
                        singleValue: (base: any) => ({ ...base, color: 'inherit', margin: 0 }),
                        input: (base: any) => ({ ...base, margin: 0, padding: 0 }),
                        valueContainer: (base: any) => ({ ...base, padding: 0 }),
                        menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
                        menu: (base: any) => ({
                          ...base,
                          fontSize: '12px',
                          borderRadius: '0.5rem',
                          backgroundColor: '#1e293b',
                          color: '#f1f5f9',
                        }),
                        option: (base: any, state: any) => ({
                          ...base,
                          backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#334155' : 'transparent',
                          color: 'inherit',
                          cursor: 'pointer',
                        })
                      }}
                      value={editedProviderData.proveedor_nombre ? { label: editedProviderData.proveedor_nombre, value: editedProviderData.proveedor_nombre } : null}
                      onChange={(newValue: any) => {
                        setEditedProviderData({ ...editedProviderData, proveedor_nombre: newValue ? newValue.label : '' });
                      }}
                      formatCreateLabel={(v) => `Usar "${v}" (nuevo)`}
                    />
                  </div>
                  <div className="group">
                    <span className="block text-[10px] text-slate-400">N° Cotización de Venta</span>
                    <input 
                      type="text" 
                      value={editedProviderData.numero_cov ?? ''}
                      onChange={e => setEditedProviderData({...editedProviderData, numero_cov: e.target.value})}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none font-mono text-xs text-slate-700 dark:text-slate-300 transition-colors py-0.5"
                      placeholder="Nº Cotización"
                    />
                  </div>
                  <div className="group">
                    <span className="block text-[10px] text-slate-400">RUT Proveedor</span>
                    <input 
                      type="text" 
                      value={editedProviderData.proveedor_rut ?? ''}
                      onChange={e => setEditedProviderData({...editedProviderData, proveedor_rut: e.target.value})}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none font-mono text-xs text-slate-700 dark:text-slate-300 transition-colors py-0.5"
                      placeholder="RUT"
                    />
                  </div>
                  <div className="group">
                    <span className="block text-[10px] text-slate-400">Condiciones Pago</span>
                    <input 
                      type="text" 
                      value={editedProviderData.condiciones_pago ?? ''}
                      onChange={e => setEditedProviderData({...editedProviderData, condiciones_pago: e.target.value})}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none text-xs text-slate-600 dark:text-slate-400 transition-colors py-0.5"
                      placeholder="Ej. CREDITO 30 DIAS"
                    />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400">Total Documento (Calculado)</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 py-0.5 block">{formatCLP(totalCalculated)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resumen de match + totales */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex-1 text-[11px] font-medium text-slate-500">Resumen de Análisis OCR:</div>
              <div className="flex gap-4 items-center">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ {matchedCount} Cotizados</span>
                <span className="text-xs font-bold text-red-500 dark:text-red-400">✗ {unmatchedCount} Faltantes</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-4 border-l pl-4 border-slate-300">
                  Subtotal: {formatCLP(subtotal)}
                </span>
              </div>
            </div>

            {/* Descuento global + Total final */}
            <div className="flex items-center justify-between gap-4 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/30">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Descuento Global
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={descuentoGlobalPct || ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      setDescuentoGlobalPct(isNaN(v) ? 0 : Math.max(0, Math.min(100, v)));
                    }}
                    placeholder="0"
                    className="w-20 text-right font-mono text-sm bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded px-2 py-1 focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">%</span>
                </div>
                {descuentoGlobalPct > 0 && (
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    (− {formatCLP(descuentoGlobalMonto)})
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Final</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">{formatCLP(totalCalculated)}</span>
              </div>
            </div>

            {/* Tabla Moderna */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th colSpan={3} className="p-3 border-b border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20">📋 Solicitado por Proyecto</th>
                    <th colSpan={5} className="p-3 border-b border-l border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">🏷️ Cotizado por Proveedor</th>
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
                          {Number(scItem.cantidad_requerida)}
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
                              type="text"
                              value={localInputs[provIdx] !== undefined ? localInputs[provIdx] : formatCLP(getItemPrice(provItem, provIdx), false)}
                              onChange={(e) => setLocalInputs(prev => ({ ...prev, [provIdx]: e.target.value }))}
                              onBlur={() => {
                                if (localInputs[provIdx] !== undefined) {
                                  const val = localInputs[provIdx].replace(/\./g, '').replace(',', '.');
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) handlePriceEdit(provIdx, parsed);
                                  setLocalInputs(prev => { const next = { ...prev }; delete next[provIdx]; return next; });
                                }
                              }}
                              className="w-full max-w-[90px] text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus:border-amber-500 focus:outline-none"
                            />
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {hasMatch ? (
                            <div className="flex items-center justify-center gap-0.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={getItemDiscount(provItem, provIdx) || ''}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  handleDiscountEdit(provIdx, isNaN(v) ? 0 : Math.max(0, Math.min(100, v)));
                                }}
                                placeholder="0"
                                className="w-12 text-right font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 focus:border-amber-500 focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-400">%</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                          {hasMatch ? formatCLP(getItemPrice(provItem, provIdx) * (provItem.cantidad_extraida || 1) * (1 - getItemDiscount(provItem, provIdx) / 100)) : '-'}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Ítems adicionales (No solicitados) */}
                  {unmatched.length > 0 && (
                    <>
                      <tr>
                        <td colSpan={8} className="px-3 py-2 bg-orange-50 dark:bg-orange-950/20 text-[10px] font-bold uppercase text-orange-600 dark:text-orange-400">
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
                            <input
                              type="text"
                              value={localInputs[provIdx] !== undefined ? localInputs[provIdx] : formatCLP(getItemPrice(provItem, provIdx), false)}
                              onChange={(e) => setLocalInputs(prev => ({ ...prev, [provIdx]: e.target.value }))}
                              onBlur={() => {
                                if (localInputs[provIdx] !== undefined) {
                                  const val = localInputs[provIdx].replace(/\./g, '').replace(',', '.');
                                  const parsed = parseFloat(val);
                                  if (!isNaN(parsed)) handlePriceEdit(provIdx, parsed);
                                  setLocalInputs(prev => { const next = { ...prev }; delete next[provIdx]; return next; });
                                }
                              }}
                              className="w-full max-w-[90px] text-right font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus:border-amber-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={getItemDiscount(provItem, provIdx) || ''}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  handleDiscountEdit(provIdx, isNaN(v) ? 0 : Math.max(0, Math.min(100, v)));
                                }}
                                placeholder="0"
                                className="w-12 text-right font-mono text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 focus:border-amber-500 focus:outline-none"
                              />
                              <span className="text-[10px] text-slate-400">%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-600">
                            {formatCLP(getItemPrice(provItem, provIdx) * (provItem.cantidad_extraida || 1) * (1 - getItemDiscount(provItem, provIdx) / 100))}
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
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                ← Volver
              </button>
              <button onClick={handleConfirm}
                disabled={matchedCount === 0}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer">
                <Check size={14} /> Confirmar y Guardar Precios ({matchedCount})
              </button>
            </div>
          </div>
        );
      })()}

      <ProveedorModal 
        isOpen={showProveedorModal} 
        onClose={() => setShowProveedorModal(false)}
        onSave={async () => {
          const provs = await getProveedores();
          setProveedores(provs || []);
        }} 
      />

      {step === 'confirming' && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-amber-500 mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Guardando precios y actualizando solicitud...</p>
        </div>
      )}
    </Modal>
  );
}
