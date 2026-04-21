import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Eye, Truck, PackageCheck } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { useApi } from '@/hooks/useApi';
import {
  getOrdenes, generarOrden, updateEstadoEntrega,
  getCotizaciones
} from '@/lib/api';

export default function OrdenesPage() {
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const { data: ordenes, loading, refetch } = useApi(() => getOrdenes(), []);

  // Form state
  const [cotizacionId, setCotizacionId] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('Neto 30 días');
  const [submitting, setSubmitting] = useState(false);

  // Approved cotizaciones available for OC
  const { data: cotizaciones } = useApi(() => getCotizaciones({ estado: 'Aprobada' }), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await generarOrden({
        cotizacion_id: Number(cotizacionId),
        condiciones_pago: condicionesPago,
      });
      setShowForm(false);
      setCotizacionId('');
      setCondicionesPago('Neto 30 días');
      refetch();
    } catch (err: any) {
      alert(err.message || 'Error al generar orden de compra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEntrega = async (id: number, estado: string) => {
    try {
      await updateEstadoEntrega(id, estado);
      refetch();
    } catch {
      alert('Error al actualizar estado');
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (row: any) => (
        <span className="font-mono text-xs font-bold text-emerald-600">OC-{String(row.id).padStart(3, '0')}</span>
      ),
    },
    {
      key: 'cotizacion_id',
      header: 'Cotización',
      render: (row: any) => (
        <span className="font-mono text-xs text-slate-500">COT-{String(row.cotizacion_id).padStart(3, '0')}</span>
      ),
    },
    { key: 'proveedor', header: 'Proveedor', sortable: true },
    { key: 'proyecto_nombre', header: 'Proyecto', sortable: true },
    {
      key: 'fecha_emision',
      header: 'Emisión',
      sortable: true,
      render: (row: any) => new Date(row.fecha_emision).toLocaleDateString('es-ES'),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      render: (row: any) => (
        <span className="font-mono text-sm font-bold text-slate-800">
          ${Number(row.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    { key: 'condiciones_pago', header: 'Pago' },
    {
      key: 'estado_entrega',
      header: 'Entrega',
      sortable: true,
      render: (row: any) => <StatusBadge status={row.estado_entrega} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-28',
      render: (row: any) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetail(row); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          {row.estado_entrega === 'Pendiente' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleUpdateEntrega(row.id, 'Recibido parcial'); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
              title="Marcar recibido parcial"
            >
              <Truck size={14} />
            </button>
          )}
          {row.estado_entrega === 'Recibido parcial' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleUpdateEntrega(row.id, 'Completado'); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
              title="Marcar completado"
            >
              <PackageCheck size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const condicionesOpciones = ['Neto 30 días', 'Neto 60 días', 'Contado', 'Contra entrega', '50% anticipo'];

  return (
    <div>
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-600">Módulo 3</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">
              Órdenes de Compra
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Genera y gestiona órdenes de compra a partir de cotizaciones aprobadas.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:shadow-emerald-600/30 active:scale-[0.98]"
          >
            <Plus size={18} />
            Generar OC
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Pendientes', value: ordenes?.filter((o: any) => o.estado_entrega === 'Pendiente').length || 0, color: 'text-amber-600' },
          { label: 'Recibido Parcial', value: ordenes?.filter((o: any) => o.estado_entrega === 'Recibido parcial').length || 0, color: 'text-sky-600' },
          { label: 'Completadas', value: ordenes?.filter((o: any) => o.estado_entrega === 'Completado').length || 0, color: 'text-emerald-600' },
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
            data={ordenes || []}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por proveedor, proyecto..."
            emptyTitle="Sin órdenes"
            emptyMessage="Genera una orden a partir de una cotización aprobada"
          />
        </div>
      </motion.div>

      {/* Generate OC Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Generar Orden de Compra"
        subtitle="Selecciona una cotización aprobada para crear la OC"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Cotización Aprobada
            </label>
            <select
              required
              value={cotizacionId}
              onChange={e => setCotizacionId(e.target.value)}
              title="Cotización aprobada previamente de la cual se generará la orden de compra, compromete el presupuesto del proyecto"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Seleccionar cotización...</option>
              {cotizaciones?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  COT-{String(c.id).padStart(3, '0')} — {c.proveedor} — ${Number(c.total).toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Condiciones de Pago
            </label>
            <select
              value={condicionesPago}
              onChange={e => setCondicionesPago(e.target.value)}
              title="Términos de pago acordados con el proveedor para la orden de compra"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              {condicionesOpciones.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {cotizacionId && cotizaciones && (
            <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-700 mb-1">Resumen</p>
              {(() => {
                const cot = cotizaciones.find((c: any) => c.id === Number(cotizacionId));
                if (!cot) return null;
                return (
                  <div className="space-y-1 text-sm text-emerald-800">
                    <p><span className="font-medium">Proveedor:</span> {cot.proveedor}</p>
                    <p><span className="font-medium">Proyecto:</span> {cot.proyecto_nombre}</p>
                    <p className="text-lg font-black mt-2">
                      Total: ${Number(cot.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

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
              disabled={submitting || !cotizacionId}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-60"
            >
              <PackageCheck size={16} />
              {submitting ? 'Generando...' : 'Generar Orden de Compra'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={showDetail ? `Orden de Compra OC-${String(showDetail.id).padStart(3, '0')}` : ''}
        subtitle={showDetail ? `Proveedor: ${showDetail.proveedor}` : ''}
        size="lg"
      >
        {showDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Cotización</p>
                <p className="text-sm font-bold text-slate-800">COT-{String(showDetail.cotizacion_id).padStart(3, '0')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Fecha Emisión</p>
                <p className="text-sm font-bold text-slate-800">{new Date(showDetail.fecha_emision).toLocaleDateString('es-ES')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Condiciones de Pago</p>
                <p className="text-sm font-bold text-slate-800">{showDetail.condiciones_pago}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Estado Entrega</p>
                <StatusBadge status={showDetail.estado_entrega} size="md" />
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-center">
              <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Total Orden de Compra</p>
              <p className="text-3xl font-black text-emerald-700">
                ${Number(showDetail.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Proyecto</p>
              <p className="text-sm font-bold text-slate-800">{showDetail.proyecto_nombre}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
