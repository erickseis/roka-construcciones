import React from 'react';
import { 
  Construction, 
  CreditCard, 
  Package, 
  Calendar, 
  HardHat, 
  Map, 
  Landmark, 
  Settings, 
  LogOut 
} from 'lucide-react';
import { cn } from '@/src/lib/utils';

const navItems = [
  { icon: Construction, label: 'Proyectos', active: true },
  { icon: CreditCard, label: 'Presupuesto' },
  { icon: Package, label: 'Materiales y Bodega' },
  { icon: Calendar, label: 'Cronograma' },
  { icon: HardHat, label: 'Nómina' },
  { icon: Map, label: 'Planos' },
  { icon: Landmark, label: 'Finanzas' },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-y-auto bg-slate-100 border-r border-slate-200">
      <div className="px-6 py-8">
        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-900 text-amber-500">
            <Construction size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-slate-900 font-headline">
              Roka Construcciones
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Admin Console
            </p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors",
                item.active 
                  ? "bg-amber-500/10 text-amber-600 font-semibold border-r-4 border-amber-500" 
                  : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              )}
            >
              <item.icon size={20} className={item.active ? "text-amber-500" : ""} />
              <span className="text-sm">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-slate-200/50 px-6 py-6">
        <a href="#" className="mb-1 flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-200 transition-colors">
          <Settings size={20} />
          <span className="text-sm">Configuración</span>
        </a>
        <a href="#" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:bg-slate-200 transition-colors">
          <LogOut size={20} />
          <span className="text-sm">Cerrar sesión</span>
        </a>
      </div>
    </aside>
  );
}
