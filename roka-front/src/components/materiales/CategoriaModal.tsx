import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { MaterialCategoria } from '../../types';
import { createMaterialCategoria, updateMaterialCategoria } from '../../lib/api';

interface CategoriaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  categoria: MaterialCategoria | null;
}

export default function CategoriaModal({ isOpen, onClose, onSave, categoria }: CategoriaModalProps) {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (categoria) {
      setFormData({
        nombre: categoria.nombre,
        descripcion: categoria.descripcion || ''
      });
    } else {
      setFormData({
        nombre: '',
        descripcion: ''
      });
    }
  }, [categoria, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (categoria) {
        await updateMaterialCategoria(categoria.id, formData);
      } else {
        await createMaterialCategoria(formData);
      }
      onSave();
      onClose();
    } catch (error) {
      console.error('Error al guardar categoría:', error);
      alert('Error al guardar la categoría.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">
            {categoria ? 'Editar Categoría' : 'Nueva Categoría'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Nombre de la Categoría *</label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Ej: Pinturas, Arreglos, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full h-24 resize-none rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Breve descripción de la categoría..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2 text-sm font-black text-white shadow-lg shadow-amber-500/30 transition-all hover:bg-amber-600 active:scale-95 disabled:opacity-50"
            >
              <Save size={18} />
              {isSubmitting ? 'Guardando...' : 'Guardar Categoría'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
