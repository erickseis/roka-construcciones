import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Printer } from 'lucide-react';
import logoRoka from '@/assets/image.png';

const EMPRESA = {
  nombre: 'Constructora Roka SpA',
  rut: '77.122.411-3',
  direccion: 'General Arteaga 30, Arica',
  telefono: '+56 9 3123 4288',
  correo: 'contacto@constructoraroka.cl',
};

const fmtMoney = (value: number) =>
  `$ ${Number(value || 0).toLocaleString('es-CL', { minimumFractionDigits: 2 })}`;

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

const OCDoc: React.FC<OCDocProps> = ({ orden, atencionManual }) => {
  const items: any[] = orden?.items || [];
  const atencion = atencionManual.trim() || orden?.atencion_a || orden?.proveedor_contacto_nombre || '-';
  const folio = orden?.folio || `OC-${String(orden?.id || 0).padStart(6, '0')}`;
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
            <img src={logoRoka} alt="Roka" style={{ width: '95px', objectFit: 'contain', filter: 'brightness(120%)' }} />
            <div>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>Sistema de Compras y Abastecimiento</div>
              <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.03em' }}>ORDEN DE COMPRA</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', opacity: 0.85 }}>Folio</div>
            <div style={{ fontSize: '16px', fontWeight: 800 }}>{folio}</div>
            <div style={{ fontSize: '10px' }}>Fecha: {fmtDate(orden?.fecha_emision)}</div>
          </div>
        </div>

        <div style={{ padding: '8px 10px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, marginBottom: '5px', color: '#0f172a' }}>PROVEEDOR</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={rowLabelStyle}>Nombre</td><td style={rowValueStyle}>{orden?.proveedor || '-'}</td></tr>
                <tr><td style={rowLabelStyle}>RUT</td><td style={rowValueStyle}>{orden?.proveedor_rut || '-'}</td></tr>
                <tr><td style={rowLabelStyle}>Razon social</td><td style={rowValueStyle}>{orden?.proveedor_razon_social || '-'}</td></tr>
                <tr><td style={rowLabelStyle}>Direccion</td><td style={rowValueStyle}>{orden?.proveedor_direccion || '-'}</td></tr>
                <tr><td style={rowLabelStyle}>Atencion</td><td style={rowValueStyle}>{atencion}</td></tr>
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontSize: '10px', fontWeight: 800, marginBottom: '5px', color: '#0f172a' }}>OBRA Y REMITENTE</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={rowLabelStyle}>Obra</td><td style={rowValueStyle}>{orden?.proyecto_nombre || '-'}</td></tr>
                <tr><td style={rowLabelStyle}>Ubicacion</td><td style={rowValueStyle}>{orden?.proyecto_ubicacion || '-'}</td></tr>
                <tr><td style={rowLabelStyle}>Licitacion</td><td style={rowValueStyle}>{orden?.proyecto_numero_licitacion || '-'}</td></tr>
                <tr><td style={rowLabelStyle}>Remitente</td><td style={rowValueStyle}>{EMPRESA.nombre}</td></tr>
                <tr><td style={rowLabelStyle}>Contacto</td><td style={rowValueStyle}>{EMPRESA.telefono} | {EMPRESA.correo}</td></tr>
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
            <th style={{ border: '1px solid #cbd5e1', padding: '5px', fontSize: '9px', width: '92px' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, index: number) => {
            const cantidad = Number(item?.cantidad_requerida || 0);
            const unitario = Number(item?.precio_unitario || 0);
            const subtotal = Number(item?.subtotal ?? cantidad * unitario);
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
                <td style={{ border: '1px solid #e2e8f0', padding: '5px', fontSize: '9px', textAlign: 'right' }}>
                  {fmtMoney(subtotal)}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} style={{ border: '1px solid #e2e8f0', padding: '10px', textAlign: 'center', fontSize: '10px', color: '#64748b' }}>
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

  useEffect(() => {
    if (!isOpen) return;

    const style = document.createElement('style');
    style.id = 'oc-print-styles';
    style.textContent = `
      @media print {
        body > *:not(#oc-print-portal) { display: none !important; }
        #oc-print-portal { display: block !important; }
        @page { margin: 0; size: A4 portrait; }
      }
      #oc-print-portal { display: none; }
    `;
    document.head.appendChild(style);

    return () => {
      document.getElementById('oc-print-styles')?.remove();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setAtencion(orden?.atencion_a || orden?.proveedor_contacto_nombre || '');
  }, [isOpen, orden]);

  if (!isOpen || !orden) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-950/70 flex flex-col items-center py-6 overflow-y-auto">
        <div className="w-[980px] max-w-[96vw] bg-white rounded-t-xl border-b border-slate-200 flex items-center justify-between px-5 py-3 sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Vista Previa - Orden de Compra</h2>
            <p className="text-xs text-slate-500">
              {orden.folio || `OC-${String(orden.id).padStart(6, '0')}`} | {orden.proveedor} | {orden.proyecto_nombre}
            </p>
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
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-amber-600 transition-colors"
            >
              <Printer size={15} />
              Imprimir / PDF
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="w-[980px] max-w-[96vw] bg-slate-200 rounded-b-xl px-6 py-6 flex justify-center min-h-[500px]">
          <div className="bg-white shadow-xl" style={{ width: '210mm' }}>
            <OCDoc orden={orden} atencionManual={atencion} />
          </div>
        </div>
      </div>

      {ReactDOM.createPortal(
        <div id="oc-print-portal">
          <OCDoc orden={orden} atencionManual={atencion} />
        </div>,
        document.body
      )}
    </>
  );
};

export default OCPreviewModal;
