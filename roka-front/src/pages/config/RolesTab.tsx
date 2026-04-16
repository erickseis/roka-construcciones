import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getRoles } from '../../lib/api';

export default function RolesTab() {
  const { data: roles, loading } = useApi(() => getRoles(), []);

  if (loading) return <div className="h-20 animate-pulse rounded-xl bg-slate-100" />;

  return (
    <div className="space-y-4">
      <h4 className="flex items-center gap-2 text-lg font-bold text-slate-800">
        <ShieldCheck className="text-emerald-500" size={20} />
        Niveles de Acceso
      </h4>
      <div className="grid grid-cols-3 gap-4">
        {roles?.map((r: any) => (
          <div key={r.id} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-sm font-black uppercase tracking-tight text-slate-900">{r.nombre}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                <ShieldCheck size={16} />
              </div>
            </div>
            <p className="relative z-10 mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Permisos de Lectura/Escritura</p>
            <div className="absolute -bottom-6 -right-6 h-20 w-20 rounded-full bg-emerald-500/5 blur-2xl transition-all group-hover:bg-emerald-500/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
