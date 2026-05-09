import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Key, Save, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { updateUser } from '../../lib/api';
import { formatRUT, validateRUT } from '../../utils/rutValidator';
import Swal from 'sweetalert2';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    rut: '',
    correo: '',
    telefono: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (isOpen && user) {
      setForm({
        nombre: user.nombre || '',
        apellido: user.apellido || '',
        rut: formatRUT(user.rut || ''),
        correo: user.correo || '',
        telefono: user.telefono || '',
        password: '',
        confirmPassword: '',
      });
      setError(null);
    }
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateRUT(form.rut)) {
      setError('El RUT ingresado no es válido.');
      return;
    }

    if (form.password) {
      if (form.password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        nombre: form.nombre,
        apellido: form.apellido,
        rut: form.rut,
        correo: form.correo,
        telefono: form.telefono || null,
      };

      if (form.password) {
        payload.password = form.password;
      }

      await updateUser(user!.id, payload);
      
      await refreshUser(); // Update AuthContext state
      
      Swal.fire({
        title: 'Perfil actualizado',
        text: 'Tus datos han sido guardados correctamente.',
        icon: 'success',
        confirmButtonColor: '#f59e0b',
      });
      
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Mi Perfil"
      subtitle="Actualiza tu información personal y contraseña."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 border border-red-100 dark:bg-red-900/20 dark:border-red-900/40">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nombre</label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                required
                type="text"
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="Tu nombre"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Apellido</label>
            <input
              required
              type="text"
              value={form.apellido}
              onChange={e => setForm({ ...form, apellido: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              placeholder="Tu apellido"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">RUT</label>
          <input
            required
            type="text"
            value={form.rut}
            onChange={e => setForm({ ...form, rut: formatRUT(e.target.value) })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            placeholder="12.345.678-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Correo</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                required
                type="email"
                value={form.correo}
                onChange={e => setForm({ ...form, correo: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="email@ejemplo.com"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Teléfono</label>
            <div className="relative">
              <Phone size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="tel"
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="+56 9..."
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">Seguridad</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nueva Contraseña</label>
              <div className="relative">
                <Key size={14} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Confirmar</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                placeholder="••••••••"
              />
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-400 italic">Dejar en blanco si no deseas cambiar tu contraseña.</p>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-6 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-8 py-2.5 text-sm font-black text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-50 transition-all active:scale-95"
          >
            <Save size={18} />
            {loading ? 'Guardando...' : 'Actualizar Perfil'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
