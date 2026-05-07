import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Eye, Send, Trash2 } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { useApi } from '@/hooks/useApi';
import { getSolicitudesCotizacion, changeSolicitudCotizacionEstado, deleteSolicitudCotizacion } from '@/lib/api';
import SolicitudCotizacionModal from './SolicitudCotizacionModal';
import SolicitudCotizacionDetailModal from './SolicitudCotizacionDetailModal';

const estadoColor: Record<string, string> = {
  Borrador: 'text-slate-500',
  Enviada: 'text-amber-600',
  Respondida: 'text-emerald-600',
  Anulada: 'text-red-600',
};

export default function SolicitudCotizacionTab() {
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: list, loading, refetch } = useApi(() => getSolicitudesCotizacion(), []);

  const handleEstado = async (id: number, estado: string) => {
    try {
      await changeSolicitudCotizacionEstado(id, estado);
      refetch();
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
    } catch { alert('Error al eliminar'); }
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
          {row.estado === 'Borrador' && (
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
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 active:scale-[0.98]">
          <Plus size={18} />
          Nueva Solicitud de Cotización
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Borrador', value: list?.filter((c: any) => c.estado === 'Borrador').length || 0, color: 'text-slate-500' },
          { label: 'Enviadas', value: list?.filter((c: any) => c.estado === 'Enviada').length || 0, color: 'text-amber-600' },
          { label: 'Respondidas', value: list?.filter((c: any) => c.estado === 'Respondida').length || 0, color: 'text-emerald-600' },
          { label: 'Anuladas', value: list?.filter((c: any) => c.estado === 'Anulada').length || 0, color: 'text-red-600' },
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
        onClose={() => setShowForm(false)}
        onSuccess={() => refetch()}
      />

      <SolicitudCotizacionDetailModal
        id={detailId}
        isOpen={detailId !== null}
        onClose={() => setDetailId(null)}
        onSuccess={() => refetch()}
      />
    </>
  );
}
