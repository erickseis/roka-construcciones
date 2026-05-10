import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda chilena (CLP).
 * Formato: 1.000,00 — punto para miles, coma para decimales.
 * Siempre muestra 2 decimales.
 * 
 * @param value - El número a formatear
 * @param showCurrency - Si true, antepone "$" (default: true)
 * @returns String formateado, ej: "$1.000,00" o "1.000,00"
 */
export function formatCLP(value: number | null | undefined, showCurrency = true): string {
  if (value === null || value === undefined) return '-';
  const formatted = new Intl.NumberFormat('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return showCurrency ? `$${formatted}` : formatted;
}
