import React, { useState, useEffect } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, Save, Check, Plus, Pencil, Trash2, AlertTriangle, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useApi } from '../../hooks/useApi';
import { getRoles, createRole, updateRole, deleteRole, reactivateRole, getPermisosByRol, updatePermisosByRol } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';

const MODULE_GROUPS = [
  {
    label: 'Módulos de Gestión', permissions: [
      { code: 'dashboard.view', label: 'Dashboard' },
      { code: 'solicitudes.view', label: 'Solicitudes de Materiales' },
      { code: 'solicitudes.view_all', label: 'Ver todas las solicitudes hechas por otros usuarios' },
      { code: 'cotizaciones.view', label: 'Solicitudes de Cotización' },
      { code: 'ordenes.view', label: 'Órdenes de Compra' },
      { code: 'ordenes.create', label: 'Generar Órdenes de Compra' },
    ]
  },
  {
    label: 'Administración', permissions: [
      { code: 'proyectos.view', label: 'Proyectos' },
      { code: 'proyectos.manage', label: 'Crear y Editar Proyectos' },
      { code: 'presupuestos.view', label: 'Presupuestos' },
      { code: 'presupuestos.manage', label: 'Crear y Editar Presupuestos' },
      { code: 'materiales.view', label: 'Catálogo de Materiales' },
      { code: 'proveedores.view', label: 'Proveedores' },
      { code: 'config.manage', label: 'Configuración del Sistema' },
    ]
  },
  {
    label: 'Sistema', permissions: [
      { code: 'notificaciones.view', label: 'Notificaciones' },
    ]
  },
];

interface Role { id: number; nombre: string; descripcion?: string; is_active?: boolean; }

