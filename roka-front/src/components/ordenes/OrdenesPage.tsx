import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Eye, Truck, PackageCheck, FileText } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import FlowStepper from '../ui/FlowStepper';
import OCPreviewModal from './OCPreviewModal';
import OCManualModal from './OCManualModal';
import { useApi } from '@/hooks/useApi';
import {
  getOrdenes, generarOrden, updateEstadoEntrega,
  getSolicitudesCotizacion, getOrden
} from '@/lib/api';

export default function OrdenesPage() {
  const [showForm, setShowForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const [ocPreview, setOcPreview] = useState<any | null>(null);
  const [loadingOc, setLoadingOc] = useState(false);
  const { data: ordenes, loading, refetch } = useApi(() => getOrdenes(), []);

  // Form state
  const [solicitudCotizacionId, setSolicitudCotizacionId] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('Neto 30 días');
  const [folio, setFolio] = useState('');
  const [descuentoTipo, setDescuentoTipo] = useState<'none' | 'porcentaje' | 'monto'>('none');
  const [descuentoValor, setDescuentoValor] = useState('0');
  const [plazoEntrega, setPlazoEntrega] = useState('Inmediata');
  const [condicionesEntrega, setCondicionesEntrega] = useState('Puesto en obra');
  const [atencionA, setAtencionA] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Solicitudes de cotización respondidas available for OC
  const { data: solicitudesCotizacion } = useApi(() => getSolicitudesCotizacion({ estado: 'Respondida' }), []);

  const selectedSC = solicitudesCotizacion?.find((sc: any) => sc.id === Number(solicitudCotizacionId));
  // Calculate subtotal from items with prices
  const subtotalBase = selectedSC?.items?.reduce((sum: number, item: any) => {
    return sum + (Number(item.precio_unitario || 0) * Number(item.cantidad_requerida || 0));
  }, 0) || 0;
  const descuentoValorNum = Number(descuentoValor || 0);
  const descuentoMonto = descuentoTipo === 'porcentaje'
    ? (subtotalBase * descuentoValorNum) / 100
    : descuentoTipo === 'monto'
      ? descuentoValorNum
      : 0;
  const subtotalNetoEstimado = Math.max(0, subtotalBase - descuentoMonto);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await generarOrden({
        solicitud_cotizacion_id: Number(solicitudCotizacionId),
        condiciones_pago: condicionesPago,
        folio: folio.trim() || undefined,
        descuento_tipo: descuentoTipo,
        descuento_valor: descuentoTipo === 'none' ? 0 : descuentoValorNum,
        plazo_entrega: plazoEntrega.trim() || undefined,
        condiciones_entrega: condicionesEntrega.trim() || undefined,
        atencion_a: atencionA.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      setShowForm(false);
      setSolicitudCotizacionId('');
      setCondicionesPago('Neto 30 días');
      setFolio('');
      setDescuentoTipo('none');
      setDescuentoValor('0');
      setPlazoEntrega('Inmediata');
      setCondicionesEntrega('Puesto en obra');
      setAtencionA('');
      setObservaciones('');
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

  const handlePreviewOC = async (id: number) => {
    setLoadingOc(true);
    try {
      const data = await getOrden(id);
      setOcPreview(data);
    } catch (err: any) {
      alert(err.message || 'Error al cargar orden de compra');
    } finally {
      setLoadingOc(false);
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (row: any) => (
        <span className="font-mono text-xs font-bold text-emerald-600">{row.folio || `OC-${String(row.id).padStart(3, '0')}`}</span>
      ),
    },
    {
      key: 'solicitud_cotizacion_id',
      header: 'Sol. Cotización',
      render: (row: any) => (
        <span className="font-mono text-xs text-slate-500">SC-{String(row.solicitud_cotizacion_id).padStart(3, '0')}</span>
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
          ${Number(row.total_final ?? row.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
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
      className: 'w-40',
      render: (row: any) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handlePreviewOC(row.id); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors"
            title="Ver / Imprimir OC"
          >
            <FileText size={14} />
          </button>
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
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Órdenes de Compra
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
               Genera y gestiona órdenes de compra a partir de solicitudes de cotización respondidas.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:shadow-emerald-600/30 active:scale-[0.98]"
            >
              <Plus size={18} />
              Generar OC
            </button>
            <button
              onClick={() => setShowManualForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 hover:shadow-orange-500/30 active:scale-[0.98]"
            >
              <Plus size={18} />
              OC Manual
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pendientes', value: ordenes?.filter((o: any) => o.estado_entrega === 'Pendiente').length || 0, color: 'text-amber-600' },
          { label: 'Recibido Parcial', value: ordenes?.filter((o: any) => o.estado_entrega === 'Recibido parcial').length || 0, color: 'text-sky-600' },
          { label: 'Completadas', value: ordenes?.filter((o: any) => o.estado_entrega === 'Completado').length || 0, color: 'text-emerald-600' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:border dark:border-slate-800">
          <DataTable
            columns={columns}
            data={ordenes || []}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por proveedor, proyecto..."
            emptyTitle="Sin órdenes"
             emptyMessage="Genera una orden a partir de una solicitud de cotización respondida"
          />
        </div>
      </motion.div>

      {/* Generate OC Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Generar Orden de Compra"
         subtitle="Selecciona una solicitud de cotización respondida para crear la OC"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Solicitud de Cotización Respondida
            </label>
            <select
              required
              value={solicitudCotizacionId}
              onChange={e => setSolicitudCotizacionId(e.target.value)}
              title="Solicitud de cotización respondida de la cual se generará la orden de compra, compromete el presupuesto del proyecto"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Seleccionar solicitud de cotización...</option>
              {solicitudesCotizacion?.map((sc: any) => (
                <option key={sc.id} value={sc.id}>
                  SC-{String(sc.id).padStart(3, '0')} — {sc.proveedor} — {sc.proyecto_nombre}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Folio (opcional)
              </label>
              <input
                value={folio}
                onChange={e => setFolio(e.target.value)}
                placeholder="Si queda vacío se autogenera"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Plazo de Entrega
              </label>
              <input
                value={plazoEntrega}
                onChange={e => setPlazoEntrega(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Condiciones de Entrega
            </label>
            <input
              value={condicionesEntrega}
              onChange={e => setCondicionesEntrega(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Tipo de Descuento
              </label>
              <select
                value={descuentoTipo}
                onChange={e => setDescuentoTipo(e.target.value as 'none' | 'porcentaje' | 'monto')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="none">Sin descuento</option>
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto">Monto fijo ($)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Valor de Descuento
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                disabled={descuentoTipo === 'none'}
                value={descuentoValor}
                onChange={e => setDescuentoValor(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              A la atención de
            </label>
            <input
              value={atencionA}
              onChange={e => setAtencionA(e.target.value)}
              placeholder="Contacto del proveedor"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Observaciones
            </label>
            <textarea
              value={observaciones}
              onChange={e => setObservaciones(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {solicitudCotizacionId && solicitudesCotizacion && (
            <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-100">
              <p className="text-xs font-bold text-emerald-700 mb-1">Resumen</p>
              {(() => {
                const sc = selectedSC;
                if (!sc) return null;
                return (
                  <div className="space-y-1 text-sm text-emerald-800">
                    <p><span className="font-medium">Proveedor:</span> {sc.proveedor}</p>
                    <p><span className="font-medium">Proyecto:</span> {sc.proyecto_nombre}</p>
                    <p><span className="font-medium">Subtotal base:</span> ${Number(subtotalBase).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                    <p><span className="font-medium">Descuento:</span> ${Math.max(0, descuentoMonto).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
                    <p className="text-lg font-black mt-2">
                      Neto comprometido: ${Number(subtotalNetoEstimado).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
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
              disabled={submitting || !solicitudCotizacionId}
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
        title={showDetail ? `Orden de Compra ${showDetail.folio || `OC-${String(showDetail.id).padStart(3, '0')}`}` : ''}
        subtitle={showDetail ? `Proveedor: ${showDetail.proveedor}` : ''}
        size="lg"
      >
        {showDetail && (
          <div className="space-y-4">
            <FlowStepper currentStep={3} estado={showDetail.estado_entrega} tipo="orden" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Solicitud de Cotización</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">SC-{String(showDetail.solicitud_cotizacion_id).padStart(3, '0')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Fecha Emisión</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{new Date(showDetail.fecha_emision).toLocaleDateString('es-ES')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Condiciones de Pago</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{showDetail.condiciones_pago}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Estado Entrega</p>
                <StatusBadge status={showDetail.estado_entrega} size="md" />
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-center dark:bg-emerald-950/20 dark:border-emerald-900">
              <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Total Orden de Compra</p>
              <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">
                ${Number(showDetail.total_final ?? showDetail.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-[10px] font-bold uppercase text-slate-400">Proyecto</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{showDetail.proyecto_nombre}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* OC Preview Modal */}
      <OCPreviewModal
        isOpen={!!ocPreview}
        onClose={() => setOcPreview(null)}
        orden={ocPreview}
      />

      {/* OC Manual Modal */}
      <OCManualModal
        isOpen={showManualForm}
        onClose={() => { setShowManualForm(false); refetch(); }}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
