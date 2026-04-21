import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Bell, HelpCircle, CheckCheck, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useApi } from '@/hooks/useApi';
import {
  getNotificaciones,
  getUnreadNotificacionesCount,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
} from '@/lib/api';

export function Header() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [openNotifications, setOpenNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const { data: unreadData, refetch: refetchUnread } = useApi(() => getUnreadNotificacionesCount(), []);
  const {
    data: notifications,
    loading: loadingNotifications,
    refetch: refetchNotifications,
  } = useApi(() => getNotificaciones({ limit: 8 }), []);

  const unreadCount = unreadData?.unread || 0;

  const fullName = user
    ? `${user.nombre} ${user.apellido}`.trim()
    : 'Usuario';

  const roleLabel = user?.cargo_nombre || user?.rol_nombre || 'Sin cargo asignado';

  const initials = user
    ? `${user.nombre?.charAt(0) || ''}${user.apellido?.charAt(0) || ''}`.toUpperCase()
    : 'U';

  const avatarSrc = user
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=334155&color=ffffff&bold=true`
    : null;

  useEffect(() => {
    const interval = setInterval(() => {
      refetchUnread();
      if (openNotifications) {
        refetchNotifications();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [openNotifications, refetchNotifications, refetchUnread]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!notificationsRef.current) return;
      if (!notificationsRef.current.contains(event.target as Node)) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const notificationRows = useMemo(() => notifications || [], [notifications]);

  const handleToggleNotifications = async () => {
    const next = !openNotifications;
    setOpenNotifications(next);
    if (next) {
      await refetchNotifications();
      await refetchUnread();
    }
  };

  const handleMarkAllRead = async () => {
    await marcarTodasNotificacionesLeidas();
    await refetchNotifications();
    await refetchUnread();
  };

  const handleMarkOneRead = async (id: number, isRead: boolean) => {
    if (isRead) return;
    await marcarNotificacionLeida(id, true);
    await refetchNotifications();
    await refetchUnread();
  };

  const getNotificationAccent = (type: string) => {
    if (type === 'cotizacion.aprobada') return 'text-emerald-600';
    if (type === 'cotizacion.rechazada') return 'text-red-600';
    if (type === 'orden.generada') return 'text-blue-600';
    if (type === 'presupuesto.sobreconsumo') return 'text-red-700';
    if (type === 'presupuesto.umbral') return 'text-amber-600';
    return 'text-slate-700';
  };

  return (
    <header className="sticky top-0 z-40 ml-64 flex w-[calc(100%-16rem)] items-center justify-between border-b border-slate-200/50 bg-slate-50/80 px-8 py-4 backdrop-blur-xl dark:border-[#1e293b] dark:bg-[#0b0e14]/90">
      <div className="flex-1" />

      <div className="flex items-center gap-6">
        <div className="flex gap-4">
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="relative" ref={notificationsRef}>
            <button
              onClick={handleToggleNotifications}
              className="relative rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[9px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {openNotifications && (
              <div className="absolute right-0 mt-2 w-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-50">Notificaciones</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-300">No leídas: {unreadCount}</p>
                  </div>
                  <button
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <CheckCheck size={14} /> Marcar todas
                  </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                  {loadingNotifications ? (
                    <div className="space-y-2 p-3">
                      {[...Array(3)].map((_, idx) => (
                        <div key={idx} className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                      ))}
                    </div>
                  ) : notificationRows.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-100">Sin notificaciones</p>
                      <p className="text-xs text-slate-400 dark:text-slate-300">Cuando ocurra una acción importante, aparecerá aquí.</p>
                    </div>
                  ) : (
                    notificationRows.map((n: any) => (
                      <button
                        key={n.id}
                        onClick={() => handleMarkOneRead(n.id, n.leida)}
                        className={`w-full border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${n.leida ? 'bg-white dark:bg-slate-900' : 'bg-amber-50/30 dark:bg-amber-900/20'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-bold ${getNotificationAccent(n.tipo)}`}>{n.titulo}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-100">{n.mensaje}</p>
                            <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-300">
                              <span>{n.enviado_por_nombre || 'Sistema'}</span>
                              <span>•</span>
                              <span>{new Date(n.created_at).toLocaleString('es-CL')}</span>
                            </div>
                          </div>
                          {!n.leida && <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <button className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800">
            <HelpCircle size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 border-l border-slate-200 pl-6 dark:border-slate-700">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-900 dark:text-slate-50">{fullName}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-200">{roleLabel}</p>
          </div>
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={`Avatar de ${fullName}`}
              className="h-10 w-10 rounded-full border-2 border-amber-500/20"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-500/20 bg-slate-700 text-xs font-bold text-white">
              {initials}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
