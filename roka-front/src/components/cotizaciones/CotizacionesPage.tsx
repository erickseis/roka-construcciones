import React, { useState } from 'react';
import { motion } from 'motion/react';
import SolicitudCotizacionTab from './SolicitudCotizacionTab';
import CotizacionVentaTab from './CotizacionVentaTab';

type Tab = 'solicitud' | 'venta';

const tabs: { key: Tab; label: string; desc: string; color: string }[] = [
  { key: 'solicitud', label: 'Solicitudes de Cotización', desc: 'Envío a proveedores para que coticen (sin precios)', color: 'bg-amber-500' },
  { key: 'venta', label: 'Cotizaciones de Venta', desc: 'Respuesta del proveedor con precios', color: 'bg-blue-600' },
];

export default function CotizacionesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('solicitud');

  return (
    <div>
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-600">Módulo 2</p>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">
          Cotizaciones
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Gestiona el envío de solicitudes a proveedores y registra sus respuestas con precios.
        </p>
      </motion.div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'solicitud' && <SolicitudCotizacionTab />}
      {activeTab === 'venta' && <CotizacionVentaTab />}
    </div>
  );
}
