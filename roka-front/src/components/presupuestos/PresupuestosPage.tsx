import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Wallet, AlertTriangle, Layers, Trash2 } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { useApi } from '@/hooks/useApi';
import {
  createPresupuesto,
  createPresupuestoCategoria,
  getAlertasPresupuesto,
  getPresupuestoProyecto,
  getPresupuestos,
  getProyectosAdmin,
  getMaterialCategorias,
} from '@/lib/api';
import { formatCLP } from '@/lib/utils';
import { showAlert, showToast } from '@/lib/alerts';

export default function PresupuestosPage() {
  const { data: presupuestos, loading, refetch } = useApi(() => getPresupuestos(), []);
  const { data: proyectos } = useApi(() => getProyectosAdmin({ is_active: true }), []);
  const { data: alertas } = useApi(() => getAlertasPresupuesto(), []);
  const { data: masterCategorias } = useApi(() => getMaterialCategorias(), []);

  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    proyecto_id: '',
    monto_total: '',
    umbral_alerta: '80',
    estado: 'Vigente',
    categorias: [{ nombre: 'Materiales', monto_asignado: '' }],
  });

  const [newCategoria, setNewCategoria] = useState({ nombre: '', monto_asignado: '' });
  const [addingCategoria, setAddingCategoria] = useState(false);

  const rows = presupuestos || [];
  const totalAsignado = useMemo(() => rows.reduce((acc: number, p: any) => acc + Number(p.monto_total || 0), 0), [rows]);
  const totalComprometido = useMemo(() => rows.reduce((acc: number, p: any) => acc + Number(p.gasto_total || 0), 0), [rows]);
  const alertasCriticas = useMemo(() => (alertas || []).filter((a: any) => a.estado_alerta !== 'OK').length, [alertas]);

  const addCategoria = () => {
    setForm(prev => ({ ...prev, categorias: [...prev.categorias, { nombre: '', monto_asignado: '' }] }));
  };

  const removeCategoria = (idx: number) => {
    setForm(prev => ({ ...prev, categorias: prev.categorias.filter((_, i) => i !== idx) }));
  };

  const updateCategoria = (idx: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      categorias: prev.categorias.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const totalCategorias = form.categorias.reduce((acc, c) => acc + Number(c.monto_asignado || 0), 0);
    const montoTotal = Number(form.monto_total);

    if (totalCategorias > montoTotal) {
      showAlert({
        title: 'Presupuesto Excedido',
        text: `La sumatoria de las categorías (${formatCLP(totalCategorias)}) supera el monto total del presupuesto (${formatCLP(montoTotal)}).`,
        icon: 'warning'
      });
      setSubmitting(false);
      return;
    }

    try {
      await createPresupuesto({
        proyecto_id: Number(form.proyecto_id),
        monto_total: Number(form.monto_total),
        umbral_alerta: Number(form.umbral_alerta),
        estado: form.estado,
        categorias: form.categorias
          .filter(c => c.nombre && c.monto_asignado)
          .map(c => ({ nombre: c.nombre, monto_asignado: Number(c.monto_asignado) })),
      });

      showToast({ title: 'Presupuesto guardado con éxito', icon: 'success' });
      setShowCreate(false);
      setForm({
        proyecto_id: '',
        monto_total: '',
        umbral_alerta: '80',
        estado: 'Vigente',
        categorias: [{ nombre: 'Materiales', monto_asignado: '' }],
      });
      refetch();
    } catch (error: any) {
      if (error.status === 409) {
        showAlert({ title: 'Conflicto', text: 'Este proyecto ya cuenta con un presupuesto asignado.', icon: 'error' });
      } else {
        showAlert({ title: 'Error', text: error.message || 'Error al crear presupuesto', icon: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (row: any) => {
    try {
      const detail = await getPresupuestoProyecto(row.proyecto_id);
      setShowDetail(detail);
    } catch (error: any) {
      showAlert({ title: 'Error', text: error.message || 'Error al cargar detalle de presupuesto', icon: 'error' });
    }
  };

  const handleAddCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showDetail) return;

    setAddingCategoria(true);
    const montoNuevo = Number(newCategoria.monto_asignado);
    const totalAsignadoCategorias = (showDetail.categorias || []).reduce((acc: number, c: any) => acc + Number(c.monto_asignado || 0), 0);
    const totalFuturo = totalAsignadoCategorias + montoNuevo;
    const presupuestoTotal = Number(showDetail.monto_total);

    if (totalFuturo > presupuestoTotal) {
      showAlert({
        title: 'Presupuesto Excedido',
        text: `No se puede agregar la categoría. La sumatoria total (${formatCLP(totalFuturo)}) superaría el presupuesto total del proyecto (${formatCLP(presupuestoTotal)}).`,
        icon: 'warning'
      });
      setAddingCategoria(false);
      return;
    }

    try {
      await createPresupuestoCategoria(showDetail.id, {
        nombre: newCategoria.nombre,
        monto_asignado: Number(newCategoria.monto_asignado),
      });

      const detail = await getPresupuestoProyecto(showDetail.proyecto_id);
      setShowDetail(detail);
      setNewCategoria({ nombre: '', monto_asignado: '' });
      showToast({ title: 'Categoría agregada', icon: 'success' });
      refetch();
    } catch (error: any) {
      showAlert({ title: 'Error', text: error.message || 'Error al agregar categoría', icon: 'error' });
    } finally {
      setAddingCategoria(false);
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (row: any) => <span className="font-mono text-xs font-bold text-amber-600">PRE-{String(row.id).padStart(3, '0')}</span>,
    },
    { key: 'proyecto_nombre', header: 'Proyecto', sortable: true },
    {
      key: 'monto_total',
      header: 'Presupuesto',
      sortable: true,
      render: (row: any) => formatCLP(Number(row.monto_total)),
    },
    {
      key: 'gasto_total',
      header: 'Usado',
      sortable: true,
      render: (row: any) => formatCLP(Number(row.gasto_total)),
    },
    {
      key: 'monto_disponible',
      header: 'Disponible',
      sortable: true,
      render: (row: any) => (
        <span className={Number(row.monto_disponible) < 0 ? 'font-bold text-red-600' : 'font-bold text-emerald-600'}>
          {formatCLP(Number(row.monto_disponible))}
        </span>
      ),
    },
    {
      key: 'porcentaje_uso',
      header: '% Uso',
      sortable: true,
      render: (row: any) => {
        const usage = Number(row.porcentaje_uso || 0);
        const color = usage >= 100 ? 'text-red-600' : usage >= Number(row.umbral_alerta) ? 'text-amber-600' : 'text-slate-700';
        return <span className={`font-bold ${color}`}>{usage.toFixed(1)}%</span>;
      },
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
    },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-600">Administración</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Presupuesto</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Controla el presupuesto por proyecto y categorías de gasto.</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600"
          >
            <Plus size={18} />
            Nuevo Presupuesto
          </button>
        </div>
      </motion.div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-slate-800/50 dark:border-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Asignado</p>
          <p className="text-2xl font-black text-blue-600">{formatCLP(totalAsignado)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-slate-800/50 dark:border-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Usado</p>
          <p className="text-2xl font-black text-amber-600">{formatCLP(totalComprometido)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-slate-800/50 dark:border-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Alertas</p>
          <p className="text-2xl font-black text-red-600">{alertasCriticas}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-[#111827]/40 dark:border dark:border-slate-800">
        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          searchable
          searchPlaceholder="Buscar por proyecto o estado..."
          emptyTitle="Sin presupuestos"
          emptyMessage="Crea el primer presupuesto por proyecto"
          onRowClick={openDetail}
        />
      </div>

      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo Presupuesto"
        subtitle="Define monto total y distribución por categorías"
        size="xl"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Proyecto</label>
              <select
                required
                value={form.proyecto_id}
                onChange={(e) => setForm({ ...form, proyecto_id: e.target.value })}
                title="Proyecto al cual se asigna el presupuesto. Solo se permite un presupuesto por proyecto"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">Seleccionar proyecto...</option>
                {proyectos
                  ?.filter((p: any) => !rows.some((b: any) => b.proyecto_id === p.id))
                  .map((p: any) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))
                }
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Monto Total</label>
              <input
                type="number"
                required
                min="1"
                value={form.monto_total}
                onChange={(e) => setForm({ ...form, monto_total: e.target.value })}
                title="Monto total del presupuesto asignado al proyecto en pesos"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Umbral %</label>
              <input
                type="number"
                required
                min="1"
                max="100"
                value={form.umbral_alerta}
                onChange={(e) => setForm({ ...form, umbral_alerta: e.target.value })}
                title="Porcentaje de uso del presupuesto a partir del cual se generarán alertas de notificación (por defecto 80%)"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Categorías iniciales</p>
              <button type="button" onClick={addCategoria} className="text-xs font-bold text-amber-600 hover:text-amber-700">Agregar categoría</button>
            </div>
            <div className="space-y-2">
              {form.categorias.map((c, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <select
                    required
                    value={c.nombre}
                    onChange={(e) => updateCategoria(idx, 'nombre', e.target.value)}
                    title="Selecciona una de las categorías definidas en el maestro de materiales"
                    className="col-span-7 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  >
                    <option value="">Seleccionar categoría...</option>
                    {masterCategorias?.map((cat: any) => (
                      <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Monto"
                    min="1"
                    value={c.monto_asignado}
                    onChange={(e) => updateCategoria(idx, 'monto_asignado', e.target.value)}
                    title="Monto asignado a esta categoría de gasto dentro del presupuesto total"
                    className="col-span-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeCategoria(idx)}
                    className="col-span-1 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} className="mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-60"
            >
              <Wallet size={16} />
              {submitting ? 'Guardando...' : 'Guardar Presupuesto'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={showDetail ? `Presupuesto ${showDetail.proyecto_nombre}` : ''}
        subtitle="Detalle por categorías"
        size="xl"
      >
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Monto Total</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCLP(Number(showDetail.monto_total))}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Comprometido</p>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{formatCLP(Number(showDetail.monto_comprometido))}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Disponible</p>
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatCLP(Number(showDetail.monto_disponible))}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Uso</p>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{Number(showDetail.porcentaje_uso).toFixed(1)}%</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Layers size={16} className="text-slate-500" />
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Categorías</p>
              </div>

              <div className="space-y-2">
                {showDetail.categorias?.length ? showDetail.categorias.map((c: any) => (
                  <div key={c.id} className="grid grid-cols-4 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-sm font-bold text-slate-800">{c.nombre}</p>
                    <p className="text-xs text-slate-500">Asignado: ${Number(c.monto_asignado).toLocaleString('es-ES')}</p>
                    <p className="text-xs text-amber-700">Comprometido: ${Number(c.monto_comprometido).toLocaleString('es-ES')}</p>
                    <p className="text-xs font-bold text-emerald-700">Disponible: ${Number(c.monto_disponible).toLocaleString('es-ES')}</p>
                  </div>
                )) : (
                  <p className="text-xs text-slate-500">No hay categorías para este presupuesto.</p>
                )}
              </div>

              <form onSubmit={handleAddCategoria} className="mt-4 grid grid-cols-12 gap-2 border-t border-slate-100 pt-4">
                <select
                  required
                  value={newCategoria.nombre}
                  onChange={(e) => setNewCategoria({ ...newCategoria, nombre: e.target.value })}
                  title="Selecciona la categoría a agregar al presupuesto"
                  className="col-span-7 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                >
                  <option value="">Seleccionar categoría...</option>
                  {masterCategorias?.map((cat: any) => (
                    <option key={cat.id} value={cat.nombre}>{cat.nombre}</option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Monto"
                  value={newCategoria.monto_asignado}
                  onChange={(e) => setNewCategoria({ ...newCategoria, monto_asignado: e.target.value })}
                  title="Monto presupuestado para la nueva categoría de gasto"
                  className="col-span-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={addingCategoria}
                  className="col-span-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {addingCategoria ? 'Agregando...' : 'Agregar'}
                </button>
              </form>
            </div>

            {(alertas || []).some((a: any) => a.proyecto_id === showDetail.proyecto_id && a.estado_alerta !== 'OK') && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle size={16} />
                Este presupuesto tiene alerta activa por umbral o sobreconsumo.
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
