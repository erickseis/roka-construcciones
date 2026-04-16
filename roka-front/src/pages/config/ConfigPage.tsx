import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Building2, ShieldCheck, Settings } from 'lucide-react';
import UsersTab from './UsersTab';
import StructureTab from './StructureTab';
import RolesTab from './RolesTab';

type Tab = 'usuarios' | 'estructura' | 'roles';

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');

  const tabs = [
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: Users },
    { id: 'estructura', label: 'Departamentos y Cargos', icon: Building2 },
    { id: 'roles', label: 'Roles y Permisos', icon: ShieldCheck },
  ];

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Configuración</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              Administración del Sistema
              <Settings className="text-slate-300" size={24} />
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Administra el personal, la estructura organizacional y los niveles de acceso.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Navigation Tabs */}
      <div className="mb-8 flex gap-1 rounded-2xl bg-slate-200/50 p-1.5 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`
              relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all duration-300
              ${activeTab === tab.id ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}
            `}
          >
            <tab.icon size={18} />
            {tab.label}
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
