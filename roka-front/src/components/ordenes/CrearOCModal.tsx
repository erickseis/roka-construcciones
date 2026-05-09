import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { generarOrden, getSolicitudesCotizacion, getSolicitudCotizacion } from '@/lib/api';
import { formatCLP } from '@/lib/utils';
import { PackageCheck } from 'lucide-react';

interface CrearOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialSolicitudCotizacionId?: number;
}

interface SolicitudCotizacionDetalle {
  id: number;
  proveedor: string;
  proyecto_nombre: string;
  items?: Array<{
    id: number;
    nombre_material: string;
    cantidad_requerida: number;
    unidad: string;
    precio_unitario?: number;
  }>;
}

const condicionesPagoOpciones = [
  'Neto 30 días',
  'Neto 60 días',
  'Contado',
  'Contra entrega',
  '50% anticipo',
];

export function CrearOCModal({ isOpen, onClose, onSuccess, initialSolicitudCotizacionId }: CrearOCModalProps) {
  // Form state
  const [solicitudCotizacionId, setSolicitudCotizacionId] = useState('');
  const [condicionesPago, setCondicionesPago] = useState('Neto 30 días');
  const [folio, setFolio] = useState('');
  const [descuentoTipo, setDescuentoTipo] = useState<'none' | 'porcentaje' | 'monto'>('none');
  const [descuentoValor, setDescuentoValor] = useState('0');
  const [plazoEntrega, setPlazoEntrega] = useState('Inmediata');
  const [condicionesEntrega, setCondicionesEntrega] = useState('Puesto en obra');
  const [atencionA, setAtencionA] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Data state
  const [solicitudesCotizacion, setSolicitudesCotizacion] = useState<SolicitudCotizacionDetalle[]>([]);
  const [scDetalle, setScDetalle] = useState<SolicitudCotizacionDetalle | null>(null);
  const [loadingSC, setLoadingSC] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);

  // Determinar si hay SC pre-seleccionada
  const isPreselected = !!initialSolicitudCotizacionId;

  // Cargar lista de SCs respondidas (solo si no hay pre-selección)
  useEffect(() => {
    if (isOpen && !isPreselected) {
      setLoadingForm(true);
      getSolicitudesCotizacion({ estado: 'Respondida' })
        .then(data => setSolicitudesCotizacion(data || []))
        .catch(() => setSolicitudesCotizacion([]))
        .finally(() => setLoadingForm(false));
    }
  }, [isOpen, isPreselected]);

  // Cargar detalle de SC cuando hay pre-selección o cuando se selecciona una del dropdown
  useEffect(() => {
    const scId = isPreselected ? initialSolicitudCotizacionId : solicitudCotizacionId;
    if (scId && isOpen) {
      setLoadingSC(true);
      getSolicitudCotizacion(Number(scId))
        .then(data => setScDetalle(data))
        .catch(() => setScDetalle(null))
        .finally(() => setLoadingSC(false));
    } else {
      setScDetalle(null);
    }
  }, [isOpen, isPreselected, initialSolicitudCotizacionId, solicitudCotizacionId]);

  // Reset form cuando se cierra el modal
  useEffect(() => {
    if (!isOpen) {
      setSolicitudCotizacionId('');
      setCondicionesPago('Neto 30 días');
      setFolio('');
      setDescuentoTipo('none');
      setDescuentoValor('0');
      setPlazoEntrega('Inmediata');
      setCondicionesEntrega('Puesto en obra');
      setAtencionA('');
      setObservaciones('');
      setScDetalle(null);
    }
  }, [isOpen]);

  // Calcular subtotales
  const subtotalBase = scDetalle?.items?.reduce((sum, item) => {
    return sum + (Number(item.precio_unitario || 0) * Number(item.cantidad_requerida || 0));
  }, 0) || 0;

  const descuentoValorNum = Number(descuentoValor || 0);
  const descuentoMonto = descuentoTipo === 'porcentaje'
    ? (subtotalBase * descuentoValorNum) / 100
    : descuentoTipo === 'monto'
      ? descuentoValorNum
      : 0;
  const subtotalNetoEstimado = Math.max(0, subtotalBase - descuentoMonto);

  // Determinar el ID de SC a usar
  const currentSCId = isPreselected ? initialSolicitudCotizacionId : solicitudCotizacionId;

  // Determinar subtitle
  const subtitle = isPreselected && scDetalle
    ? `SC-${String(currentSCId).padStart(3, '0')} — ${scDetalle.proveedor}`
    : 'Selecciona una solicitud de cotización respondida para crear la OC';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSCId) return;

    setSubmitting(true);
    try {
      await generarOrden({
        solicitud_cotizacion_id: Number(currentSCId),
        condiciones_pago: condicionesPago,
        folio: folio.trim() || undefined,
        descuento_tipo: descuentoTipo,
        descuento_valor: descuentoTipo === 'none' ? undefined : Number(descuentoValor),
        plazo_entrega: plazoEntrega,
        condiciones_entrega: condicionesEntrega,
        atencion_a: atencionA.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al generar la orden de compra');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generar Orden de Compra"
      subtitle={subtitle}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Solicitud de Cotización */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Solicitud de Cotización Respondida
          </label>
          {isPreselected ? (
            <div className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-500">
              SC-{String(currentSCId).padStart(3, '0')} — {scDetalle?.proveedor || 'Cargando...'}
            </div>
          ) : (
            <select
              required
              value={solicitudCotizacionId}
              onChange={e => setSolicitudCotizacionId(e.target.value)}
              disabled={loadingForm}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
            >
              <option value="">Seleccionar solicitud de cotización...</option>
              {solicitudesCotizacion.map((sc: any) => (
                <option key={sc.id} value={sc.id}>
                  SC-{String(sc.id).padStart(3, '0')} — {sc.proveedor} — {sc.proyecto_nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Condiciones de Pago */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Condiciones de Pago
          </label>
          <select
            value={condicionesPago}
            onChange={e => setCondicionesPago(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            {condicionesPagoOpciones.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Folio y Plazo de Entrega */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Folio (opcional)
            </label>
            <input
              value={folio}
              onChange={e => setFolio(e.target.value)}
              placeholder="Si queda vacío se autogenera"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Plazo de Entrega
            </label>
            <input
              value={plazoEntrega}
              onChange={e => setPlazoEntrega(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
        </div>

        {/* Condiciones de Entrega */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Condiciones de Entrega
          </label>
          <input
            value={condicionesEntrega}
            onChange={e => setCondicionesEntrega(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {/* Tipo de Descuento y Valor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Tipo de Descuento
            </label>
            <select
              value={descuentoTipo}
              onChange={e => setDescuentoTipo(e.target.value as 'none' | 'porcentaje' | 'monto')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="none">Sin descuento</option>
              <option value="porcentaje">Porcentaje (%)</option>
              <option value="monto">Monto fijo ($)</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Valor de Descuento
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={descuentoTipo === 'none'}
              value={descuentoValor}
              onChange={e => setDescuentoValor(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60"
            />
          </div>
        </div>

        {/* A la atención de */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
            A la atención de
          </label>
          <input
            value={atencionA}
            onChange={e => setAtencionA(e.target.value)}
            placeholder="Contacto del proveedor"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {/* Observaciones */}
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
            Observaciones
          </label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {/* Resumen de SC seleccionada */}
        {currentSCId && scDetalle && !loadingSC && (
          <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-100">
            <p className="text-xs font-bold text-emerald-700 mb-2">Resumen</p>
            <div className="space-y-1 text-sm text-emerald-800 mb-3">
              <p><span className="font-medium">Proveedor:</span> {scDetalle.proveedor}</p>
              <p><span className="font-medium">Proyecto:</span> {scDetalle.proyecto_nombre}</p>
            </div>

            {/* Tabla de items */}
            {scDetalle.items && scDetalle.items.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-emerald-200">
                      <th className="text-left py-1.5 font-semibold text-emerald-700">Material</th>
                      <th className="text-right py-1.5 font-semibold text-emerald-700">Cant.</th>
                      <th className="text-left py-1.5 font-semibold text-emerald-700">Unidad</th>
                      <th className="text-right py-1.5 font-semibold text-emerald-700">P. Unit.</th>
                      <th className="text-right py-1.5 font-semibold text-emerald-700">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scDetalle.items.map((item, idx) => {
                      const subtotalItem = Number(item.precio_unitario || 0) * Number(item.cantidad_requerida || 0);
                      return (
                        <tr key={idx} className="border-b border-emerald-100/50">
                          <td className="py-1.5 text-emerald-900">{item.nombre_material}</td>
                          <td className="py-1.5 text-right text-emerald-800">{item.cantidad_requerida}</td>
                          <td className="py-1.5 text-left text-emerald-800">{item.unidad}</td>
                          <td className="py-1.5 text-right text-emerald-800">
                            ${formatCLP(Number(item.precio_unitario || 0))}
                          </td>
                          <td className="py-1.5 text-right text-emerald-800 font-medium">
                            ${formatCLP(subtotalItem)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totales */}
            <div className="mt-3 pt-2 border-t border-emerald-200 space-y-1">
              <p className="flex justify-between text-sm text-emerald-800">
                <span>Subtotal base:</span>
                <span className="font-medium">${formatCLP(subtotalBase)}</span>
              </p>
              <p className="flex justify-between text-sm text-emerald-800">
                <span>Descuento:</span>
                <span className="font-medium">-${formatCLP(Math.max(0, descuentoMonto), false)}</span>
              </p>
              <p className="flex justify-between text-lg font-black text-emerald-900 mt-2">
                <span>Neto comprometido:</span>
                <span>${Number(subtotalNetoEstimado).toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
              </p>
            </div>
          </div>
        )}

        {/* Loading state para detalle de SC */}
        {currentSCId && loadingSC && (
          <div className="rounded-lg bg-emerald-50 p-4 border border-emerald-100 text-center">
            <p className="text-sm text-emerald-600">Cargando detalle de solicitud de cotización...</p>
          </div>
        )}

        {/* Botones de acción */}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !currentSCId || loadingSC}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-60"
          >
            <PackageCheck size={16} />
            {submitting ? 'Generando...' : 'Generar Orden de Compra'}
          </button>
        </div>
      </form>
    </Modal>
  );
}