import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { getSolicitudes, getSolicitud, getProveedores, createBatchSolicitudesCotizacion } from '@/lib/api';
import { AlertCircle, Plus } from 'lucide-react';
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

  useEffect(() => {
    if (!isOpen) return;
    setSolicitudId(initialSolicitudId || '');
    setItems([]);
    setError(null);
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
    if (!id) { setItems([]); return; }
    setLoading(true);
    try {
      const data = await getSolicitud(Number(id));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!solicitudId) { setError('Selecciona una solicitud de materiales'); return; }

    const itemsSinProveedor = items.filter(i => !i.proveedor_id && !i.proveedor_nombre.trim());
    if (itemsSinProveedor.length > 0) {
      setError(`Los siguientes ítems no tienen proveedor asignado: ${itemsSinProveedor.map(i => i.nombre_material).join(', ')}`);
      return;
    }

    // Agrupar ítems por proveedor
    const asignacionesMap = new Map<string, { proveedor_id?: number; proveedor: string; solicitud_item_ids: number[] }>();
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

        {loading && <div className="text-center text-xs text-slate-400 py-4">Cargando ítems...</div>}

        {items.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Asignación de Proveedor por Ítem</label>
              <button
                type="button"
                onClick={() => setShowProveedorModal(true)}
                className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-600 shadow-sm border border-amber-100 transition-all hover:bg-amber-100 hover:shadow-md active:scale-95 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20"
              >
                <Plus size={14} />
                Registrar nuevo proveedor
              </button>
            </div>
            <p className="mb-2 text-[10px] text-slate-400">Cada ítem indica a qué proveedor se le enviará la solicitud de cotización. El sistema agrupará automáticamente los ítems por proveedor.</p>
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
                            if (!newValue) {
                              updateItemProveedor(idx, '', '');
                            } else if (newValue.isExisting) {
                              updateItemProveedor(idx, newValue.value, newValue.label);
                            } else {
                              updateItemProveedor(idx, '', newValue.value);
                            }
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

        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border dark:border-amber-800/50">
          <strong>Sin precios:</strong> La solicitud de cotización solo lista los materiales necesarios.
          El proveedor responderá con precios, los cuales se ingresarán como "Cotización de Venta" en el siguiente paso.
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
          <button type="submit" disabled={submitting || items.length === 0}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-60">
            <Plus size={16} />
            {submitting ? 'Generando...' : `Generar Solicitudes (${new Set(items.filter(i => i.proveedor_id || i.proveedor_nombre.trim()).map(i => i.proveedor_id ? `cat_${i.proveedor_id}` : `txt_${i.proveedor_nombre.trim().toLowerCase()}`)).size} proveedores)`}
          </button>
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
