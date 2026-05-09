import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Eye, Send, Trash2, FileDown, Upload, ShoppingCart, FileText, Ban } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import FilterPanel, { FilterField } from '../ui/FilterPanel';
import { useApi } from '@/hooks/useApi';
import { getSolicitudesCotizacion, changeSolicitudCotizacionEstado, deleteSolicitudCotizacion, getSolicitudes, descargarSolicitudCotizacionPdf, getSolicitudCotizacion, getOrden } from '@/lib/api';
import SolicitudCotizacionModal from './SolicitudCotizacionModal';
import SolicitudCotizacionDetailModal from './SolicitudCotizacionDetailModal';
import ImportarRespuestaSCModal from './ImportarRespuestaSCModal';
import { CrearOCModal } from '../ordenes/CrearOCModal';
import OCPreviewModal from '../ordenes/OCPreviewModal';
import { Clock, AlertTriangle } from 'lucide-react';
import Swal from 'sweetalert2';

const estadoColor: Record<string, string> = {
  Borrador: 'text-slate-500',
  Enviada: 'text-blue-600',
  Respondida: 'text-emerald-600',
  Anulada: 'text-red-600',
};

export default function SolicitudCotizacionTab() {
  const [showForm, setShowForm] = useState(false);
  const [initialSolicitudId, setInitialSolicitudId] = useState<string | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [crearOCFromSC, setCrearOCFromSC] = useState<number | null>(null);
  const [ocPreview, setOcPreview] = useState<any | null>(null);
  const [loadingOc, setLoadingOc] = useState(false);
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false);

  // Filters
  const [filters, setFilters] = useState<Record<string, string>>({
    estado: '', proveedor: '', proyecto: '', fecha_desde: '', fecha_hasta: '',
  });
  const handleFilterChange = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleResetFilters = () => setFilters({ estado: '', proveedor: '', proyecto: '', fecha_desde: '', fecha_hasta: '' });
  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

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

  const { data: list, loading, refetch } = useApi(() => getSolicitudesCotizacion(), []);
  // Cargar solicitudes de materiales pendientes para procesar
  const { data: solicitudesPendientes, loading: loadingPendientes, refetch: refetchPendientes } = useApi(() => getSolicitudes({ estado: 'Pendiente' }), []);

  const handleOpenForm = (solId?: string) => {
    setInitialSolicitudId(solId);
    setShowForm(true);
  };

  const filteredList = React.useMemo(() => {
    if (!list) return [];
    let result = (list as any[]).filter((c: any) => mostrarAnuladas || c.estado?.toUpperCase() !== 'ANULADA');
    if (filters.estado) result = result.filter((c: any) => c.estado === filters.estado);
    if (filters.proveedor) result = result.filter((c: any) => c.proveedor === filters.proveedor);
    if (filters.proyecto) result = result.filter((c: any) => c.proyecto_nombre === filters.proyecto);
    if (filters.fecha_desde) result = result.filter((c: any) => c.created_at && String(c.created_at).slice(0, 10) >= filters.fecha_desde);
    if (filters.fecha_hasta) result = result.filter((c: any) => c.created_at && String(c.created_at).slice(0, 10) <= filters.fecha_hasta);
    return result;
  }, [list, mostrarAnuladas, filters]);

  const filterFields: FilterField[] = React.useMemo(() => {
    const proveedores = Array.from(new Set((list || []).map((c: any) => c.proveedor).filter(Boolean))) as string[];
    const proyectos = Array.from(new Set((list || []).map((c: any) => c.proyecto_nombre).filter(Boolean))) as string[];
    return [
      {
        key: 'estado', label: 'Estado', type: 'select',
        options: [
          { value: 'Borrador', label: 'Borrador' },
          { value: 'Enviada', label: 'Enviada' },
          { value: 'Respondida', label: 'Respondida' },
          { value: 'Anulada', label: 'Anulada' },
        ]
      },
      { key: 'proveedor', label: 'Proveedor', type: 'select', options: proveedores.map(p => ({ value: p, label: p })) },
      { key: 'proyecto', label: 'Proyecto', type: 'select', options: proyectos.map(p => ({ value: p, label: p })) },
      { key: 'fecha_desde', label: 'Fecha desde', type: 'date' },
      { key: 'fecha_hasta', label: 'Fecha hasta', type: 'date' },
    ];
  }, [list]);

  // Auto-open form when coming from dashboard with solicitud_id param
  useEffect(() => {
    const solId = searchParams.get('solicitud_id');
    if (solId) {
      handleOpenForm(solId);
      setSearchParams({}, { replace: true });
    }
  }, []);

  const handleEstado = async (id: number, estado: string) => {
    try {
      await changeSolicitudCotizacionEstado(id, estado);
      refetch();
      refetchPendientes();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  const handleAnular = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Al anular esta cotización, no podrá ser utilizada en el flujo de compra.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await changeSolicitudCotizacionEstado(id, 'Anulada');
        refetch();
        refetchPendientes();
      } catch { alert('Error al anular'); }
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta solicitud de cotización?')) return;
    try {
      await deleteSolicitudCotizacion(id);
      refetch();
      refetchPendientes();
    } catch { alert('Error al eliminar'); }
  };

  const handleOpenImport = async (id: number) => {
    try {
      const data = await getSolicitudCotizacion(id);
      setImportData(data);
      setShowImport(true);
    } catch (err: any) {
      alert(err.message || 'Error al cargar datos de la cotización');
    }
  };

  const columns = [
    {
      key: 'id', header: 'ID', sortable: true,
      render: (row: any) => <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">SC-{String(row.id).padStart(3, '0')}</span>,
    },
    { key: 'proveedor', header: 'Proveedor', sortable: true },
    {
      key: 'solicitud_id', header: 'Solicitud',
      render: (row: any) => <span className="font-mono text-xs text-slate-500 dark:text-slate-400">SOL-{String(row.solicitud_id).padStart(3, '0')}</span>,
    },
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
      key: 'total_items', header: 'Ítems',
      render: (row: any) => (
        <span className="font-mono text-sm text-slate-600 dark:text-slate-400">{row.total_items ?? '-'}</span>
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
          <button onClick={(e) => { e.stopPropagation(); setDetailId(row.id); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer" title="Ver detalle">
            <Eye size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); descargarSolicitudCotizacionPdf(row.id); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 cursor-pointer" title="Descargar PDF">
            <FileDown size={14} />
          </button>
          {row.estado?.toUpperCase() === 'ENVIADA' && (
            <button onClick={(e) => { e.stopPropagation(); handleOpenImport(row.id); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer" title="Cargar respuesta del vendedor">
              <Upload size={14} />
            </button>
          )}
          {row.estado?.toUpperCase() === 'RESPONDIDA' && !row.orden_id && (
            <button onClick={(e) => { e.stopPropagation(); setCrearOCFromSC(row.id); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer" title="Crear Orden de Compra">
              <ShoppingCart size={14} />
            </button>
          )}
          {row.estado?.toUpperCase() === 'RESPONDIDA' && row.orden_id && (
            <button onClick={(e) => { e.stopPropagation(); handlePreviewOC(row.orden_id); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 cursor-pointer" title="Ver Orden de Compra">
              <FileText size={14} />
            </button>
          )}
          {row.estado?.toUpperCase() === 'BORRADOR' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleEstado(row.id, 'Enviada'); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 cursor-pointer" title="Marcar como Enviada">
                <Send size={14} />
              </button>
              <button onClick={(e) => handleAnular(row.id, e)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 cursor-pointer" title="Anular">
                <Ban size={14} />
              </button>
              <button onClick={(e) => handleDelete(row.id, e)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 cursor-pointer" title="Eliminar">
                <Trash2 size={14} />
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
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Envío de solicitudes a proveedores para que coticen materiales. Sin precios.
          </p>
        </div>
        <button onClick={() => handleOpenForm()}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 active:scale-[0.98] cursor-pointer">
          <Plus size={18} />
          Nueva Solicitud de Cotización
        </button>
      </div>

      {/* Alertas de Solicitudes Pendientes por Procesar */}
      {solicitudesPendientes && solicitudesPendientes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-500/5 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-amber-800 dark:text-amber-500">
              <AlertTriangle size={18} className="animate-pulse" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Solicitudes de Materiales Pendientes de Cotizar</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {solicitudesPendientes.map((sol: any) => {
                let diasRestantes = null;
                let colorClase = "text-slate-600 dark:text-slate-400";
                let bgClase = "bg-white dark:bg-slate-800";
                
                if (sol.fecha_requerida) {
                  const fechaReq = new Date(sol.fecha_requerida);
                  fechaReq.setHours(23, 59, 59, 999);
                  const hoy = new Date();
                  const diffTime = Math.max(0, fechaReq.getTime() - hoy.getTime());
                  diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  
                  if (diasRestantes <= 2) {
                    colorClase = "text-red-600 dark:text-red-400 font-bold";
                    bgClase = "bg-red-50 border-red-100 dark:bg-red-500/10 dark:border-red-500/20";
                  } else if (diasRestantes <= 5) {
                    colorClase = "text-amber-600 dark:text-amber-400 font-bold";
                    bgClase = "bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20";
                  } else {
                    colorClase = "text-emerald-600 dark:text-emerald-400 font-medium";
                  }
                }

                return (
                  <div key={sol.id} className={`flex flex-col justify-between rounded-lg border p-3 shadow-sm transition-all hover:shadow-md ${bgClase} ${sol.fecha_requerida ? '' : 'border-slate-200 dark:border-slate-700'}`}>
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">SOL-{String(sol.id).padStart(3, '0')}</span>
                        {diasRestantes !== null ? (
                          <span className={`flex items-center gap-1 text-[10px] ${colorClase}`}>
                            <Clock size={12} />
                            {diasRestantes === 0 ? '¡Para hoy!' : `${diasRestantes} días rest.`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Sin fecha definida</span>
                        )}
                      </div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={sol.proyecto_nombre}>
                        {sol.proyecto_nombre}
                      </p>
                      {sol.proyecto_numero_obra && (
                        <p className="text-[10px] font-mono text-slate-400">
                          N° {sol.proyecto_numero_obra}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {sol.solicitante || 'Sin solicitante'}
                      </p>
                    </div>
                    <div className="mt-3 text-right">
                      <button 
                        onClick={() => handleOpenForm(String(sol.id))}
                        className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
                      >
                        <Send size={12} />
                        Crear Cotización
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Borrador', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'BORRADOR').length || 0, color: 'text-slate-500 dark:text-slate-400', toggle: false },
          { label: 'Enviadas', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'ENVIADA').length || 0, color: 'text-blue-600 dark:text-blue-400', toggle: false },
          { label: 'Respondidas', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'RESPONDIDA').length || 0, color: 'text-emerald-600 dark:text-emerald-400', toggle: false },
          { label: 'Anuladas', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'ANULADA').length || 0, color: 'text-red-600 dark:text-red-400', toggle: true },
        ].map(stat => (
          <div
            key={stat.label}
            onClick={stat.toggle ? () => setMostrarAnuladas(v => !v) : undefined}
            className={`rounded-xl bg-white p-4 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700 ${
              stat.toggle ? 'cursor-pointer hover:border-red-200 hover:shadow-md transition-all' : ''
            } ${stat.toggle && mostrarAnuladas ? 'border-red-300 ring-1 ring-red-200' : ''}`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            {stat.toggle && (
              <p className="text-[10px] text-slate-400 mt-0.5">{mostrarAnuladas ? '▲ Ocultar' : '▼ Mostrar'}</p>
            )}
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
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-[#111827]/40 dark:border dark:border-slate-800">
          <div className="flex justify-between mb-3">
            {activeFilterCount > 0 ? (
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                {filteredList.length} resultado{filteredList.length !== 1 ? 's' : ''} con filtros aplicados
              </p>
            ) : <span />}
            <button
              onClick={() => setMostrarAnuladas(v => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                mostrarAnuladas
                  ? 'border-red-300 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
              } cursor-pointer`}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${mostrarAnuladas ? 'bg-red-500' : 'bg-slate-300'}`} />
              {mostrarAnuladas ? 'Ocultar Anuladas' : 'Mostrar Anuladas'}
            </button>
          </div>
          <DataTable
            columns={columns}
            data={filteredList}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por proveedor, proyecto..."
            emptyTitle="Sin solicitudes de cotización"
            emptyMessage="Crea una solicitud de cotización a partir de una solicitud de materiales, asignando proveedores por ítem"
          />
        </div>
      </motion.div>

      <SolicitudCotizacionModal
        isOpen={showForm}
        initialSolicitudId={initialSolicitudId}
        onClose={() => { setShowForm(false); setInitialSolicitudId(undefined); }}
        onSuccess={() => { refetch(); refetchPendientes(); }}
      />

      <SolicitudCotizacionDetailModal
        id={detailId}
        isOpen={!!detailId}
        onClose={() => setDetailId(null)}
        onSuccess={() => {
          refetch();
          refetchPendientes();
        }}
      />

      <ImportarRespuestaSCModal
        isOpen={showImport}
        onClose={() => { setShowImport(false); setImportData(null); }}
        solicitudCotizacionId={importData?.id || 0}
        scItems={importData?.items || []}
        solicitudData={importData}
        onSuccess={() => {
          setShowImport(false);
          setImportData(null);
          refetch();
          refetchPendientes();
        }}
      />

      <CrearOCModal
        isOpen={!!crearOCFromSC}
        onClose={() => setCrearOCFromSC(null)}
        onSuccess={() => { setCrearOCFromSC(null); refetch(); refetchPendientes(); }}
        initialSolicitudCotizacionId={crearOCFromSC || undefined}
      />

      <OCPreviewModal
        isOpen={!!ocPreview}
        onClose={() => setOcPreview(null)}
        orden={ocPreview}
      />
    </>
  );
}
