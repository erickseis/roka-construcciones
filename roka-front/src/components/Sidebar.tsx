import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  DollarSign,
  PackageCheck,
  Construction,
  CreditCard,
  Settings,
  LogOut,
  User,
  Package,
  Truck,
  X
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import logoRoka from '@/assets/image.png';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { ALL_MODULES } from '../lib/navigation';

const MODULE_ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, FileText, DollarSign, PackageCheck,
  Construction, CreditCard, Settings, Package, Truck,
};

const PRIMARY_PATHS = ['/', '/solicitudes', '/cotizaciones', '/ordenes'];
const PRIMARY_ICONS: Record<string, React.ElementType> = {
  '/': LayoutDashboard,
  '/solicitudes': FileText,
  '/cotizaciones': DollarSign,
  '/ordenes': PackageCheck,
};
const SECONDARY_ICONS: Record<string, React.ElementType> = {
  '/proyectos': Construction,
  '/presupuestos': CreditCard,
  '/materiales': Package,
  '/proveedores': Truck,
  '/config': Settings,
};

const navItems = ALL_MODULES.filter(m => PRIMARY_PATHS.includes(m.to)).map(m => ({
  ...m, icon: PRIMARY_ICONS[m.to] || LayoutDashboard,
}));

const secondaryItems = ALL_MODULES.filter(m => !PRIMARY_PATHS.includes(m.to)).map(m => ({
  ...m, icon: SECONDARY_ICONS[m.to] || Settings,
}));

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  onProfileClick: () => void;
}

export function Sidebar({ isOpen, onClose, onProfileClick }: SidebarProps) {
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-50 flex h-screen w-64 flex-col overflow-y-auto border-r border-slate-200 bg-slate-100 transition-transform duration-300 ease-in-out dark:border-slate-800/60 dark:bg-[#080a0f] lg:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="px-6 py-8 flex-1">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex w-10 items-center justify-center overflow-hidden rounded bg-slate-900 text-amber-500 dark:bg-slate-800">
              <img src={logoRoka} alt="Logo Roka" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="font-headline text-lg font-black leading-tight tracking-tight text-slate-900 dark:text-slate-50">
                Roka <br /> <span className="text-sm font-extrabold text-slate-500 dark:text-slate-200">Construcciones</span>
              </h1>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 lg:hidden dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Primary Nav — Procurement Modules */}
        {navItems.filter(item => hasPermission(item.permission)).length > 0 && (
          <>
            <p className="mb-2 px-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
              Módulos de Gestión
            </p>
            <nav className="mb-6 space-y-1">
              {navItems.filter(item => hasPermission(item.permission)).map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200",
                    isActive
                      ? "border border-slate-200 bg-white font-semibold text-amber-600 shadow-sm dark:border-[#1e293b] dark:bg-[#141b2d] dark:text-amber-500 dark:shadow-[0_4px_20px_rgba(245,158,11,0.05)]"
                      : "text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#141b2d]/50 dark:hover:text-slate-100"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={isActive ? "text-amber-500" : ""} />
                      <span className="text-sm">{item.label}</span>
                      {isActive && <motion.div layoutId="sidebar-active" className="ml-auto h-1.5 w-1.5 rounded-full bg-amber-500" />}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </>
        )}

        {/* Admin Nav */}
        {secondaryItems.filter(item => hasPermission(item.permission)).length > 0 && (
          <>
            <p className="mb-2 px-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-300">
              Administración
            </p>
            <nav className="space-y-1">
              {secondaryItems.filter(item => hasPermission(item.permission)).map((item) => (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200",
                    isActive
                      ? "border border-slate-200 bg-white font-semibold text-amber-600 shadow-sm dark:border-[#1e293b] dark:bg-[#141b2d] dark:text-amber-500 dark:shadow-[0_4px_20px_rgba(245,158,11,0.05)]"
                      : "text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#141b2d]/50 dark:hover:text-slate-100"
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={isActive ? "text-amber-500" : "text-slate-400 group-hover:text-slate-100"} />
                      <span className="text-sm">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-200/30 p-4 dark:border-[#1e293b] dark:bg-[#0b0e14]/40">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={onProfileClick}
            className="flex items-center gap-3 text-left overflow-hidden flex-1 group cursor-pointer"
          >
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 group-hover:bg-amber-200 transition-colors dark:bg-amber-500/10 dark:text-amber-500 dark:group-hover:bg-amber-500/20">
              <User size={20} />
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-black text-slate-900 group-hover:text-amber-600 transition-colors dark:text-slate-50 dark:group-hover:text-amber-500">{user?.nombre} {user?.apellido}</p>
              <p className="truncate text-[10px] font-bold uppercase tracking-tighter text-slate-400 dark:text-slate-300">{user?.rol_nombre || 'Usuario'}</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
            }}
            className="cursor-pointer ml-auto rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
            title="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
