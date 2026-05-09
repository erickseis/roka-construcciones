import React from 'react';
import { CheckCircle, XCircle, Send, MailCheck, Truck } from 'lucide-react';

interface AuditTrailBadgeProps {
  label: string;
  nombre: string | null;
  fecha: string | null;
  icon?: 'aprobado' | 'rechazado' | 'enviado' | 'respondido' | 'entrega' | React.ReactNode;
}

// Mapeo de iconos
const getIcon = (iconType?: 'aprobado' | 'rechazado' | 'enviado' | 'respondido' | 'entrega' | React.ReactNode): React.ReactNode => {
  if (!iconType) return null;
  if (React.isValidElement(iconType)) return iconType;
  
  const iconMap = {
    aprobado: <CheckCircle size={12} className="text-emerald-500" />,
    rechazado: <XCircle size={12} className="text-red-500" />,
    enviado: <Send size={12} className="text-indigo-500" />,
    respondido: <MailCheck size={12} className="text-blue-500" />,
    entrega: <Truck size={12} className="text-amber-500" />,
  };
  
  return iconMap[iconType as keyof typeof iconMap] || null;
};

// Formato de fecha chilena: dd/MM/yyyy HH:mm
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

export default function AuditTrailBadge({ label, nombre, fecha, icon }: AuditTrailBadgeProps) {
  // Si no hay nombre, no renderizar nada (datos históricos sin audit)
  if (!nombre) return null;

  const formattedDate = formatDate(fecha);
  const iconComponent = getIcon(icon);

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      {iconComponent && <span className="flex-shrink-0">{iconComponent}</span>}
      <span className="font-medium">
        {label} {nombre}
      </span>
      {formattedDate && (
        <span className="text-slate-400">— {formattedDate}</span>
      )}
    </div>
  );
}