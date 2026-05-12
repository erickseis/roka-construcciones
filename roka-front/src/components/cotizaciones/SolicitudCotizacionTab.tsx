import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Plus, Eye, Send, Trash2, FileDown, Upload, ShoppingCart, FileText, Ban } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import FilterPanel, { FilterField } from '../ui/FilterPanel';
import { useApi } from '@/hooks/useApi';
import { getSolicitudesCotizacion, changeSolicitudCotizacionEstado, deleteSolicitudCotizacion, getSolicitudes, descargarSolicitudCotizacionPdf, getSolicitudCotizacion, getOrden, getTriageConfig } from '@/lib/api';
import SolicitudCotizacionModal from './SolicitudCotizacionModal';
import SolicitudCotizacionDetailModal from './SolicitudCotizacionDetailModal';
import ImportarRespuestaSCModal from './ImportarRespuestaSCModal';
import { CrearOCModal } from '../ordenes/CrearOCModal';
import OCPreviewModal from '../ordenes/OCPreviewModal';
import { Clock, AlertTriangle, Layers, Zap, Flame, Box, ArrowRight } from 'lucide-react';
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
  const [triageConfig, setTriageConfig] = useState<{ critico_dias: number; atrasado_dias: number }>({ critico_dias: 2, atrasado_dias: 5 });

  // Cargar configuración de triage desde API
  useEffect(() => {
    getTriageConfig().then((config: any[]) => {
      const cfg: Record<string, number> = {};
      config?.forEach((c: any) => { cfg[c.codigo] = c.valor; });
      setTriageConfig({ critico_dias: cfg.critico_dias ?? 2, atrasado_dias: cfg.atrasado_dias ?? 5 });
    }).catch(() => { /* usar defaults */ });
  }, []);

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

  // Triage board data
  const triageGroups = React.useMemo(() => {
    if (!solicitudesPendientes) return { critical: [], late: [], fresh: [] };
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const withDays = solicitudesPendientes.map((s: any) => {
      let diasRestantes = null;
      if (s.fecha_requerida) {
        const fechaReq = new Date(s.fecha_requerida);
        fechaReq.setHours(0, 0, 0, 0);
        // Permite dias negativos si ya se pasó la fecha
        const diffTime = fechaReq.getTime() - now.getTime();
        diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      return { ...s, diasRestantes };
    });

    return {
      critical: withDays.filter((p: any) => p.diasRestantes !== null && p.diasRestantes <= triageConfig.critico_dias),
      late: withDays.filter((p: any) => p.diasRestantes !== null && p.diasRestantes > triageConfig.critico_dias && p.diasRestantes <= triageConfig.atrasado_dias),
      fresh: withDays.filter((p: any) => p.diasRestantes === null || p.diasRestantes > triageConfig.atrasado_dias),
    };
  }, [solicitudesPendientes, triageConfig]);

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
          { value: 'Observación', label: 'Observación' },
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
          {row.estado?.toUpperCase() === 'OBSERVACIÓN' && (
            <>
              {row.orden_id && (
                <button onClick={(e) => { e.stopPropagation(); handlePreviewOC(row.orden_id); }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 cursor-pointer" title="Ver OC anulada">
                  <FileText size={14} />
                </button>
              )}
              <button onClick={(e) => { e.stopPropagation(); setCrearOCFromSC(row.id); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer" title="Crear Orden de Compra">
                <ShoppingCart size={14} />
              </button>
              <button onClick={(e) => handleAnular(row.id, e)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 cursor-pointer" title="Anular Solicitud de Cotización">
                <Ban size={14} />
              </button>
            </>
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

      {/* Alertas de Solicitudes Pendientes por Procesar - Triage Kanban */}
      {solicitudesPendientes && solicitudesPendientes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 rounded-xl bg-slate-50 p-4 dark:bg-[#111827]/40 dark:border dark:border-slate-800">
          <div className="mb-4 flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Triage de Cotizaciones
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {solicitudesPendientes.length} solicitudes pendientes agrupadas por margen de entrega.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'critical', title: 'Crítica', subtitle: `≤ ${triageConfig.critico_dias} días`, icon: Flame, colorClass: 'text-rose-600 dark:text-rose-400', bgClass: 'bg-rose-50 dark:bg-rose-500/10', borderClass: 'border-rose-200 dark:border-rose-500/20', hoverBorder: 'hover:border-rose-300 dark:hover:border-rose-500/40', items: triageGroups.critical },
              { key: 'late', title: 'Atrasada', subtitle: `${triageConfig.critico_dias + 1}–${triageConfig.atrasado_dias} días`, icon: Clock, colorClass: 'text-amber-600 dark:text-amber-400', bgClass: 'bg-amber-50 dark:bg-amber-500/10', borderClass: 'border-amber-200 dark:border-amber-500/20', hoverBorder: 'hover:border-amber-300 dark:hover:border-amber-500/40', items: triageGroups.late },
              { key: 'fresh', title: 'Reciente', subtitle: `> ${triageConfig.atrasado_dias} días`, icon: Zap, colorClass: 'text-emerald-600 dark:text-emerald-400', bgClass: 'bg-emerald-50 dark:bg-emerald-500/10', borderClass: 'border-emerald-200 dark:border-emerald-500/20', hoverBorder: 'hover:border-emerald-300 dark:hover:border-emerald-500/40', items: triageGroups.fresh },
            ].map(col => (
              <div key={col.key} className="flex flex-col rounded-xl">
                {/* Column Header */}
                <div className={`flex items-center justify-between rounded-t-xl border border-b-0 p-3 ${col.bgClass} ${col.borderClass}`}>
                  <div className="flex items-center gap-2">
                    <col.icon size={16} className={col.colorClass} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${col.colorClass}`}>{col.title}</span>
                    <span className={`text-[10px] opacity-70 ${col.colorClass}`}>{col.subtitle}</span>
                  </div>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-white/50 text-xs font-bold dark:bg-black/20 ${col.colorClass}`}>
                    {col.items.length}
                  </span>
                </div>

                {/* Column Content */}
                <div className={`flex flex-col gap-2 rounded-b-xl border border-t-0 p-2 min-h-[280px] bg-white dark:bg-slate-900/50 ${col.borderClass}`}>
                  {col.items.length === 0 && (
                    <div className="py-10 text-center text-xs text-slate-400">Nada por aquí.</div>
                  )}
                  {col.items.map((req: any) => (
                    <div 
                      key={req.id} 
                      className={`group relative flex cursor-pointer flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-all hover:-translate-y-0.5 ${col.hoverBorder} dark:border-slate-800 dark:bg-slate-900`}
                      onClick={() => handleOpenForm(String(req.id))}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">SOL-{String(req.id).padStart(3, '0')}</span>
                        <div className={`flex items-center gap-1 text-[10px] font-bold ${col.colorClass}`}>
                          <Clock size={10} />
                          {req.diasRestantes === null ? 'Sin fecha' : req.diasRestantes <= 0 ? '¡Para hoy o vencida!' : `${req.diasRestantes} d. rest.`}
                        </div>
                      </div>
                      <div className="mt-2 text-sm font-bold text-slate-800 leading-tight dark:text-slate-100">{req.proyecto_nombre}</div>
                      {req.proyecto_numero_obra && <div className="mt-1 text-[10px] font-mono text-slate-400">N° {req.proyecto_numero_obra}</div>}
                      
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {req.solicitante ? req.solicitante.split(' ').map((n:string)=>n[0]).join('').substring(0, 2).toUpperCase() : '?'}
                        </div>
                        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{req.solicitante || 'Desconocido'}</div>
                      </div>

                      <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800">
                        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <Box size={10} />
                          <strong className="text-slate-700 dark:text-slate-200">{req.total_items}</strong> ítems
                        </span>
                        
                        <button className="ml-auto flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-700">
                          Cotizar <ArrowRight size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Borrador', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'BORRADOR').length || 0, color: 'text-slate-500 dark:text-slate-400', toggle: false },
          { label: 'Enviadas', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'ENVIADA').length || 0, color: 'text-blue-600 dark:text-blue-400', toggle: false },
          { label: 'Respondidas', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'RESPONDIDA').length || 0, color: 'text-emerald-600 dark:text-emerald-400', toggle: false },
          { label: 'Observación', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'OBSERVACIÓN').length || 0, color: 'text-amber-600 dark:text-amber-400', toggle: false },
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
