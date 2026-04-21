import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { X, Printer } from 'lucide-react';
import logoRoka from '@/assets/image.png';

const EMPRESA = {
  nombre: 'CONSTRUCTORA ROKA SPA',
  rut: '77.122.411-3',
  direccion: 'General Arteaga 30',
  telefono: '+56 9 31234288',
  ciudad: 'ARICA-CHILE',
};

const IVA = 0.19;
const MAX_ROWS = 8;

const fmt = (n: number) => '$' + Math.round(n).toLocaleString('es-CL');
const fmtNum = (n: number) => n.toLocaleString('es-CL');

const fmtDate = (s: string) => {
  const d = new Date(s);
  return [
    String(d.getDate()).padStart(2, '0'),
    String(d.getMonth() + 1).padStart(2, '0'),
    d.getFullYear(),
  ].join('-');
};

interface OCDocProps {
  orden: any;
  atencion: string;
}

const OCDoc: React.FC<OCDocProps> = ({ orden, atencion }) => {
  const items: any[] = orden.items || [];
  const paddedItems = [
    ...items,
    ...Array(Math.max(0, MAX_ROWS - items.length)).fill(null),
  ];

  const subtotal = Number(orden.total);
  const impuesto = Math.round(subtotal * IVA);
  const total = subtotal + impuesto;
  const fecha = fmtDate(orden.fecha_emision);

  const cellBorder = '1px solid #000';
  const th: React.CSSProperties = {
    border: cellBorder,
    padding: '3px 5px',
    fontWeight: 'bold',
    backgroundColor: '#fff',
    whiteSpace: 'nowrap' as const,
  };
  const td: React.CSSProperties = { border: cellBorder, padding: '3px 5px' };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' as const };

  return (
    <div style={{
      fontFamily: 'Arial, sans-serif',
      fontSize: '10px',
      color: '#000',
      backgroundColor: '#fff',
      padding: '12mm 14mm',
      width: '210mm',
      minHeight: '297mm',
      boxSizing: 'border-box',
    }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>

        {/* LEFT: Destinado a + Facturar a */}
        <div style={{ flex: 1, lineHeight: '1.55', fontSize: '10px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontWeight: 'bold' }}>Destinado a:</div>
            <div>{orden.proveedor}</div>
            <div>COTIZACIÓN n° COT-{String(orden.cotizacion_id).padStart(3, '0')}</div>
            <div>{EMPRESA.ciudad}</div>
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>Facturar a:</div>
            <div>{EMPRESA.nombre}</div>
            <div>RUT: {EMPRESA.rut}</div>
            <div>{EMPRESA.direccion}</div>
            <div>Teléfono {EMPRESA.telefono}</div>
            <div>{EMPRESA.ciudad}</div>
          </div>
        </div>

        {/* CENTER: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '180px', flexShrink: 0 }}>
          <img src={logoRoka} alt="Roka" style={{ width: '160px', objectFit: 'contain' }} />
        </div>

        {/* RIGHT: Title + info table */}
        <div style={{ flex: 1 }}>
          <div style={{ textAlign: 'right', marginBottom: '8px' }}>
            <div style={{
              fontSize: '22px',
              fontWeight: 'bold',
              color: '#555',
              letterSpacing: '3px',
              lineHeight: 1,
            }}>
              ORDEN DE COMPRA
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '10px', letterSpacing: '1px', color: '#333', marginTop: '4px' }}>
              N°&nbsp;&nbsp;&nbsp;{String(orden.id).padStart(3, '0')} / {orden.proyecto_nombre?.toUpperCase()}
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <tbody>
              {[
                ['Fecha:', fecha],
                ['Autorizado por:', orden.autorizado_por_nombre || ''],
                ['A la atención de:', atencion],
                ['Tipo de entrega:', 'Inmediata'],
                ['con fecha:', fecha],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ border: cellBorder, padding: '2px 4px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{label}</td>
                  <td style={{ border: cellBorder, padding: '2px 4px', minWidth: '90px' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ITEMS TABLE ────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '6px' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'right', width: '28px' }}>#</th>
            <th style={{ ...th, textAlign: 'right', width: '60px' }}>Cantidad</th>
            <th style={{ ...th, textAlign: 'right', width: '70px' }}>Código</th>
            <th style={{ ...th, textAlign: 'left' }}>Producto</th>
            <th style={{ ...th, textAlign: 'right', width: '80px' }}>P.Unitario</th>
            <th style={{ ...th, textAlign: 'right', width: '90px' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {paddedItems.map((item: any, i: number) => {
            const rowTotal = item
              ? Number(item.precio_unitario) * Number(item.cantidad_requerida)
              : 0;
            const codigo = item?.material_sku || '';
            const producto = item
              ? codigo
                ? `${codigo}-${item.nombre_material}`
                : item.nombre_material
              : '';
            return (
              <tr key={i} style={{ height: '20px' }}>
                <td style={{ ...tdR }}>{i + 1}</td>
                <td style={{ ...tdR }}>{item ? fmtNum(Number(item.cantidad_requerida)) : ''}</td>
                <td style={{ ...tdR }}>{codigo}</td>
                <td style={{ ...td }}>{produto}</td>
                <td style={{ ...tdR }}>{item ? fmtNum(Number(item.precio_unitario)) : ''}</td>
                <td style={{ ...tdR }}>{item ? fmtNum(rowTotal) : '0'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── TOTALS ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '10px' }}>
          <tbody>
            {[
              ['Subtotal', fmt(subtotal)],
              ['Impuesto', fmt(impuesto)],
              ['Total', fmt(total)],
            ].map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: '3px 8px', fontWeight: 'bold', textAlign: 'right' }}>{label}</td>
                <td style={{
                  border: cellBorder,
                  padding: '3px 10px',
                  textAlign: 'right',
                  backgroundColor: '#FFFFC0',
                  minWidth: '120px',
                  fontWeight: label === 'Total' ? 'bold' : 'normal',
                }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── SIGNATURE BLOCKS ───────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: '16px', marginTop: '8px' }}>
        {[
          { nombre: orden.autorizado_por_nombre || '', sub: '' },
          { nombre: '', sub: '' },
          { nombre: EMPRESA.nombre, sub: `Rut: ${EMPRESA.rut}` },
        ].map((sig, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ height: '50px' }} />
            <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '9px' }}>
              <div style={{ fontWeight: 'bold' }}>{sig.nombre}</div>
              {sig.sub && <div>{sig.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM SIGN LINES ──────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px' }}>
        <div>
          <div style={{ width: '180px', borderTop: '1px solid #000', marginBottom: '3px' }} />
          <div style={{ fontSize: '9px' }}>Firma y Timbre &nbsp;&nbsp;&nbsp; Fecha</div>
        </div>
        <div>
          <div style={{ width: '180px', borderTop: '1px solid #000', marginBottom: '3px' }} />
          <div style={{ fontSize: '9px' }}>Fecha</div>
        </div>
      </div>
    </div>
  );

  // Fix typo in variable above
  function produto(item: any, codigo: string) {
    return item ? (codigo ? `${codigo}-${item.nombre_material}` : item.nombre_material) : '';
  }
};

interface OCPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  orden: any;
}

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

  if (!isOpen || !orden) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* ── Modal overlay (screen only) ── */}
      <div className="fixed inset-0 z-50 bg-black/60 flex flex-col items-center py-6 overflow-y-auto">
        {/* Toolbar */}
        <div className="w-[900px] max-w-[95vw] bg-white rounded-t-xl border-b border-slate-200 flex items-center justify-between px-5 py-3 sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="font-bold text-slate-800 text-base">Vista Previa — Orden de Compra</h2>
            <p className="text-xs text-slate-500">
              OC-{String(orden.id).padStart(3, '0')} &middot; {orden.proveedor} &middot; {orden.proyecto_nombre}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">A la atención de:</label>
              <input
                value={atencion}
                onChange={e => setAtencion(e.target.value)}
                placeholder="Nombre del contacto..."
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-amber-400 w-44"
              />
            </div>
            <button
              onClick={handlePrint}
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

        {/* Paper preview */}
        <div className="w-[900px] max-w-[95vw] bg-slate-200 rounded-b-xl px-6 py-6 flex justify-center min-h-[500px]">
          <div className="bg-white shadow-xl" style={{ width: '210mm' }}>
            <OCDoc orden={orden} atencion={atencion} />
          </div>
        </div>
      </div>

      {/* ── Print portal (body-level, hidden on screen, visible on print) ── */}
      {ReactDOM.createPortal(
        <div id="oc-print-portal">
          <OCDoc orden={orden} atencion={atencion} />
        </div>,
        document.body
      )}
    </>
  );
};

export default OCPreviewModal;
