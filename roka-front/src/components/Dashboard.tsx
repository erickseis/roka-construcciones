import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BudgetChart } from './BudgetChart';
import { MaterialsList } from './MaterialsList';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#f7fafc]">
      <Sidebar />
      <Header />

      <main className="ml-64 p-10">
        <div className="mx-auto max-w-7xl">
          {/* Dashboard Header */}
          <div className="mb-10">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-600">
              Resumen Ejecutivo
            </p>
            <h2 className="font-headline text-4xl font-extrabold leading-none tracking-tight text-slate-900 mb-4">
              Consola de Control
            </h2>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500"></span>
              <span className="text-[10px] font-medium uppercase tracking-tighter text-slate-500">
                Conectado a Red Local de Obra • Actualizado ahora
              </span>
            </div>
          </div>

          {/* Bento Grid */}
          <div className="relative grid grid-cols-12 gap-6">
            {/* Estado de Proyecto */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-12 flex flex-col justify-between rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:shadow-md lg:col-span-4"
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold leading-tight text-slate-900">Estado de Proyecto</h3>
                  <p className="text-xs text-slate-500">Torre Miramar - Etapa C</p>
                </div>
                <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  En Curso
                </span>
              </div>

              <div className="relative flex items-center justify-center py-4">
                <svg className="h-32 w-32 -rotate-90 transform">
                  <circle className="text-slate-100" cx="64" cy="64" fill="transparent" r="58" stroke="currentColor" strokeWidth="8"></circle>
                  <circle
                    className="text-amber-500"
                    cx="64" cy="64" fill="transparent" r="58" stroke="currentColor"
                    strokeWidth="8"
                    strokeDasharray="364.4"
                    strokeDashoffset="127.5"
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-slate-900">65%</span>
                  <span className="text-[10px] font-bold uppercase text-slate-400">Avance</span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Próximo Hito:</span>
                  <span className="font-bold text-slate-900">Vaciado de Losa 4</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full w-[65%] bg-amber-500"></div>
                </div>
              </div>
            </motion.div>

            {/* Control Presupuestario */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="col-span-12 rounded-xl bg-white p-6 shadow-sm lg:col-span-8"
            >
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Control Presupuestario</h3>
                  <p className="text-xs text-slate-500">Presupuesto vs. Gasto Real (Acumulado)</p>
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-slate-300"></span>
                    <span className="text-slate-500">Presupuesto</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm bg-amber-500"></span>
                    <span className="text-slate-900">Gasto Real</span>
                  </div>
                </div>
              </div>
              <BudgetChart />
            </motion.div>

            {/* Solicitud de Materiales */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-12 rounded-xl bg-white p-6 shadow-sm lg:col-span-5"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Solicitud de Materiales</h3>
                <button className="text-[10px] font-bold uppercase tracking-wider text-amber-600 hover:underline">
                  Ver Todo
                </button>
              </div>
              <MaterialsList />
            </motion.div>

            {/* Flujo de Pagos */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="col-span-12 flex flex-col rounded-xl bg-white p-6 shadow-sm lg:col-span-7"
            >
              <h3 className="mb-8 text-lg font-bold text-slate-900">Flujo de Pagos</h3>
              <div className="grid flex-grow grid-cols-2 gap-8">
                {/* Facturas Pendientes */}
                <div className="relative flex flex-col justify-between overflow-hidden rounded-lg bg-slate-900 p-5 text-white">
                  <div className="relative z-10">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      Facturas Pendientes
                    </p>
                    <h4 className="text-3xl font-black tracking-tight">$42,850.00</h4>
                  </div>
                  <div className="relative z-10 mt-4 flex items-center gap-2 text-[10px] font-bold text-red-400">
                    <AlertTriangle size={14} />
                    5 Vencidas esta semana
                  </div>
                  <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl"></div>
                </div>

                {/* Ingresos del Mes */}
                <div className="relative flex flex-col justify-between overflow-hidden rounded-lg bg-amber-500 p-5 text-white">
                  <div className="relative z-10">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-100">
                      Ingresos del Mes
                    </p>
                    <h4 className="text-3xl font-black tracking-tight">$128,400.00</h4>
                  </div>
                  <div className="relative z-10 mt-4 flex items-center gap-2 text-[10px] font-bold uppercase text-amber-900/70">
                    <TrendingUp size={14} />
                    +12% vs. mes anterior
                  </div>
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/20 blur-2xl"></div>
                </div>
              </div>

              <div className="mt-8 flex items-center gap-4 border-t border-slate-100 pt-6">
                <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(242,169,0,0.6)]"></div>
                <p className="text-[11px] font-medium italic text-slate-500">
                  Los ingresos del mes están directamente vinculados al 65% de avance registrado en Miramar Etapa C.
                </p>
              </div>
            </motion.div>

            {/* Footer Info */}
            <div className="col-span-12 mt-4 flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm bg-amber-600"></span>
                <span className="text-[10px] font-bold uppercase text-slate-500">
                  Sincronizado con Stitch ID: 4421-RC
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400">
                © 2024 Roka Construcciones S.A.S. • Todos los derechos reservados
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
