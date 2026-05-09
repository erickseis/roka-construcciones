import React from 'react';
import { ShieldOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SinAccesoPage() {
  // const { logout } = useAuth();
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
      <ShieldOff size={48} className="text-slate-300" />
      <h1 className="text-xl font-bold text-slate-700 dark:text-slate-200">Sin módulos asignados</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Tu cuenta no tiene acceso a ningún módulo.<br />Contacta al administrador para que te asigne permisos.
      </p>
      {/* <button
        onClick={logout}
        className="mt-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-white hover:bg-amber-600 cursor-pointer"
      >
        Cerrar sesión
      </button> */}
    </div>
  );
}
