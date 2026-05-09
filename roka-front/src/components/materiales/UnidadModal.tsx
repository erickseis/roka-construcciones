import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { UnidadMedida } from '../../types';
import { createUnidadMedida, updateUnidadMedida } from '../../lib/api';

interface UnidadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  unidad: UnidadMedida | null;
}

export default function UnidadModal({ isOpen, onClose, onSave, unidad }: UnidadModalProps) {
  const [formData, setFormData] = useState({
    nombre: '',
    abreviatura: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (unidad) {
      setFormData({
        nombre: unidad.nombre,
        abreviatura: unidad.abreviatura
      });
    } else {
      setFormData({
        nombre: '',
        abreviatura: ''
      });
    }
  }, [unidad, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (unidad) {
        await updateUnidadMedida(unidad.id, formData);
      } else {
        await createUnidadMedida(formData);
      }
      onSave();
      onClose();
    } catch (error: any) {
      console.error('Error al guardar unidad:', error);
      alert(error.error || 'Error al guardar la unidad de medida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">
            {unidad ? 'Editar Unidad' : 'Nueva Unidad'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Nombre de la Unidad *</label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Ej: Kilogramos, Metros Cúbicos, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Abreviatura *</label>
            <input
              type="text"
              required
              value={formData.abreviatura}
              onChange={(e) => setFormData({ ...formData, abreviatura: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Ej: kg, m3, und, etc."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2 text-sm font-black text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 dark:bg-slate-50 dark:text-slate-900 cursor-pointer"
            >
              <Save size={18} />
              {isSubmitting ? 'Guardando...' : 'Guardar Unidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
