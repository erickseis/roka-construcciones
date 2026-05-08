import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, FolderKanban, Pencil, Power, Download, FileText, ChevronDown } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { Modal } from '../ui/Modal';
import { StatusBadge } from '../ui/StatusBadge';
import { useApi } from '@/hooks/useApi';
import {
  createProyecto,
  getProyectosAdmin,
  updateProyecto,
  updateProyectoActive,
  getUsers,
  downloadLicitacionArchivo,
} from '@/lib/api';

export default function ProyectosPage() {
  const { data: proyectos, loading, refetch } = useApi(() => getProyectosAdmin(), []);
  const { data: users } = useApi(() => getUsers(), []);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    numero_obra: '',
    ubicacion: '',
    estado: 'Planificación',
    fecha_inicio: '',
    fecha_fin: '',
    responsable_usuario_id: '',
    numero_licitacion: '',
    descripcion_licitacion: '',
    fecha_apertura_licitacion: '',
    monto_referencial_licitacion: '',
    mandante: '',
    moneda: 'CLP',
    solicitante: '',
    plazo_ejecucion_dias: '',
  });

  const [archivo_licitacion, setArchivo_licitacion] = useState<File | null>(null);
  const [archivo_materiales, setArchivo_materiales] = useState<File | null>(null);
  const [procesarMateriales, setProcesarMateriales] = useState(false);
  const [mostrarLicitacion, setMostrarLicitacion] = useState(false);

  const resetForm = () => {
    setForm({
      nombre: '',
      numero_obra: '',
      ubicacion: '',
      estado: 'Planificación',
      fecha_inicio: '',
      fecha_fin: '',
      responsable_usuario_id: '',
      numero_licitacion: '',
      descripcion_licitacion: '',
      fecha_apertura_licitacion: '',
      monto_referencial_licitacion: '',
      mandante: '',
      moneda: 'CLP',
      solicitante: '',
      plazo_ejecucion_dias: '',
    });
    setArchivo_licitacion(null);
    setArchivo_materiales(null);
    setProcesarMateriales(false);
    setMostrarLicitacion(false);
    setEditing(null);
  };

  const estadoCounts = useMemo(() => {
    const rows = proyectos || [];
    return {
      activos: rows.filter((p: any) => p.is_active).length,
      enCurso: rows.filter((p: any) => p.estado === 'En Curso').length,
      planificacion: rows.filter((p: any) => p.estado === 'Planificación').length,
    };
  }, [proyectos]);

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (proyecto: any) => {
    setEditing(proyecto);
    setForm({
      nombre: proyecto.nombre || '',
      numero_obra: proyecto.numero_obra || '',
      ubicacion: proyecto.ubicacion || '',
      estado: proyecto.estado || 'Planificación',
      fecha_inicio: proyecto.fecha_inicio ? String(proyecto.fecha_inicio).slice(0, 10) : '',
      fecha_fin: proyecto.fecha_fin ? String(proyecto.fecha_fin).slice(0, 10) : '',
      responsable_usuario_id: proyecto.responsable_usuario_id ? String(proyecto.responsable_usuario_id) : '',
      numero_licitacion: proyecto.numero_licitacion || '',
      descripcion_licitacion: proyecto.descripcion_licitacion || '',
      fecha_apertura_licitacion: proyecto.fecha_apertura_licitacion ? String(proyecto.fecha_apertura_licitacion).slice(0, 10) : '',
      monto_referencial_licitacion: proyecto.monto_referencial_licitacion ? String(proyecto.monto_referencial_licitacion) : '',
      mandante: proyecto.mandante || '',
      moneda: proyecto.moneda || 'CLP',
      plazo_ejecucion_dias: proyecto.plazo_ejecucion_dias ? String(proyecto.plazo_ejecucion_dias) : '',
    });
    setMostrarLicitacion(!!proyecto.numero_licitacion || !!proyecto.mandante);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('nombre', form.nombre);
      formData.append('numero_obra', form.numero_obra);
      if (form.ubicacion) formData.append('ubicacion', form.ubicacion);
      formData.append('estado', form.estado);
      if (form.fecha_inicio) formData.append('fecha_inicio', form.fecha_inicio);
      if (form.fecha_fin) formData.append('fecha_fin', form.fecha_fin);
      if (form.responsable_usuario_id) formData.append('responsable_usuario_id', form.responsable_usuario_id);
      if (form.numero_licitacion) formData.append('numero_licitacion', form.numero_licitacion);
      if (form.descripcion_licitacion) formData.append('descripcion_licitacion', form.descripcion_licitacion);
      if (form.fecha_apertura_licitacion) formData.append('fecha_apertura_licitacion', form.fecha_apertura_licitacion);
      if (form.monto_referencial_licitacion) formData.append('monto_referencial_licitacion', form.monto_referencial_licitacion);
      if (form.mandante) formData.append('mandante', form.mandante);
      if (form.moneda) formData.append('moneda', form.moneda);
      if (form.plazo_ejecucion_dias) formData.append('plazo_ejecucion_dias', form.plazo_ejecucion_dias);
      if (archivo_licitacion) formData.append('archivo_licitacion', archivo_licitacion);
      if (archivo_materiales) {
        formData.append('archivo_materiales', archivo_materiales);
        if (procesarMateriales) {
          formData.append('procesar_materiales', 'true');
          formData.append('solicitante', form.solicitante || 'Importación automática');
        }
      }

      if (editing) {
        await updateProyecto(editing.id, formData);
      } else {
        await createProyecto(formData);
      }

      setShowForm(false);
      resetForm();
      refetch();
    } catch (error: any) {
      alert(error.message || 'Error al guardar proyecto');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (row: any) => {
    const nextValue = !row.is_active;
    const label = nextValue ? 'activar' : 'inactivar';

    if (!confirm(`¿Deseas ${label} este proyecto?`)) return;

    try {
      await updateProyectoActive(row.id, nextValue);
      refetch();
    } catch (error: any) {
      alert(error.message || 'Error al actualizar estado del proyecto');
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (row: any) => <span className="font-mono text-xs font-bold text-amber-600">PRY-{String(row.id).padStart(3, '0')}</span>,
    },
    { key: 'nombre', header: 'Proyecto', sortable: true },
    {
      key: 'numero_obra',
      header: 'N° Obra',
      sortable: true,
      render: (row: any) => row.numero_obra ? (
        <span className="font-mono text-xs font-bold text-slate-700">{row.numero_obra}</span>
      ) : (
        <span className="text-[10px] text-slate-400">—</span>
      ),
    },
    { key: 'ubicacion', header: 'Ubicación', sortable: true },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (row: any) => <StatusBadge status={row.estado} />,
    },
    {
      key: 'is_active',
      header: 'Activo',
      sortable: true,
      render: (row: any) => (
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
          {row.is_active ? 'Sí' : 'No'}
        </span>
      ),
    },
    { key: 'responsable_nombre', header: 'Responsable', sortable: true },
    {
      key: 'numero_licitacion',
      header: 'Licitación',
      sortable: false,
      render: (row: any) => row.numero_licitacion ? (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
          {row.numero_licitacion}
        </span>
      ) : (
        <span className="text-[10px] text-slate-400">—</span>
      ),
    },
    {
      key: 'presupuesto_total',
      header: 'Presupuesto',
      sortable: true,
      render: (row: any) => {
        const total = Number(row.presupuesto_total ?? 0);
        const pct = Number(row.presupuesto_porcentaje_uso ?? 0);
        const disp = Number(row.presupuesto_disponible ?? 0);
        if (!total) return <span className="text-[10px] text-slate-400">—</span>;
        const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
        return (
          <div className="min-w-[130px]">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-700">{pct.toFixed(1)}%</span>
              <span className="text-slate-400">disp. ${disp.toLocaleString('es-CL')}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="mt-0.5 text-[9px] text-slate-400">
              ${total.toLocaleString('es-CL')}
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row: any) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEdit(row);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleActive(row);
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
            title={row.is_active ? 'Inactivar' : 'Activar'}
          >
            <Power size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-600">Administración</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Proyectos</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Gestiona la cartera de proyectos y sus responsables.</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600"
          >
            <Plus size={18} />
            Nuevo Proyecto
          </button>
        </div>
      </motion.div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-slate-800/50 dark:border-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Activos</p>
          <p className="text-2xl font-black text-emerald-600">{estadoCounts.activos}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-slate-800/50 dark:border-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">En Curso</p>
          <p className="text-2xl font-black text-amber-600">{estadoCounts.enCurso}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm dark:bg-slate-800/50 dark:border-slate-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Planificación</p>
          <p className="text-2xl font-black text-violet-600">{estadoCounts.planificacion}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-slate-900 dark:border dark:border-slate-800">
        <DataTable
          columns={columns}
          data={proyectos || []}
          loading={loading}
          searchable
          searchPlaceholder="Buscar por proyecto, ubicación o responsable..."
          emptyTitle="Sin proyectos"
          emptyMessage="Crea tu primer proyecto para comenzar"
        />
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title={editing ? 'Editar Proyecto' : 'Nuevo Proyecto'}
        subtitle="Información base del proyecto"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Nombre</label>
            <input
              type="text"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              title="Nombre identificatorio del proyecto de obra"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Número de Obra <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.numero_obra}
              onChange={(e) => setForm({ ...form, numero_obra: e.target.value })}
              placeholder="Ej: OBRA-2024-001"
              title="Código identificatorio obligatorio de la obra. Se usa como referencia en órdenes de compra y documentos oficiales."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Ubicación</label>
              <input
                type="text"
                value={form.ubicacion}
                onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                title="Dirección o ubicación física donde se desarrolla el proyecto"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Estado</label>
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                title="Estado actual del proyecto: Planificación, En Curso o Completado"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="Planificación">Planificación</option>
                <option value="En Curso">En Curso</option>
                <option value="Completado">Completado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Inicio</label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
                title="Fecha de inicio prevista para el proyecto"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Fin</label>
              <input
                type="date"
                value={form.fecha_fin}
                onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                title="Fecha de término prevista para el proyecto"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Responsable</label>
              <select
                value={form.responsable_usuario_id}
                onChange={(e) => setForm({ ...form, responsable_usuario_id: e.target.value })}
                title="Persona responsable de la gestión y supervisión del proyecto"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">Sin responsable</option>
                {users?.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setMostrarLicitacion(!mostrarLicitacion)}
              className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              <ChevronDown size={16} className={`transition-transform ${mostrarLicitacion ? 'rotate-180' : ''}`} />
              Datos de Licitación
            </button>

            {mostrarLicitacion && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Número de Licitación <sup className='text-slate-500'>(Opcional)</sup></label>
                  <input
                    type="text"
                    value={form.numero_licitacion}
                    onChange={(e) => setForm({ ...form, numero_licitacion: e.target.value })}
                    placeholder="Ej: LIC-2024-001"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Descripción</label>
                  <textarea
                    value={form.descripcion_licitacion}
                    onChange={(e) => setForm({ ...form, descripcion_licitacion: e.target.value })}
                    placeholder="Detalles de la licitación..."
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Fecha de Apertura</label>
                    <input
                      type="date"
                      value={form.fecha_apertura_licitacion}
                      onChange={(e) => setForm({ ...form, fecha_apertura_licitacion: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Monto de Adjudicación (obra)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.monto_referencial_licitacion}
                      onChange={(e) => setForm({ ...form, monto_referencial_licitacion: e.target.value })}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div title="Persona o entidad que financia el proyecto">
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Mandante</label>
                    <input
                      type="text"
                      value={form.mandante}
                      onChange={(e) => setForm({ ...form, mandante: e.target.value })}
                      placeholder="Nombre del mandante o entidad financiadora"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Moneda</label>
                    <input
                      type="text"
                      value={form.moneda}
                      onChange={(e) => setForm({ ...form, moneda: e.target.value })}
                      placeholder="CLP, USD, UF, UTM"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Plazo de ejecución (días)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.plazo_ejecucion_dias}
                    onChange={(e) => setForm({ ...form, plazo_ejecucion_dias: e.target.value })}
                    placeholder="Ej: 365"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Archivo de Licitación</label>
                  <div className="rounded-lg border-2 border-dashed border-slate-300 p-4">
                    <input
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv"
                      onChange={(e) => setArchivo_licitacion(e.target.files?.[0] || null)}
                      className="w-full text-xs"
                    />
                    <p className="mt-2 text-[10px] text-slate-500">Archivos permitidos: PDF, Excel, CSV (máx. 20MB)</p>
                    {archivo_licitacion && (
                      <p className="mt-2 text-xs text-green-600 font-medium">✓ {archivo_licitacion.name}</p>
                    )}
                    {editing?.archivo_licitacion_nombre && !archivo_licitacion && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-slate-600">Archivo actual: {editing.archivo_licitacion_nombre}</span>
                        <button
                          type="button"
                          onClick={() => downloadLicitacionArchivo(editing.id, editing.archivo_licitacion_nombre)}
                          className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                        >
                          <Download size={12} />
                          Descargar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">Archivo de Materiales (Excel)</label>
                  <div className="rounded-lg border-2 border-dashed border-slate-300 p-4">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setArchivo_materiales(e.target.files?.[0] || null)}
                      className="w-full text-xs"
                    />
                    <p className="mt-2 text-[10px] text-slate-500">Sube el listado de materiales en Excel para importar</p>
                    {archivo_materiales && (
                      <p className="mt-2 text-xs text-green-600 font-medium">✓ {archivo_materiales.name}</p>
                    )}
                    <label className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <input
                        type="checkbox"
                        checked={procesarMateriales}
                        onChange={(e) => setProcesarMateriales(e.target.checked)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 dark:border-slate-600"
                      />
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Procesar como solicitud de materiales
                      </span>
                    </label>
                    {procesarMateriales && (
                      <div className="mt-2">
                        <input
                          type="text"
                          placeholder="Nombre del solicitante"
                          value={form.solicitante || ''}
                          onChange={(e) => setForm({ ...form, solicitante: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                        />
                        <p className="mt-1 text-[10px] text-amber-600">
                          Se importarán los materiales como una solicitud nueva
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-60"
            >
              <FolderKanban size={16} />
              {submitting ? 'Guardando...' : 'Guardar Proyecto'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
