import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { createOrdenManual, getSolicitudes, getUnidadesMedida } from '@/lib/api';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { getProyectosAdmin } from '@/lib/api';

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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [proyectoId, setProyectoId] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [proveedorRut, setProveedorRut] = useState('');
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
      return;
    }
    getSolicitudes({ proyecto_id: Number(proyectoId) })
      .then(res => setSolicitudes(Array.isArray(res) ? res : (res as any)?.data || []))
      .catch(() => setSolicitudes([]));
  }, [proyectoId]);

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
    if (!proveedor.trim()) { setError('Ingresa el nombre del proveedor'); return; }

    const validItems = items.filter(i => i.nombre_material.trim() && i.cantidad > 0 && i.precio_unitario > 0);
    if (validItems.length === 0) { setError('Agrega al menos un ítem válido'); return; }

    setSubmitting(true);
    try {
      await createOrdenManual({
        proyecto_id: Number(proyectoId),
        proveedor: proveedor.trim(),
        proveedor_rut: proveedorRut || undefined,
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
    <Modal isOpen={isOpen} onClose={onClose} title="Orden de Compra Manual" subtitle="Para urgencias de terreno sin solicitud previa" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={14} /><span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Proyecto *</label>
            <select value={proyectoId} onChange={e => setProyectoId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400">
              <option value="">Seleccionar proyecto</option>
              {proyectos?.filter((p: any) => p.is_active).map((p: any) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Folio (opcional)</label>
            <input type="text" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400" disabled placeholder="Auto-generado" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Solicitud de Materiales</label>
            <select value={solicitudId} onChange={e => setSolicitudId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400">
              <option value="">Sin solicitud (opcional)</option>
              {solicitudes.map((s: any) => (
                <option key={s.id} value={s.id}>
                  SM-{String(s.id).padStart(3, '0')} — {s.solicitante} ({s.estado})
                </option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-slate-400">Vincula esta OC a una solicitud existente para trazabilidad.</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Código de Obra</label>
            <input type="text" value={codigoObra} onChange={e => setCodigoObra(e.target.value)} placeholder="Ej: OB-2024-001" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            <p className="mt-1 text-[10px] text-slate-400">Si no se especifica, se usa el N° de licitación del proyecto.</p>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Proveedor</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Nombre *</label>
              <input type="text" value={proveedor} onChange={e => setProveedor(e.target.value)} placeholder="Nombre del proveedor" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">RUT</label>
              <input type="text" value={proveedorRut} onChange={e => setProveedorRut(e.target.value)} placeholder="12.345.678-9" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Ítems</p>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700">
              <Plus size={14} /> Agregar ítem
            </button>
          </div>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={item.id} className="flex items-end gap-2 rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                <div className="flex-1 grid grid-cols-5 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Material / Descripción</label>
                    <input type="text" value={item.nombre_material} onChange={e => updateItem(item.id, 'nombre_material', e.target.value)} placeholder="Ej: Cemento" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Cant.</label>
                    <input type="number" step="0.01" min="0" value={item.cantidad} onChange={e => updateItem(item.id, 'cantidad', Number(e.target.value))} placeholder="0" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Unidad</label>
                    <select 
                      value={item.unidad} 
                      onChange={e => updateItem(item.id, 'unidad', e.target.value)} 
                      className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-400"
                    >
                      <option value="">Seleccionar</option>
                      {masterUnidades?.map((u: any) => (
                        <option key={u.id} value={u.abreviatura}>{u.nombre} ({u.abreviatura})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Precio Unit. ($)</label>
                    <input type="number" step="0.01" min="0" value={item.precio_unitario} onChange={e => updateItem(item.id, 'precio_unitario', Number(e.target.value))} placeholder="0" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-amber-400" />
                  </div>
                </div>
                <button type="button" onClick={() => removeItem(item.id)} className="mb-1 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors" title="Eliminar ítem">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 text-right text-sm font-bold text-slate-700">
            Total: ${total.toLocaleString('es-CL')}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Condiciones</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Condiciones de Pago</label>
              <input type="text" value={condicionesPago} onChange={e => setCondicionesPago(e.target.value)} placeholder="Contado, Neto 30 días" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Plazo de Entrega</label>
              <input type="text" value={plazoEntrega} onChange={e => setPlazoEntrega(e.target.value)} placeholder="Inmediata, 5 días hábiles" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Atención a</label>
              <input type="text" value={atencionA} onChange={e => setAtencionA(e.target.value)} placeholder="Nombre de contacto" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Observaciones</label>
              <input type="text" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Notas adicionales" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400" />
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Constancia:</strong> Esta OC se crea sin respaldo de solicitud de materiales ni cotización previa.
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 disabled:opacity-60">
            {submitting ? 'Creando...' : 'Crear OC Manual'}
          </button>
        </div>
      </form>
    </Modal>
  );
}