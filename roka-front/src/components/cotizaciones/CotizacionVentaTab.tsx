import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Eye, Check, X, DollarSign } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import FlowStepper from '../ui/FlowStepper';
import { useApi } from '@/hooks/useApi';
import {
  getCotizaciones, createCotizacion, aprobarCotizacion, rechazarCotizacion,
  getSolicitudes, getSolicitud, getProveedores
} from '@/lib/api';
import ProveedorModal from '../proveedores/ProveedorModal';

export default function CotizacionVentaTab() {
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const { data: cotizaciones, loading, refetch } = useApi(() => getCotizaciones(), []);

  const [solicitudId, setSolicitudId] = useState('');
  const [proveedorId, setProveedorId] = useState<number | ''>('');
  const [proveedorOtro, setProveedorOtro] = useState('');
  const [solicitudItems, setSolicitudItems] = useState<any[]>([]);
  const [precios, setPrecios] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const { data: solicitudes } = useApi(() => getSolicitudes({ estado: undefined }), []);
  const solicitudesForQuote = solicitudes?.filter((s: any) => s.estado !== 'Aprobado') || [];

  const { data: proveedores, refetch: refetchProveedores } = useApi(() => getProveedores(), []);

  const [showProveedorModal, setShowProveedorModal] = useState(false);

  useEffect(() => {
    if (!solicitudId) {
      setSolicitudItems([]);
      setPrecios({});
      return;
    }
    setLoadingItems(true);
    getSolicitud(Number(solicitudId))
      .then(data => {
        setSolicitudItems(data.items || []);
        const defaultPrecios: Record<number, string> = {};
        (data.items || []).forEach((item: any) => { defaultPrecios[item.id] = ''; });
        setPrecios(defaultPrecios);
      })
      .finally(() => setLoadingItems(false));
  }, [solicitudId]);

  const calcTotal = () => {
    return solicitudItems.reduce((sum, item) => {
      const precio = parseFloat(precios[item.id] || '0');
      return sum + (precio * parseFloat(item.cantidad_requerida));
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedorId && !proveedorOtro) {
      alert('Debes seleccionar un proveedor del catálogo o escribir el nombre de otro proveedor');
      return;
    }
    setSubmitting(true);
    try {
      const proveedorData: { proveedor_id?: number; proveedor: string } = { proveedor: '' };
      if (proveedorId) {
        proveedorData.proveedor_id = Number(proveedorId);
        const prov = proveedores?.find((p: any) => p.id === Number(proveedorId));
        proveedorData.proveedor = prov?.nombre || '';
      } else if (proveedorOtro) {
        proveedorData.proveedor = proveedorOtro;
      }
      await createCotizacion({
        solicitud_id: Number(solicitudId),
        ...proveedorData,
        items: solicitudItems.map(item => ({
          solicitud_item_id: item.id,
          precio_unitario: parseFloat(precios[item.id] || '0'),
        })),
      });
      setShowForm(false);
      setSolicitudId('');
      setProveedorId('');
      setProveedorOtro('');
      setPrecios({});
      refetch();
    } catch (err: any) {
      alert(err.message || 'Error al crear cotización');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAprobar = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Aprobar esta cotización de venta?')) return;
    try { await aprobarCotizacion(id); refetch(); }
    catch { alert('Error al aprobar'); }
  };

  const handleRechazar = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Rechazar esta cotización de venta?')) return;
    try { await rechazarCotizacion(id); refetch(); }
    catch { alert('Error al rechazar'); }
  };

  const columns = [
    {
      key: 'id', header: 'ID', sortable: true,
      render: (row: any) => <span className="font-mono text-xs font-bold text-blue-600">COT-{String(row.id).padStart(3, '0')}</span>,
    },
    {
      key: 'solicitud_id', header: 'Solicitud',
      render: (row: any) => <span className="font-mono text-xs text-slate-500">SOL-{String(row.solicitud_id).padStart(3, '0')}</span>,
    },
    { key: 'proveedor', header: 'Proveedor', sortable: true },
    { key: 'proyecto_nombre', header: 'Proyecto', sortable: true },
    {
      key: 'total', header: 'Total', sortable: true,
      render: (row: any) => (
        <span className="font-mono text-sm font-bold text-slate-800">${Number(row.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
      ),
    },
    {
      key: 'estado', header: 'Estado', sortable: true,
      render: (row: any) => <StatusBadge status={row.estado} />,
    },
    {
      key: 'actions', header: '', className: 'w-28',
      render: (row: any) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); setShowDetail(row); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Ver detalle">
            <Eye size={14} />
          </button>
          {row.estado === 'Pendiente' && (
            <>
              <button onClick={(e) => handleAprobar(row.id, e)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Aprobar">
                <Check size={14} />
              </button>
              <button onClick={(e) => handleRechazar(row.id, e)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Rechazar">
                <X size={14} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Respuesta del proveedor con precios. Desde aquí se aprueba/rechaza y se genera la OC.
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.98]">
          <Plus size={18} />
          Nueva Cotización de Venta
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        {[
          { label: 'Pendientes', value: cotizaciones?.filter((c: any) => c.estado === 'Pendiente').length || 0, color: 'text-amber-600' },
          { label: 'Aprobadas', value: cotizaciones?.filter((c: any) => c.estado === 'Aprobada').length || 0, color: 'text-emerald-600' },
          { label: 'Rechazadas', value: cotizaciones?.filter((c: any) => c.estado === 'Rechazada').length || 0, color: 'text-red-600' },
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
            data={cotizaciones || []}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por proveedor, proyecto..."
            emptyTitle="Sin cotizaciones de venta"
            emptyMessage="Registra una cotización desde una solicitud de cotización o directamente desde una solicitud de materiales"
          />
        </div>
      </motion.div>

      {/* Create Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)}
        title="Nueva Cotización de Venta"
        subtitle="Registra la respuesta del proveedor con precios" size="xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Solicitud</label>
              <select required value={solicitudId} onChange={e => setSolicitudId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400">
                <option value="">Seleccionar solicitud...</option>
                {solicitudesForQuote.map((s: any) => (
                  <option key={s.id} value={s.id}>SOL-{String(s.id).padStart(3, '0')} — {s.proyecto_nombre} ({s.estado})</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Proveedor</label>
                <button type="button" onClick={() => setShowProveedorModal(true)}
                  className="text-[10px] font-bold text-blue-600 hover:underline">+ Registrar nuevo</button>
              </div>
              <select value={proveedorId} onChange={e => {
                if (e.target.value === 'otro') { setProveedorId(''); setProveedorOtro(''); }
                else { setProveedorId(e.target.value); setProveedorOtro(''); }
              }} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400">
                <option value="">Seleccionar proveedor...</option>
                {proveedores?.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} {p.rut ? `(${p.rut})` : ''}</option>)}
                <option value="otro">+ Otro proveedor (escribir)</option>
              </select>
              {proveedorId === '' && (
                <input type="text" value={proveedorOtro} onChange={e => setProveedorOtro(e.target.value)}
                  placeholder="Nombre del proveedor"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400" />
              )}
            </div>
          </div>

          {solicitudItems.length > 0 && (
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Precios por Ítem</label>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Material</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Cantidad</th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Unidad</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Precio Unit.</th>
                      <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudItems.map((item: any) => {
                      const precio = parseFloat(precios[item.id] || '0');
                      const subtotal = precio * parseFloat(item.cantidad_requerida);
                      return (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{item.nombre_material}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600">{Number(item.cantidad_requerida).toLocaleString()}</td>
                          <td className="px-3 py-2 text-slate-500">{item.unidad}</td>
                          <td className="px-3 py-2">
                            <input required type="number" min="0.01" step="0.01"
                              value={precios[item.id] || ''}
                              onChange={e => setPrecios(prev => ({ ...prev, [item.id]: e.target.value }))}
                              className="w-28 ml-auto block rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-sm outline-none focus:border-blue-400"
                              placeholder="$0.00" />
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                            ${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-blue-50/50">
                    <tr>
                      <td colSpan={4} className="px-3 py-3 text-right text-xs font-bold uppercase text-slate-600">Total Cotización</td>
                      <td className="px-3 py-3 text-right font-mono text-lg font-black text-blue-700">
                        ${calcTotal().toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {loadingItems && <div className="text-center text-xs text-slate-400 py-4">Cargando ítems de la solicitud...</div>}

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
            <button type="submit" disabled={submitting || solicitudItems.length === 0}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-60">
              <DollarSign size={16} />
              {submitting ? 'Creando...' : 'Registrar Cotización'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)}
        title={showDetail ? `Cotización COT-${String(showDetail.id).padStart(3, '0')}` : ''}
        subtitle={showDetail ? `Proveedor: ${showDetail.proveedor}` : ''} size="lg">
        {showDetail && (
          <div className="space-y-4">
            <FlowStepper currentStep={1} estado={showDetail.estado} tipo="cotizacion" />
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Solicitud</p>
                <p className="text-sm font-bold text-slate-800">SOL-{String(showDetail.solicitud_id).padStart(3, '0')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Total</p>
                <p className="text-sm font-bold text-blue-700">${Number(showDetail.total).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Estado</p>
                <StatusBadge status={showDetail.estado} size="md" />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Proyecto</p>
              <p className="text-sm font-bold text-slate-800">{showDetail.proyecto_nombre}</p>
            </div>
          </div>
        )}
      </Modal>

      <ProveedorModal isOpen={showProveedorModal} onClose={() => setShowProveedorModal(false)}
        onSave={async (nuevoProveedor) => {
          await refetchProveedores();
          setProveedorId(nuevoProveedor.id);
          setProveedorOtro('');
        }} />
    </>
  );
}
