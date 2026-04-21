import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Package,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Material, MaterialInput, UnidadMedida, MaterialCategoria } from '../../types';
import MaterialModal from './MaterialModal';
import CategoriaModal from './CategoriaModal';
import UnidadModal from './UnidadModal';
import { 
  getMaterialCategorias, 
  deleteMaterialCategoria, 
  deleteUnidadMedida,
  getMaterialesSolicitados,
  getProyectos
} from '../../lib/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function MaterialesPage() {
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [masterCategorias, setMasterCategorias] = useState<MaterialCategoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'materiales' | 'categorias' | 'unidades' | 'solicitados'>('materiales');
  const [materialesSolicitados, setMaterialesSolicitados] = useState<any[]>([]);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MaterialCategoria | null>(null);

  const [isUnidadModalOpen, setIsUnidadModalOpen] = useState(false);
  const [editingUnidad, setEditingUnidad] = useState<UnidadMedida | null>(null);

  const fetchMateriales = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/materiales`);
      if (!response.ok) throw new Error('Error al cargar materiales');
      const data = await response.json();
      setMateriales(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnidades = async () => {
    try {
      const response = await fetch(`${API_URL}/materiales/unidades`);
      if (!response.ok) throw new Error('Error al cargar unidades');
      const data = await response.json();
      setUnidades(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchCategorias = async () => {
    try {
      const data = await getMaterialCategorias();
      setMasterCategorias(data);
    } catch (error) {
      console.error(error);
    }
  };
  
  const fetchSolicitados = async () => {
    setIsLoading(true);
    try {
      const data = await getMaterialesSolicitados({ 
        q: searchTerm, 
        proyecto_id: selectedCategoryId && activeTab === 'solicitados' ? Number(selectedCategoryId) : undefined 
      });
      setMaterialesSolicitados(data);
    } catch (error) {
      console.error('Error al cargar materiales solicitados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProyectos = async () => {
    try {
      const data = await getProyectos();
      setProyectos(data);
    } catch (error) {
      console.error('Error al cargar proyectos:', error);
    }
  };

  useEffect(() => {
    fetchMateriales();
    fetchUnidades();
    fetchCategorias();
    fetchProyectos();
  }, []);

  useEffect(() => {
    if (activeTab === 'solicitados') {
      fetchSolicitados();
    }
  }, [activeTab, searchTerm, selectedCategoryId]);

  const handleSave = async (data: MaterialInput) => {
    const method = editingMaterial ? 'PUT' : 'POST';
    const url = editingMaterial
      ? `${API_URL}/materiales/${editingMaterial.id}`
      : `${API_URL}/materiales`;

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al guardar');
    }

    fetchMateriales();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Está seguro de que desea eliminar este material?')) return;

    try {
      const response = await fetch(`${API_URL}/materiales/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.error || 'Error al eliminar');
        return;
      }

      fetchMateriales();
    } catch (error) {
      console.error(error);
      alert('Error en el servidor al intentar eliminar');
    }
  };

  const filteredMateriales = materiales.filter(m => {
    const matchesSearch = m.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.sku && m.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategoryId === '' || m.categoria_id === Number(selectedCategoryId);
    return matchesSearch && matchesCategory;
  });

  const filteredCategorias = masterCategorias.filter(c => 
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.descripcion && c.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredUnidades = unidades.filter(u => 
    u.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.abreviatura.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('¿Está seguro de que desea eliminar esta categoría?')) return;
    try {
      await deleteMaterialCategoria(id);
      fetchCategorias();
    } catch (error: any) {
      alert(error.error || error.message || 'Error al eliminar categoría');
    }
  };

  const handleDeleteUnidad = async (id: number) => {
    if (!confirm('¿Está seguro de que desea eliminar esta unidad de medida?')) return;
    try {
      await deleteUnidadMedida(id);
      fetchUnidades();
    } catch (error: any) {
      alert(error.error || error.message || 'Error al eliminar unidad de medida');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-1">
            <span>Configuración</span>
            <ChevronRight size={14} />
            <span className="text-amber-600">Catálogo</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            Gestiona tus <span className="text-amber-500">Materiales</span>
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Gestiona el catálogo centralizado para mejorar la trazabilidad de tus compras.
          </p>
        </div>

        <div className="flex gap-2">
          {[
            { id: 'materiales', label: 'Materiales' },
            { id: 'categorias', label: 'Categorías' },
            { id: 'unidades', label: 'Unidades' },
            { id: 'solicitados', label: 'Solicitados' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-[0_4px_20px_rgba(245,158,11,0.4)] scale-105 z-10'
                  : 'bg-white/50 text-slate-500 hover:bg-white border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabGlow"
                  className="absolute -bottom-1 left-1/2 h-1 w-8 -translate-x-1/2 rounded-full bg-amber-400 blur-[2px]"
                />
              )}
            </button>
          ))}
          
          <button
            onClick={() => {
              if (activeTab === 'materiales') {
                setEditingMaterial(null);
                setIsModalOpen(true);
              } else if (activeTab === 'categorias') {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              } else if (activeTab === 'unidades') {
                setEditingUnidad(null);
                setIsUnidadModalOpen(true);
              }
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-black text-white shadow-xl transition-all hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-900"
          >
            <Plus size={18} />
            {activeTab === 'materiales' ? 'Registrar Material' : activeTab === 'categorias' ? 'Nueva Categoría' : activeTab === 'unidades' ? 'Nueva Unidad' : 'Registrar'}
          </button>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/20">
              <Package size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Materiales</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">{materiales.length}</h3>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/20">
              <Filter size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Categorías</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">{masterCategorias.length}</h3>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/20">
              <RefreshCw size={24} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Unidades de Medida</p>
              <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50">{unidades.length}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 p-4 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nombre o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-100 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-600 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
          >
            {activeTab === 'solicitados' ? (
              <>
                <option value="">Todos los Proyectos</option>
                {proyectos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </>
            ) : (
              <>
                <option value="">Todas las Categorías</option>
                {masterCategorias.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nombre}</option>
                ))}
              </>
            )}
          </select>
          <button
            onClick={fetchMateriales}
            className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Conditional Rendering based on Tab */}
      {activeTab === 'materiales' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">SKU / Código</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Material</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Categoría</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unidad</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Precio Ref.</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      <RefreshCw className="animate-spin text-amber-500 inline-block mb-2" size={32} />
                      <p>Cargando catálogo...</p>
                    </td>
                  </tr>
                ) : filteredMateriales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No se encontraron materiales.
                    </td>
                  </tr>
                ) : (
                  filteredMateriales.map((material) => (
                    <tr key={material.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-mono text-[10px] font-black">{material.sku || 'S/N'}</td>
                      <td className="px-6 py-4 font-bold">{material.nombre}</td>
                      <td className="px-6 py-4 text-slate-500 font-medium text-xs">{material.categoria_nombre || material.categoria || 'Sin categoría'}</td>
                      <td className="px-6 py-4 text-slate-500 text-xs font-bold">{material.unidad_abreviatura}</td>
                      <td className="px-6 py-4 text-right font-black">${Number(material.precio_referencial).toLocaleString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-black ${material.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {material.is_active ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setEditingMaterial(material); setIsModalOpen(true); }} className="hover:text-amber-600"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(material.id)} className="hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'categorias' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Descripción</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Creado el</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCategorias.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">{searchTerm ? 'No se encontraron categorías que coincidan con la búsqueda.' : 'No hay categorías registradas.'}</td></tr>
                ) : (
                  filteredCategorias.map((cat) => (
                    <tr key={cat.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-50">{cat.nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{cat.descripcion || '—'}</td>
                      <td className="px-6 py-4 text-xs text-slate-400">{new Date(cat.created_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setEditingCategory(cat); setIsCategoryModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-amber-600"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'unidades' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nombre</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Abreviatura</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUnidades.length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400">{searchTerm ? 'No se encontraron unidades que coincidan con la búsqueda.' : 'No hay unidades registradas.'}</td></tr>
                ) : (
                  filteredUnidades.map((u) => (
                    <tr key={u.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-50">{u.nombre}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-mono">{u.abreviatura}</td>
                      <td className="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setEditingUnidad(u); setIsUnidadModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-amber-600"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteUnidad(u.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-800/50 dark:bg-slate-900/40">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Material Solicitado</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Proyecto / Obra</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Solicitante</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Cantidad</th>
                  <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">Cargando requerimientos...</td></tr>
                ) : materialesSolicitados.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No se encontraron requerimientos de obra.</td></tr>
                ) : (
                  materialesSolicitados.map((item) => (
                    <tr key={item.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 dark:text-slate-50">{item.nombre_material}</div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">ID SOL: {String(item.solicitud_id).padStart(3, '0')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-black text-amber-600">{item.proyecto_nombre}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">{item.solicitante}</td>
                      <td className="px-6 py-4 text-right font-black">
                        {Number(item.cantidad_requerida).toLocaleString()} <span className="text-[10px] text-slate-400 lowercase font-normal">{item.unidad}</span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs text-slate-500">
                        {new Date(item.fecha).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <MaterialModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMaterial(null);
        }}
        onSave={handleSave}
        material={editingMaterial}
        unidades={unidades}
      />

      <CategoriaModal 
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        onSave={fetchCategorias}
        categoria={editingCategory}
      />

      <UnidadModal
        isOpen={isUnidadModalOpen}
        onClose={() => {
          setIsUnidadModalOpen(false);
          setEditingUnidad(null);
        }}
        onSave={fetchUnidades}
        unidad={editingUnidad}
      />
    </div>
  );
}
