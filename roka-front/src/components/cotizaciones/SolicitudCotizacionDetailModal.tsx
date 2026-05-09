import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import FlowStepper from '../ui/FlowStepper';
import AuditTrailBadge from '../ui/AuditTrailBadge';
import { getSolicitudCotizacion, changeSolicitudCotizacionEstado, deleteSolicitudCotizacion, descargarSolicitudCotizacionPdf, getOrden, enviarSCProveedor } from '@/lib/api';
import { formatCLP } from '@/lib/utils';
import { Send, Trash2, FileDown, Upload, ShoppingCart, FileText, MailCheck, Ban } from 'lucide-react';
import ImportarRespuestaSCModal from './ImportarRespuestaSCModal';
import { CrearOCModal } from '../ordenes/CrearOCModal';
import OCPreviewModal from '../ordenes/OCPreviewModal';
import Swal from 'sweetalert2';
export default function SolicitudCotizacionDetailModal({ id, isOpen, onClose, onSuccess }: { id: number | null; isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showCrearOC, setShowCrearOC] = useState(false);
  const [ocPreview, setOcPreview] = useState<any | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleVerOC = async (ordenId: number) => {
    try {
      const data = await getOrden(ordenId);
      setOcPreview(data);
    } catch (err: any) {
      alert(err.message || 'Error al cargar orden de compra');
    }
  };

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

  const handleAnular = async () => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Al anular esta cotización, no podrá ser utilizada en el flujo de compra.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      handleEstado('Anulada');
    }
  };

  const handleEnviarProveedor = async () => {
    if (!id || !data) return;
    const result = await Swal.fire({
      title: '¿Enviar SC al proveedor?',
      html: `Se enviará la solicitud de cotización <strong>SC-${String(id).padStart(3, '0')}</strong> por correo electrónico al proveedor <strong>${data.proveedor}</strong>.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#f59e0b',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    setSendingEmail(true);
    try {
      const res = await enviarSCProveedor(id);
      await Swal.fire({
        title: '¡Email enviado!',
        text: `Solicitud de cotización enviada a ${res.enviado_a}`,
        icon: 'success',
        confirmButtonColor: '#f59e0b',
      });
    } catch (err: any) {
      await Swal.fire({
        title: 'Error al enviar',
        text: err.message || 'No se pudo enviar el email',
        icon: 'error',
        confirmButtonColor: '#64748b',
      });
    } finally {
      setSendingEmail(false);
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

            {/* Audit Trail - Trazabilidad */}
            <div className="flex flex-wrap gap-3">
              {data.estado === 'Enviada' && (
                <AuditTrailBadge
                  label="Enviado por"
                  nombre={data.enviado_by_nombre}
                  fecha={data.enviado_at}
                  icon="enviado"
                />
              )}
              {data.estado === 'Respondida' && (
                <AuditTrailBadge
                  label="Respondido por"
                  nombre={data.respondido_by_nombre}
                  fecha={data.respondido_at}
                  icon="respondido"
                />
              )}
              {data.estado === 'Anulada' && (
                <AuditTrailBadge
                  label="Anulada por"
                  nombre={data.rechazado_by_nombre}
                  fecha={data.rechazado_at}
                  icon="rechazado"
                />
              )}
            </div>

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
                              <td className="px-3 py-2 text-right font-mono text-slate-800 dark:text-slate-200">{formatCLP(Number(item.precio_unitario))}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{formatCLP(Number(item.subtotal || item.precio_unitario * item.cantidad_requerida))}</td>
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
                <button
                  onClick={handleEnviarProveedor}
                  disabled={sendingEmail}
                  title="Enviar solicitud de cotización al proveedor por email"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                >
                  <MailCheck size={14} /> {sendingEmail ? 'Enviando...' : 'Enviar a Proveedor'}
                </button>
                {(data.estado === 'Borrador') && (
                  <>
                    <button onClick={handleAnular}
                      className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100">
                      <Ban size={14} className="inline mr-1" />Anular
                    </button>
                    <button onClick={handleDelete}
                      className="rounded-lg px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
                      <Trash2 size={14} className="inline mr-1" />Eliminar
                    </button>
                  </>
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
                  <button onClick={() => setShowImport(true)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700">
                    <Upload size={14} /> Cargar Respuesta
                  </button>
                )}


                {data.estado?.toUpperCase() === 'RESPONDIDA' && !data.orden_id && (
                  <button onClick={() => setShowCrearOC(true)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all">
                    <ShoppingCart size={14} /> Crear Orden de Compra
                  </button>
                )}
                {data.estado?.toUpperCase() === 'RESPONDIDA' && data.orden_id && (
                  <button onClick={() => handleVerOC(data.orden_id)}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all">
                    <FileText size={14} /> Ver Orden de Compra
                  </button>
                )}

                {data.estado === 'Respondida' && (
                  <button onClick={handleAnular}
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
      <CrearOCModal
        isOpen={showCrearOC}
        onClose={() => setShowCrearOC(false)}
        onSuccess={() => {
          setShowCrearOC(false);
          if (id) getSolicitudCotizacion(id).then(setData);
          onSuccess();
        }}
        initialSolicitudCotizacionId={id || undefined}
      />

      <OCPreviewModal
        isOpen={!!ocPreview}
        onClose={() => setOcPreview(null)}
        orden={ocPreview}
      />
    </>
  );
}
