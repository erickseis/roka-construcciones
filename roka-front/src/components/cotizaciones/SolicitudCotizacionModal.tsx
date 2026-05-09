import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { getSolicitudes, getSolicitud, getProveedores, createBatchSolicitudesCotizacion } from '@/lib/api';
import { AlertCircle, Plus, Box, Truck, Layers, GripVertical, Trash2, X } from 'lucide-react';
import ProveedorModal from '../proveedores/ProveedorModal';
import CreatableSelect from 'react-select/creatable';

interface ItemAsignacion {
  solicitud_item_id: number;
  nombre_material: string;
  cantidad_requerida: number;
  unidad: string;
  codigo?: string;
  proveedor_id: number | '';
  proveedor_nombre: string;
}

export default function SolicitudCotizacionModal({ isOpen, onClose, onSuccess, initialSolicitudId }: { isOpen: boolean; onClose: () => void; onSuccess: () => void; initialSolicitudId?: string }) {
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [solicitudId, setSolicitudId] = useState('');
  const [items, setItems] = useState<ItemAsignacion[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [solicitudSeleccionada, setSolicitudSeleccionada] = useState<any>(null);

  // Modos de asignacion
  const [asignacionMode, setAsignacionMode] = useState<'por_item' | 'unico' | 'agrupar'>('por_item');
  const [proveedorUnico, setProveedorUnico] = useState<{ id: number | ''; nombre: string }>({ id: '', nombre: '' });
  const [proveedorMasivo, setProveedorMasivo] = useState<{ id: number | ''; nombre: string } | null>(null);

  interface GrupoProveedor {
    id: string;
    proveedor_id: number | '';
    proveedor_nombre: string;
    items: number[];
  }
  const [grupos, setGrupos] = useState<GrupoProveedor[]>([]);
  const [draggedItemId, setDraggedItemId] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSolicitudId(initialSolicitudId || '');
    setItems([]);
    setError(null);
    setAsignacionMode('por_item');
    setProveedorUnico({ id: '', nombre: '' });
    setProveedorMasivo(null);
    setGrupos([]);
    setSolicitudSeleccionada(null);
    
    Promise.all([
      getSolicitudes({ estado: undefined }),
      getProveedores(),
    ]).then(([sols, provs]) => {
      setSolicitudes(sols?.filter((s: any) => s.estado !== 'Aprobado') || []);
      setProveedores(provs || []);
      if (initialSolicitudId) {
        handleSolicitudChange(initialSolicitudId);
      }
    });
  }, [isOpen, initialSolicitudId]);

  const handleSolicitudChange = async (id: string) => {
    setSolicitudId(id);
    setError(null);
    if (!id) { setItems([]); setSolicitudSeleccionada(null); return; }
    setLoading(true);
    try {
      const data = await getSolicitud(Number(id));
      setSolicitudSeleccionada(data);
      setItems((data.items || []).map((i: any) => ({
        solicitud_item_id: i.id,
        nombre_material: i.nombre_material,
        cantidad_requerida: i.cantidad_requerida,
        unidad: i.unidad,
        codigo: i.codigo || i.material_sku || '',
        proveedor_id: '' as const,
        proveedor_nombre: '',
      })));
    } catch (e: any) {
      setError('Error al cargar ítems de la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const updateItemProveedor = (idx: number, provId: number | '', provNombre: string) => {
    const newItems = [...items];
    newItems[idx].proveedor_id = provId;
    newItems[idx].proveedor_nombre = provNombre;
    setItems(newItems);
  };

  const handleAsignarMasivo = () => {
    if (!proveedorMasivo) return;
    setItems(prev => prev.map(item => {
      if (!item.proveedor_id && !item.proveedor_nombre.trim()) {
        return { ...item, proveedor_id: proveedorMasivo.id, proveedor_nombre: proveedorMasivo.nombre };
      }
      return item;
    }));
    setProveedorMasivo(null);
  };

  const handleDragStart = (e: React.DragEvent, itemId: number) => {
    setDraggedItemId(itemId);
    e.dataTransfer.setData('text/plain', itemId.toString());
  };

  const handleDrop = (e: React.DragEvent, grupoId: string) => {
    e.preventDefault();
    if (draggedItemId === null) return;
    
    setGrupos(prev => prev.map(g => {
      let updatedItems = g.items.filter(id => id !== draggedItemId);
      if (g.id === grupoId) {
        updatedItems.push(draggedItemId);
      }
      return { ...g, items: updatedItems };
    }));
    setDraggedItemId(null);
  };

  const handleDropUnassigned = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedItemId === null) return;
    setGrupos(prev => prev.map(g => ({ ...g, items: g.items.filter(id => id !== draggedItemId) })));
    setDraggedItemId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!solicitudId) { setError('Selecciona una solicitud de materiales'); return; }

    const asignacionesMap = new Map<string, { proveedor_id?: number; proveedor: string; solicitud_item_ids: number[] }>();

    if (asignacionMode === 'unico') {
      if (!proveedorUnico.id && !proveedorUnico.nombre.trim()) {
        setError('Debes seleccionar un proveedor para toda la solicitud.');
        return;
      }
      const key = proveedorUnico.id ? `cat_${proveedorUnico.id}` : `txt_${proveedorUnico.nombre.trim().toLowerCase()}`;
      asignacionesMap.set(key, {
        proveedor_id: proveedorUnico.id || undefined,
        proveedor: proveedorUnico.id ? (proveedores.find(p => p.id === proveedorUnico.id)?.nombre || '') : proveedorUnico.nombre.trim(),
        solicitud_item_ids: items.map(i => i.solicitud_item_id),
      });
    } else if (asignacionMode === 'agrupar') {
      const itemsEnGrupos = new Set(grupos.flatMap(g => g.items));
      if (itemsEnGrupos.size < items.length) {
        setError('Hay ítems sin asignar a ningún grupo.');
        return;
      }
      for (const g of grupos) {
        if (!g.proveedor_id && !g.proveedor_nombre.trim()) {
           setError('Todos los grupos deben tener un proveedor asignado.');
           return;
        }
        if (g.items.length === 0) {
           setError('No puedes enviar grupos vacíos. Elimina el grupo vacío.');
           return;
        }
        const key = g.proveedor_id ? `cat_${g.proveedor_id}_${g.id}` : `txt_${g.proveedor_nombre.trim().toLowerCase()}_${g.id}`;
        asignacionesMap.set(key, {
          proveedor_id: g.proveedor_id || undefined,
          proveedor: g.proveedor_id ? (proveedores.find(p => p.id === g.proveedor_id)?.nombre || '') : g.proveedor_nombre.trim(),
          solicitud_item_ids: g.items,
        });
      }
    } else {
      const itemsSinProveedor = items.filter(i => !i.proveedor_id && !i.proveedor_nombre.trim());
      if (itemsSinProveedor.length > 0) {
        setError(`Los siguientes ítems no tienen proveedor asignado: ${itemsSinProveedor.map(i => i.nombre_material).join(', ')}`);
        return;
      }

      for (const item of items) {
        const key = item.proveedor_id ? `cat_${item.proveedor_id}` : `txt_${item.proveedor_nombre.trim().toLowerCase()}`;
        if (!asignacionesMap.has(key)) {
          const proveedor = item.proveedor_id
            ? proveedores.find(p => p.id === item.proveedor_id)
            : null;
          asignacionesMap.set(key, {
            proveedor_id: item.proveedor_id || undefined,
            proveedor: proveedor?.nombre || item.proveedor_nombre.trim(),
            solicitud_item_ids: [],
          });
        }
        asignacionesMap.get(key)!.solicitud_item_ids.push(item.solicitud_item_id);
      }
    }

    setSubmitting(true);
    try {
      await createBatchSolicitudesCotizacion({
        solicitud_id: Number(solicitudId),
        asignaciones: [...asignacionesMap.values()],
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear solicitudes de cotización');
    } finally {
      setSubmitting(false);
    }
  };

  const providerOptions = proveedores.map(p => ({
    value: p.id,
    label: p.nombre,
    isExisting: true
  }));

  const customStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '32px',
      fontSize: '12px',
      borderRadius: '0.5rem',
      borderColor: state.isFocused ? '#f59e0b' : '#e2e8f0',
      backgroundColor: 'transparent',
      boxShadow: 'none',
      '&:hover': {
        borderColor: state.isFocused ? '#f59e0b' : '#cbd5e1',
      },
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'inherit',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#94a3b8',
    }),
    input: (base: any) => ({
      ...base,
      margin: '0',
      padding: '0',
      color: 'inherit',
    }),
    indicatorSeparator: () => ({
      display: 'none',
    }),
    dropdownIndicator: (base: any) => ({
      ...base,
      padding: '4px',
    }),
    menuPortal: (base: any) => ({
      ...base,
      zIndex: 9999,
    }),
    menu: (base: any) => ({
      ...base,
      fontSize: '12px',
      borderRadius: '0.5rem',
      overflow: 'hidden',
      backgroundColor: '#1e293b',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
      border: '1px solid #334155',
    }),
    option: (base: any, state: { isFocused: boolean; isSelected: boolean }) => ({
      ...base,
      backgroundColor: state.isSelected ? '#f59e0b' : state.isFocused ? '#334155' : 'transparent',
      color: state.isSelected ? 'white' : '#f1f5f9',
      padding: '8px 12px',
      cursor: 'pointer',
      '&:active': {
        backgroundColor: '#f59e0b',
      },
    }),
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nueva Solicitud de Cotización"
      subtitle="Selecciona una solicitud de materiales y asigna proveedor a cada ítem" size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={14} /><span>{error}</span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Solicitud de Materiales</label>
          <select required value={solicitudId} onChange={e => handleSolicitudChange(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-amber-500/50">
            <option value="">Seleccionar solicitud...</option>
            {solicitudes.map((s: any) => (
              <option key={s.id} value={s.id} className="dark:bg-slate-900">SOL-{String(s.id).padStart(3, '0')} — {s.proyecto_nombre} ({s.estado})</option>
            ))}
          </select>
        </div>

        {solicitudSeleccionada?.fecha_requerida && !loading && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-900/20 dark:border-amber-800">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-500">Fecha requerida en terreno:</span>
              <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {new Date(solicitudSeleccionada.fecha_requerida).toLocaleDateString('es-CL')}
              </span>
              {(() => {
                const d = new Date(solicitudSeleccionada.fecha_requerida);
                if (isNaN(d.getTime())) return null;
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                d.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                let label = `${diffDays} día(s)`;
                let colorClass = 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';
                if (diffDays < 0) {
                  label = `Vencida hace ${Math.abs(diffDays)} día(s)`;
                  colorClass = 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
                } else if (diffDays <= 2) {
                  label = `Crítico — ${diffDays} día(s)`;
                  colorClass = 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
                } else if (diffDays <= 5) {
                  label = `Atrasado — ${diffDays} día(s)`;
                  colorClass = 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
                }
                return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${colorClass}`}>{label}</span>;
              })()}
            </div>
          </div>
        )}

        {loading && <div className="text-center text-xs text-slate-400 py-4">Cargando ítems...</div>}

        {/* Toggle de Modos */}
        {items.length > 0 && !loading && (
          <div>
            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Modo de Asignación</label>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button type="button" onClick={() => setAsignacionMode('por_item')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${asignacionMode === 'por_item' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                <Box size={14} /> Por ítem
              </button>
              <button type="button" onClick={() => setAsignacionMode('unico')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${asignacionMode === 'unico' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                <Truck size={14} /> Un proveedor para todos
              </button>
              <button type="button" onClick={() => setAsignacionMode('agrupar')} className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${asignacionMode === 'agrupar' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>
                <Layers size={14} /> Agrupar por proveedor
              </button>
            </div>
          </div>
        )}

        {/* MODO: POR ÍTEM */}
        {items.length > 0 && !loading && asignacionMode === 'por_item' && (
          <div>
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Asignar a ítems sin proveedor:</span>
                <div className="flex-1 max-w-[300px]">
                  <CreatableSelect
                    isClearable
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    placeholder="Elegir proveedor..."
                    options={providerOptions}
                    styles={customStyles}
                    value={proveedorMasivo ? (proveedorMasivo.id ? providerOptions.find(o => o.value === proveedorMasivo.id) : { label: proveedorMasivo.nombre, value: proveedorMasivo.nombre }) : null}
                    onChange={(newValue: any) => {
                      if (!newValue) setProveedorMasivo(null);
                      else if (newValue.isExisting) setProveedorMasivo({ id: newValue.value, nombre: newValue.label });
                      else setProveedorMasivo({ id: '', nombre: newValue.value });
                    }}
                    formatCreateLabel={(v) => `Usar "${v}" (nuevo)`}
                  />
                </div>
                <button type="button" onClick={handleAsignarMasivo} disabled={!proveedorMasivo} className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600 cursor-pointer transition-colors">
                  Aplicar
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="h-1.5 w-6 rounded-full bg-amber-500"></span>
                <span className="text-slate-400">{items.filter(i => i.proveedor_id || i.proveedor_nombre.trim()).length}/{items.length} asignados</span>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-hidden dark:border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Material</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Código</th>
                    <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Cant.</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Unidad</th>
                    <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Proveedor</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.solicitud_item_id} className="border-t border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{item.nombre_material}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{item.codigo || '-'}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">{Number(item.cantidad_requerida).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{item.unidad}</td>
                      <td className="px-3 py-2 min-w-[200px] dark:text-slate-200">
                        <CreatableSelect
                          isClearable
                          menuPortalTarget={document.body}
                          menuPosition="fixed"
                          placeholder="Buscar o escribir proveedor..."
                          options={providerOptions}
                          styles={customStyles}
                          value={item.proveedor_id ? providerOptions.find(o => o.value === item.proveedor_id) : (item.proveedor_nombre ? { label: item.proveedor_nombre, value: item.proveedor_nombre } : null)}
                          onChange={(newValue: any) => {
                            if (!newValue) updateItemProveedor(idx, '', '');
                            else if (newValue.isExisting) updateItemProveedor(idx, newValue.value, newValue.label);
                            else updateItemProveedor(idx, '', newValue.value);
                          }}
                          formatCreateLabel={(inputValue) => `Usar "${inputValue}" (nuevo)`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODO: UN PROVEEDOR PARA TODOS */}
        {items.length > 0 && !loading && asignacionMode === 'unico' && (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Proveedor de toda la solicitud</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Truck size={24} />
                </div>
                <div className="flex-1">
                  <CreatableSelect
                    isClearable
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    placeholder="Buscar o escribir proveedor global..."
                    options={providerOptions}
                    styles={customStyles}
                    value={proveedorUnico.id ? providerOptions.find(o => o.value === proveedorUnico.id) : (proveedorUnico.nombre ? { label: proveedorUnico.nombre, value: proveedorUnico.nombre } : null)}
                    onChange={(newValue: any) => {
                      if (!newValue) setProveedorUnico({ id: '', nombre: '' });
                      else if (newValue.isExisting) setProveedorUnico({ id: newValue.value, nombre: newValue.label });
                      else setProveedorUnico({ id: '', nombre: newValue.value });
                    }}
                    formatCreateLabel={(v) => `Usar "${v}" (nuevo)`}
                  />
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500 mb-2">
                <span>Materiales Incluidos</span>
                <span>{items.length} ítems se enviarán al proveedor</span>
              </div>
              <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-slate-800">
                <table className="min-w-full text-sm">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {items.map((item, idx) => (
                      <tr key={item.solicitud_item_id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 w-10 text-center font-mono text-xs text-slate-400">{String(idx + 1).padStart(2, '0')}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{item.nombre_material}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{item.codigo || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {Number(item.cantidad_requerida).toLocaleString()} <span className="text-xs text-slate-400 font-sans">{item.unidad}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MODO: AGRUPAR POR PROVEEDOR */}
        {items.length > 0 && !loading && asignacionMode === 'agrupar' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                <Layers size={18} className="text-amber-500" />
                <p>Crea grupos por proveedor y arrastra los materiales al grupo que corresponda. Se generará una solicitud por grupo.</p>
              </div>
              <button type="button" onClick={() => setGrupos([...grupos, { id: crypto.randomUUID(), proveedor_id: '', proveedor_nombre: '', items: [] }])} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer">
                <Plus size={14} /> Agregar grupo
              </button>
            </div>

            {/* Grupos */}
            <div className="space-y-3">
              {grupos.map((grupo, gIdx) => (
                <div key={grupo.id} className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, grupo.id)}
                >
                  {/* Header Grupo */}
                  <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 border-b border-slate-100 dark:bg-slate-800/50 dark:border-slate-800">
                    <Truck size={16} className="text-slate-400" />
                    <div className="flex-1 max-w-[300px]">
                      <CreatableSelect
                        isClearable
                        menuPortalTarget={document.body}
                        menuPosition="fixed"
                        placeholder="Proveedor del grupo..."
                        options={providerOptions}
                        styles={customStyles}
                        value={grupo.proveedor_id ? providerOptions.find(o => o.value === grupo.proveedor_id) : (grupo.proveedor_nombre ? { label: grupo.proveedor_nombre, value: grupo.proveedor_nombre } : null)}
                        onChange={(newValue: any) => {
                          const newGroups = [...grupos];
                          if (!newValue) { newGroups[gIdx].proveedor_id = ''; newGroups[gIdx].proveedor_nombre = ''; }
                          else if (newValue.isExisting) { newGroups[gIdx].proveedor_id = newValue.value; newGroups[gIdx].proveedor_nombre = newValue.label; }
                          else { newGroups[gIdx].proveedor_id = ''; newGroups[gIdx].proveedor_nombre = newValue.value; }
                          setGrupos(newGroups);
                        }}
                        formatCreateLabel={(v) => `Usar "${v}" (nuevo)`}
                      />
                    </div>
                    <div className="text-[10px] font-bold uppercase text-slate-400 flex-1">{grupo.items.length} ítems</div>
                    <button type="button" onClick={() => setGrupos(grupos.filter(g => g.id !== grupo.id))} className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {/* Items del Grupo */}
                  <div className="min-h-[40px] divide-y divide-slate-100 dark:divide-slate-800/60 p-1">
                    {grupo.items.length === 0 && <div className="py-3 text-center text-xs italic text-slate-400">Arrastra ítems aquí...</div>}
                    {grupo.items.map(itemId => {
                      const item = items.find(i => i.solicitud_item_id === itemId)!;
                      return (
                        <div key={itemId} draggable onDragStart={(e) => handleDragStart(e, itemId)} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-grab active:cursor-grabbing">
                          <GripVertical size={14} className="text-slate-300 dark:text-slate-600" />
                          <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">{item.nombre_material}</span>
                          <span className="font-mono text-xs text-slate-400 w-24">{item.codigo || '-'}</span>
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{item.cantidad_requerida} <span className="text-xs text-slate-400 font-sans font-normal">{item.unidad}</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Ítems Sin Asignar */}
            <div 
              className="mt-6 rounded-xl border-2 border-dashed border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900/30"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDropUnassigned}
            >
              <h4 className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Ítems sin asignar ({items.filter(i => !grupos.some(g => g.items.includes(i.solicitud_item_id))).length})</h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {items.filter(i => !grupos.some(g => g.items.includes(i.solicitud_item_id))).map(item => (
                  <div key={item.solicitud_item_id} draggable onDragStart={(e) => handleDragStart(e, item.solicitud_item_id)} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-grab active:cursor-grabbing group rounded-lg">
                    <GripVertical size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-amber-500 transition-colors" />
                    <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">{item.nombre_material}</span>
                    <span className="font-mono text-xs text-slate-400 w-24">{item.codigo || '-'}</span>
                    <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{item.cantidad_requerida} <span className="text-xs text-slate-400 font-sans font-normal">{item.unidad}</span></span>
                  </div>
                ))}
                {items.filter(i => !grupos.some(g => g.items.includes(i.solicitud_item_id))).length === 0 && (
                  <div className="py-6 text-center text-sm text-emerald-500 font-bold">¡Todos los ítems han sido asignados a grupos! 🎉</div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border dark:border-amber-800/50">
          <strong>Sin precios:</strong> La solicitud de cotización solo lista los materiales. El proveedor responderá con precios, los cuales se ingresarán como "Cotización de Venta" en el siguiente paso.
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {asignacionMode === 'unico' && <>Se generará <strong className="text-slate-800 dark:text-slate-200">1</strong> solicitud • {items.length} ítems agrupados</>}
            {asignacionMode === 'agrupar' && <>Se generarán <strong className="text-slate-800 dark:text-slate-200">{grupos.length}</strong> solicitudes agrupadas</>}
            {asignacionMode === 'por_item' && <>Se generarán <strong className="text-slate-800 dark:text-slate-200">{new Set(items.filter(i => i.proveedor_id || i.proveedor_nombre.trim()).map(i => i.proveedor_id ? `cat_${i.proveedor_id}` : `txt_${i.proveedor_nombre.trim().toLowerCase()}`)).size}</strong> solicitudes a proveedores</>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer transition-colors">Cancelar</button>
            <button type="submit" disabled={submitting || items.length === 0}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50 cursor-pointer">
              {submitting ? 'Generando...' : (
                asignacionMode === 'unico' ? `Generar 1 Solicitud` :
                asignacionMode === 'agrupar' ? `Generar ${grupos.length} Solicitudes` :
                `Generar Solicitudes`
              )}
            </button>
          </div>
        </div>

        <ProveedorModal isOpen={showProveedorModal} onClose={() => setShowProveedorModal(false)}
          onSave={async () => {
            const provs = await getProveedores();
            setProveedores(provs || []);
          }} />
      </form>
    </Modal>
  );
}
