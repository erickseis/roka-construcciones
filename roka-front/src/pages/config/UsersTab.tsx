import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, UserPlus, Trash2, Eye, ShieldAlert, BadgeCheck } from 'lucide-react';
import { DataTable } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { getUsers, createUser, deleteUser, getDepartamentos, getCargos, getRoles } from '../../lib/api';
import { validateRUT, formatRUT } from '../../utils/rutValidator';

export default function UsersTab() {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: usuarios, loading, refetch } = useApi(() => getUsers(), []);
  const { data: departamentos } = useApi(() => getDepartamentos(), []);
  const { data: cargos } = useApi(() => getCargos(), []);
  const { data: roles } = useApi(() => getRoles(), []);

  // Form state
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    rut: '',
    correo: '',
    telefono: '',
    departamento_id: '',
    cargo_id: '',
    rol_id: '',
    password: '',
    confirmPassword: '',
  });

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, rut: formatRUT(e.target.value) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones Frontend
    if (!validateRUT(form.rut)) {
      setError('El RUT ingresado no es válido.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      await createUser({
        ...form,
        departamento_id: form.departamento_id ? Number(form.departamento_id) : null,
        cargo_id: form.cargo_id ? Number(form.cargo_id) : null,
        rol_id: form.rol_id ? Number(form.rol_id) : null,
      });
      setShowForm(false);
      resetForm();
      refetch();
    } catch (err: any) {
      setError(err.message || 'Error al crear usuario');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      nombre: '',
      apellido: '',
      rut: '',
      correo: '',
      telefono: '',
      departamento_id: '',
      cargo_id: '',
      rol_id: '',
      password: '',
      confirmPassword: '',
    });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Seguro que deseas desactivar este usuario?')) return;
    try {
      await deleteUser(id);
      refetch();
    } catch {
      alert('Error al desactivar');
    }
  };

  const columns = [
    {
      key: 'full_name',
      header: 'Nombre Completo',
      sortable: true,
      render: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 dark:text-slate-100">{row.nombre} {row.apellido}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{row.correo}</span>
        </div>
      ),
    },
    { key: 'rut', header: 'RUT', sortable: true },
    { 
      key: 'rol_nombre', 
      header: 'Rol', 
      sortable: true,
      render: (row: any) => (
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <ShieldAlert size={14} className="text-amber-500" />
          {row.rol_nombre || 'Sin Rol'}
        </span>
      )
    },
    { key: 'departamento_nombre', header: 'Departamento' },
    { key: 'cargo_nombre', header: 'Cargo' },
    {
      key: 'is_active',
      header: 'Estado',
      render: (row: any) => (
        row.is_active 
          ? <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600"><BadgeCheck size={14} /> Activo</span>
          : <span className="text-[10px] font-bold uppercase text-slate-400">Inactivo</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (row: any) => (
        <div className="flex gap-2">
          <button onClick={() => {}} className="text-slate-400 hover:text-slate-600 transition-colors">
            <Eye size={16} />
          </button>
          <button onClick={() => handleDelete(row.id)} className="text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Personal Registrado</h3>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 active:scale-[0.98]"
        >
          <UserPlus size={18} />
          Registrar Usuario
        </button>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-[#111827]/40 dark:border-slate-800">
        <DataTable
          columns={columns}
          data={usuarios || []}
          loading={loading}
          searchable
          searchPlaceholder="Buscar por nombre, correo o RUT..."
          emptyTitle="Sin personal"
          emptyMessage="No se han registrado usuarios en el sistema todavía."
        />
      </div>

      {/* Register User Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Registro de Nuevo Usuario"
        subtitle="Completa todos los campos para dar de alta al personal en el sistema."
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nombre</label>
              <input
                required
                type="text"
                value={form.nombre}
                onChange={e => setForm({...form, nombre: e.target.value})}
                title="Nombre del usuario que se registrará en el sistema"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="Juan"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Apellido</label>
              <input
                required
                type="text"
                value={form.apellido}
                onChange={e => setForm({...form, apellido: e.target.value})}
                title="Apellido paterno del usuario"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="Pérez"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">RUT</label>
              <input
                required
                type="text"
                value={form.rut}
                onChange={handleRutChange}
                title="RUT del usuario en formato 12.345.678-9, identificador único nacional"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="12.345.678-9"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Correo Electrónico</label>
              <input
                required
                type="email"
                value={form.correo}
                onChange={e => setForm({...form, correo: e.target.value})}
                title="Correo electrónico corporativo del usuario, será utilizado para iniciar sesión"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="juan@roka.cl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Teléfono</label>
              <input
                type="tel"
                value={form.telefono}
                onChange={e => setForm({...form, telefono: e.target.value})}
                title="Número de teléfono de contacto del usuario"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="+56 9 1234 5678"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rol de Sistema</label>
              <select
                required
                value={form.rol_id}
                onChange={e => setForm({...form, rol_id: e.target.value})}
                title="Rol que determina los permisos y nivel de acceso del usuario en el sistema"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">Seleccionar Rol...</option>
                {roles?.map((r: any) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Departamento</label>
              <select
                value={form.departamento_id}
                onChange={e => setForm({...form, departamento_id: e.target.value})}
                title="Departamento de la organización al que pertenece el usuario"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">Seleccionar...</option>
                {departamentos?.map((d: any) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cargo</label>
              <select
                value={form.cargo_id}
                onChange={e => setForm({...form, cargo_id: e.target.value})}
                title="Cargo o puesto que ocupa el usuario dentro de la empresa"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">Seleccionar...</option>
                {cargos?.filter((c: any) => !form.departamento_id || c.departamento_id === Number(form.departamento_id))
                  .map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Contraseña</label>
              <input
                required
                type="password"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                title="Contraseña de acceso al sistema, debe tener al menos 6 caracteres"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Repetir Contraseña</label>
              <input
                required
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm({...form, confirmPassword: e.target.value})}
                title="Repetir la contraseña para confirmar que fue ingresada correctamente"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-2.5 text-sm font-black text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-60"
            >
              {submitting ? 'Registrando...' : 'Finalizar Registro'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
