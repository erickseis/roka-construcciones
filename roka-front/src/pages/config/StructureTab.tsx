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
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Building2 className="text-amber-500" size={20} />
            Departamentos
          </h4>
          <button onClick={openCreateDept} className="p-1.5 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors">
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {departamentos?.map((d: any) => (
            <div key={d.id} className="group rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-slate-200 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-800">{d.nombre}</p>
                  <p className="text-xs text-slate-500">{d.descripcion || 'Sin descripción'}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditDept(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteDept(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cargos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <Briefcase className="text-blue-500" size={20} />
            Cargos
          </h4>
          <button onClick={openCreateCargo} className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors">
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {cargos?.map((c: any) => (
            <div key={c.id} className="group rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-slate-200 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-800">{c.nombre}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400">{c.departamento_nombre}</p>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditCargo(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteCargo(c)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
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
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
          <textarea placeholder="Descripción" value={deptForm.descripcion}
            onChange={e => setDeptForm({...deptForm, descripcion: e.target.value})}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowDeptModal(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
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
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
          <select required value={cargoForm.departamento_id}
            onChange={e => setCargoForm({...cargoForm, departamento_id: e.target.value})}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm">
            <option value="">Seleccionar Departamento...</option>
            {departamentos?.map((d: any) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCargoModal(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
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
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm mt-1">
              <option value="">Seleccionar destino...</option>
              {migrationModal?.disponibles?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMigrationModal(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">Cancelar</button>
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