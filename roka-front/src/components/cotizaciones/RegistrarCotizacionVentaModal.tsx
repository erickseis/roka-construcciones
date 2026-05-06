import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { createCotizacion } from '@/lib/api';
import { DollarSign, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  solicitudCotizacionId: number;
  proveedor: string;
  items: { id: number; solicitud_item_id: number; nombre_material: string; cantidad_requerida: number; unidad: string }[];
  solicitudId: number;
  onSuccess: () => void;
}

export default function RegistrarCotizacionVentaModal({ isOpen, onClose, solicitudCotizacionId, proveedor, items, solicitudId, onSuccess }: Props) {
  const [precios, setPrecios] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      const defaultPrecios: Record<number, string> = {};
      items.forEach(item => { defaultPrecios[item.solicitud_item_id] = ''; });
      setPrecios(defaultPrecios);
      setError(null);
    }
  }, [isOpen, items]);

  const calcTotal = () => {
    return items.reduce((sum, item) => {
      const precio = parseFloat(precios[item.solicitud_item_id] || '0');
      return sum + (precio * parseFloat(item.cantidad_requerida));
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const itemsConPrecio = items.filter(i => parseFloat(precios[i.solicitud_item_id] || '0') > 0);
    if (itemsConPrecio.length === 0) {
      setError('Debes ingresar al menos un precio');
      return;
    }

    setSubmitting(true);
    try {
      await createCotizacion({
        solicitud_id: solicitudId,
        solicitud_cotizacion_id: solicitudCotizacionId,
        proveedor: proveedor,
        items: items.map(item => ({
          solicitud_item_id: item.solicitud_item_id,
          precio_unitario: parseFloat(precios[item.solicitud_item_id] || '0'),
        })),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al registrar cotización de venta');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}
      title="Registrar Cotización de Venta"
      subtitle={`Proveedor: ${proveedor}`}
      size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle size={14} /><span>{error}</span>
          </div>
        )}

        <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
          Ingresa los precios que el proveedor <strong>{proveedor}</strong> respondió.
          La solicitud de cotización se marcará automáticamente como "Respondida".
        </div>

        {items.length > 0 && (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Material</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Cantidad</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Unidad</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Precio Unit.</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const solicitudItemId = item.solicitud_item_id;
                  const precio = parseFloat(precios[solicitudItemId] || '0');
                  const subtotal = precio * parseFloat(item.cantidad_requerida);
                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-800">{item.nombre_material}</td>
                      <td className="px-3 py-2 text-right font-mono text-slate-600">{Number(item.cantidad_requerida).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-500">{item.unidad}</td>
                      <td className="px-3 py-2">
                        <input required type="number" min="0.01" step="0.01"
                          value={precios[solicitudItemId] || ''}
                          onChange={e => setPrecios(prev => ({ ...prev, [solicitudItemId]: e.target.value }))}
                          className="w-28 ml-auto block rounded-md border border-slate-200 bg-white px-2 py-1 text-right text-sm outline-none focus:border-blue-400"
                          placeholder="$0.00" />
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                        ${subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-blue-50/50">
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-right text-xs font-bold uppercase text-slate-600">Total</td>
                  <td className="px-3 py-3 text-right font-mono text-lg font-black text-blue-700">
                    ${calcTotal().toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:opacity-60">
            <DollarSign size={16} />
            {submitting ? 'Registrando...' : 'Registrar Cotización de Venta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
