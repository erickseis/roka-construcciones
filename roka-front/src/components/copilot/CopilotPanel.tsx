import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { usePermissions } from '../../context/PermissionsContext';
import {
  Compass,
  FolderKanban,
  Wallet,
  FileText,
  DollarSign,
  PackageCheck,
  Package,
  Ruler,
  ArrowRight,
  Check,
} from 'lucide-react';

interface CopilotPanelProps {
  onClose: () => void;
}

const STEPS = [
  {
    id: 'proyectos',
    path: '/proyectos',
    icon: FolderKanban,
    label: 'Proyecto',
    description: 'Crear proyecto de obra nuevo',
    detail: 'Define el nombre, ubicación, estado y responsable del proyecto.',
    permiso: 'proyectos.view',
  },
  {
    id: 'presupuestos',
    path: '/presupuestos',
    icon: Wallet,
    label: 'Presupuesto',
    description: 'Asignar presupuesto y categorías al proyecto',
    detail: 'Sin presupuesto activo no se pueden generar órdenes de compra.',
    permiso: 'presupuestos.view',
  },
  {
    id: 'solicitudes',
    path: '/solicitudes',
    icon: FileText,
    label: 'Solicitud de Materiales',
    description: 'Solicitar los materiales necesarios',
    detail: 'Lista los materiales con cantidad y unidad de medida requeridos.',
    permiso: 'solicitudes.view',
  },
  {
    id: 'solicitudes-cotizacion',
    path: '/cotizaciones',
    icon: DollarSign,
    label: 'Solicitud de Cotización',
    description: 'Gestionar solicitudes de cotización a proveedores',
    detail: 'Crea y envía solicitudes de cotización para obtener precios de proveedores.',
    permiso: 'cotizaciones.view',
  },
  {
    id: 'ordenes',
    path: '/ordenes',
    icon: PackageCheck,
    label: 'Orden de Compra',
    description: 'Generar OC que compromete el presupuesto',
    detail: 'Al generar la OC se valida disponibilidad presupuestaria y se compromete el monto.',
    permiso: 'ordenes.view',
  },
];

const CATALOG_STEPS = [
  {
    id: 'materiales',
    path: '/materiales',
    icon: Package,
    label: 'Materiales',
    description: 'Gestionar catálogo de materiales y unidades de medida',
    detail: 'Crea y administra los materiales disponibles y sus unidades.',
    permiso: 'materiales.view',
  },
];

function getStepStatus(currentPath: string, stepPath: string, stepIndex: number, visibleSteps: typeof STEPS, visibleCatalog: typeof CATALOG_STEPS): 'completed' | 'active' | 'pending' {
  const exactMatch = currentPath === stepPath;
  const startsWith = currentPath.startsWith(stepPath + '/') || currentPath.startsWith(stepPath);

  if (exactMatch || (stepPath === '/' && currentPath === '/')) return 'active';

  const currentIndex = visibleSteps.findIndex(s => {
    const match = currentPath === s.path || currentPath.startsWith(s.path + '/');
    return match;
  });

  if (currentIndex === -1) {
    if (visibleCatalog.some(s => currentPath === s.path || currentPath.startsWith(s.path + '/'))) {
      return 'pending';
    }
    return 'pending';
  }

  if (currentIndex > stepIndex) return 'completed';
  if (currentIndex === stepIndex) return 'active';
  return 'pending';
}