export default function RolesTab() {
  const [incluirInactivos, setIncluirInactivos] = useState(false);
  const { data: roles, loading: loadingRoles, refetch: refetchRoles } = useApi(() => getRoles({ incluir_inactivos: incluirInactivos }), [incluirInactivos]);

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [migrationModal, setMigrationModal] = useState<{
    item: any; usuarios_afectados: number; disponibles: any[];
  } | null>(null);
  const [migrarAId, setMigrarAId] = useState('');

  useEffect(() => {
    if (selectedRoleId) {
      setLoadingPermissions(true);
      getPermisosByRol(selectedRoleId)
        .then(setRolePermissions)
        .catch(() => setRolePermissions([]))
        .finally(() => setLoadingPermissions(false));
    } else {
      setRolePermissions([]);
    }
  }, [selectedRoleId]);

  const togglePermission = (code: string) => {
    setRolePermissions(prev => prev.includes(code) ? prev.filter(p => p !== code) : [...prev, code]);
  };

  const handleSave = async () => {
    if (!selectedRoleId) return;
    setSaving(true); setSaveSuccess(false);
    try {
      await updatePermisosByRol(selectedRoleId, rolePermissions);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch { alert('Error al guardar permisos'); }
    finally { setSaving(false); }
  };

  const openCreate = () => { setEditingRole(null); setRoleName(''); setShowForm(true); };
  const openEdit = (r: any) => { setEditingRole(r); setRoleName(r.nombre); setShowForm(true); };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingRole) await updateRole(editingRole.id, { nombre: roleName });
      else await createRole({ nombre: roleName });
      setShowForm(false);
      refetchRoles();
    } catch { alert('Error al guardar rol'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteRole = async (r: any) => {
    try {
      const res = await deleteRole(r.id);
      if (res.necesita_migracion) {
        setMigrarAId('');
        setMigrationModal({ item: r, ...res });
      } else {
        refetchRoles();
        if (selectedRoleId === r.id) setSelectedRoleId(null);
      }
    } catch { alert('Error al eliminar rol'); }
  };

  const handleConfirmMigration = async () => {
    if (!migrarAId) return;
    setSubmitting(true);
    try {
      await deleteRole(migrationModal!.item.id, Number(migrarAId));
      setMigrationModal(null);
      refetchRoles();
      if (selectedRoleId === migrationModal!.item.id) setSelectedRoleId(null);
    } catch { alert('Error al migrar y eliminar'); }
    finally { setSubmitting(false); }
  };

  const handleReactivate = async (id: number) => {
    try {
      await reactivateRole(id);
      refetchRoles();
    } catch { alert('Error al reactivar rol'); }
  };

  if (loadingRoles) return <div className="h-20 animate-pulse rounded-xl bg-slate-100" />;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <ShieldCheck size={20} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Configuración de Seguridad</span>
          </div>
          <h4 className="text-2xl font-black tracking-tight text-slate-800 dark:text-slate-100">
            Niveles de Acceso
          </h4>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIncluirInactivos(!incluirInactivos)}
            className={`
              flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-bold uppercase tracking-wider transition-all
              ${incluirInactivos
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'}
            `}
          >
            {incluirInactivos ? <Eye size={14} /> : <EyeOff size={14} />}
            {incluirInactivos ? 'Ocultar Inactivos' : 'Ver Inactivos'}
          </button>
          
          <button onClick={openCreate}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:scale-105 active:scale-95 transition-all">
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {roles?.map((role: Role) => {
          const isInactive = role.is_active === false;
          return (
            <div key={role.id}
              onClick={() => !isInactive && setSelectedRoleId(selectedRoleId === role.id ? null : role.id)}
              className={`
                group relative overflow-hidden rounded-2xl border p-5 transition-all duration-300
                ${isInactive ? 'opacity-50 border-slate-200 bg-slate-50 cursor-default dark:border-slate-800 dark:bg-slate-900/50' : 'cursor-pointer'}
                ${selectedRoleId === role.id && !isInactive
                  ? 'border-amber-400 ring-4 ring-amber-400/10 bg-amber-50/30 dark:border-amber-500/50 dark:bg-amber-500/5'
                  : 'border-slate-200 bg-white hover:border-amber-200 hover:shadow-xl hover:shadow-slate-200/50 dark:border-slate-800 dark:bg-[#111827]/40 dark:hover:border-slate-700 dark:hover:shadow-none'}
              `}>
              
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`
                    flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300
                    ${isInactive ? 'bg-slate-200 text-slate-400' : selectedRoleId === role.id ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400 group-hover:scale-110'}
                  `}>
                    <ShieldCheck size={20} />
                  </div>
                  
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                    {isInactive ? (
                      <button onClick={(e) => { e.stopPropagation(); handleReactivate(role.id); }}
                        className="rounded-lg p-1.5 bg-white shadow-sm border border-slate-100 text-emerald-500 hover:bg-emerald-50 dark:bg-slate-800 dark:border-slate-700 dark:text-emerald-400" title="Reactivar">
                        <RotateCcw size={14} />
                      </button>
                    ) : (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(role); }}
                          className="rounded-lg p-1.5 bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-blue-400"><Pencil size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }}
                          className="rounded-lg p-1.5 bg-white shadow-sm border border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-red-400"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className={`text-base font-bold tracking-tight ${isInactive ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {role.nombre}
                  </h5>
                  {isInactive ? (
                    <span className="mt-1 inline-block px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Desactivado</span>
                  ) : (
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                      {role.descripcion || 'Configuración de permisos y niveles de acceso al sistema.'}
                    </p>
                  )}
                </div>

                {!isInactive && (
                  <div className="flex items-center justify-between pt-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${selectedRoleId === role.id ? 'text-amber-600' : 'text-slate-400'}`}>
                      {selectedRoleId === role.id ? 'Cerrar Permisos' : 'Ver Permisos'}
                    </span>
                    <div className={`${selectedRoleId === role.id ? 'text-amber-500 rotate-180' : 'text-slate-300'} transition-transform duration-300`}>
                      <ChevronDown size={16} />
                    </div>
                  </div>
                )}
              </div>

              {/* Decoración de fondo */}
              <div className={`
                absolute -bottom-4 -right-4 h-24 w-24 rounded-full blur-3xl transition-all duration-500
                ${selectedRoleId === role.id ? 'bg-amber-500/20' : 'bg-emerald-500/5 group-hover:bg-emerald-500/10'}
              `} />
            </div>
          );
        })}
      </div>

      {selectedRoleId && !roles?.find((r: Role) => r.id === selectedRoleId)?.is_active === false && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 mt-4">
          {loadingPermissions ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <span className="ml-2 text-sm text-slate-500">Cargando permisos...</span>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h5 className="text-sm font-bold text-slate-700">
                  Permisos del rol: {roles?.find((r: Role) => r.id === selectedRoleId)?.nombre}
                </h5>
                <p className="text-xs text-slate-500 mt-1">
                  Los permisos .view controlan visibilidad en sidebar. Los permisos .manage/.create son capacidades adicionales.
                </p>
              </div>
              <div className="space-y-6">
                {MODULE_GROUPS.map(group => (
                  <div key={group.label}>
                    <h6 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{group.label}</h6>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                      {group.permissions.map(perm => (
                        <label key={perm.code} className="flex items-center gap-2 py-1.5 text-sm text-slate-700 cursor-pointer hover:text-slate-900">
                          <input type="checkbox" checked={rolePermissions.includes(perm.code)}
                            onChange={() => togglePermission(perm.code)}
                            className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 focus:ring-offset-0" />
                          <span>{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-4">
                <button onClick={handleSave} disabled={saving}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all ${saving ? 'bg-slate-400 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600'}`}>
                  {saving ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Guardando...</>
                    : saveSuccess ? <><Check size={18} /> Guardado</>
                      : <><Save size={18} /> Guardar Permisos</>}
                </button>
                {saveSuccess && <span className="text-sm text-emerald-600 font-medium">Permisos actualizados correctamente</span>}
              </div>
            </>
          )}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)}
        title={editingRole ? 'Editar Rol' : 'Nuevo Rol'}
        subtitle={editingRole ? `Editando: ${editingRole.nombre}` : ''}>
        <form onSubmit={handleSaveRole} className="space-y-4">
          <input required type="text" placeholder="Nombre del Rol" value={roleName}
            onChange={e => setRoleName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100" />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
            <button type="submit" disabled={submitting}
              className="rounded-lg bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
              {submitting ? 'Guardando...' : editingRole ? 'Guardar Cambios' : 'Crear Rol'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!migrationModal} onClose={() => setMigrationModal(null)}
        title="Desactivar Rol" subtitle="Hay usuarios vinculados. Debes migrarlos antes de desactivar.">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4 border border-amber-100">
            <AlertTriangle size={24} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">
                {migrationModal?.usuarios_afectados} usuario{migrationModal?.usuarios_afectados !== 1 ? 's' : ''} vinculado{migrationModal?.usuarios_afectados !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-700">
                Se encuentra{migrationModal?.usuarios_afectados !== 1 ? 'n' : ''} en <strong>{migrationModal?.item?.nombre}</strong>.
              </p>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Migrar usuarios a:</label>
            <select value={migrarAId} onChange={e => setMigrarAId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2.5 text-sm mt-1 outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100">
              <option value="">Seleccionar destino...</option>
              {migrationModal?.disponibles?.map((d: any) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setMigrationModal(null)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">Cancelar</button>
            <button disabled={!migrarAId || submitting} onClick={handleConfirmMigration}
              className="flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60">
              {submitting ? 'Procesando...' : 'Migrar y Desactivar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}