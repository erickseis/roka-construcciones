import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Building2, ShieldCheck, Settings, Mail, Bell, Gauge, Save } from 'lucide-react';
import UsersTab from './UsersTab';
import StructureTab from './StructureTab';
import RolesTab from './RolesTab';
import EmailNotificationsTab from './EmailNotificationsTab';
import EmailAlertasTab from './EmailAlertasTab';
import { getTriageConfig, updateTriageConfig } from '@/lib/api';

type Tab = 'usuarios' | 'estructura' | 'roles' | 'email' | 'alertas' | 'triage';

function TriageConfigTab() {
  const [config, setConfig] = useState<Record<string, number>>({ critico_dias: 2, atrasado_dias: 5 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTriageConfig()
      .then(data => {
        const cfg: Record<string, number> = {};
        data?.forEach((c: any) => { cfg[c.codigo] = c.valor; });
        setConfig({ critico_dias: cfg.critico_dias ?? 2, atrasado_dias: cfg.atrasado_dias ?? 5 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTriageConfig('critico_dias', config.critico_dias);
      await updateTriageConfig('atrasado_dias', config.atrasado_dias);
      alert('Configuración guardada correctamente');
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-slate-400">Cargando configuración...</p>;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <p className="mb-1 text-xs font-bold uppercase text-slate-500">Crítico (días)</p>
        <p className="mb-2 text-xs text-slate-400">Solicitudes con días restantes ≤ este valor se marcan como Crítica</p>
        <input
          type="number" min={1}
          value={config.critico_dias}
          onChange={e => setConfig(p => ({ ...p, critico_dias: Number(e.target.value) }))}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>
      <div>
        <p className="mb-1 text-xs font-bold uppercase text-slate-500">Atrasado (días)</p>
        <p className="mb-2 text-xs text-slate-400">Solicitudes con días entre crítico y este valor se marcan como Atrasada</p>
        <input
          type="number" min={1}
          value={config.atrasado_dias}
          onChange={e => setConfig(p => ({ ...p, atrasado_dias: Number(e.target.value) }))}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:border-slate-700 dark:bg-slate-900"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-60"
      >
        <Save size={16} />
        {saving ? 'Guardando...' : 'Guardar Configuración'}
      </button>
    </div>
  );
}

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');

  const tabs = [
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: Users },
    { id: 'estructura', label: 'Departamentos y Cargos', icon: Building2 },
    { id: 'roles', label: 'Roles y Permisos', icon: ShieldCheck },
    { id: 'email', label: 'Notificaciones Email', icon: Mail },
    { id: 'alertas', label: 'Alertas de Entrega', icon: Bell },
    { id: 'triage', label: 'Configuración Triage', icon: Gauge },
  ];

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Configuración</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
              Administración del Sistema
              <Settings className="text-slate-300 dark:text-slate-600" size={24} />
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Administra el personal, la estructura organizacional y los niveles de acceso.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs */}
      <div className="mb-10 flex gap-2 rounded-2xl bg-slate-100 p-1.5 w-fit dark:bg-slate-800/50">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`
              relative flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all duration-300
              ${activeTab === tab.id 
                ? 'text-amber-600 dark:text-amber-500' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}
             cursor-pointer`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-xl bg-white shadow-md shadow-slate-200/50 dark:bg-slate-700 dark:shadow-none"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <tab.icon size={18} />
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'usuarios' && <UsersTab />}
          {activeTab === 'estructura' && <StructureTab />}
          {activeTab === 'roles' && <RolesTab />}
          {activeTab === 'email' && <EmailNotificationsTab />}
          {activeTab === 'alertas' && <EmailAlertasTab />}
          {activeTab === 'triage' && <TriageConfigTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
