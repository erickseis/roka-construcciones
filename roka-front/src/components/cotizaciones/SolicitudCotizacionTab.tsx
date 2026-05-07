import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Eye, Send, Trash2, FileDown, Upload } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { getSolicitudesCotizacion, changeSolicitudCotizacionEstado, deleteSolicitudCotizacion, getSolicitudes, descargarSolicitudCotizacionPdf, getSolicitudCotizacion } from '@/lib/api';
import SolicitudCotizacionModal from './SolicitudCotizacionModal';
import SolicitudCotizacionDetailModal from './SolicitudCotizacionDetailModal';
import ImportarRespuestaSCModal from './ImportarRespuestaSCModal';
import { Clock, AlertTriangle } from 'lucide-react';

const estadoColor: Record<string, string> = {
  Borrador: 'text-slate-500',
  Enviada: 'text-amber-600',
  Respondida: 'text-emerald-600',
  Anulada: 'text-red-600',
};

export default function SolicitudCotizacionTab() {
  const [showForm, setShowForm] = useState(false);
  const [initialSolicitudId, setInitialSolicitudId] = useState<string | undefined>(undefined);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [importData, setImportData] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  
  const { data: list, loading, refetch } = useApi(() => getSolicitudesCotizacion(), []);
  // Cargar solicitudes de materiales pendientes para procesar
  const { data: solicitudesPendientes, loading: loadingPendientes, refetch: refetchPendientes } = useApi(() => getSolicitudes({ estado: 'Pendiente' }), []);

  const handleOpenForm = (solId?: string) => {
    setInitialSolicitudId(solId);
    setShowForm(true);
  };

  const handleEstado = async (id: number, estado: string) => {
    try {
      await changeSolicitudCotizacionEstado(id, estado);
      refetch();
      refetchPendientes();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado');
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
      render: (row: any) => <span className="font-mono text-xs font-bold text-amber-600">SC-{String(row.id).padStart(3, '0')}</span>,
    },
    { key: 'proveedor', header: 'Proveedor', sortable: true },
    {
      key: 'solicitud_id', header: 'Solicitud',
      render: (row: any) => <span className="font-mono text-xs text-slate-500">SOL-{String(row.solicitud_id).padStart(3, '0')}</span>,
    },
    { key: 'proyecto_nombre', header: 'Proyecto', sortable: true },
    {
      key: 'total_items', header: 'Ítems',
      render: (row: any) => (
        <span className="font-mono text-sm text-slate-600">{row.total_items ?? '-'}</span>
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
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Ver detalle">
            <Eye size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); descargarSolicitudCotizacionPdf(row.id); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600" title="Descargar PDF">
            <FileDown size={14} />
          </button>
          {row.estado?.toUpperCase() === 'ENVIADA' && (
            <button onClick={(e) => { e.stopPropagation(); handleOpenImport(row.id); }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600" title="Cargar respuesta del vendedor">
              <Upload size={14} />
            </button>
          )}
          {row.estado?.toUpperCase() === 'BORRADOR' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); handleEstado(row.id, 'Enviada'); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Marcar como Enviada">
                <Send size={14} />
              </button>
              <button onClick={(e) => handleDelete(row.id, e)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Eliminar">
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
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 active:scale-[0.98]">
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
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate" title={sol.proyecto_nombre}>
                        {sol.proyecto_nombre}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {sol.solicitante || 'Sin solicitante'}
                      </p>
                    </div>
                    <div className="mt-3 text-right">
                      <button 
                        onClick={() => handleOpenForm(String(sol.id))}
                        className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-amber-600 active:scale-95 transition-all"
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
          { label: 'Borrador', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'BORRADOR').length || 0, color: 'text-slate-500' },
          { label: 'Enviadas', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'ENVIADA').length || 0, color: 'text-emerald-600' },
          { label: 'Respondidas', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'RESPONDIDA').length || 0, color: 'text-emerald-600' },
          { label: 'Anuladas', value: list?.filter((c: any) => c.estado?.toUpperCase() === 'ANULADA').length || 0, color: 'text-red-600' },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-[#111827]/40 dark:border dark:border-slate-800">
          <DataTable
            columns={columns}
            data={list || []}
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
    </>
  );
}
