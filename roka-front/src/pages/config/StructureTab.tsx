import React, { useState } from 'react';
import { Plus, Building2, Briefcase } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getDepartamentos, getCargos, createDepartamento, createCargo } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';

export default function StructureTab() {
  const { data: departamentos, refetch: refetchDepts } = useApi(() => getDepartamentos(), []);
  const { data: cargos, refetch: refetchCargos } = useApi(() => getCargos(), []);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showCargoModal, setShowCargoModal] = useState(false);

  const [deptForm, setDeptForm] = useState({ nombre: '', descripcion: '' });
  const [cargoForm, setCargoForm] = useState({ nombre: '', departamento_id: '' });

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createDepartamento(deptForm);
      setShowDeptModal(false);
      setDeptForm({ nombre: '', descripcion: '' });
      refetchDepts();
    } catch { alert('Error al crear departamento'); }
  };

  const handleCreateCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCargo({ ...cargoForm, departamento_id: Number(cargoForm.departamento_id) });
      setShowCargoModal(false);
      setCargoForm({ nombre: '', departamento_id: '' });
      refetchCargos();
    } catch { alert('Error al crear cargo'); }
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
          <button onClick={() => setShowDeptModal(true)} className="p-1.5 rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors">
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {departamentos?.map((d: any) => (
            <div key={d.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <p className="font-bold text-slate-800">{d.nombre}</p>
              <p className="text-xs text-slate-500">{d.descripcion || 'Sin descripción'}</p>
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
          <button onClick={() => setShowCargoModal(true)} className="p-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors">
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-2">
          {cargos?.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div>
                <p className="font-bold text-slate-800">{c.nombre}</p>
                <p className="text-[10px] uppercase font-bold text-slate-400">{c.departamento_nombre}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={showDeptModal} onClose={() => setShowDeptModal(false)} title="Nuevo Departamento">
        <form onSubmit={handleCreateDept} className="space-y-4">
          <input required type="text" placeholder="Nombre" value={deptForm.nombre} onChange={e => setDeptForm({...deptForm, nombre: e.target.value})} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
          <textarea placeholder="Descripción" value={deptForm.descripcion} onChange={e => setDeptForm({...deptForm, descripcion: e.target.value})} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
          <button type="submit" className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-bold text-white">Crear</button>
        </form>
      </Modal>

      <Modal isOpen={showCargoModal} onClose={() => setShowCargoModal(false)} title="Nuevo Cargo">
        <form onSubmit={handleCreateCargo} className="space-y-4">
          <input required type="text" placeholder="Nombre del Cargo" value={cargoForm.nombre} onChange={e => setCargoForm({...cargoForm, nombre: e.target.value})} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
          <select required value={cargoForm.departamento_id} onChange={e => setCargoForm({...cargoForm, departamento_id: e.target.value})} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm">
            <option value="">Seleccionar Departamento...</option>
            {departamentos?.map((d: any) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          <button type="submit" className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white">Crear Cargo</button>
        </form>
      </Modal>
    </div>
  );
}
