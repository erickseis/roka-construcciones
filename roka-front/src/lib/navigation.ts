export interface NavItem {
  label: string;
  to: string;
  permission: string;
}

export const ALL_MODULES: NavItem[] = [
  { label: 'Dashboard', to: '/', permission: 'dashboard.view' },
  { label: 'Solicitudes de Materiales', to: '/solicitudes', permission: 'solicitudes.view' },
  { label: 'Solicitudes de Cotización', to: '/cotizaciones', permission: 'cotizaciones.view' },
  { label: 'Órdenes de Compra', to: '/ordenes', permission: 'ordenes.view' },
  { label: 'Proyectos', to: '/proyectos', permission: 'proyectos.view' },
  { label: 'Presupuesto', to: '/presupuestos', permission: 'presupuestos.view' },
  { label: 'Catálogo de Materiales', to: '/materiales', permission: 'materiales.view' },
  { label: 'Proveedores', to: '/proveedores', permission: 'proveedores.view' },
  { label: 'Configuración', to: '/config', permission: 'config.manage' },
];

export function getFirstAvailableRoute(permissions: string[]): string {
  const item = ALL_MODULES.find(m => permissions.includes(m.permission));
  return item?.to || '/sin-acceso';
}
