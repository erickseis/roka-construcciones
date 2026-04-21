import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, FolderKanban, Pencil, Power } from 'lucide-react';
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
} from '@/lib/api';

export default function ProyectosPage() {
  const { data: proyectos, loading, refetch } = useApi(() => getProyectosAdmin(), []);
  const { data: users } = useApi(() => getUsers(), []);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    nombre: '',
    ubicacion: '',
    estado: 'Planificación',
    fecha_inicio: '',
    fecha_fin: '',
    responsable_usuario_id: '',
  });

  const resetForm = () => {
    setForm({
      nombre: '',
      ubicacion: '',
      estado: 'Planificación',
      fecha_inicio: '',
      fecha_fin: '',
      responsable_usuario_id: '',
    });
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
      ubicacion: proyecto.ubicacion || '',
      estado: proyecto.estado || 'Planificación',
      fecha_inicio: proyecto.fecha_inicio ? String(proyecto.fecha_inicio).slice(0, 10) : '',
      fecha_fin: proyecto.fecha_fin ? String(proyecto.fecha_fin).slice(0, 10) : '',
      responsable_usuario_id: proyecto.responsable_usuario_id ? String(proyecto.responsable_usuario_id) : '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        nombre: form.nombre,
        ubicacion: form.ubicacion || null,
        estado: form.estado,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        responsable_usuario_id: form.responsable_usuario_id ? Number(form.responsable_usuario_id) : null,
      };

      if (editing) {
        await updateProyecto(editing.id, payload);
      } else {
        await createProyecto(payload);
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
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">Proyectos</h2>
            <p className="mt-1 text-sm text-slate-500">Gestiona la cartera de proyectos y sus responsables.</p>
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

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Activos</p>
          <p className="text-2xl font-black text-emerald-600">{estadoCounts.activos}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">En Curso</p>
          <p className="text-2xl font-black text-amber-600">{estadoCounts.enCurso}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Planificación</p>
          <p className="text-2xl font-black text-violet-600">{estadoCounts.planificacion}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
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
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              >
                <option value="Planificación">Planificación</option>
                <option value="En Curso">En Curso</option>
                <option value="Completado">Completado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
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
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              >
                <option value="">Sin responsable</option>
                {users?.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.nombre} {u.apellido}</option>
                ))}
              </select>
            </div>
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
