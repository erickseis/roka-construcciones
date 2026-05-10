import React, { useState } from 'react';
import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';

export interface FilterFieldOption {
  value: string;
  label: string;
}

export interface FilterField {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date' | 'number';
  options?: FilterFieldOption[];
  placeholder?: string;
}

interface FilterPanelProps {
  fields: FilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  activeCount: number;
  defaultOpen?: boolean;
}

export default function FilterPanel({
  fields,
  values,
  onChange,
  onReset,
  activeCount,
  defaultOpen = false,
}: FilterPanelProps) {
  const [open, setOpen] = useState(defaultOpen || activeCount > 0);

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
            Filtros
          </span>
          {activeCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {activeCount} activo{activeCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onReset(); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onReset(); } }}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 cursor-pointer"
            >
              <X size={12} /> Limpiar
            </span>
          )}
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4 dark:border-slate-700">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {fields.map(field => (
              <div key={field.key}>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={values[field.key] || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <option value="">{field.placeholder || 'Todos'}</option>
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={values[field.key] || ''}
                    onChange={(e) => onChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
