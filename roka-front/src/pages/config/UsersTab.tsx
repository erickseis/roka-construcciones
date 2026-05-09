import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, UserPlus, Trash2, Key, Pencil, ShieldAlert, BadgeCheck, Users } from 'lucide-react';
import { DataTable } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { useApi } from '../../hooks/useApi';
import { getUsers, createUser, updateUser, deleteUser, getDepartamentos, getCargos, getRoles } from '../../lib/api';
import { validateRUT, formatRUT } from '../../utils/rutValidator';
import ChangePasswordModal from '../../components/config/ChangePasswordModal';

export default function UsersTab() {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<{ id: number; nombre: string; apellido: string } | null>(null);

  const { data: usuarios, loading, refetch } = useApi(() => getUsers(), []);
  const { data: departamentos } = useApi(() => getDepartamentos(), []);
  const { data: cargos } = useApi(() => getCargos(), []);
  const { data: roles } = useApi(() => getRoles(), []);

  const [form, setForm] = useState({
    nombre: '', apellido: '', rut: '', correo: '', telefono: '',
    departamento_id: '', cargo_id: '', rol_id: '',
    password: '', confirmPassword: '',
  });

  const isEditing = !!editingUser;

  const openCreateForm = () => {
    setEditingUser(null);
    setForm({ nombre: '', apellido: '', rut: '', correo: '', telefono: '', departamento_id: '', cargo_id: '', rol_id: '', password: '', confirmPassword: '' });
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (user: any) => {
    setEditingUser(user);
    setForm({
      nombre: user.nombre || '',
      apellido: user.apellido || '',
      rut: formatRUT(user.rut || ''),
      correo: user.correo || '',
      telefono: user.telefono || '',
      departamento_id: user.departamento_id ? String(user.departamento_id) : '',
      cargo_id: user.cargo_id ? String(user.cargo_id) : '',
      rol_id: user.rol_id ? String(user.rol_id) : '',
      password: '',
      confirmPassword: '',
    });
    setError(null);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({
      nombre: '', apellido: '', rut: '', correo: '', telefono: '',
      departamento_id: '', cargo_id: '', rol_id: '',
      password: '', confirmPassword: '',
    });
  };

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, rut: formatRUT(e.target.value) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateRUT(form.rut)) {
      setError('El RUT ingresado no es válido.');
      return;
    }

    if (!isEditing) {
      if (form.password !== form.confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
      if (form.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
    } else if (form.password && form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    } else if (form.password !== form.confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        nombre: form.nombre, apellido: form.apellido, rut: form.rut,
        correo: form.correo, telefono: form.telefono || null,
        departamento_id: form.departamento_id ? Number(form.departamento_id) : null,
        cargo_id: form.cargo_id ? Number(form.cargo_id) : null,
        rol_id: form.rol_id ? Number(form.rol_id) : null,
      };
      if (form.password) payload.password = form.password;

      if (isEditing) {
        await updateUser(editingUser.id, payload);
      } else {
        await createUser(payload);
      }

      setShowForm(false);
      setEditingUser(null);
      resetForm();
      refetch();
    } catch (err: any) {
      setError(err.message || 'Error al guardar usuario');
    } finally {
      setSubmitting(false);
    }
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
      key: 'full_name', header: 'Nombre Completo', sortable: true,
      render: (row: any) => (
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 dark:text-slate-100">{row.nombre} {row.apellido}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{row.correo}</span>
        </div>
      ),
    },
    { key: 'rut', header: 'RUT', sortable: true },
    {
      key: 'rol_nombre', header: 'Rol', sortable: true,
      render: (row: any) => (
        <span className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          <ShieldAlert size={14} className="text-amber-500" />
          {row.rol_nombre || 'Sin Rol'}
        </span>
      ),
    },
    { key: 'departamento_nombre', header: 'Departamento' },
    { key: 'cargo_nombre', header: 'Cargo' },
    {
      key: 'is_active', header: 'Estado',
      render: (row: any) => (
        row.is_active
          ? <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-600"><BadgeCheck size={14} /> Activo</span>
          : <span className="text-[10px] font-bold uppercase text-slate-400">Inactivo</span>
      ),
    },
    {
      key: 'actions', header: '', className: 'w-28',
      render: (row: any) => (
        <div className="flex gap-1">
          <button onClick={() => openEditForm(row)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-colors dark:hover:bg-slate-800 dark:hover:text-blue-400" title="Editar usuario">
            <Pencil size={15} />
          </button>
          <button onClick={() => setPasswordTarget({ id: row.id, nombre: row.nombre, apellido: row.apellido })}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors dark:hover:bg-amber-900/20 dark:hover:text-amber-400" title="Cambiar contraseña">
            <Key size={15} />
          </button>
          <button onClick={() => handleDelete(row.id)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors dark:hover:bg-red-900/20 dark:hover:text-red-400" title="Desactivar usuario">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <Users size={20} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Recursos Humanos</span>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">Personal Registrado</h3>
        </div>
        
        <button onClick={openCreateForm}
          className="group flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <UserPlus size={18} className="transition-transform group-hover:rotate-12" />
          Registrar Usuario
        </button>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-[#111827]/40 dark:border-slate-800">
        <DataTable columns={columns} data={usuarios || []} loading={loading} searchable
          searchPlaceholder="Buscar por nombre, correo o RUT..."
          emptyTitle="Sin personal" emptyMessage="No se han registrado usuarios en el sistema todavía." />
      </div>

      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditingUser(null); }}
        title={isEditing ? 'Editar Usuario' : 'Registro de Nuevo Usuario'}
        subtitle={isEditing ? `Editando: ${editingUser.nombre} ${editingUser.apellido}` : 'Completa todos los campos para dar de alta al personal.'}
        size="xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 border border-red-100">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nombre</label>
              <input required type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="Juan" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Apellido</label>
              <input required type="text" value={form.apellido} onChange={e => setForm({...form, apellido: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="Pérez" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">RUT</label>
              <input required type="text" value={form.rut} onChange={handleRutChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="12.345.678-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Correo Electrónico</label>
              <input required type="email" value={form.correo} onChange={e => setForm({...form, correo: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="juan@roka.cl" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Teléfono</label>
              <input type="tel" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="+56 9 1234 5678" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Rol de Sistema</label>
              <select required value={form.rol_id} onChange={e => setForm({...form, rol_id: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
                <option value="">Seleccionar Rol...</option>
                {roles?.map((r: any) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Departamento</label>
              <select value={form.departamento_id} onChange={e => setForm({...form, departamento_id: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
                <option value="">Seleccionar...</option>
                {departamentos?.map((d: any) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Cargo</label>
              <select value={form.cargo_id} onChange={e => setForm({...form, cargo_id: e.target.value})}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
                <option value="">Seleccionar...</option>
                {cargos?.filter((c: any) => !form.departamento_id || c.departamento_id === Number(form.departamento_id))
                  .map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Contraseña {isEditing ? '(nueva, opcional)' : '*'}
              </label>
              <input type="password" value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
                required={!isEditing}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder={isEditing ? 'Dejar vacío para mantener actual' : '••••••••'} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Repetir Contraseña {isEditing ? '(si cambias)' : '*'}
              </label>
              <input type="password" value={form.confirmPassword}
                onChange={e => setForm({...form, confirmPassword: e.target.value})}
                required={!isEditing}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder={isEditing ? 'Dejar vacío para mantener actual' : '••••••••'} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <button type="button" onClick={() => { setShowForm(false); setEditingUser(null); }}
              className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
              Cerrar
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-2.5 text-sm font-black text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-60">
              {submitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Finalizar Registro'}
            </button>
          </div>
        </form>
      </Modal>

      <ChangePasswordModal
        isOpen={!!passwordTarget}
        onClose={() => setPasswordTarget(null)}
        user={passwordTarget}
      />
    </div>
  );
}