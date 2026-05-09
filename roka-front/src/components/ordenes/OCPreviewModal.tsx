import React, { useEffect, useMemo, useState } from 'react';
import { X, Printer, MailCheck } from 'lucide-react';
import { formatCLP } from '@/lib/utils';
import { enviarOCProveedor } from '@/lib/api';
import Swal from 'sweetalert2';
import AuditTrailBadge from '../ui/AuditTrailBadge';

const EMPRESA = {
  nombre: 'Constructora Roka SpA',
  rut: '77.122.411-3',
  direccion: 'General Arteaga 30, Arica',
  telefono: '+56 9 3123 4288',
  correo: 'contacto@constructoraroka.cl',
};

const ROKA_LOGO_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1079 1079" width="62" height="62" style={{ flexShrink: 0, borderRadius: 10 }}>
    <rect width="1079" height="1079" fill="#ea9a00" />
    <path d="M 656,606 L 646,591 L 635,591 L 356,678 L 318,777 L 343,776 L 374,702 L 656,615 Z M 989,597 L 968,585 L 815,818 L 282,818 L 293,843 L 834,843 Z M 885,539 L 868,522 L 858,522 L 691,574 L 691,583 L 701,598 L 711,598 L 873,547 L 885,547 Z" fill="#c58200" opacity="0.9" />
    <path d="M 972,572 L 664,252 L 327,348 L 116,565 L 273,816 L 815,816 Z M 764,770 L 763,779 L 315,778 L 355,676 L 637,588 L 649,591 Z M 370,522 L 370,535 L 283,748 L 275,748 L 173,589 L 173,579 Z M 868,519 L 922,575 L 922,583 L 811,753 L 800,756 L 690,586 L 688,573 Z M 831,480 L 828,490 L 377,626 L 426,503 L 760,407 Z M 722,367 L 720,377 L 219,522 L 219,514 L 350,380 L 653,296 Z" fill="white" fillRule="evenodd" />
  </svg>
);

const fmtMoney = (value: number | null | undefined) => formatCLP(Number(value || 0));

const fmtDate = (input?: string) => {
  if (!input) return '-';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-CL');
};

interface OCPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orden: any;
}

interface OCDocProps {
  orden: any;
  atencionManual: string;
}

const rowLabelStyle: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: '9px',
  fontWeight: 700,
  color: '#374151',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  width: '36%',
};

const rowValueStyle: React.CSSProperties = {
  padding: '4px 6px',
  fontSize: '10px',
  color: '#111827',
  borderBottom: '1px dotted #d1d5db',
};

const headerLabelStyle: React.CSSProperties = {
  fontSize: '8px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: '#475569',
  padding: '2px 4px',
  width: '36%',
};

const headerValueStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  color: '#0f172a',
  padding: '2px 4px',
};

