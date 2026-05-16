import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Eye, Truck, PackageCheck, FileText, XCircle } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import FlowStepper from '../ui/FlowStepper';
import FilterPanel, { FilterField } from '../ui/FilterPanel';
import OCPreviewModal from './OCPreviewModal';
import OCManualModal from './OCManualModal';
import { CrearOCModal } from './CrearOCModal';
import { useApi } from '@/hooks/useApi';
import { formatCLP } from '@/lib/utils';
import {
  getOrdenes, updateEstadoEntrega, anularOrden, getOrden
} from '@/lib/api';

export default function OrdenesPage() {
  const [showForm, setShowForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const [ocPreview, setOcPreview] = useState<any | null>(null);
  const [loadingOc, setLoadingOc] = useState(false);
  const { data: ordenes, loading, refetch } = useApi(() => getOrdenes(), []);

  // Filters
  const [filters, setFilters] = useState<Record<string, string>>({
    estado_entrega: '', proveedor: '', proyecto: '',
    fecha_desde: '', fecha_hasta: '', total_min: '', total_max: '',
  });
  const handleFilterChange = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleResetFilters = () => setFilters({ estado_entrega: '', proveedor: '', proyecto: '', fecha_desde: '', fecha_hasta: '', total_min: '', total_max: '' });
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  const filteredOrdenes = React.useMemo(() => {
    if (!ordenes) return [];
    let result = [...ordenes];
    if (filters.estado_entrega) result = result.filter((o: any) => o.estado_entrega === filters.estado_entrega);
    if (filters.proveedor) result = result.filter((o: any) => o.proveedor === filters.proveedor);
    if (filters.proyecto) result = result.filter((o: any) => o.proyecto_nombre === filters.proyecto);
    if (filters.fecha_desde) result = result.filter((o: any) => o.fecha_emision && String(o.fecha_emision).slice(0, 10) >= filters.fecha_desde);
    if (filters.fecha_hasta) result = result.filter((o: any) => o.fecha_emision && String(o.fecha_emision).slice(0, 10) <= filters.fecha_hasta);
    if (filters.total_min) result = result.filter((o: any) => Number(o.total_final ?? o.total ?? 0) >= Number(filters.total_min));
    if (filters.total_max) result = result.filter((o: any) => Number(o.total_final ?? o.total ?? 0) <= Number(filters.total_max));
    return result;
  }, [ordenes, filters]);

  const filterFields: FilterField[] = React.useMemo(() => {
    const proveedores = Array.from(new Set((ordenes || []).map((o: any) => o.proveedor).filter(Boolean))) as string[];
    const proyectos = Array.from(new Set((ordenes || []).map((o: any) => o.proyecto_nombre).filter(Boolean))) as string[];
    return [
      {
        key: 'estado_entrega', label: 'Estado Entrega', type: 'select',
        options: [
          { value: 'Pendiente', label: 'Pendiente' },
          { value: 'Recibido parcial', label: 'Recibido parcial' },
          { value: 'Completado', label: 'Completado' },
          { value: 'Anulada', label: 'Anulada' },
        ]
      },
      { key: 'proveedor', label: 'Proveedor', type: 'select', options: proveedores.map(p => ({ value: p, label: p })) },
      { key: 'proyecto', label: 'Proyecto', type: 'select', options: proyectos.map(p => ({ value: p, label: p })) },
      { key: 'fecha_desde', label: 'Emisión desde', type: 'date' },
      { key: 'fecha_hasta', label: 'Emisión hasta', type: 'date' },
      { key: 'total_min', label: 'Total mínimo', type: 'number', placeholder: '0' },
      { key: 'total_max', label: 'Total máximo', type: 'number', placeholder: '999999' },
    ];
  }, [ordenes]);

  const handleUpdateEntrega = async (id: number, estado: string) => {
    try {
      await updateEstadoEntrega(id, estado);
      refetch();
    } catch {
      alert('Error al actualizar estado');
    }
  };

  const handleAnular = async (id: number) => {
    const confirmed = window.confirm('¿Estás seguro de anular esta Orden de Compra? Se liberará el presupuesto y la solicitud de materiales volverá a Pendiente.');
    if (!confirmed) return;
    try {
      await anularOrden(id);
      refetch();
    } catch (err: any) {
      alert(err.message || 'Error al anular orden de compra');
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
        <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">{row.folio || `OC-${String(row.id).padStart(3, '0')}`}</span>
      ),
    },
    {
      key: 'solicitud_cotizacion_id',
      header: 'Sol. Cotización',
      render: (row: any) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">SC-{String(row.solicitud_cotizacion_id).padStart(3, '0')}</span>
      ),
    },
    { key: 'proveedor', header: 'Proveedor', sortable: true },
    { 
      key: 'proyecto_nombre', 
      header: 'Proyecto', 
      sortable: true,
      render: (row: any) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-700 dark:text-slate-200">{row.proyecto_nombre}</span>
          {row.proyecto_numero_obra && (
            <span className="text-[10px] font-mono text-slate-400">N° {row.proyecto_numero_obra}</span>
          )}
        </div>
      )
    },
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
        <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-100">
          {formatCLP(Number(row.total_final ?? row.total))}
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
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (row: any) => {
        const isAnulada = row.estado === 'Anulada';
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
            isAnulada ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
          }`}>
            {isAnulada ? 'Anulada' : 'Vigente'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-48',
      render: (row: any) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handlePreviewOC(row.id); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors cursor-pointer"
            title="Ver / Imprimir OC"
          >
            <FileText size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowDetail(row); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          {row.estado !== 'Anulada' && row.estado_entrega === 'Pendiente' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleUpdateEntrega(row.id, 'Recibido parcial'); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors cursor-pointer"
              title="Marcar recibido parcial"
            >
              <Truck size={14} />
            </button>
          )}
          {row.estado !== 'Anulada' && row.estado_entrega === 'Recibido parcial' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleUpdateEntrega(row.id, 'Completado'); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors cursor-pointer"
              title="Marcar completado"
            >
              <PackageCheck size={14} />
            </button>
          )}
          {(!row.estado || row.estado === 'Vigente') && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAnular(row.id); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
              title="Anular orden de compra"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

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
            {/* <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:shadow-emerald-600/30 active:scale-[0.98] cursor-pointer"
            >
              <Plus size={18} />
              Generar OC
            </button> */}
            <button
              onClick={() => setShowManualForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 hover:shadow-orange-500/30 active:scale-[0.98] cursor-pointer"
            >
              <Plus size={18} />
              OC Manual
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Vigentes', value: ordenes?.filter((o: any) => !o.estado || o.estado === 'Vigente').length || 0, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pendientes', value: ordenes?.filter((o: any) => o.estado_entrega === 'Pendiente').length || 0, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Recibido Parcial', value: ordenes?.filter((o: any) => o.estado_entrega === 'Recibido parcial').length || 0, color: 'text-sky-600 dark:text-sky-400' },
          { label: 'Anuladas', value: ordenes?.filter((o: any) => o.estado === 'Anulada').length || 0, color: 'text-red-600 dark:text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <FilterPanel
        fields={filterFields}
        values={filters}
        onChange={handleFilterChange}
        onReset={handleResetFilters}
        activeCount={activeFilterCount}
      />

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:border dark:border-slate-800">
          {activeFilterCount > 0 && (
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-600">
              {filteredOrdenes.length} resultado{filteredOrdenes.length !== 1 ? 's' : ''} con filtros aplicados
            </p>
          )}
          <DataTable
            columns={columns}
            data={filteredOrdenes}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por proveedor, proyecto..."
            emptyTitle="Sin órdenes"
            emptyMessage="Genera una orden a partir de una solicitud de cotización respondida"
          />
        </div>
      </motion.div>

      {/* Generate OC Modal */}
      <CrearOCModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onSuccess={() => { setShowForm(false); refetch(); }}
      />

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

            {showDetail.fecha_requerida && showDetail.estado_entrega !== 'Completado' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-500">Fecha requerida en terreno:</span>
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                    {new Date(showDetail.fecha_requerida).toLocaleDateString('es-CL')}
                  </span>
                  {(() => {
                    const d = new Date(showDetail.fecha_requerida);
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
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Estado OC</p>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                  showDetail.estado === 'Anulada' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}>
                  {showDetail.estado === 'Anulada' ? 'Anulada' : 'Vigente'}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-center dark:bg-emerald-950/20 dark:border-emerald-900">
              <p className="text-[10px] font-bold uppercase text-emerald-600 mb-1">Total Orden de Compra</p>
              <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">
                {formatCLP(Number(showDetail.total_final ?? showDetail.total))}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-[10px] font-bold uppercase text-slate-400">Proyecto</p>
              <div className="flex flex-col">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{showDetail.proyecto_nombre}</p>
                {showDetail.proyecto_numero_obra && (
                  <p className="text-[10px] font-mono text-slate-400">N° {showDetail.proyecto_numero_obra}</p>
                )}
              </div>
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