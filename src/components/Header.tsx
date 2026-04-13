import React from 'react';
import { Search, Bell, HelpCircle } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-40 ml-64 flex w-[calc(100%-16rem)] items-center justify-between bg-slate-50/80 px-8 py-4 backdrop-blur-xl border-b border-slate-200/50">
      <div className="flex w-96 items-center rounded-lg bg-slate-100 px-4 py-2">
        <Search size={18} className="mr-2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar proyectos, órdenes o planos..."
          className="w-full bg-transparent text-sm text-slate-600 outline-none focus:ring-0"
        />
      </div>

      <div className="flex items-center gap-6">
        <div className="flex gap-4">
          <button className="relative rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100">
            <Bell size={20} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500"></span>
          </button>
          <button className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100">
            <HelpCircle size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900">Ing. Arq. Rodrigo K.</p>
            <p className="text-[10px] text-slate-500">Director de Obra</p>
          </div>
          <img
            src="https://picsum.photos/seed/engineer/100/100"
            alt="User avatar"
            className="h-10 w-10 rounded-full border-2 border-amber-500/20"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
}