const OCDoc: React.FC<OCDocProps> = ({ orden, atencionManual }) => {
  const items: any[] = orden?.items || [];
  const hasItemDiscount = items.some((i: any) => Number(i?.descuento_porcentaje || 0) > 0);
  const atencion = atencionManual.trim() || orden?.atencion_a || orden?.proveedor_contacto_nombre || '-';
  const folio = orden?.folio || `OC-${String(orden?.id || 0).padStart(6, '0')}`;
  const numeroSolicitud = orden?.solicitud_id ? `SM-${String(orden.solicitud_id).padStart(3, '0')}` : '-';
  const numeroSolicitudCotizacion = orden?.solicitud_cotizacion_id ? `SC-${String(orden.solicitud_cotizacion_id).padStart(3, '0')}` : '-';
  const moneda = 'PESO CHILENO';
  const subtotalNeto = Number(orden?.subtotal_neto ?? orden?.total ?? 0);
  const descuentoMonto = Number(orden?.descuento_monto ?? 0);
  const descuentoTipo = String(orden?.descuento_tipo || 'none');
  const descuentoValor = Number(orden?.descuento_valor ?? 0);
  const impuesto = Number(orden?.impuesto_monto ?? subtotalNeto * 0.19);
  const totalFinal = Number(orden?.total_final ?? subtotalNeto + impuesto);

  const descuentoDetalle = useMemo(() => {
    if (descuentoTipo === 'porcentaje') return `${descuentoValor.toFixed(2)}%`;
    if (descuentoTipo === 'monto') return fmtMoney(descuentoValor);
    return 'Sin descuento';
  }, [descuentoTipo, descuentoValor]);

  return (
    <div
      style={{
        width: '210mm',
        minHeight: '297mm',
        boxSizing: 'border-box',
        padding: '10mm 11mm',
        color: '#111827',
        backgroundColor: '#ffffff',
        fontFamily: `'Trebuchet MS', 'Gill Sans', sans-serif`,
      }}
    >
      <div
        style={{
          border: '2px solid #0f172a',
          borderRadius: '10px',
          overflow: 'hidden',
          marginBottom: '8px',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(90deg, #0f172a 0%, #1e293b 100%)',
            color: '#f8fafc',
            padding: '7px 10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {ROKA_LOGO_SVG}
            <div style={{ lineHeight: 1.2 }}>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Sistema de Compras y Abastecimiento</div>
              <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.03em', marginBottom: '3px' }}>ORDEN DE COMPRA</div>
              <div style={{ fontSize: '10px', fontWeight: 700 }}>{EMPRESA.nombre}</div>
              <div style={{ fontSize: '9px', opacity: 0.95 }}>General Arteaga N°30</div>
              <div style={{ fontSize: '9px', opacity: 0.95 }}>Rut {EMPRESA.rut}</div>
              <div style={{ fontSize: '9px', opacity: 0.95 }}>Tel. +56 582 295842</div>
              <div style={{ fontSize: '9px', opacity: 0.95 }}>Cel. +56 9 31234288</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', opacity: 0.85 }}>Orden de Compra N°: </div>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>{folio}</div>
            <div style={{ fontSize: '10px' }}>Fecha: {fmtDate(orden?.fecha_emision)}</div>
          </div>
        </div>

        <div style={{ padding: '8px 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: '#0f172a' }}>DATOS DEL PROVEEDOR</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={headerLabelStyle}>Señor(es)</td>
                  <td style={headerValueStyle}>{orden?.proveedor || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>N° Cotiz. Venta</td>
                  <td style={headerValueStyle}>{orden?.numero_cov || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Atención</td>
                  <td style={headerValueStyle}>{atencion}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Dirección</td>
                  <td style={headerValueStyle}>{orden?.proveedor_direccion || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Rut</td>
                  <td style={headerValueStyle}>{orden?.proveedor_rut || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Teléfono</td>
                  <td style={headerValueStyle}>{orden?.proveedor_telefono || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Email</td>
                  <td style={headerValueStyle}>{orden?.proveedor_correo || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 800, marginBottom: '6px', color: '#0f172a' }}>DATOS DE OBRA</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={headerLabelStyle}>Despachar a</td>
                  <td style={headerValueStyle}>{orden?.condiciones_entrega || 'Despachar a Obra'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Plazo de Entrega</td>
                  <td style={headerValueStyle}>{orden?.plazo_entrega || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Cód. Obra</td>
                  <td style={headerValueStyle}>{orden?.codigo_obra || orden?.proyecto_numero_obra || orden?.proyecto_numero_licitacion || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Obra</td>
                  <td style={headerValueStyle}>{orden?.proyecto_nombre || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Autorizado por</td>
                  <td style={headerValueStyle}>{orden?.autorizado_por_nombre || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Nro. Solicitud de Cotización</td>
                  <td style={headerValueStyle}>{numeroSolicitudCotizacion}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Encargado</td>
                  <td style={headerValueStyle}>{orden?.responsable_nombre || orden?.solicitante || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Forma de Pago</td>
                  <td style={headerValueStyle}>{orden?.condiciones_pago || 'Crédito 45 días'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Emitida por</td>
                  <td style={headerValueStyle}>{orden?.autorizado_por_nombre || '-'}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Fecha Autorización</td>
                  <td style={headerValueStyle}>{fmtDate(orden?.updated_at || orden?.fecha_emision)}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Moneda</td>
                  <td style={headerValueStyle}>{moneda}</td>
                </tr>
                <tr>
                  <td style={headerLabelStyle}>Nro. Solic. Mat.</td>
                  <td style={headerValueStyle}>{numeroSolicitud}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1', marginBottom: '7px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #cbd5e1', padding: '5px', fontSize: '9px', width: '30px' }}>#</th>
            <th style={{ border: '1px solid #cbd5e1', padding: '5px', fontSize: '9px', width: '62px' }}>Cant.</th>
            <th style={{ border: '1px solid #cbd5e1', padding: '5px', fontSize: '9px', width: '70px' }}>Codigo</th>
            <th style={{ border: '1px solid #cbd5e1', padding: '5px', fontSize: '9px' }}>Descripcion</th>
            <th style={{ border: '1px solid #cbd5e1', padding: '5px', fontSize: '9px', width: '88px' }}>P. Unitario</th>
            {hasItemDiscount && <th style={{ border: '1px solid #cbd5e1', padding: '5px', fontSize: '9px', width: '44px', textAlign: 'center' }}>Desc.</th>}
            <th style={{ border: '1px solid #cbd5e1', padding: '5px', fontSize: '9px', width: '92px' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, index: number) => {
            const cantidad = Number(item?.cantidad_requerida ?? item?.cantidad_extraida ?? 0);
            const unitario = Number(item?.precio_unitario || 0);
            const desc = Number(item?.descuento_porcentaje || 0);
            const subtotal = (item?.subtotal != null && Number(item.subtotal) > 0)
              ? Number(item.subtotal)
              : Math.round(cantidad * unitario * (desc > 0 ? (1 - desc / 100) : 1) * 100) / 100;
            return (
              <tr key={item?.id ?? index}>
                <td style={{ border: '1px solid #e2e8f0', padding: '5px', fontSize: '9px', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ border: '1px solid #e2e8f0', padding: '5px', fontSize: '9px', textAlign: 'right' }}>
                  {cantidad.toLocaleString('es-CL')}
                </td>
                <td style={{ border: '1px solid #e2e8f0', padding: '5px', fontSize: '9px', textAlign: 'center' }}>
                  {item?.material_sku || '-'}
                </td>
                <td style={{ border: '1px solid #e2e8f0', padding: '5px', fontSize: '9px' }}>
                  <div style={{ fontWeight: 700 }}>{item?.nombre_material || '-'}</div>
                  <div style={{ color: '#475569' }}>Unidad: {item?.unidad || '-'}</div>
                </td>
                <td style={{ border: '1px solid #e2e8f0', padding: '5px', fontSize: '9px', textAlign: 'right' }}>
                  {fmtMoney(unitario)}
                </td>
                {hasItemDiscount && (
                  <td style={{ border: '1px solid #e2e8f0', padding: '5px', fontSize: '9px', textAlign: 'center' }}>
                    {desc > 0
                      ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '9px' }}>{desc}%</span>
                      : '-'}
                  </td>
                )}
                <td style={{ border: '1px solid #e2e8f0', padding: '5px', fontSize: '9px', textAlign: 'right' }}>
                  {fmtMoney(subtotal)}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={hasItemDiscount ? 7 : 6} style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
                Esta orden no tiene items cargados.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '10px', marginBottom: '10px' }}>
        <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>CONDICIONES COMERCIALES</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={rowLabelStyle}>Cond. de pago</td><td style={rowValueStyle}>{orden?.condiciones_pago || '-'}</td></tr>
              <tr><td style={rowLabelStyle}>Plazo entrega</td><td style={rowValueStyle}>{orden?.plazo_entrega || '-'}</td></tr>
              <tr><td style={rowLabelStyle}>Cond. entrega</td><td style={rowValueStyle}>{orden?.condiciones_entrega || '-'}</td></tr>
              <tr><td style={rowLabelStyle}>Observaciones</td><td style={rowValueStyle}>{orden?.observaciones || '-'}</td></tr>
              <tr><td style={rowLabelStyle}>Autorizado por</td><td style={rowValueStyle}>{orden?.autorizado_por_nombre || '-'}</td></tr>
            </tbody>
          </table>
        </div>

        <div style={{ border: '1px solid #1e293b', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '7px', fontSize: '10px', borderBottom: '1px solid #e2e8f0' }}>Subtotal Neto</td>
                <td style={{ padding: '7px', fontSize: '10px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>{fmtMoney(subtotalNeto)}</td>
              </tr>
              <tr>
                <td style={{ padding: '7px', fontSize: '10px', borderBottom: '1px solid #e2e8f0' }}>
                  Descuento ({descuentoDetalle})
                </td>
                <td style={{ padding: '7px', fontSize: '10px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>- {fmtMoney(descuentoMonto)}</td>
              </tr>
              <tr>
                <td style={{ padding: '7px', fontSize: '10px', borderBottom: '1px solid #e2e8f0' }}>IVA (19%)</td>
                <td style={{ padding: '7px', fontSize: '10px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>{fmtMoney(impuesto)}</td>
              </tr>
              <tr style={{ background: '#0f172a', color: '#f8fafc' }}>
                <td style={{ padding: '9px', fontSize: '11px', fontWeight: 800 }}>TOTAL FINAL</td>
                <td style={{ padding: '9px', fontSize: '12px', fontWeight: 800, textAlign: 'right' }}>{fmtMoney(totalFinal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '10px' }}>
        {[
          { label: 'Solicitado por', value: orden?.solicitante || '-' },
          { label: 'Revisado por', value: orden?.autorizado_por_nombre || '-' },
          { label: 'Aprobado por', value: EMPRESA.nombre },
        ].map(sig => (
          <div key={sig.label} style={{ textAlign: 'center' }}>
            <div style={{ height: '34px' }} />
            <div style={{ borderTop: '1px solid #94a3b8', paddingTop: '5px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700 }}>{sig.label}</div>
              <div style={{ fontSize: '9px', color: '#475569' }}>{sig.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '8px', fontSize: '8px', color: '#64748b', textAlign: 'right' }}>
        Documento generado por ROKA | {fmtDate(new Date().toISOString())}
      </div>
    </div>
  );
};

const OCPreviewModal: React.FC<OCPreviewModalProps> = ({ isOpen, onClose, orden }) => {
  const [atencion, setAtencion] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAtencion(orden?.atencion_a || orden?.proveedor_contacto_nombre || '');
  }, [isOpen, orden]);

  const handleEnviarProveedor = async () => {
    if (!orden?.id) return;
    const result = await Swal.fire({
      title: '¿Enviar OC al proveedor?',
      html: `Se enviará la Orden de Compra <strong>${orden.folio || `OC-${String(orden.id).padStart(3, '0')}`}</strong> por correo electrónico al proveedor <strong>${orden.proveedor}</strong>.`,
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
      const res = await enviarOCProveedor(orden.id);
      await Swal.fire({
        title: '¡Email enviado!',
        text: `Orden de Compra enviada a ${res.enviado_a}`,
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

  const handlePrint = () => {
    const apiBase = import.meta.env.VITE_API_URL + '/roka/api';
    const token = localStorage.getItem('roka_token') || '';
    const url = `${apiBase}/ordenes/${orden.id}/html`;

    // Abrir ventana en blanco y hacer fetch con el token de autenticación
    const win = window.open('', '_blank');
    if (!win) { alert('El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio.'); return; }

    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.text())
      .then(html => {
        win.document.open();
        win.document.write(html);
        win.document.close();
        win.addEventListener('load', () => { win.focus(); win.print(); });
      })
      .catch(() => { win.close(); alert('Error al generar el documento para imprimir.'); });
  };

  if (!isOpen || !orden) return null;

  return (
    <>
      <div className="fixed inset-0 z-[150] bg-slate-950/70 flex flex-col items-center py-6 overflow-y-auto">
        <div className="w-[980px] max-w-[96vw] bg-white rounded-t-xl border-b border-slate-200 flex items-center justify-between px-5 py-3 sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Vista Previa - Orden de Compra</h2>
            <p className="text-xs text-slate-500">
              {orden.folio || `OC-${String(orden.id).padStart(6, '0')}`} | {orden.proveedor} | {orden.proyecto_nombre}
            </p>
            {/* Audit Trail - Estado de entrega */}
            {orden.estado_entrega && orden.estado_entrega !== 'Pendiente' && (
              <div className="mt-1">
                <AuditTrailBadge
                  label="Entrega actualizada por"
                  nombre={orden.entrega_updated_by_nombre}
                  fecha={orden.entrega_updated_at}
                  icon="entrega"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">A la atencion de:</label>
              <input
                value={atencion}
                onChange={e => setAtencion(e.target.value)}
                placeholder="Nombre de contacto"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400 w-48"
              />
            </div>
            <button
              onClick={handleEnviarProveedor}
              disabled={sendingEmail}
              title="Enviar OC al proveedor por email"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <MailCheck size={15} />
              {sendingEmail ? 'Enviando...' : 'Enviar a Proveedor'}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-amber-600 transition-colors cursor-pointer"
            >
              <Printer size={15} />
              Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="w-[980px] max-w-[96vw] bg-slate-200 rounded-b-xl px-6 py-6 flex justify-center ">
          <div className="bg-white shadow-xl" style={{ width: '210mm' }}>
            <OCDoc orden={orden} atencionManual={atencion} />
          </div>
        </div>
      </div>

    </>
  );
};

export default OCPreviewModal;
