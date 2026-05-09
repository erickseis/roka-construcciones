import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { updateUserPassword } from '../../lib/api';
import { Key, AlertCircle, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: { id: number; nombre: string; apellido: string } | null;
}

export default function ChangePasswordModal({ isOpen, onClose, user }: Props) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      await updateUserPassword(user!.id, password);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); reset(); }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar contraseña');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => { setPassword(''); setConfirmPassword(''); setError(null); setSuccess(false); };

  return (
    <Modal isOpen={isOpen} onClose={() => { reset(); onClose(); }}
      title="Cambiar Contraseña"
      subtitle={user ? `${user.nombre} ${user.apellido}` : ''}
      size="sm">
      {success ? (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check size={28} />
          </div>
          <p className="text-sm font-bold text-emerald-700">Contraseña actualizada correctamente</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={14} /><span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nueva Contraseña</label>
            <input type="password" required minLength={6} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="•••••••• (min. 6 caracteres)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Repetir Contraseña</label>
            <input type="password" required minLength={6} value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-amber-400" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => { reset(); onClose(); }}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-60">
              <Key size={16} />
              {submitting ? 'Guardando...' : 'Cambiar Contraseña'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}