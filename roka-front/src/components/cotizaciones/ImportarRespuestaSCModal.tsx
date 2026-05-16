import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { Upload, Check, AlertCircle, Loader2, AlertTriangle, FileText, Building2, Plus, RefreshCw, GripVertical } from 'lucide-react';
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
type ItemState = 'pending' | 'confirmed' | 'rejected';

const confidenceBadge: Record<MatchConfidence, { bg: string; text: string; label: string; border: string }> = {
  high: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Match exacto', border: 'border-emerald-400' },
  medium: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Match parcial', border: 'border-amber-400' },
  low: { bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', label: 'Match bajo', border: 'border-orange-400' },
  none: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: 'Sin respuesta', border: 'border-red-400' },
};

const confidencePercent: Record<MatchConfidence, number | null> = {
  high: 95, medium: 75, low: 50, none: null,
};

interface EditedPrices { [index: number]: number; }
interface EditedField {
  nombre_extraido?: string;
  cantidad_extraida?: number | string;
  unidad_extraida?: string;
  codigo_proveedor?: string;
}

export default function ImportarRespuestaSCModal({ isOpen, onClose, solicitudCotizacionId, scItems, solicitudData, onSuccess }: Props) {
  const [step, setStep] = useState<'upload' | 'processing' | 'preview' | 'confirming'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [editedPrices, setEditedPrices] = useState<EditedPrices>({});
  const [editedDiscounts, setEditedDiscounts] = useState<Record<number, number>>({});
  const [editedFields, setEditedFields] = useState<Record<number, EditedField>>({});
  const [matchOverrides, setMatchOverrides] = useState<Record<number, number | null>>({});
  const [itemStates, setItemStates] = useState<Record<number, ItemState>>({});
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
  const [isManualMode, setIsManualMode] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragTargetSc, setDragTargetSc] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      getProveedores().then(data => setProveedores(data || []));
    }
  }, [isOpen]);

  useEffect(() => {
    if (preview?.items) {
      setEditedPrices({});
      setEditedDiscounts({});
      setEditedFields({});
      setMatchOverrides({});
      setDescuentoGlobalPct(0);
      setEditedProviderData({
        proveedor_nombre: preview.proveedor_nombre || solicitudData?.proveedor || '',
        numero_cov: preview.numero_cov || '',
        proveedor_rut: preview.proveedor_rut || '',
        condiciones_pago: preview.condiciones_pago || '',
      });
      const initial: Record<number, ItemState> = {};
      (preview.items as any[]).forEach((item: any, idx: number) => {
        const conf = item.match_confidence as MatchConfidence;
        if (conf === 'high' || conf === 'medium' || conf === 'low') {
          initial[idx] = 'pending';
        } else if (item.is_manual) {
          initial[idx] = 'pending';
        }
      });
      setItemStates(initial);
    }
  }, [preview]);

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setStep('processing');
    setMatchOverrides({});
    setEditedPrices({});
    setEditedDiscounts({});
    setEditedFields({});
    setItemStates({});
    setDescuentoGlobalPct(0);
    try {
      const result = await importarRespuestaSC(solicitudCotizacionId, file);
      setPreview(result);
      setStep('preview');
      showToast({ title: 'Cotización importada correctamente', icon: 'success' });
    } catch (err: any) {
      showAlert({ title: 'Error de Importación', text: err.message || 'Error al procesar la respuesta del proveedor.', icon: 'error' });
      setStep('upload');
    }
  };

  const handleManualEntry = () => {
    setIsManualMode(true);
    setPreview({
      solicitud_cotizacion_id: solicitudCotizacionId,
      archivo_path: null, archivo_nombre: null,
      numero_cov: '', proveedor_nombre: solicitudData?.proveedor || '',
      proveedor_rut: '', condiciones_pago: '',
      items: scItems.map((sc: any) => ({
        id: `manual_${sc.solicitud_item_id}`,
        solicitud_item_id: sc.solicitud_item_id,
        nombre_extraido: sc.nombre_material,
        cantidad_extraida: sc.cantidad_requerida,
        unidad_extraida: sc.unidad,
        precio_unitario: 0,
        descuento_porcentaje: 0,
        codigo_proveedor: sc.codigo || '',
        match_confidence: 'none' as MatchConfidence,
        is_manual: true,
      })),
      warnings: [],
    });
    setStep('preview');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] || null);
    setError(null);
  };

  const getEffectiveSolicitudItemId = useCallback((provItem: any, idx: number): number | null => {
    if (idx in matchOverrides) return matchOverrides[idx];
    return provItem?.solicitud_item_id || null;
  }, [matchOverrides]);

  const getItemPrice = (item: any, index: number): number =>
    editedPrices[index] !== undefined ? editedPrices[index] : (item.precio_unitario || 0);

  const getItemDiscount = (item: any, index: number): number =>
    editedDiscounts[index] !== undefined ? editedDiscounts[index] : Number(item.descuento_porcentaje || 0);

  const getItemField = (item: any, index: number, field: keyof EditedField): any => {
    if (editedFields[index] && editedFields[index]![field] !== undefined) return editedFields[index]![field];
    return item[field] ?? '';
  };

  const handlePriceEdit = (index: number, value: number) =>
    setEditedPrices(prev => ({ ...prev, [index]: value }));

  const handleDiscountEdit = (index: number, value: number) =>
    setEditedDiscounts(prev => ({ ...prev, [index]: value }));

  const handleFieldEdit = (index: number, field: keyof EditedField, value: any) =>
    setEditedFields(prev => ({ ...prev, [index]: { ...prev[index], [field]: value } }));

  const handleSetMatch = (provIdx: number, solicitudItemId: number | null) => {
    setMatchOverrides(prev => {
      const next = { ...prev };
      if (solicitudItemId !== null) {
        Object.keys(next).forEach(k => {
          const key = Number(k);
          if (next[key] === solicitudItemId && key !== provIdx) next[key] = null;
        });
      }
      next[provIdx] = solicitudItemId;
      return next;
    });
  };

  const confirmItem = (idx: number) =>
    setItemStates(prev => ({ ...prev, [idx]: 'confirmed' }));

  const rejectItem = (idx: number) =>
    setItemStates(prev => ({ ...prev, [idx]: 'rejected' }));

  const undoItem = (idx: number) =>
    setItemStates(prev => ({ ...prev, [idx]: 'pending' }));

  const acceptAllHighConfidence = () => {
    if (!preview?.items) return;
    setItemStates(prev => {
      const next = { ...prev };
      (preview.items as any[]).forEach((item: any, idx: number) => {
        if (prev[idx] === 'pending' && item.match_confidence === 'high') next[idx] = 'confirmed';
      });
      return next;
    });
  };

  const confirmAllSuggested = () => {
    setItemStates(prev => {
      const next = { ...prev };
      Object.keys(prev).forEach(k => {
        if (prev[+k] === 'pending') next[+k] = 'confirmed';
      });
      return next;
    });
  };

  const handleAddManualItem = () => {
    setPreview((prev: any) => {
      if (!prev) return prev;
      const newItem = {
        id: `manual_${Date.now()}`,
        solicitud_item_id: null,
        nombre_extraido: '', cantidad_extraida: 1, unidad_extraida: '',
        precio_unitario: 0, descuento_porcentaje: 0, codigo_proveedor: '',
        match_confidence: 'none' as MatchConfidence, is_manual: true,
      };
      return { ...prev, items: [...prev.items, newItem] };
    });
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setStep('confirming');
    setError(null);
    try {
      const confirmedItems = (preview.items as any[])
        .map((item: any, idx: number) => ({ item, idx }))
        .filter(({ idx }) => itemStates[idx] === 'confirmed')
        .map(({ item, idx }) => ({
          solicitud_item_id: matchOverrides[idx] !== undefined && matchOverrides[idx] !== null
            ? matchOverrides[idx]
            : item.solicitud_item_id,
          precio_unitario: getItemPrice(item, idx),
          descuento_porcentaje: getItemDiscount(item, idx),
          codigo_proveedor: getItemField(item, idx, 'codigo_proveedor') || item.codigo_proveedor || '',
        }));

      await confirmarImportacionSC({
        solicitud_cotizacion_id: solicitudCotizacionId,
        archivo_path: preview.archivo_path,
        archivo_nombre: preview.archivo_nombre,
        numero_cov: editedProviderData.numero_cov !== undefined && editedProviderData.numero_cov !== '' ? editedProviderData.numero_cov : preview.numero_cov,
        condiciones_pago: editedProviderData.condiciones_pago !== undefined ? editedProviderData.condiciones_pago : preview.condiciones_pago,
        plazo_entrega: preview.plazo_entrega,
        descuento_global: descuentoGlobalPct > 0 ? descuentoGlobalPct : undefined,
        proveedor_nombre: editedProviderData.proveedor_nombre !== undefined ? editedProviderData.proveedor_nombre : preview.proveedor_nombre,
        items: confirmedItems,
      });

      onSuccess();
      onClose();
      resetState();
    } catch (err: any) {
      setError(err.message || 'Error al confirmar importación');
      setStep('preview');
    }
  };

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setEditedPrices({});
    setEditedDiscounts({});
    setEditedFields({});
    setMatchOverrides({});
    setItemStates({});
    setDescuentoGlobalPct(0);
    setEditedProviderData({});
    setLocalInputs({});
    setError(null);
    setIsManualMode(false);
  };

  const handleClose = () => { resetState(); onClose(); };

  // DnD handlers for match reassignment
  const handleDragStart = (e: React.DragEvent, provIdx: number) => {
    setDraggedIdx(provIdx);
    e.dataTransfer.setData('text/plain', String(provIdx));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragTargetSc(null);
  };

  const handleScTargetDragOver = (e: React.DragEvent, scItemId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragTargetSc(scItemId);
  };

  const handleScTargetDrop = (e: React.DragEvent, scItemId: number) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    handleSetMatch(draggedIdx, scItemId);
    const state = itemStates[draggedIdx];
    if (state !== 'confirmed' && state !== 'rejected') {
      setItemStates(prev => ({ ...prev, [draggedIdx]: 'pending' }));
    }
    setDraggedIdx(null);
    setDragTargetSc(null);
  };

  const handleScTargetDragLeave = () => {
    setDragTargetSc(null);
  };

  const handleRemoveMatchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIdx === null) return;
    handleSetMatch(draggedIdx, null);
    setItemStates(prev => { const n = { ...prev }; delete n[draggedIdx]; return n; });
    setDraggedIdx(null);
    setDragTargetSc(null);
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}
      title="Cargar Respuesta del Proveedor"
      subtitle="Importa la cotización de venta recibida del proveedor"
      size={step === 'preview' ? '3xl' : 'xl'}>

      {/* ── UPLOAD ─────────────────────────────────────────────── */}
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

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-400">o</span>
            </div>
          </div>

          <button onClick={handleManualEntry} type="button"
            className="w-full rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 p-5 text-center hover:border-blue-500 dark:hover:border-blue-500 bg-blue-50/30 dark:bg-blue-950/10 transition-colors cursor-pointer group">
            <FileText size={28} className="mx-auto mb-2 text-blue-400 group-hover:text-blue-500" />
            <p className="text-sm font-bold text-blue-700 dark:text-blue-400">Cargar respuesta manualmente</p>
            <p className="text-xs text-blue-500/70 dark:text-blue-400/70 mt-1">Ingresa los datos del proveedor y los precios a mano</p>
          </button>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>
      )}

      {/* ── PROCESSING ─────────────────────────────────────────── */}
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

      {/* ── PREVIEW ────────────────────────────────────────────── */}
      {step === 'preview' && preview && (() => {
        const providerItems = preview.items as any[];

        // Chip counts
        const vinculadosCount = Object.values(itemStates).filter(s => s === 'confirmed').length;
        const porConfirmarCount = Object.values(itemStates).filter(s => s === 'pending').length;
        const linkedScIds = new Set(
          providerItems
            .map((pi: any, idx: number) => {
              if (itemStates[idx] === 'confirmed' || itemStates[idx] === 'pending') {
                return matchOverrides[idx] !== undefined ? matchOverrides[idx] : pi.solicitud_item_id;
              }
              return null;
            })
            .filter(id => id !== null)
        );
        const sinCotizarCount = scItems.filter((sc: any) => !linkedScIds.has(sc.solicitud_item_id)).length;
        const highConfPendingCount = providerItems.filter((item: any, idx: number) =>
          itemStates[idx] === 'pending' && item.match_confidence === 'high'
        ).length;

        // Totals (exclude rejected)
        const subtotal = providerItems.reduce((sum: number, item: any, idx: number) => {
          if (itemStates[idx] === 'rejected') return sum;
          const price = getItemPrice(item, idx);
          const desc = getItemDiscount(item, idx) / 100;
          const qty = Number(getItemField(item, idx, 'cantidad_extraida') || item.cantidad_extraida || 1);
          return sum + price * qty * (1 - desc);
        }, 0) || 0;
        const descuentoGlobalMonto = subtotal * (descuentoGlobalPct / 100);
        const totalCalculated = subtotal - descuentoGlobalMonto;

        return (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Proveedor</span>
                  <span className="text-[9px] font-bold text-blue-400 font-mono">
                    {solicitudData ? `SC-${String(solicitudData.id).padStart(3, '0')}` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] text-slate-500">Razón Social</span>
                  <button type="button" onClick={() => setShowProveedorModal(true)}
                    className="text-[9px] font-bold text-blue-400 hover:text-blue-300">
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
                    control: (base: any) => ({
                      ...base,
                      minHeight: '30px',
                      fontSize: '13px',
                      fontWeight: '600',
                      border: 'none',
                      borderBottom: '1px solid transparent',
                      borderRadius: '0',
                      backgroundColor: 'transparent',
                      boxShadow: 'none',
                      padding: 0,
                      '&:hover': { borderBottom: '1px solid #475569' },
                    }),
                    singleValue: (base: any) => ({ ...base, color: '#e2e8f0', margin: 0 }),
                    input: (base: any) => ({ ...base, margin: 0, padding: 0, color: '#e2e8f0' }),
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
                    if (newValue) {
                      const selectedProv = proveedores.find(p => p.nombre === newValue.label);
                      setEditedProviderData({
                        ...editedProviderData,
                        proveedor_nombre: newValue.label,
                        proveedor_rut: selectedProv?.rut || '',
                        condiciones_pago: selectedProv?.condiciones_pago || '',
                      });
                    } else {
                      setEditedProviderData({ ...editedProviderData, proveedor_nombre: '' });
                    }
                  }}
                  formatCreateLabel={(v) => `Usar "${v}" (nuevo)`}
                />
              </div>

              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-3">Datos Cotización</span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <div>
                    <span className="block text-[8px] text-slate-500 mb-0.5">N° Cotización de Venta</span>
                    <input
                      type="text"
                      value={editedProviderData.numero_cov ?? ''}
                      onChange={e => setEditedProviderData({...editedProviderData, numero_cov: e.target.value})}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 outline-none font-mono text-xs text-slate-200 transition-colors py-0.5"
                      placeholder="Nº Cov"
                    />
                  </div>
                  <div>
                    <span className="block text-[8px] text-slate-500 mb-0.5">RUT Proveedor</span>
                    <input
                      type="text"
                      value={editedProviderData.proveedor_rut ?? ''}
                      onChange={e => setEditedProviderData({...editedProviderData, proveedor_rut: e.target.value})}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 outline-none font-mono text-xs text-slate-200 transition-colors py-0.5"
                      placeholder="RUT"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="block text-[8px] text-slate-500 mb-0.5">Condiciones de Pago</span>
                    <input
                      type="text"
                      value={editedProviderData.condiciones_pago ?? ''}
                      onChange={e => setEditedProviderData({...editedProviderData, condiciones_pago: e.target.value})}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-600 focus:border-blue-500 outline-none text-xs text-slate-300 transition-colors py-0.5"
                      placeholder="Ej. CREDITO 30 DIAS"
                    />
                  </div>
                  <div className="col-span-2 flex justify-end items-center gap-3 mt-1">
                    <span className="text-[8px] font-bold uppercase text-slate-500">Total Documento</span>
                    <span className="text-lg font-black text-emerald-400">{formatCLP(totalCalculated)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Tab + chips + actions */}
            <div className="flex items-center justify-between mb-4 mt-6 border-b border-slate-700/50 pb-3">
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Análisis OCR
                </span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span className="font-bold text-emerald-400">{vinculadosCount}</span> vinculados
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    <span className="font-bold text-amber-500">{porConfirmarCount}</span> por confirmar
                  </span>
                  <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                    <span className="font-bold text-red-500">{sinCotizarCount}</span> sin cotizar
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setStep('upload'); setPreview(null); setItemStates({}); setMatchOverrides({}); setEditedPrices({}); setEditedDiscounts({}); setEditedFields({}); setDescuentoGlobalPct(0); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
                  <RefreshCw size={12} /> Reanalizar PDF
                </button>
                <button
                  onClick={acceptAllHighConfidence}
                  disabled={highConfPendingCount === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-indigo-900/40 border border-indigo-700/50 hover:bg-indigo-800/60 disabled:opacity-40 text-indigo-300 text-[10px] font-medium cursor-pointer transition-colors">
                  Aceptar todas las sugerencias (≥85%)
                </button>
              </div>
            </div>

            {/* 3. Warning banner */}
            {porConfirmarCount > 0 && (
              <div className="flex items-center justify-between gap-4 mb-6 bg-[#3d2f19]/30 border border-amber-900/40 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-amber-500">
                      {porConfirmarCount} ítems del proveedor requieren confirmación
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      El OCR identificó coincidencias en los materiales del proyecto. Confirma o rechaza cada vinculación.
                    </p>
                  </div>
                </div>
                {preview.archivo_path && (
                  <a href={`${(import.meta as any).env.VITE_API_URL.replace(/\/api\/?$/, '')}${preview.archivo_path}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[10px] font-medium text-slate-300 hover:text-white whitespace-nowrap flex-shrink-0 hover:underline">
                    Ver original PDF
                  </a>
                )}
              </div>
            )}

            {/* Global Discount */}
            <div className="flex items-center justify-between gap-4 bg-amber-950/10 border border-amber-900/30 rounded-lg p-3 mb-4">
              <div className="flex items-center gap-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
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
                    className="w-20 text-right font-mono text-sm bg-slate-800 border border-amber-700 rounded px-2 py-1 focus:border-amber-500 focus:outline-none text-white"
                  />
                  <span className="text-[10px] font-bold text-amber-400">%</span>
                </div>
                {descuentoGlobalPct > 0 && (
                  <span className="text-[10px] text-amber-400/80">
                    (− {formatCLP(descuentoGlobalMonto)})
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold uppercase text-slate-500">Total</span>
                <span className="text-lg font-black text-emerald-400 ml-3">{formatCLP(totalCalculated)}</span>
              </div>
            </div>

            {/* 7. Reconciliation list */}
            <div className="w-full">
              <div className="grid grid-cols-[1fr_60px_60px_100px_70px_170px] gap-3 px-3 pb-2 text-[8px] uppercase tracking-wider font-bold text-slate-500 border-b border-slate-700/50 mb-3">
                <div className="pl-6">Descripción Cotizada</div>
                <div className="text-center">Cant.</div>
                <div className="text-center">Unid.</div>
                <div className="text-right">P. Unitario</div>
                <div className="text-center">Desc.</div>
                <div className="text-right">Acción</div>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[45vh] overflow-y-auto pr-1">
                {providerItems.length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic bg-slate-800/30 rounded-lg border border-slate-700/50">
                    <div className="flex flex-col items-center gap-3">
                      <span>No hay items. Agrega items manualmente.</span>
                      <button type="button" onClick={handleAddManualItem}
                        className="flex items-center gap-1.5 px-4 py-2 rounded border border-slate-600 hover:bg-slate-700 text-slate-300 text-[10px] font-bold cursor-pointer transition-colors">
                        <Plus size={12} /> Agregar ítem
                      </button>
                    </div>
                  </div>
                )}

                {providerItems.map((provItem: any, idx: number) => {
                  const confidence = provItem.match_confidence as MatchConfidence;
                  const state = itemStates[idx];
                  const effectiveScId = getEffectiveSolicitudItemId(provItem, idx);
                  const linkedScItem = scItems.find((sc: any) => sc.solicitud_item_id === effectiveScId);
                  const matchScore = provItem.match_score !== undefined
                    ? Math.round(provItem.match_score * 100)
                    : confidencePercent[confidence];

                  const isConfirmed = state === 'confirmed';
                  const isRejected = state === 'rejected';
                  const isPending = state === 'pending';
                  const isNoMatch = !state && !effectiveScId;
                  const hasManualLink = isNoMatch && matchOverrides[idx] !== undefined && matchOverrides[idx] !== null;

                  const borderClass = isConfirmed
                    ? 'border border-slate-700 border-l-2 border-l-slate-600 bg-[#161b22]'
                    : isPending
                      ? 'border border-[#4a3b2c] border-l-2 border-l-amber-500 bg-[#1c2128]'
                      : isRejected
                        ? 'border border-slate-800 opacity-40 bg-[#161b22]'
                        : 'border border-slate-700 bg-[#161b22]';

                  const containerClass = `grid grid-cols-[1fr_60px_60px_100px_70px_170px] gap-3 items-center p-3 rounded border-opacity-70 ${borderClass}`;

                  return (
                    <div key={idx}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`${containerClass} ${draggedIdx === idx ? 'opacity-40 ring-2 ring-amber-500/50' : ''} ${draggedIdx !== null && draggedIdx !== idx ? 'ring-1 ring-blue-500/20' : ''} transition-all`}>
                      {/* DESCRIPCIÓN */}
                      <div className="flex items-start gap-2 min-w-0">
                        <GripVertical size={14} className="text-slate-600 mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                        <div className="flex flex-col min-w-0 flex-1">
                          <input
                            type="text"
                            value={getItemField(provItem, idx, 'nombre_extraido') || provItem.nombre_extraido || ''}
                            onChange={(e) => handleFieldEdit(idx, 'nombre_extraido', e.target.value)}
                            disabled={isRejected}
                            className={`w-full bg-transparent outline-none text-xs font-bold truncate uppercase tracking-wide ${isRejected ? 'line-through text-slate-500' : 'text-slate-200'}`}
                            placeholder="Descripción del material"
                          />
                          <span className="text-[9px] text-slate-500 mt-0.5">
                            Detectado por OCR - línea {idx + 1}
                          </span>
                        </div>
                      </div>

                      {/* CANT */}
                      <div className="text-center">
                        <input
                          type="number" min="0" step="0.01"
                          value={getItemField(provItem, idx, 'cantidad_extraida') || provItem.cantidad_extraida || 1}
                          onChange={(e) => handleFieldEdit(idx, 'cantidad_extraida', parseFloat(e.target.value) || 1)}
                          disabled={isRejected}
                          className={`w-full text-center bg-transparent outline-none text-xs font-bold font-mono py-0.5 disabled:opacity-50 ${isRejected ? 'text-slate-500' : 'text-slate-200'}`}
                        />
                      </div>

                      {/* UNID */}
                      <div className="text-center">
                        <input
                          type="text"
                          value={getItemField(provItem, idx, 'unidad_extraida') || provItem.unidad_extraida || ''}
                          onChange={(e) => handleFieldEdit(idx, 'unidad_extraida', e.target.value)}
                          disabled={isRejected}
                          className={`w-full text-center bg-transparent outline-none text-[10px] font-medium py-0.5 uppercase disabled:opacity-50 ${isRejected ? 'text-slate-500' : 'text-slate-400'}`}
                          placeholder="UN"
                        />
                      </div>

                      {/* P. UNITARIO */}
                      <div className="text-right">
                        <input
                          type="text"
                          value={localInputs[idx] !== undefined ? localInputs[idx] : formatCLP(getItemPrice(provItem, idx), false)}
                          onChange={(e) => setLocalInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                          onBlur={() => {
                            if (localInputs[idx] !== undefined) {
                              const val = localInputs[idx].replace(/\./g, '').replace(',', '.');
                              const parsed = parseFloat(val);
                              if (!isNaN(parsed)) handlePriceEdit(idx, parsed);
                              setLocalInputs(prev => { const next = { ...prev }; delete next[idx]; return next; });
                            }
                          }}
                          disabled={isRejected}
                          className={`w-full text-right font-mono bg-transparent outline-none disabled:opacity-50 text-[11px] font-medium ${isRejected ? 'text-slate-500' : 'text-slate-300'}`}
                        />
                      </div>

                      {/* DESCUENTO % */}
                      <div className="text-center">
                        {isRejected ? (
                          <span className="text-slate-500 text-[10px]">—</span>
                        ) : (
                          <div className="flex items-center justify-center gap-0.5">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={getItemDiscount(provItem, idx) || ''}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                handleDiscountEdit(idx, isNaN(v) ? 0 : Math.max(0, Math.min(100, v)));
                              }}
                              placeholder="0"
                              className="w-12 text-right font-mono text-[10px] bg-transparent border-b border-transparent hover:border-slate-600 focus:border-amber-500 outline-none text-slate-300 disabled:opacity-50"
                            />
                            <span className="text-[9px] text-slate-500">%</span>
                          </div>
                        )}
                      </div>

                      {/* VINCULAR A MATERIAL DEL PROYECTO */}
                      {/* <div className="pl-2">
                        {isNoMatch && !hasManualLink ? (
                          <div className="relative flex items-center justify-between gap-2 min-w-0 bg-[#2d1b2e]/30 border border-dashed border-[#8a3c4a]/50 rounded px-2 py-1.5 w-full">
                            <span className="text-[10px] text-[#e06c75] truncate flex-1 font-medium">* Vincular manualmente...</span>
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value !== '') {
                                  handleSetMatch(idx, Number(e.target.value));
                                  setItemStates(prev => ({ ...prev, [idx]: 'pending' }));
                                }
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                              <option value="">+ Vincular manualmente...</option>
                              {scItems.map((sc: any) => (
                                <option key={sc.solicitud_item_id} value={sc.solicitud_item_id}>
                                  {sc.nombre_material}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : linkedScItem ? (
                          <div className="relative flex items-center gap-2 min-w-0 bg-[#21262d] border border-[#30363d] rounded px-2 py-1.5 w-full">
                            <div className="flex-1 min-w-0 truncate text-[10px] text-slate-300 font-medium">
                              {linkedScItem.codigo && <span className="text-slate-500 mr-1.5">{linkedScItem.codigo}</span>}
                              {linkedScItem.nombre_material}
                            </div>
                            {matchScore !== null && !isRejected && confidence !== 'none' && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${confidence === 'high' ? 'text-emerald-400' : confidence === 'medium' ? 'text-amber-400' : 'text-orange-400'}`}>
                                {matchScore}%
                              </span>
                            )}
                            <span className="text-slate-500 text-[8px] ml-1 flex-shrink-0">▼</span>
                            {!isRejected && (
                              <select
                                value={String(effectiveScId)}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') {
                                    handleSetMatch(idx, null);
                                    setItemStates(prev => { const n = { ...prev }; delete n[idx]; return n; });
                                  } else {
                                    handleSetMatch(idx, Number(val));
                                  }
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer">
                                <option value={String(effectiveScId)}>{linkedScItem.nombre_material}</option>
                                <option value="">✕ Quitar match</option>
                                {scItems
                                  .filter((sc: any) => sc.solicitud_item_id !== effectiveScId)
                                  .map((sc: any) => (
                                    <option key={sc.solicitud_item_id} value={String(sc.solicitud_item_id)}>
                                      → {sc.nombre_material}
                                    </option>
                                  ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[10px]">—</span>
                        )}
                      </div> */}

                      {/* ACCIÓN */}
                      <div className="text-right flex items-center justify-end gap-2">
                        {isPending && (
                          <>
                            <button onClick={() => rejectItem(idx)}
                              className="px-2.5 py-1.5 rounded border border-slate-700 bg-transparent text-[10px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                              ✕ Rechazar
                            </button>
                            <button onClick={() => confirmItem(idx)}
                              className="px-3 py-1.5 rounded bg-[#e3a008] hover:bg-amber-400 text-[10px] font-bold text-black transition-colors">
                              ✓ Confirmar
                            </button>
                          </>
                        )}
                        {isConfirmed && (
                          <button onClick={() => undoItem(idx)}
                            className="px-3 py-1.5 rounded bg-slate-800 text-[10px] font-medium text-slate-400 hover:text-white transition-colors">
                            ✓ Confirmado (Deshacer)
                          </button>
                        )}
                        {isRejected && (
                          <button onClick={() => undoItem(idx)}
                            className="px-3 py-1.5 rounded border border-slate-700/50 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-colors">
                            ↩ Deshacer
                          </button>
                        )}
                        {isNoMatch && !hasManualLink && (
                          <span className="text-[10px] text-slate-500 mr-2">—</span>
                        )}
                        {isNoMatch && hasManualLink && (
                          <>
                            <button onClick={() => rejectItem(idx)}
                              className="px-2.5 py-1.5 rounded border border-slate-700 bg-transparent text-[10px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors">
                              ✕ Rechazar
                            </button>
                            <button onClick={() => confirmItem(idx)}
                              className="px-3 py-1.5 rounded bg-slate-600 hover:bg-slate-500 text-[10px] font-bold text-white transition-colors">
                              ✓ Confirmar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Drop zone overlay (visible when dragging) */}
            {draggedIdx !== null && (
              <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-blue-400 bg-blue-950/20">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-3">
                  Arrastra el ítem sobre un material del proyecto para vincularlo:
                </p>
                <div className="flex flex-wrap gap-2">
                  {scItems.map((sc: any) => {
                    const alreadyMatched = Object.entries(matchOverrides).some(
                      ([k, v]) => v === sc.solicitud_item_id && Number(k) !== draggedIdx
                    );
                    return (
                      <div key={sc.solicitud_item_id}
                        onDragOver={(e) => handleScTargetDragOver(e, sc.solicitud_item_id)}
                        onDrop={(e) => handleScTargetDrop(e, sc.solicitud_item_id)}
                        onDragLeave={handleScTargetDragLeave}
                        className={`px-3 py-2 rounded-lg border-2 text-xs font-bold cursor-pointer transition-all ${dragTargetSc === sc.solicitud_item_id
                          ? 'border-emerald-400 bg-emerald-900/30 text-emerald-300 scale-105'
                          : alreadyMatched
                            ? 'border-slate-700 bg-slate-800/50 text-slate-500 opacity-60'
                            : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-blue-400'
                          }`}>
                        {sc.codigo && <span className="text-slate-500 mr-1.5">{sc.codigo}</span>}
                        {sc.nombre_material}
                        {alreadyMatched && <span className="text-[9px] ml-1.5 text-slate-600">(ocupado)</span>}
                      </div>
                    );
                  })}
                  <div
                    onDragOver={(e) => { e.preventDefault(); }}
                    onDrop={handleRemoveMatchDrop}
                    className={`px-3 py-2 rounded-lg border-2 border-dashed text-xs font-bold cursor-pointer transition-all ${dragTargetSc === null
                      ? 'border-red-400 bg-red-900/20 text-red-400'
                      : 'border-slate-700 text-slate-500 hover:border-red-400'
                      }`}>
                    ✕ Quitar match
                  </div>
                </div>
              </div>
            )}

            {/* 8. Footer */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 tracking-wide">
                    Sugerencias con confianza ≥ 85%:
                  </span>
                  <span className="text-emerald-500 font-bold text-xs">{highConfPendingCount}</span>
                </div>
                <button onClick={confirmAllSuggested}
                  disabled={porConfirmarCount === 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0d4a36]/50 border border-[#166534] hover:bg-[#166534]/60 disabled:opacity-40 text-emerald-500 text-[11px] font-bold cursor-pointer transition-colors ml-4">
                  Confirmar todas las sugeridas
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={() => { setStep('upload'); setPreview(null); setItemStates({}); setMatchOverrides({}); setEditedPrices({}); setEditedDiscounts({}); setEditedFields({}); setDescuentoGlobalPct(0); }}
                  className="rounded px-4 py-2 text-[11px] font-medium text-slate-400 hover:text-white transition-colors">
                  Volver
                </button>
                <button onClick={handleConfirm}
                  disabled={vinculadosCount === 0}
                  className="flex items-center gap-1.5 px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer transition-colors ml-2">
                  <Check size={14} /> Confirmar y Guardar ({vinculadosCount})
                </button>
              </div>
            </div>
          </>
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
