import React, { useState } from 'react';
import { Plus, Building2, Briefcase, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getDepartamentos, getCargos, createDepartamento, updateDepartamento, deleteDepartamento, createCargo, updateCargo, deleteCargo } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';

export default function StructureTab() {
  const { data: departamentos, refetch: refetchDepts } = useApi(() => getDepartamentos(), []);
  const { data: cargos, refetch: refetchCargos } = useApi(() => getCargos(), []);

  // Edit/create state
  const [editingDept, setEditingDept] = useState<any | null>(null);
  const [editingCargo, setEditingCargo] = useState<any | null>(null);
  const [deptForm, setDeptForm] = useState({ nombre: '', descripcion: '' });
  const [cargoForm, setCargoForm] = useState({ nombre: '', departamento_id: '' });
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showCargoModal, setShowCargoModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Migration state
  const [migrationModal, setMigrationModal] = useState<{
    type: 'departamento' | 'cargo';
    item: any;
    usuarios_afectados: number;
    disponibles: any[];
  } | null>(null);
  const [migrarAId, setMigrarAId] = useState('');

  const openCreateDept = () => {
    setEditingDept(null);
    setDeptForm({ nombre: '', descripcion: '' });
    setShowDeptModal(true);
  };

  const openEditDept = (d: any) => {
    setEditingDept(d);
    setDeptForm({ nombre: d.nombre, descripcion: d.descripcion || '' });
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingDept) {
        await updateDepartamento(editingDept.id, deptForm);
      } else {
        await createDepartamento(deptForm);
      }
      setShowDeptModal(false);
      setEditingDept(null);
      refetchDepts();
    } catch { alert('Error al guardar departamento'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteDept = async (d: any) => {
    try {
      const res = await deleteDepartamento(d.id);
      if (res.necesita_migracion) {
        setMigrarAId('');
        setMigrationModal({ type: 'departamento', item: d, ...res });
      } else {
        refetchDepts();
      }
    } catch { alert('Error al eliminar departamento'); }
  };

  const openCreateCargo = () => {
    setEditingCargo(null);
    setCargoForm({ nombre: '', departamento_id: '' });
    setShowCargoModal(true);
  };

  const openEditCargo = (c: any) => {
    setEditingCargo(c);
    setCargoForm({ nombre: c.nombre, departamento_id: String(c.departamento_id) });
    setShowCargoModal(true);
  };

  const handleSaveCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...cargoForm, departamento_id: Number(cargoForm.departamento_id) };
      if (editingCargo) {
        await updateCargo(editingCargo.id, payload);
      } else {
        await createCargo(payload);
      }
      setShowCargoModal(false);
      setEditingCargo(null);
      refetchCargos();
    } catch { alert('Error al guardar cargo'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteCargo = async (c: any) => {
    try {
      const res = await deleteCargo(c.id);
      if (res.necesita_migracion) {
        setMigrarAId('');
        setMigrationModal({ type: 'cargo', item: c, ...res });
      } else {
        refetchCargos();
      }
    } catch { alert('Error al eliminar cargo'); }
  };

  const handleConfirmMigration = async () => {
    if (!migrarAId) return;
    setSubmitting(true);
    try {
      if (migrationModal!.type === 'departamento') {
        await deleteDepartamento(migrationModal!.item.id, Number(migrarAId));
        refetchDepts();
      } else {
        await deleteCargo(migrationModal!.item.id, Number(migrarAId));
        refetchCargos();
      }
      setMigrationModal(null);
    } catch { alert('Error al migrar y eliminar'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="grid grid-cols-2 gap-8">
      {/* Departamentos */}
      <div className="space-y-4">
        <div className="flex items-end justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-amber-500">
              <Building2 size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Organización</span>
            </div>
            <h4 className="text-xl font-black text-slate-800 dark:text-slate-100">Departamentos</h4>
          </div>
          <button onClick={openCreateDept} 
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all hover:scale-105 active:scale-95">
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {departamentos?.map((d: any) => (
            <div key={d.id} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-amber-200 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 dark:bg-[#111827]/40 dark:border-slate-800 dark:hover:border-slate-700">
              <div className="relative z-10 flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-bold text-slate-800 dark:text-slate-200">{d.nombre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{d.descripcion || 'Sin descripción adicional.'}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <button onClick={() => openEditDept(d)} className="rounded-lg p-1.5 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:text-blue-400"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteDept(d)} className="rounded-lg p-1.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:bg-slate-800 dark:text-slate-500 dark:hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 h-12 w-12 rounded-full bg-amber-500/5 blur-xl group-hover:bg-amber-500/10 transition-colors" />
            </div>
          ))}
        </div>
      </div>

      {/* Cargos */}
      <div className="space-y-4">
        <div className="flex items-end justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-blue-500">
              <Briefcase size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Estructura</span>
            </div>
            <h4 className="text-xl font-black text-slate-800 dark:text-slate-100">Cargos</h4>
          </div>
          <button onClick={openCreateCargo}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {cargos?.map((c: any) => (
            <div key={c.id} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 dark:bg-[#111827]/40 dark:border-slate-800 dark:hover:border-slate-700">
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">{c.nombre}</p>
                  <p className="text-[10px] uppercase font-black tracking-widest text-blue-500 dark:text-blue-400 mt-0.5">{c.departamento_nombre}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <button onClick={() => openEditCargo(c)} className="rounded-lg p-1.5 bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-500 dark:hover:text-blue-400"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteCargo(c)} className="rounded-lg p-1.5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:bg-slate-800 dark:text-slate-500 dark:hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="absolute -bottom-2 -right-2 h-12 w-12 rounded-full bg-blue-500/5 blur-xl group-hover:bg-blue-500/10 transition-colors" />
            </div>
          ))}
        </div>
      </div>

      {/* Dept Modal */}
      <Modal isOpen={showDeptModal} onClose={() => setShowDeptModal(false)}
        title={editingDept ? 'Editar Departamento' : 'Nuevo Departamento'}
        subtitle={editingDept ? `Editando: ${editingDept.nombre}` : ''}>
        <form onSubmit={handleSaveDept} className="space-y-4">
          <input required type="text" placeholder="Nombre" value={deptForm.nombre}
            onChange={e => setDeptForm({...deptForm, nombre: e.target.value})}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
          <textarea placeholder="Descripción" value={deptForm.descripcion}
            onChange={e => setDeptForm({...deptForm, descripcion: e.target.value})}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowDeptModal(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-amber-500 px-6 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-60">
              {submitting ? 'Guardando...' : editingDept ? 'Guardar Cambios' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cargo Modal */}
      <Modal isOpen={showCargoModal} onClose={() => setShowCargoModal(false)}
        title={editingCargo ? 'Editar Cargo' : 'Nuevo Cargo'}
        subtitle={editingCargo ? `Editando: ${editingCargo.nombre}` : ''}>
        <form onSubmit={handleSaveCargo} className="space-y-4">
          <input required type="text" placeholder="Nombre del Cargo" value={cargoForm.nombre}
            onChange={e => setCargoForm({...cargoForm, nombre: e.target.value})}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
          <select required value={cargoForm.departamento_id}
            onChange={e => setCargoForm({...cargoForm, departamento_id: e.target.value})}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
            <option value="">Seleccionar Departamento...</option>
            {departamentos?.map((d: any) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCargoModal(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              {submitting ? 'Guardando...' : editingCargo ? 'Guardar Cambios' : 'Crear Cargo'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Migration Modal */}
      <Modal isOpen={!!migrationModal} onClose={() => setMigrationModal(null)}
        title={`Eliminar ${migrationModal?.type === 'departamento' ? 'Departamento' : 'Cargo'}`}
        subtitle="Hay usuarios vinculados. Debes migrarlos antes de eliminar.">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
            <AlertTriangle size={24} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                {migrationModal?.usuarios_afectados} usuario{migrationModal?.usuarios_afectados !== 1 ? 's' : ''} vinculado{migrationModal?.usuarios_afectados !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-700">
                Se encuentra{migrationModal?.usuarios_afectados !== 1 ? 'n' : ''} en <strong>{migrationModal?.item?.nombre}</strong>.
                Selecciona a dónde migrarlos.
              </p>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Migrar a:
            </label>
            <select value={migrarAId} onChange={e => setMigrarAId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm mt-1 outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
              <option value="">Seleccionar destino...</option>
              {migrationModal?.disponibles?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMigrationModal(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
            <button type="button" disabled={!migrarAId || submitting} onClick={handleConfirmMigration}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60">
              {submitting ? 'Procesando...' : 'Migrar y Eliminar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}