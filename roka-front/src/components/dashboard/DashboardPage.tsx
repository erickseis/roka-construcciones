import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, AlertTriangle, Clock, DollarSign, FileText, PackageCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useApi } from '@/hooks/useApi';
import { getDashboardResumen } from '@/lib/api';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];

export default function DashboardPage() {
  const { data: stats, loading } = useApi(() => getDashboardResumen(), []);

  const solicitudesPie = stats ? [
    { name: 'Pendientes', value: stats.solicitudes_mensual.pendientes },
    { name: 'Atendidas', value: stats.solicitudes_mensual.atendidas },
  ] : [];

  const gastoBarData = stats?.gasto_por_proyecto?.map((item: any) => ({
    name: item.proyecto.length > 20 ? item.proyecto.substring(0, 20) + '...' : item.proyecto,
    gasto: Number(item.gasto_total),
    ordenes: item.total_ordenes,
  })) || [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <div className="h-72 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-72 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-600">Resumen Ejecutivo</p>
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">
          Dashboard de Estadísticas
        </h2>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-[10px] font-medium uppercase tracking-tighter text-slate-500">
            Datos en tiempo real • Actualizado ahora
          </span>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        {[
          {
            label: 'Solicitudes Pendientes',
            value: stats?.solicitudes_mensual?.pendientes ?? 0,
            icon: <FileText size={20} />,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            iconBg: 'bg-amber-100',
          },
          {
            label: 'Solicitudes Atendidas',
            value: stats?.solicitudes_mensual?.atendidas ?? 0,
            icon: <TrendingUp size={20} />,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            iconBg: 'bg-emerald-100',
          },
          {
            label: 'Promedio Conversión',
            value: `${stats?.tiempo_conversion?.promedio_dias ?? 0} días`,
            icon: <Clock size={20} />,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            iconBg: 'bg-blue-100',
            subtitle: `Min: ${stats?.tiempo_conversion?.min_dias ?? 0}d — Max: ${stats?.tiempo_conversion?.max_dias ?? 0}d`,
          },
          {
            label: 'Gasto Total en OCs',
            value: `$${(stats?.gasto_por_proyecto?.reduce((s: number, p: any) => s + Number(p.gasto_total), 0) || 0).toLocaleString('es-ES')}`,
            icon: <DollarSign size={20} />,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            iconBg: 'bg-violet-100',
          },
        ].map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{kpi.label}</p>
                <p className={`mt-1 text-2xl font-black ${kpi.color}`}>{kpi.value}</p>
                {kpi.subtitle && <p className="mt-0.5 text-[10px] text-slate-400">{kpi.subtitle}</p>}
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.iconBg} ${kpi.color}`}>
                {kpi.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6 mb-8">
        {/* Solicitudes Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="col-span-5 rounded-xl bg-white p-6 shadow-sm border border-slate-100"
        >
          <h3 className="mb-1 text-lg font-bold text-slate-900">Solicitudes del Mes</h3>
          <p className="mb-6 text-xs text-slate-400">Pendientes vs. Atendidas</p>

          <div className="flex items-center justify-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie
                    data={solicitudesPie}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {solicitudesPie.map((_, index) => (
                      <Cell key={index} fill={COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900">
                  {stats?.solicitudes_mensual?.total ?? 0}
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400">Total</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-amber-500" />
              <span className="text-[10px] font-bold uppercase text-slate-500">Pendientes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-blue-500" />
              <span className="text-[10px] font-bold uppercase text-slate-500">Atendidas</span>
            </div>
          </div>
        </motion.div>

        {/* Gasto por Proyecto Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="col-span-7 rounded-xl bg-white p-6 shadow-sm border border-slate-100"
        >
          <h3 className="mb-1 text-lg font-bold text-slate-900">Gasto por Proyecto</h3>
          <p className="mb-6 text-xs text-slate-400">Total aprobado en Órdenes de Compra</p>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gastoBarData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  formatter={(value: number) => [`$${value.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, 'Gasto']}
                />
                <Bar dataKey="gasto" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Conversion Time Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">Tiempo de Conversión</h3>
            <p className="text-xs text-slate-400">Desde solicitud de material hasta orden de compra</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20">
            <Clock size={24} className="text-amber-400" />
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-6">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mínimo</p>
            <p className="mt-1 text-3xl font-black text-blue-400">
              {stats?.tiempo_conversion?.min_dias ?? 0}
              <span className="text-sm font-medium text-slate-500"> días</span>
            </p>
          </div>
          <div className="text-center border-x border-slate-700">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Promedio</p>
            <p className="mt-1 text-3xl font-black text-amber-400">
              {stats?.tiempo_conversion?.promedio_dias ?? 0}
              <span className="text-sm font-medium text-slate-500"> días</span>
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Máximo</p>
            <p className="mt-1 text-3xl font-black text-red-400">
              {stats?.tiempo_conversion?.max_dias ?? 0}
              <span className="text-sm font-medium text-slate-500"> días</span>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
