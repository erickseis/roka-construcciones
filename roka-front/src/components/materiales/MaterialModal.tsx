import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Material, MaterialInput, UnidadMedida, MaterialCategoria } from '../../types';
import { getMaterialCategorias } from '../../lib/api';
import CategoriaModal from './CategoriaModal';

interface MaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MaterialInput) => Promise<void>;
  material?: Material | null;
  unidades: UnidadMedida[];
}

export default function MaterialModal({ isOpen, onClose, onSave, material, unidades }: MaterialModalProps) {
  const [formData, setFormData] = useState<MaterialInput>({
    sku: '',
    nombre: '',
    descripcion: '',
    unidad_medida_id: 0,
    categoria_id: 0,
    categoria: '',
    precio_referencial: undefined,
    is_active: true
  });
  const [categorias, setCategorias] = useState<MaterialCategoria[]>([]);
  const [isCategoriaModalOpen, setIsCategoriaModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategorias = async () => {
    try {
      const data = await getMaterialCategorias();
      setCategorias(data);
    } catch (error) {
      console.error('Error al cargar categorias:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCategorias();
    }
  }, [isOpen]);

  useEffect(() => {
    if (material) {
      setFormData({
        sku: material.sku || '',
        nombre: material.nombre,
        descripcion: material.descripcion || '',
        unidad_medida_id: material.unidad_medida_id,
        categoria_id: material.categoria_id || 0,
        categoria: material.categoria || '',
        precio_referencial: material.precio_referencial ? Number(material.precio_referencial) : undefined,
        is_active: material.is_active
      });
    } else {
      setFormData({
        sku: '',
        nombre: '',
        descripcion: '',
        unidad_medida_id: unidades.length > 0 ? unidades[0].id : 0,
        categoria_id: 0,
        categoria: '',
        precio_referencial: undefined,
        is_active: true
      });
    }
  }, [material, unidades, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error al guardar material:', error);
      alert('Error al guardar el material. Verifique los datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">
            {material ? 'Editar Material' : 'Nuevo Material'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">SKU / Código</label>
              <input
                type="text"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                placeholder="Ej: MAT-001"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">Categoría</label>
                <button 
                  type="button"
                  onClick={() => setIsCategoriaModalOpen(true)}
                  className="text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:underline"
                >
                  + Nueva
                </button>
              </div>
              <select
                value={formData.categoria_id || ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const cat = categorias.find(c => c.id === id);
                  setFormData({ ...formData, categoria_id: id, categoria: cat?.nombre || '' });
                }}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value={0}>Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Nombre del Material *</label>
            <input
              type="text"
              required
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Ej: Cemento Gris Tipo I"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Unidad de Medida *</label>
              <select
                required
                value={formData.unidad_medida_id}
                onChange={(e) => setFormData({ ...formData, unidad_medida_id: Number(e.target.value) })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value={0} disabled>Seleccione unidad</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.abreviatura})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Precio Ref. ($) <span className="text-[9px] text-slate-400 font-normal lowercase">(opcional)</span></label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej: 1500"
                value={formData.precio_referencial ?? ''}
                onChange={(e) => setFormData({ ...formData, precio_referencial: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Descripción</label>
            <textarea
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full h-24 resize-none rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              placeholder="Detalles adicionales del material..."
            />
          </div>

          {material && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Material Activo
              </label>
            </div>
          )}

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
              {isSubmitting ? 'Guardando...' : 'Guardar Material'}
            </button>
          </div>
        </form>
      </div>

      <CategoriaModal 
        isOpen={isCategoriaModalOpen}
        onClose={() => setIsCategoriaModalOpen(false)}
        onSave={() => {
          fetchCategorias();
        }}
        categoria={null}
      />
    </div>
  );
}
