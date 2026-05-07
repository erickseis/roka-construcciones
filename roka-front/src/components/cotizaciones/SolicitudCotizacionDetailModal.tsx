import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import FlowStepper from '../ui/FlowStepper';
import { getSolicitudCotizacion, changeSolicitudCotizacionEstado, deleteSolicitudCotizacion, descargarSolicitudCotizacionPdf } from '@/lib/api';
import { Send, Trash2, FileDown, Upload } from 'lucide-react';
import ImportarRespuestaSCModal from './ImportarRespuestaSCModal';
export default function SolicitudCotizacionDetailModal({ id, isOpen, onClose, onSuccess }: { id: number | null; isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    if (!isOpen || !id) { setData(null); return; }
    setLoading(true);
    getSolicitudCotizacion(id).then(setData).finally(() => setLoading(false));
  }, [id, isOpen]);

  const handleEstado = async (estado: string) => {
    if (!id) return;
    try {
      await changeSolicitudCotizacionEstado(id, estado);
      const updated = await getSolicitudCotizacion(id);
      setData(updated);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Error al cambiar estado');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!confirm('¿Eliminar esta solicitud de cotización?')) return;
    try {
      await deleteSolicitudCotizacion(id);
      onSuccess();
      onClose();
    } catch { alert('Error al eliminar'); }
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}
        title={data ? `Solicitud de Cotización SC-${String(data.id).padStart(3, '0')}` : ''}
        subtitle={data ? `Proveedor: ${data.proveedor}` : ''}
        size="lg">
        {loading && <div className="text-center py-8 text-sm text-slate-400">Cargando...</div>}
        {data && (
          <div className="space-y-4">
            <FlowStepper currentStep={1} estado={data.estado} tipo="solicitud_cotizacion" />

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Solicitud de Materiales</p>
                <p className="text-sm font-bold text-slate-800">SOL-{String(data.solicitud_id).padStart(3, '0')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Estado</p>
                <StatusBadge status={data.estado === 'Enviada' ? 'Cotizando' : data.estado} size="md" />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase text-slate-400">Proyecto</p>
              <p className="text-sm font-bold text-slate-800">{data.proyecto_nombre}</p>
            </div>

            {/* Items con precios si existen */}
            {data.items && data.items.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ítems ({data.items.length})
                </p>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Material</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Código</th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Cantidad</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Unidad</th>
                        {data.items.some((item: any) => item.precio_unitario != null) && (
                          <>
                            <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">P. Unitario</th>
                            <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Subtotal</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item: any) => (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-800">{item.nombre_material}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">{item.codigo_proveedor || item.codigo || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600">{Number(item.cantidad_requerida).toLocaleString()}</td>
                          <td className="px-3 py-2 text-slate-500">{item.unidad}</td>
                          {item.precio_unitario != null && (
                            <>
                              <td className="px-3 py-2 text-right font-mono text-slate-800">${Number(item.precio_unitario).toLocaleString('es-CL', { minimumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">${Number(item.subtotal || item.precio_unitario * item.cantidad_requerida).toLocaleString('es-CL', { minimumFractionDigits: 2 })}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                <button onClick={() => descargarSolicitudCotizacionPdf(id!)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
                  <FileDown size={14} /> Descargar PDF
                </button>
                {(data.estado === 'Borrador') && (
                  <button onClick={handleDelete}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
                    <Trash2 size={14} className="inline mr-1" />Eliminar
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {data.estado === 'Borrador' && (
                  <button onClick={() => handleEstado('Enviada')}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600">
                    <Send size={14} /> Marcar como Enviada
                  </button>
                )}
                {data.estado === 'Enviada' && (
                  <button onClick={() => handleEstado('Respondida')}
                    className="flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-white hover:bg-sky-600">
                    Marcar como Respondida
                  </button>
                )}
                {(data.estado === 'Enviada' || data.estado === 'Respondida') && (
                  <button onClick={() => setShowImport(true)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
                    <Upload size={14} /> Cargar Respuesta
                  </button>
                )}

                {data.estado === 'Respondida' && (
                  <button onClick={() => handleEstado('Anulada')}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100">
                    Anular
                  </button>
                )}
                {data.estado === 'Enviada' && (
                  <button onClick={() => handleEstado('Borrador')}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100">
                    Volver a Borrador
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
      <ImportarRespuestaSCModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        solicitudCotizacionId={id || 0}
        scItems={data?.items || []}
        solicitudData={data}
        onSuccess={() => {
          setShowImport(false);
          if (id) getSolicitudCotizacion(id).then(setData);
          onSuccess();
        }}
      />
    </>
  );
}
