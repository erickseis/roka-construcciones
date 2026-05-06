import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  // Solicitudes
  'Pendiente':         { bg: 'bg-amber-50 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500' },
  'Cotizando':         { bg: 'bg-blue-50 dark:bg-blue-900/40',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  'Aprobado':          { bg: 'bg-emerald-50 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  // Cotizaciones
  'Aprobada':          { bg: 'bg-emerald-50 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Rechazada':         { bg: 'bg-red-50 dark:bg-red-900/40',    text: 'text-red-700 dark:text-red-400',    dot: 'bg-red-500' },
  // Órdenes
  'Recibido parcial':  { bg: 'bg-sky-50 dark:bg-sky-900/40',    text: 'text-sky-700 dark:text-sky-400',    dot: 'bg-sky-500' },
  'Completado':        { bg: 'bg-emerald-50 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  // Proyectos
  'En Curso':          { bg: 'bg-amber-50 dark:bg-amber-900/40',  text: 'text-amber-700 dark:text-amber-400',  dot: 'bg-amber-500' },
  'Planificación':     { bg: 'bg-violet-50 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  // Materiales (Catalogo)
  'Activo':            { bg: 'bg-emerald-50 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Inactivo':          { bg: 'bg-slate-50 dark:bg-slate-800/60', text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
  // Solicitudes de Cotización
  'ENVIADA':           { bg: 'bg-blue-50 dark:bg-blue-900/40',   text: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-500' },
  'RESPONDIDA':        { bg: 'bg-emerald-50 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider',
      config.bg, config.text, 'border-transparent',
      size === 'sm' ? 'px-2.5 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {status}
    </span>
  );
}
