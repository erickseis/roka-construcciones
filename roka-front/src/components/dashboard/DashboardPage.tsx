import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, AlertTriangle, Clock, DollarSign, FileText, PackageCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useApi } from '@/hooks/useApi';
import { getDashboardResumen, getTriageConfig } from '@/lib/api';
import { formatCLP } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];

export default function DashboardPage() {
  const { data: stats, loading } = useApi(() => getDashboardResumen(), []);
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [triageConfig, setTriageConfig] = useState<Record<string, number>>({ critico_dias: 2, atrasado_dias: 5 });

  // Cargar configuración de triage desde API
  useEffect(() => {
    getTriageConfig().then((config: any[]) => {
      const cfg: Record<string, number> = {};
      config?.forEach((c: any) => { cfg[c.codigo] = c.valor; });
      setTriageConfig({ critico_dias: cfg.critico_dias ?? 2, atrasado_dias: cfg.atrasado_dias ?? 5 });
    }).catch(() => { /* usar defaults */ });
  }, []);

  const solicitudesPie = stats ? [
    { name: 'Pendientes', value: stats.solicitudes_mensual.pendientes },
    { name: 'Cotizando', value: stats.solicitudes_mensual.cotizando },
    { name: 'Aprobadas', value: stats.solicitudes_mensual.aprobadas },
  ] : [];

  const gastoBarData = stats?.gasto_por_proyecto?.map((item: any) => ({
    name: item.proyecto.length > 20 ? item.proyecto.substring(0, 20) + '...' : item.proyecto,
    gasto: Number(item.gasto_total),
    presupuesto: Number(item.presupuesto_total),
    ordenes: item.total_ordenes,
  })) || [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Dashboard de Estadísticas
        </h2>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" title="Los datos se actualizan automáticamente desde el servidor" />
          <span className="text-[10px] font-medium uppercase tracking-tighter text-slate-500" title="Los datos se actualizan automáticamente desde el servidor">
            Datos en tiempo real • Actualizado ahora
          </span>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: 'Pendientes por Cotizar',
            value: stats?.solicitudes_mensual?.pendientes ?? 0,
            icon: <FileText size={20} />,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            iconBg: 'bg-amber-100',
            title: 'Solicitudes de materiales que aún no tienen cotizaciones enviadas a proveedores. Son el punto de partida para crear solicitudes de cotización.',
          },
          // {
          //   label: 'En Cotización',
          //   value: stats?.solicitudes_mensual?.cotizando ?? 0,
          //   icon: <PackageCheck size={20} />,
          //   color: 'text-blue-600',
          //   bg: 'bg-blue-50',
          //   iconBg: 'bg-blue-100',
          //   title: 'Solicitudes con cotizaciones ya enviadas a proveedores, esperando respuesta de precios para generar órdenes de compra.',
          // },
          {
            label: 'Promedio Conversión',
            value: `${stats?.tiempo_conversion?.promedio_dias ?? 0} días`,
            icon: <Clock size={20} />,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            iconBg: 'bg-blue-100',
            subtitle: `Min: ${stats?.tiempo_conversion?.min_dias ?? 0}d — Max: ${stats?.tiempo_conversion?.max_dias ?? 0}d`,
            title: 'Tiempo promedio en días que toma desde crear una solicitud hasta generar una orden de compra',
          },
          {
            label: 'Gasto Total en OCs',
            value: formatCLP(stats?.gasto_por_proyecto?.reduce((s: number, p: any) => s + Number(p.gasto_total), 0) || 0),
            icon: <DollarSign size={20} />,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            iconBg: 'bg-violet-100',
            title: 'Suma total en pesos del monto de todas las órdenes de compra generadas en los proyectos activos',
          },
          {
            label: 'Presupuesto Total',
            value: formatCLP(stats?.gasto_por_proyecto?.reduce((s: number, p: any) => s + Number(p.presupuesto_total), 0) || 0),
            icon: <TrendingUp size={20} />,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            iconBg: 'bg-emerald-100',
            title: 'Suma total de presupuestos asignados a todos los proyectos activos',
          },
          {
            label: 'Presupuesto Disponible',
            value: formatCLP(stats?.gasto_por_proyecto?.reduce((s: number, p: any) => s + Number(p.presupuesto_disponible), 0) || 0),
            icon: <DollarSign size={20} />,
            color: 'text-sky-600',
            bg: 'bg-sky-50',
            iconBg: 'bg-sky-100',
            title: 'Suma total de presupuesto aún disponible (no comprometido) en todos los proyectos',
          },
        ].map((kpi, idx) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            title={kpi.title}
            className="rounded-xl bg-white p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow dark:bg-slate-800/50 dark:border-slate-700"
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Solicitudes Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          title="Distribución mensual del estado de las solicitudes de materiales: cuántas están pendientes vs. atendidas"
          className="col-span-1 lg:col-span-6 rounded-xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700"
        >
          <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Solicitudes del Mes</h3>
          <p className="mb-6 text-xs text-slate-400">Por estado: Pendientes, Cotizando, Aprobadas</p>

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
                <span className="text-3xl font-black text-slate-900 dark:text-white" title="Total de solicitudes de materiales registradas en el mes actual">
                  {stats?.solicitudes_mensual?.total ?? 0}
                </span>
                <span className="text-[10px] font-bold uppercase text-slate-400">Total</span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-amber-500" />
              <span className="text-[10px] font-bold uppercase text-slate-500">Pendientes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-blue-500" />
              <span className="text-[10px] font-bold uppercase text-slate-500">Cotizando</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" />
              <span className="text-[10px] font-bold uppercase text-slate-500">Aprobadas</span>
            </div>
          </div>
        </motion.div>

        {/* Gasto por Proyecto Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          title="Comparación del gasto total comprometido en órdenes de compra por cada proyecto activo"
          className="col-span-1 lg:col-span-6 rounded-xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700"
        >
          <h3 className="mb-1 text-lg font-bold text-slate-900 dark:text-white">Presupuesto vs Gasto por Proyecto</h3>
          <p className="mb-6 text-xs text-slate-400">Presupuesto asignado vs gastado en Órdenes de Compra</p>

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
                  cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f1f5f9' }}
                  contentStyle={{
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    color: theme === 'dark' ? '#f8fafc' : '#0f172a'
                  }}
                  formatter={(value: number, name: string) => {
                    const label = name === 'presupuesto' ? 'Presupuesto' : 'Gasto OC';
                    return [formatCLP(value), label];
                  }}
                />
                <Bar dataKey="presupuesto" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                <Bar dataKey="gasto" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex justify-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-emerald-500" />
              <span className="text-[10px] font-bold uppercase text-slate-500">Presupuesto</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-amber-500" />
              <span className="text-[10px] font-bold uppercase text-slate-500">Gasto OC</span>
            </div>
          </div>
        </motion.div>
      </div>
      {/* Solicitudes Urgentes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        title="Lista de solicitudes de materiales pendientes ordenadas por fecha de entrega más próxima a vencer, con código de color según urgencia"
        className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Solicitudes de Materiales por Fecha de Entrega</h3>
            <p className="text-xs text-slate-400">Ordenadas por fecha más próxima a vencer</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
        </div>

        {(!stats?.solicitudes_urgentes || stats.solicitudes_urgentes.length === 0) ? (
          <div className="py-8 text-center text-sm text-slate-500">
            ✓ No hay solicitudes pendientes con fecha de entrega próxima
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800/50">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 text-left text-xs font-bold uppercase text-slate-400">Folio</th>
                  <th className="py-2 text-left text-xs font-bold uppercase text-slate-400">Proyecto</th>
                  <th className="py-2 text-left text-xs font-bold uppercase text-slate-400">Solicitante</th>
                  <th className="py-2 text-center text-xs font-bold uppercase text-slate-400">Ítems</th>
                  <th className="py-2 text-left text-xs font-bold uppercase text-slate-400">Fecha Requerida</th>
                  <th className="py-2 text-center text-xs font-bold uppercase text-slate-400">Días Restantes</th>
                  <th className="py-2 text-center text-xs font-bold uppercase text-slate-400">Estado</th>
                </tr>
              </thead>
              <tbody>
                {stats.solicitudes_urgentes.map((sol: any) => {
                  const diasRestantes = sol.dias_restantes;
                  let diasBadgeClass = '';
                  let diasBadgeText = '';

                  if (diasRestantes === null) {
                    diasBadgeClass = 'bg-slate-100 text-slate-500';
                    diasBadgeText = '-';
                  } else if (diasRestantes < 0) {
                    diasBadgeClass = 'bg-red-100 text-red-700 font-bold';
                    diasBadgeText = `Vencida hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) > 1 ? 's' : ''}`;
                  } else if (diasRestantes <= triageConfig.critico_dias) {
                    diasBadgeClass = 'bg-red-100 text-red-700 font-bold';
                    diasBadgeText = `Crítica: ${diasRestantes} día${diasRestantes > 1 ? 's' : ''}`;
                  } else if (diasRestantes <= triageConfig.atrasado_dias) {
                    diasBadgeClass = 'bg-amber-100 text-amber-700 font-bold';
                    diasBadgeText = `Atrasada: ${diasRestantes} días`;
                  } else {
                    diasBadgeClass = 'bg-emerald-50 text-emerald-600';
                    diasBadgeText = `${diasRestantes} días`;
                  }

                  const estadoClass = sol.estado === 'Pendiente'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700';

                  return (
                    <tr
                      key={sol.id}
                      className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-amber-50 dark:hover:bg-amber-900/10 cursor-pointer transition-colors"
                      title="Clic para crear cotización para esta solicitud"
                      onClick={() => navigate(`/cotizaciones?solicitud_id=${sol.id}`)}
                    >
                      <td className="py-2.5 text-slate-600 dark:text-slate-300 font-medium">
                        SOL-{String(sol.id).padStart(3, '0')}
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300 max-w-[150px] truncate" title={sol.proyecto_nombre}>
                        {sol.proyecto_nombre}
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">
                        {sol.solicitante}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium dark:bg-slate-700 dark:text-slate-300">
                          {sol.total_items}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">
                        {sol.fecha_requerida
                          ? new Date(sol.fecha_requerida).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '-'}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${diasBadgeClass}`}>
                          {diasBadgeText}
                        </span>
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${estadoClass}`}>
                          {sol.estado}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Estado de Presupuestos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-4 rounded-xl bg-white p-6 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Estado de Presupuestos</h3>
            <p className="text-xs text-slate-400">Presupuesto asignado, comprometido y disponible por proyecto</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <TrendingUp size={20} className="text-emerald-500" />
          </div>
        </div>

        {(!stats?.gasto_por_proyecto || stats.gasto_por_proyecto.length === 0) ? (
          <div className="py-8 text-center text-sm text-slate-500">
            No hay proyectos con presupuesto asignado
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-slate-800/50">
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="py-2 text-left text-xs font-bold uppercase text-slate-400">Proyecto</th>
                  <th className="py-2 text-right text-xs font-bold uppercase text-slate-400">Presupuesto</th>
                  <th className="py-2 text-right text-xs font-bold uppercase text-slate-400">Usado</th>
                  <th className="py-2 text-right text-xs font-bold uppercase text-slate-400">Disponible</th>
                  <th className="py-2 text-center text-xs font-bold uppercase text-slate-400">Uso</th>
                </tr>
              </thead>
              <tbody>
                {stats.gasto_por_proyecto.filter((p: any) => Number(p.presupuesto_total) > 0).map((p: any) => {
                  const uso = Number(p.porcentaje_uso);
                  let usoClass = 'bg-emerald-100 text-emerald-700';
                  if (uso >= 100) usoClass = 'bg-red-100 text-red-700 font-bold';
                  else if (uso >= 80) usoClass = 'bg-amber-100 text-amber-700 font-bold';
                  else if (uso >= 50) usoClass = 'bg-yellow-100 text-yellow-700';

                  return (
                    <tr key={p.proyecto} className="border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/20">
                      <td className="py-2.5 text-slate-600 dark:text-slate-300 font-medium max-w-[200px] truncate" title={p.proyecto}>
                        {p.proyecto}
                      </td>
                      <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                        {formatCLP(Number(p.presupuesto_total))}
                      </td>
                      <td className="py-2.5 text-right font-mono text-amber-700 dark:text-amber-400">
                        {formatCLP(Number(p.presupuesto_usado))}
                      </td>
                      <td className="py-2.5 text-right font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                        {formatCLP(Number(p.presupuesto_disponible))}
                      </td>
                      <td className="py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${usoClass}`}>
                          {uso.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>


      {/* Conversion Time Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        title="Métricas de eficiencia del proceso de compras: tiempo que demora cada solicitud en convertirse en orden de compra"
        className="mt-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-lg"
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

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center" title="Tiempo mínimo en días que tomó completar el ciclo solicitud → orden de compra">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Mínimo</p>
            <p className="mt-1 text-3xl font-black text-blue-400">
              {stats?.tiempo_conversion?.min_dias ?? 0}
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400"> días</span>
            </p>
          </div>
          <div className="text-center border-x border-slate-700" title="Tiempo promedio en días del ciclo completo solicitud → orden de compra">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Promedio</p>
            <p className="mt-1 text-3xl font-black text-amber-400">
              {stats?.tiempo_conversion?.promedio_dias ?? 0}
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400"> días</span>
            </p>
          </div>
          <div className="text-center" title="Tiempo máximo en días que tomó completar el ciclo solicitud → orden de compra">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Máximo</p>
            <p className="mt-1 text-3xl font-black text-red-400">
              {stats?.tiempo_conversion?.max_dias ?? 0}
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400"> días</span>
            </p>
          </div>
        </div>
      </motion.div>

    </div>
  );
}