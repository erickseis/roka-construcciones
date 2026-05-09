import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { createOrdenManual, getSolicitudes, getUnidadesMedida, getProveedores } from '@/lib/api';
import { AlertCircle, Plus, Trash2, Building2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getProyectosAdmin } from '@/lib/api';
import { formatCLP } from '@/lib/utils';
import CreatableSelect from 'react-select/creatable';
import ProveedorModal from '../proveedores/ProveedorModal';

interface OCIItem {
  id: number;
  nombre_material: string;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  codigo: string;
}

export default function OCManualModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const { data: proyectos } = useApi(() => getProyectosAdmin(), []);
  const { data: masterUnidades } = useApi(() => getUnidadesMedida(), []);
  const { data: proveedoresList, refetch: refetchProveedores } = useApi(() => getProveedores(), []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [proyectoId, setProyectoId] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState<{ id: number | null; nombre: string; rut: string }>({ id: null, nombre: '', rut: '' });
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [items, setItems] = useState<OCIItem[]>([{ id: 1, nombre_material: '', cantidad: 0, unidad: 'Unidades', precio_unitario: 0, codigo: '' }]);
  const [condicionesPago, setCondicionesPago] = useState('Contado');
  const [plazoEntrega, setPlazoEntrega] = useState('');
  const [atencionA, setAtencionA] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [solicitudId, setSolicitudId] = useState('');
  const [codigoObra, setCodigoObra] = useState('');
  const [solicitudes, setSolicitudes] = useState<any[]>([]);

  // Fetch solicitudes when project changes
  useEffect(() => {
    if (!proyectoId) {
      setSolicitudes([]);
      setSolicitudId('');
      setCodigoObra('');
      return;
    }
    // Auto-cargar código de obra desde el proyecto seleccionado
    const proyecto = proyectos?.find((p: any) => p.id === Number(proyectoId));
    if (proyecto?.numero_obra) {
      setCodigoObra(proyecto.numero_obra);
    } else {
      setCodigoObra('');
    }
    getSolicitudes({ proyecto_id: Number(proyectoId) })
      .then(res => setSolicitudes(Array.isArray(res) ? res : (res as any)?.data || []))
      .catch(() => setSolicitudes([]));
  }, [proyectoId, proyectos]);

  const addItem = () => {
    setItems([...items, { id: items.length + 1, nombre_material: '', cantidad: 0, unidad: 'Unidades', precio_unitario: 0, codigo: '' }]);
  };

  const removeItem = (id: number) => {
    if (items.length <= 1) return;
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: number, field: string, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const total = items.reduce((sum, i) => sum + (Number(i.cantidad) * Number(i.precio_unitario)), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!proyectoId) { setError('Selecciona un proyecto'); return; }
    if (!selectedProveedor.nombre.trim()) { setError('Ingresa el nombre del proveedor'); return; }

    const validItems = items.filter(i => i.nombre_material.trim() && i.cantidad > 0 && i.precio_unitario > 0);
    if (validItems.length === 0) { setError('Agrega al menos un ítem válido'); return; }

    setSubmitting(true);
    try {
      await createOrdenManual({
        proyecto_id: Number(proyectoId),
        proveedor: selectedProveedor.nombre.trim(),
        proveedor_rut: selectedProveedor.rut || undefined,
        items: validItems,
        condiciones_pago: condicionesPago || undefined,
        plazo_entrega: plazoEntrega || undefined,
        atencion_a: atencionA || undefined,
        observaciones: observaciones || undefined,
        solicitud_id: solicitudId ? Number(solicitudId) : undefined,
        codigo_obra: codigoObra.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al crear OC manual');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Orden de Compra Manual" subtitle="Para urgencias de terreno sin solicitud previa" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={14} /><span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Proyecto *</label>
            <select value={proyectoId} onChange={e => setProyectoId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:focus:border-amber-500/50">
              <option value="" className="dark:bg-slate-900">Seleccionar proyecto</option>
              {proyectos?.filter((p: any) => p.is_active).map((p: any) => (
                <option key={p.id} value={p.id} className="dark:bg-slate-900">{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">N° de Orden de Compra (opcional)</label>
            <input type="text" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" disabled placeholder="Auto-generado" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Solicitud de Materiales</label>
            <select value={solicitudId} onChange={e => setSolicitudId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100 dark:focus:border-amber-500/50">
              <option value="" className="dark:bg-slate-900">Sin solicitud (opcional)</option>
              {solicitudes.map((s: any) => (
                <option key={s.id} value={s.id} className="dark:bg-slate-900">
                  SM-{String(s.id).padStart(3, '0')} — {s.solicitante} ({s.estado})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">Vincula esta OC a una solicitud existente para trazabilidad.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Código de Obra</label>
            <input type="text" value={codigoObra} onChange={e => setCodigoObra(e.target.value)} placeholder="Se auto-carga al seleccionar proyecto" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" readOnly />
            <p className="mt-1 text-[10px] text-slate-400">Se auto-carga desde el N° de obra del proyecto.</p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Proveedor</p>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nombre *</label>
                <button type="button" onClick={() => setShowProveedorModal(true)}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer">
                  <Building2 size={12} /> Nuevo proveedor
                </button>
              </div>
              <CreatableSelect
                isClearable
                placeholder="Buscar proveedor del catálogo o escribir nuevo..."
                options={proveedoresList?.map((p: any) => ({
                  value: p.id,
                  label: `${p.nombre}${p.rut ? ` (${p.rut})` : ''}`,
                  proveedor: p,
                })) || []}
                value={selectedProveedor.id ? {
                  value: selectedProveedor.id,
                  label: selectedProveedor.nombre + (selectedProveedor.rut ? ` (${selectedProveedor.rut})` : ''),
                } : selectedProveedor.nombre ? {
                  value: selectedProveedor.nombre,
                  label: selectedProveedor.nombre,
                  isManual: true,
                } : null}
                onChange={(newValue: any, actionMeta) => {
                  if (!newValue) {
                    setSelectedProveedor({ id: null, nombre: '', rut: '' });
                  } else if (newValue.isManual || (actionMeta.action === 'create-option')) {
                    setSelectedProveedor({ id: null, nombre: newValue.value, rut: '' });
                  } else if (newValue.proveedor) {
                    const prov = newValue.proveedor;
                    setSelectedProveedor({ id: prov.id, nombre: prov.nombre, rut: prov.rut || '' });
                  }
                }}
                formatCreateLabel={(v) => `Usar ingreso manual: "${v}"`}
                menuPortalTarget={document.body}
                styles={{
                  control: (base, state) => ({
                    ...base,
                    minHeight: '38px',
                    borderRadius: '0.375rem',
                    borderColor: state.isFocused ? '#fbbf24' : '#e2e8f0',
                    backgroundColor: 'transparent',
                    boxShadow: state.isFocused ? '0 0 0 1px #fbbf24' : 'none',
                    '&:hover': { borderColor: state.isFocused ? '#fbbf24' : '#cbd5e1' },
                    fontSize: '0.875rem',
                  }),
                  singleValue: (base) => ({ ...base, color: 'inherit' }),
                  input: (base) => ({ ...base, color: 'inherit' }),
                  placeholder: (base) => ({ ...base, color: '#94a3b8' }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                  menu: (base) => ({
                    ...base,
                    fontSize: '0.875rem',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                  }),
                  option: (base, state) => ({
                    ...base,
                    backgroundColor: state.isSelected ? '#f59e0b' : state.isFocused ? '#334155' : 'transparent',
                    color: state.isSelected ? 'white' : '#f1f5f9',
                    '&:active': { backgroundColor: '#f59e0b' },
                  }),
                }}
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">RUT</label>
              <input
                type="text"
                value={selectedProveedor.rut}
                onChange={e => setSelectedProveedor(prev => ({ ...prev, rut: e.target.value }))}
                placeholder={selectedProveedor.id ? 'Cargado desde catálogo' : '12.345.678-9'}
                readOnly={!!selectedProveedor.id}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400 bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Ítems</p>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 cursor-pointer">
              <Plus size={14} /> Agregar ítem
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-end gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50/50 dark:bg-slate-900/40 dark:border-slate-800">
                <div className="flex-1 grid grid-cols-5 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Material / Descripción</label>
                    <input type="text" value={item.nombre_material} onChange={e => updateItem(item.id, 'nombre_material', e.target.value)} placeholder="Ej: Cemento" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Cant.</label>
                    <input type="number" step="0.01" min="0" value={item.cantidad} onChange={e => updateItem(item.id, 'cantidad', Number(e.target.value))} placeholder="0" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Unidad</label>
                    <select
                      value={item.unidad}
                      onChange={e => updateItem(item.id, 'unidad', e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                    >
                      <option value="" className="dark:bg-slate-800">Seleccionar</option>
                      {masterUnidades?.map((u: any) => (
                        <option key={u.id} value={u.abreviatura} className="dark:bg-slate-800">{u.nombre} ({u.abreviatura})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Precio Unit. ($)</label>
                    <input type="number" step="0.01" min="0" value={item.precio_unitario} onChange={e => updateItem(item.id, 'precio_unitario', Number(e.target.value))} placeholder="0" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
                  </div>
                </div>
                <button type="button" onClick={() => removeItem(item.id)} className="mb-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-900/20 dark:hover:text-red-400 cursor-pointer" title="Eliminar ítem">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 text-right text-sm font-bold text-slate-700 dark:text-slate-200">
            Total: {formatCLP(total)}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Condiciones</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Condiciones de Pago</label>
              <input type="text" value={condicionesPago} onChange={e => setCondicionesPago(e.target.value)} placeholder="Contado, Neto 30 días" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Plazo de Entrega</label>
              <input type="text" value={plazoEntrega} onChange={e => setPlazoEntrega(e.target.value)} placeholder="Inmediata, 5 días hábiles" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Atención a</label>
              <input type="text" value={atencionA} onChange={e => setAtencionA(e.target.value)} placeholder="Nombre de contacto" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Observaciones</label>
              <input type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas adicionales" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100" />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200 dark:border dark:border-amber-800/50">
          <strong>Constancia:</strong> Esta OC se crea sin respaldo de solicitud de materiales ni cotización previa.
        </div>

        <ProveedorModal
          isOpen={showProveedorModal}
          onClose={() => setShowProveedorModal(false)}
          onSave={async (nuevo: any) => {
            await refetchProveedores();
            setSelectedProveedor({ id: nuevo.id, nombre: nuevo.nombre, rut: nuevo.rut || '' });
            setShowProveedorModal(false);
          }}
        />

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer">Cancelar</button>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-95 disabled:opacity-60 cursor-pointer">
            {submitting ? 'Creando...' : 'Crear OC Manual'}
          </button>
        </div>
      </form>
    </Modal>
  );
}