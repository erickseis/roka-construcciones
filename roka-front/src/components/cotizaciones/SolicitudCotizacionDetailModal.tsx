import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import FlowStepper from '../ui/FlowStepper';
import AuditTrailBadge from '../ui/AuditTrailBadge';
import { getSolicitudCotizacion, changeSolicitudCotizacionEstado, deleteSolicitudCotizacion, descargarSolicitudCotizacionPdf, getOrden, enviarSCProveedor } from '@/lib/api';
import { formatCLP } from '@/lib/utils';
import { Send, Trash2, FileDown, Upload, ShoppingCart, FileText, MailCheck, Ban, Building2, FileCheck2 } from 'lucide-react';
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

            {data.fecha_requerida && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-500">Fecha requerida en terreno:</span>
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                    {new Date(data.fecha_requerida).toLocaleDateString('es-CL')}
                  </span>
                  {(() => {
                    const d = new Date(data.fecha_requerida);
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

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Solicitud de Materiales</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">SOL-{String(data.solicitud_id).padStart(3, '0')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="text-[10px] font-bold uppercase text-slate-400">Estado</p>
                <StatusBadge status={data.estado === 'Enviada' ? 'Cotizando' : data.estado} size="md" />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-[10px] font-bold uppercase text-slate-400">Proyecto</p>
              <div className="flex flex-col">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{data.proyecto_nombre}</p>
                {data.proyecto_numero_obra && (
                  <p className="text-[10px] font-mono text-slate-400">N° {data.proyecto_numero_obra}</p>
                )}
              </div>
            </div>

            {/* Datos del Proveedor */}
            {data.proveedor_id && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                  <Building2 size={13} className="text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Datos del Proveedor</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3">
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold uppercase text-slate-400">Razón Social</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{data.proveedor}</p>
                  </div>
                  {data.prov_rut && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">RUT</p>
                      <p className="text-xs font-mono text-slate-700 dark:text-slate-300">{data.prov_rut}</p>
                    </div>
                  )}
                  {data.prov_contacto_nombre && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Contacto</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{data.prov_contacto_nombre}</p>
                    </div>
                  )}
                  {(data.prov_correo || data.prov_contacto_correo) && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Email</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{data.prov_contacto_correo || data.prov_correo}</p>
                    </div>
                  )}
                  {(data.prov_telefono || data.prov_contacto_telefono) && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Teléfono</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{data.prov_contacto_telefono || data.prov_telefono}</p>
                    </div>
                  )}
                  {data.prov_condiciones_pago && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Cond. de Pago</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{data.prov_condiciones_pago}</p>
                    </div>
                  )}
                  {data.prov_plazo_entrega && (
                    <div>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Plazo Entrega</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{data.prov_plazo_entrega}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Datos de la Cotización de Venta (solo cuando Respondida) */}
            {data.estado?.toUpperCase() === 'RESPONDIDA' && (data.numero_cov || data.condiciones_pago_cov || data.plazo_entrega_cov || Number(data.descuento_global_cov) > 0) && (() => {
              const subtotal = (data.items || []).reduce((sum: number, item: any) => {
                const punit = Number(item.precio_unitario || 0);
                const cant = Number(item.cantidad_requerida || 0);
                const desc = Number(item.descuento_porcentaje || 0);
                return sum + Math.round(punit * cant * (desc > 0 ? (1 - desc / 100) : 1) * 100) / 100;
              }, 0);
              const descGlobalPct = Number(data.descuento_global_cov || 0);
              const descGlobalMonto = subtotal * (descGlobalPct / 100);
              const totalFinal = subtotal - descGlobalMonto;
              const hasItemsConPrecios = data.items && data.items.some((i: any) => i.precio_unitario != null);

              return (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 overflow-hidden">
                  <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 border-b border-emerald-200 dark:border-emerald-800/50">
                    <FileCheck2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Cotización de Venta del Proveedor</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 p-3">
                    {data.numero_cov && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">N° Cotización de Venta</p>
                        <p className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-400">{data.numero_cov}</p>
                      </div>
                    )}
                    {data.condiciones_pago_cov && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Condiciones de Pago</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{data.condiciones_pago_cov}</p>
                      </div>
                    )}
                    {data.plazo_entrega_cov && (
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-400">Plazo de Entrega</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{data.plazo_entrega_cov}</p>
                      </div>
                    )}
                  </div>

                  {hasItemsConPrecios && (
                    <div className="border-t border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/40 dark:bg-emerald-950/10 px-3 py-2 space-y-1">
                      {descGlobalPct > 0 && (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                            <span className="font-mono text-slate-700 dark:text-slate-300">{subtotal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">Descuento Global ({descGlobalPct}%)</span>
                            <span className="font-mono text-amber-700 dark:text-amber-400">− {descGlobalMonto.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                          </div>
                          <div className="h-px bg-emerald-200 dark:bg-emerald-800/50 my-1" />
                        </>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total Neto</span>
                        <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">{totalFinal.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                      </div>
                    </div>
                  )}

                  {data.archivo_adjunto_path && (
                    <div className="border-t border-emerald-200 dark:border-emerald-800/50 px-3 py-2 flex items-center justify-between">
                      <a href={`${(import.meta as any).env.VITE_API_URL.replace(/\/api\/?$/, '')}${data.archivo_adjunto_path}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        <FileText size={14} /> {data.archivo_adjunto_nombre || 'Descargar respuesta original'}
                      </a>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Items con precios si existen */}
            {data.items && data.items.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Ítems ({data.items.length})
                </p>
                <div className="rounded-lg border border-slate-200 overflow-hidden dark:border-slate-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                      <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Material</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Código</th>
                        <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Cantidad</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Unidad</th>
                        {data.items.some((item: any) => item.precio_unitario != null) && (
                          <>
                            <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">P. Unitario</th>
                            {data.items.some((item: any) => Number(item.descuento_porcentaje) > 0) && (
                              <th className="px-3 py-2 text-center text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Desc.</th>
                            )}
                            <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Subtotal</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item: any) => (
                        <tr key={item.id} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">{item.nombre_material}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{item.codigo_proveedor || item.codigo || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-300">{Number(item.cantidad_requerida).toLocaleString()}</td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{item.unidad}</td>
                          {item.precio_unitario != null && (() => {
                            const punit = Number(item.precio_unitario);
                            const cant = Number(item.cantidad_requerida);
                            const desc = Number(item.descuento_porcentaje || 0);
                            const hasAnyDesc = data.items.some((i: any) => Number(i.descuento_porcentaje) > 0);
                            const subtotalLinea = Math.round(punit * cant * (desc > 0 ? (1 - desc / 100) : 1) * 100) / 100;
                            return (
                              <>
                                <td className="px-3 py-2 text-right font-mono text-slate-800 dark:text-slate-200">{formatCLP(punit)}</td>
                                {hasAnyDesc && (
                                  <td className="px-3 py-2 text-center font-mono text-xs">
                                    {desc > 0
                                      ? <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 font-bold">{desc}%</span>
                                      : <span className="text-slate-400">-</span>
                                    }
                                  </td>
                                )}
                                <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{formatCLP(subtotalLinea)}</td>
                              </>
                            );
                          })()}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex gap-2">
                <button onClick={() => descargarSolicitudCotizacionPdf(id!)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer">
                  <FileDown size={14} /> Descargar PDF
                </button>
                <button
                  onClick={handleEnviarProveedor}
                  disabled={sendingEmail}
                  title="Enviar solicitud de cotización al proveedor por email"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-900/30 cursor-pointer"
                >
                  <MailCheck size={14} /> {sendingEmail ? 'Enviando...' : 'Enviar a Proveedor'}
                </button>
                {(data.estado === 'Borrador') && (
                  <>
                    <button onClick={handleAnular}
                      className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer">
                      <Ban size={14} className="inline mr-1" />Anular
                    </button>
                    <button onClick={handleDelete}
                      className="rounded-lg px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 cursor-pointer">
                      <Trash2 size={14} className="inline mr-1" />Eliminar
                    </button>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {data.estado === 'Borrador' && (
                  <button onClick={() => handleEstado('Enviada')}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 cursor-pointer">
                    <Send size={14} /> Marcar como Enviada
                  </button>
                )}
                {data.estado === 'Enviada' && (
                  <button onClick={() => setShowImport(true)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer">
                    <Upload size={14} /> Cargar Respuesta
                  </button>
                )}


                {data.estado?.toUpperCase() === 'RESPONDIDA' && !data.orden_id && (
                  <button onClick={() => setShowCrearOC(true)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer">
                    <ShoppingCart size={14} /> Crear Orden de Compra
                  </button>
                )}
                {data.estado?.toUpperCase() === 'RESPONDIDA' && data.orden_id && (
                  <button onClick={() => handleVerOC(data.orden_id)}
                    className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all cursor-pointer">
                    <FileText size={14} /> Ver Orden de Compra
                  </button>
                )}

                {data.estado === 'Respondida' && (
                  <button onClick={handleAnular}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer">
                    Anular
                  </button>
                )}
                {data.estado === 'Enviada' && (
                  <button onClick={() => handleEstado('Borrador')}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer">
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
