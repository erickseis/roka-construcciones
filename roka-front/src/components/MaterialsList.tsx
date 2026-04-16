import React from 'react';
import { Construction, Package, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

const materials = [
  {
    icon: Construction,
    name: 'Acero Corrugado',
    details: '12 Toneladas • OC-442',
    status: 'Aprobado',
    statusColor: 'bg-green-50 text-green-700 border-green-100 dot-green-500'
  },
  {
    icon: Package,
    name: 'Cemento Gris',
    details: '500 Sacos • OC-445',
    status: 'Cotizado',
    statusColor: 'bg-blue-50 text-blue-700 border-blue-100 dot-blue-500'
  },
  {
    icon: Layers,
    name: 'Gravilla',
    details: '40 m³ • OC-446',
    status: 'Pendiente',
    statusColor: 'bg-slate-100 text-slate-500 border-slate-200 dot-slate-400'
  }
];

export function MaterialsList() {
  return (
    <div className="space-y-4">
      {materials.map((item) => (
        <div 
          key={item.name}
          className="flex items-center justify-between rounded-lg bg-slate-50 p-3 transition-colors hover:bg-slate-100"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-white text-slate-400 shadow-sm">
              <item.icon size={20} className={item.status === 'Aprobado' ? 'text-amber-600' : ''} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
              <p className="text-[10px] font-medium uppercase text-slate-400">{item.details}</p>
            </div>
          </div>
          <span className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase",
            item.statusColor.split(' ').slice(0, 3).join(' ')
          )}>
            <span className={cn("h-1 w-1 rounded-full", item.statusColor.split(' ').pop()?.replace('dot-', 'bg-'))}></span>
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}