export function CopilotPanel({ onClose }: CopilotPanelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { hasPermission } = usePermissions();

  const visibleSteps = STEPS.filter(s => hasPermission(s.permiso));
  const visibleCatalog = CATALOG_STEPS.filter(s => hasPermission(s.permiso));

  return (
    <motion.div
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed bottom-6 right-6 z-50 flex w-[380px] max-h-[calc(100vh-120px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700/60 dark:bg-slate-900 dark:shadow-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 shadow-md shadow-amber-500/30">
            <Compass size={16} className="text-white" />
          </div>
          <div>
            <h3 className="font-headline text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              Guía de Flujo
            </h3>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              Registro de datos paso a paso
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          title="Minimizar guía"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="space-y-0">
          {visibleSteps.map((step, index) => {
            const status = getStepStatus(currentPath, step.path, index, visibleSteps, visibleCatalog);
            const Icon = step.icon;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06, duration: 0.3 }}
              >
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => navigate(step.path)}
                      className={`relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 transition-all duration-200 ${
                        status === 'active'
                          ? 'border-amber-500 bg-amber-500 shadow-md shadow-amber-500/30 scale-110'
                          : status === 'completed'
                          ? 'border-emerald-500 bg-emerald-500 shadow-sm shadow-emerald-500/20'
                          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                      }`}
                      title={`Ir a ${step.label}`}
                    >
                      {status === 'completed' ? (
                        <Check size={14} className="text-white" strokeWidth={3} />
                      ) : status === 'active' ? (
                        <Icon size={16} className="text-white" />
                      ) : (
                        <Icon size={16} className="text-slate-400 dark:text-slate-500" />
                      )}
                      {status === 'active' && (
                        <motion.div
                          className="absolute inset-0 rounded-xl border-2 border-amber-500"
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                          style={{ opacity: 0.4 }}
                        />
                      )}
                    </button>
                    {index < visibleSteps.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 min-h-[20px] my-1 transition-colors duration-300 ${
                          status === 'completed'
                            ? 'bg-emerald-400'
                            : status === 'active'
                            ? 'bg-gradient-to-b from-amber-400 to-slate-200 dark:to-slate-700'
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    )}
                  </div>

                  <div className={`pb-5 flex-1 ${index === visibleSteps.length - 1 ? 'pb-0' : ''}`}>
                    <button
                      onClick={() => navigate(step.path)}
                      className={`text-left w-full group ${
                        status === 'active' ? 'cursor-pointer' : 'cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase tracking-widest ${
                            status === 'active'
                              ? 'text-amber-600 dark:text-amber-400'
                              : status === 'completed'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          Paso {index + 1}
                        </span>
                        {status === 'active' && (
                          <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        )}
                      </div>
                      <p
                        className={`mt-0.5 font-headline text-sm font-bold leading-tight ${
                          status === 'active'
                            ? 'text-slate-900 dark:text-slate-50'
                            : status === 'completed'
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`mt-0.5 text-xs leading-snug ${
                          status === 'active'
                            ? 'text-slate-600 dark:text-slate-400'
                            : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {step.description}
                      </p>
                      {status === 'active' && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-1.5 text-[11px] leading-snug text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-lg px-2.5 py-1.5 border border-amber-200/60 dark:border-amber-800/40"
                        >
                          {step.detail}
                        </motion.p>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Catalogo transversal
          </p>
          <div className="space-y-2">
            {visibleCatalog.map((step) => {
              const isActive = currentPath === step.path || currentPath.startsWith(step.path + '/');
              const Icon = step.icon;

              return (
                <motion.button
                  key={step.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  onClick={() => navigate(step.path)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                    isActive
                      ? 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/30 shadow-sm'
                      : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50 hover:border-slate-300 hover:bg-white dark:hover:border-slate-600'
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                      isActive
                        ? 'bg-amber-500 shadow-sm shadow-amber-500/30'
                        : 'bg-slate-200 dark:bg-slate-700'
                    }`}
                  >
                    <Icon size={15} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-headline text-sm font-bold ${
                        isActive
                          ? 'text-slate-900 dark:text-slate-50'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug truncate">
                      {step.description}
                    </p>
                  </div>
                  <ArrowRight
                    size={14}
                    className={`flex-shrink-0 ${
                      isActive ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-800">
        <p className="text-center text-[10px] font-medium text-slate-400 dark:text-slate-500">
          Este flujo garantiza control presupuestario en cada compra
        </p>
      </div>
    </motion.div>
  );
}