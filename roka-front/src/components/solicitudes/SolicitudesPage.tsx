import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, FileText, Eye, Trash2, Upload } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import FlowStepper from '../ui/FlowStepper';
import { useApi } from '@/hooks/useApi';
import {
  getSolicitudes,
  getSolicitud,
  createSolicitud,
  deleteSolicitud,
  getProyectos,
  getMaterialesMaster,
  getUnidadesMedida,
  createMaterialMaster,
  getCotizaciones
} from '@/lib/api';
import MaterialModal from '../materiales/MaterialModal';
import BulkImportModal from './BulkImportModal';
import { MaterialInput } from '@/types';


export default function SolicitudesPage() {
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const { data: solicitudes, loading, refetch } = useApi(() => getSolicitudes(), []);
  const { data: proyectos } = useApi(() => getProyectos(), []);
  const { data: masterMateriales, refetch: refetchMateriales } = useApi(() => getMaterialesMaster(), []);
  const { data: masterUnidades } = useApi(() => getUnidadesMedida(), []);
  const { data: cotizaciones } = useApi(() => getCotizaciones(), []);
  
  // Material Modal state
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({
    proyecto_id: '',
    solicitante: '',
    items: [{ material_id: null as number | null, nombre_material: '', cantidad_requerida: '', unidad: 'Unidades', codigo: '' }],
  });
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { material_id: null, nombre_material: '', cantidad_requerida: '', unidad: 'Unidades', codigo: '' }],
    }));
  };

  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createSolicitud({
        proyecto_id: Number(form.proyecto_id),
        solicitante: form.solicitante,
        items: form.items.map(i => ({
          material_id: i.material_id,
          nombre_material: i.nombre_material,
          cantidad_requerida: Number(i.cantidad_requerida),
          unidad: i.unidad,
          ...(i.codigo ? { codigo: i.codigo } : {}),
        })),
      });
      setShowForm(false);
      setForm({
        proyecto_id: '',
        solicitante: '',
        items: [{ material_id: null, nombre_material: '', cantidad_requerida: '', unidad: 'Unidades', codigo: '' }],
      });
      refetch();
    } catch (err) {
      alert('Error al crear solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta solicitud?')) return;
    try {
      await deleteSolicitud(id);
      refetch();
    } catch {
      alert('Error al eliminar');
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (row: any) => (
        <span className="font-mono text-xs font-bold text-amber-600">SOL-{String(row.id).padStart(3, '0')}</span>
      ),
    },
    { key: 'proyecto_nombre', header: 'Proyecto', sortable: true },
    { key: 'solicitante', header: 'Solicitante', sortable: true },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      render: (row: any) => new Date(row.fecha).toLocaleDateString('es-ES'),
    },
    {
      key: 'total_items',
      header: 'Ítems',
      render: (row: any) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
          {row.total_items}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (row: any) => <StatusBadge status={row.estado} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (row: any) => (
        <div className="flex gap-1">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setLoadingDetail(true);
              try {
                const detail = await getSolicitud(row.id);
                setShowDetail(detail);
              } catch (err) {
                console.error('Error al cargar detalle:', err);
                alert('Error al cargar los detalles de la solicitud');
              } finally {
                setLoadingDetail(false);
              }
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  const unidadesStatic = ['Unidades', 'kg', 'm³', 'Toneladas', 'Sacos', 'Galones', 'Piezas', 'ml', 'Litros'];

  const onNewMaterialSaved = async (data: MaterialInput) => {
    try {
      const resp = await createMaterialMaster(data);
      await refetchMateriales();
      return resp;
    } catch (error) {
      console.error('Error al crear material maestro:', error);
      throw error;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-600">Módulo 1</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">
              Solicitudes de Materiales
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Gestiona las solicitudes de materiales para cada proyecto de obra.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setShowBulkImport(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
            >
              <Upload size={18} />
              Importar
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 hover:shadow-amber-500/30 active:scale-[0.98]"
            >
              <Plus size={18} />
              Nueva Solicitud
            </button>
          </div>

        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pendientes', value: solicitudes?.filter((s: any) => s.estado === 'Pendiente').length || 0, color: 'text-amber-600' },
          { label: 'Cotizando', value: solicitudes?.filter((s: any) => s.estado === 'Cotizando').length || 0, color: 'text-blue-600' },
          { label: 'Aprobadas', value: solicitudes?.filter((s: any) => s.estado === 'Aprobado').length || 0, color: 'text-emerald-600' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <DataTable
            columns={columns}
            data={solicitudes || []}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por proyecto, solicitante..."
            emptyTitle="Sin solicitudes"
            emptyMessage="Crea tu primera solicitud de materiales"
          />
        </div>
      </motion.div>

      {/* Create Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Nueva Solicitud de Materiales"
        subtitle="Agrega los materiales requeridos para el proyecto"
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Proyecto</label>
              <select
                required
                value={form.proyecto_id}
                onChange={e => setForm({ ...form, proyecto_id: e.target.value })}
                title="Proyecto para el cual se solicitan los materiales"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              >
                <option value="">Seleccionar proyecto...</option>
                {proyectos?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Solicitante</label>
              <input
                required
                type="text"
                value={form.solicitante}
                onChange={e => setForm({ ...form, solicitante: e.target.value })}
                placeholder="Nombre del solicitante"
                title="Nombre de la persona que solicita los materiales en obra"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Materiales</label>
              <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-amber-600 hover:text-amber-700">
                <Plus size={14} /> Agregar ítem
              </button>
            </div>
            <div className="space-y-4">
              {form.items.map((item, idx) => (
                <div key={idx} className="space-y-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                         <label className="text-[10px] font-bold uppercase text-slate-400">Material / Insumo <span className="text-slate-300 normal-case font-normal">(catálogo opcional)</span></label>
                         <button
                          type="button"
                          onClick={() => setIsMaterialModalOpen(true)}
                          className="text-[10px] font-bold text-amber-600 hover:underline"
                          title="Registrar nuevo material en el catálogo"
                         >
                           + Nuevo en catálogo
                         </button>
                      </div>
                      <select
                        value={item.material_id || ''}
                        onChange={e => {
                          const matId = Number(e.target.value);
                          const mat = masterMateriales?.find((m: any) => m.id === matId);
                          setForm(prev => ({
                            ...prev,
                            items: prev.items.map((it, i) => i === idx ? {
                              ...it,
                              material_id: matId || null,
                              nombre_material: mat?.nombre || it.nombre_material,
                              unidad: mat?.unidad_abreviatura || it.unidad,
                              codigo: mat?.sku || it.codigo,
                            } : it)
                          }));
                        }}
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-400"
                      >
                        <option value="">— Sin catálogo / manual —</option>
                        {masterMateriales?.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre} {m.sku ? `(${m.sku})` : ''} — {m.unidad_abreviatura}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Cant.</label>
                        <input
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.cantidad_requerida}
                          onChange={e => updateItem(idx, 'cantidad_requerida', e.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none focus:border-amber-400"
                        />
                      </div>

                      <div className="w-28">
                         <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Unidad</label>
                         <select
                          value={item.unidad}
                          onChange={e => updateItem(idx, 'unidad', e.target.value)}
                          className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-sm outline-none focus:border-amber-400"
                        >
                          {masterUnidades?.map((u: any) => (
                            <option key={u.id} value={u.abreviatura}>{u.nombre} ({u.abreviatura})</option>
                          )) || unidadesStatic.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-end">
                      {form.items.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="mb-2 p-1 text-slate-400 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nombre + Código — siempre visibles, requerido nombre si no hay catálogo */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      required={!item.material_id}
                      type="text"
                      placeholder={item.material_id ? 'Nombre (auto desde catálogo)' : 'Nombre del material *'}
                      value={item.nombre_material}
                      onChange={e => updateItem(idx, 'nombre_material', e.target.value)}
                      className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs italic outline-none focus:border-amber-400"
                    />
                    <input
                      type="text"
                      placeholder="Código (opcional)"
                      value={item.codigo}
                      onChange={e => updateItem(idx, 'codigo', e.target.value)}
                      className="w-full sm:w-32 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-mono outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-60"
            >
              <FileText size={16} />
              {submitting ? 'Creando...' : 'Crear Solicitud'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={showDetail ? `Solicitud SOL-${String(showDetail.id).padStart(3, '0')}` : ''}
        subtitle={showDetail?.proyecto_nombre}
        size="lg"
      >
        {showDetail && (
          <div className="space-y-4">
            <FlowStepper currentStep={0} estado={showDetail.estado} tipo="solicitud" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Solicitante</p>
                <p className="text-sm font-bold text-slate-800">{showDetail.solicitante}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Fecha</p>
                <p className="text-sm font-bold text-slate-800">{new Date(showDetail.fecha).toLocaleDateString('es-ES')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Estado</p>
                <StatusBadge status={showDetail.estado} size="md" />
              </div>
            </div>

            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Ítems de la solicitud</p>
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Material</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Cantidad</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Unidad</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Precio Ref.</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Subtotal</th>
                </tr></thead>
                <tbody>
                  {loadingDetail ? (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-400">Cargando ítems...</td></tr>
                  ) : showDetail.items ? showDetail.items.map((item: any) => {
                    const subtotal = item.precio_referencial ? Number(item.precio_referencial) * Number(item.cantidad_requerida) : null;
                    return (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                             <span className="font-medium text-slate-800">{item.material_oficial_nombre || item.nombre_material}</span>
                             {item.material_sku && <span className="text-[9px] font-mono text-slate-400">{item.material_sku}</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">{Number(item.cantidad_requerida).toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-500">{item.unidad_abreviatura || item.unidad}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">${item.precio_referencial ? Number(item.precio_referencial).toLocaleString('es-CL', { minimumFractionDigits: 2 }) : '—'}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600 font-bold">${subtotal ? subtotal.toLocaleString('es-CL', { minimumFractionDigits: 2 }) : '—'}</td>
                      </tr>
                    );
                  }) : (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-slate-400">Sin ítems</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {!loadingDetail && showDetail.items && (
              <div className="rounded-lg bg-blue-50 p-3 border border-blue-200">
                <p className="text-[10px] font-bold uppercase text-blue-600 mb-2">Total Estimado</p>
                <p className="text-2xl font-black text-blue-900">
                  ${showDetail.items
                    .reduce((sum: number, item: any) => {
                      const subtotal = item.precio_referencial ? Number(item.precio_referencial) * Number(item.cantidad_requerida) : 0;
                      return sum + subtotal;
                    }, 0)
                    .toLocaleString('es-CL', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            {cotizaciones && cotizaciones.filter((c: any) => c.solicitud_id === showDetail.id).length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Cotizaciones relacionadas</p>
                <div className="space-y-2">
                  {cotizaciones
                    .filter((c: any) => c.solicitud_id === showDetail.id)
                    .map((cot: any) => (
                      <div key={cot.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{cot.proveedor}</span>
                          <StatusBadge status={cot.estado} size="sm" />
                        </div>
                        <span className="font-mono text-slate-600">${Number(cot.total).toLocaleString('es-CL', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <MaterialModal 
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        onSave={onNewMaterialSaved}
        unidades={masterUnidades || []}
      />

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        proyectos={proyectos || []}
        masterMateriales={masterMateriales || []}
        onSuccess={() => {
          refetch();
          setShowBulkImport(false);
        }}
      />
    </div>

  );
}
