import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, FileText, Eye, Trash2, Upload, Download, Send, PackageCheck, Ban } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import FlowStepper from '../ui/FlowStepper';
import CreatableSelect from 'react-select/creatable';
import { useApi } from '@/hooks/useApi';
import {
  getSolicitudes,
  getSolicitud,
  createSolicitud,
  deleteSolicitud,
  getProyectos,
  getMaterialesMaster,
  getUnidadesMedida,
  createMaterialMaster
} from '@/lib/api';
import { showConfirm, showAlert, showToast } from '@/lib/alerts';
import MaterialModal from '../materiales/MaterialModal';
import BulkImportModal from './BulkImportModal';
import { MaterialInput } from '@/types';


export default function SolicitudesPage() {
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showDetail, setShowDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [showAnuladas, setShowAnuladas] = useState(false);
  const { data: solicitudes, loading, refetch } = useApi(() => getSolicitudes(showAnuladas ? { estado: 'Anulada' } : {}), [showAnuladas]);
  const { data: proyectos } = useApi(() => getProyectos(), []);

  // Sort: Pendiente first, then Cotizando, then Aprobado, then others
  const sortedSolicitudes = React.useMemo(() => {
    if (!solicitudes) return [];
    const order: Record<string, number> = { 'Pendiente': 0, 'Cotizando': 1, 'Aprobado': 2 };
    return [...solicitudes].sort((a: any, b: any) => {
      const orderA = order[a.estado] ?? 3;
      const orderB = order[b.estado] ?? 3;
      if (orderA !== orderB) return orderA - orderB;
      // Within same status, sort by date descending (newest first)
      return new Date(b.created_at || b.fecha).getTime() - new Date(a.created_at || a.fecha).getTime();
    });
  }, [solicitudes]);
  const { data: masterMateriales, refetch: refetchMateriales } = useApi(() => getMaterialesMaster(), []);
  const { data: masterUnidades } = useApi(() => getUnidadesMedida(), []);
  
  // Material Modal state
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  // Form state
  const [form, setForm] = useState({
    proyecto_id: '',
    solicitante: '',
    fecha_requerida: '',
    items: [{ material_id: null as number | null, nombre_material: '', cantidad_requerida: '', unidad: 'Unidades', codigo: '' }],
  });
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { material_id: null, nombre_material: '', cantidad_requerida: '', unidad: 'Unidades', codigo: '' }],
    }));
  };

  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createSolicitud({
        proyecto_id: Number(form.proyecto_id),
        solicitante: form.solicitante,
        fecha_requerida: form.fecha_requerida || null,
        items: form.items.map(i => ({
          material_id: i.material_id,
          nombre_material: i.nombre_material,
          cantidad_requerida: Number(i.cantidad_requerida),
          unidad: i.unidad,
          ...(i.codigo ? { codigo: i.codigo } : {}),
        })),
      });
      setShowForm(false);
      setForm({
        proyecto_id: '',
        solicitante: '',
        fecha_requerida: '',
        items: [{ material_id: null, nombre_material: '', cantidad_requerida: '', unidad: 'Unidades', codigo: '' }],
      });
      refetch();
    } catch (err) {
      alert('Error al crear solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, currentEstado: string) => {
    if (currentEstado !== 'Anulada') {
      const result = await showConfirm({
        title: '¿Anular Solicitud?',
        text: 'La solicitud se marcará como anulada y se ocultará de los procesos activos (Cotizaciones, OC).',
        confirmButtonText: 'Sí, anular',
        cancelButtonText: 'No, cancelar'
      });
      if (!result.isConfirmed) return;
    } else {
      const result = await showConfirm({
        title: '¿Eliminar Permanentemente?',
        text: 'Esta acción borrará definitivamente el registro de la base de datos y toda su trazabilidad relacionada. ¡No se puede deshacer!',
        icon: 'error',
        confirmButtonText: 'Sí, eliminar permanentemente',
        cancelButtonText: 'Cancelar'
      });
      if (!result.isConfirmed) return;
    }

    try {
      await deleteSolicitud(id);
      refetch();
      showToast({
        title: currentEstado === 'Anulada' ? 'Eliminada permanentemente' : 'Solicitud anulada',
        icon: 'success'
      });
    } catch (err: any) {
      showAlert({
        title: 'Error',
        text: err.message || 'Error al procesar la solicitud',
        icon: 'error'
      });
    }
  };

  const columns = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      render: (row: any) => (
        <span className="font-mono text-xs font-bold text-amber-600">SOL-{String(row.id).padStart(3, '0')}</span>
      ),
    },
    { key: 'proyecto_nombre', header: 'Proyecto', sortable: true },
    { key: 'solicitante', header: 'Solicitante', sortable: true },
    {
      key: 'fecha',
      header: 'Fecha',
      sortable: true,
      render: (row: any) => new Date(row.fecha).toLocaleDateString('es-ES'),
    },
    {
      key: 'total_items',
      header: 'Ítems',
      render: (row: any) => (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
          {row.total_items}
        </span>
      ),
    },
    {
      key: 'estado',
      header: 'Estado',
      sortable: true,
      render: (row: any) => <StatusBadge status={row.estado} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (row: any) => (
        <div className="flex gap-1">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setLoadingDetail(true);
              try {
                const detail = await getSolicitud(row.id);
                setShowDetail(detail);
              } catch (err) {
                console.error('Error al cargar detalle:', err);
                alert('Error al cargar los detalles de la solicitud');
              } finally {
                setLoadingDetail(false);
              }
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Ver detalle"
          >
            <Eye size={14} />
          </button>
          {row.estado !== 'Aprobado' && (
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row.id, row.estado); }}
              className={`rounded-lg p-1.5 transition-colors ${
                row.estado === 'Anulada' 
                  ? 'text-red-600 hover:bg-red-100' 
                  : 'text-slate-400 hover:bg-amber-50 hover:text-amber-500'
              }`}
              title={row.estado === 'Anulada' ? 'Eliminar permanentemente' : 'Anular solicitud'}
            >
              {row.estado === 'Anulada' ? <Trash2 size={14} /> : <Ban size={14} />}
            </button>
          )}
        </div>
      ),
    },
  ];

  const unidadesStatic = ['Unidades', 'kg', 'm³', 'Toneladas', 'Sacos', 'Galones', 'Piezas', 'ml', 'Litros'];

  const downloadTemplate = () => {
    // Hoja de Datos
    const templateData = [
      { 'Material': 'Cemento Gris', 'Cantidad': 10, 'Unidad': 'Sacos', 'SKU': 'CEM-001' },
      { 'Material': 'Varilla 1/2', 'Cantidad': 50, 'Unidad': 'Piezas', 'SKU': 'VAR-002' },
      { 'Material': 'Arena de Río', 'Cantidad': 5.5, 'Unidad': 'm3', 'SKU': '' },
      { 'Material': 'Grava 3/4', 'Cantidad': 3, 'Unidad': 'm3', 'SKU': '' },
    ];
    
    // Hoja de Instrucciones
    const instructionData = [
      { 'Campo': 'Material', 'Descripción': 'Nombre del material o insumo (Obligatorio)', 'Ejemplo': 'Cemento Gris' },
      { 'Campo': 'Cantidad', 'Descripción': 'Cantidad requerida en formato numérico (Obligatorio)', 'Ejemplo': '10' },
      { 'Campo': 'Unidad', 'Descripción': 'Unidad de medida (Opcional, por defecto: Unidades)', 'Ejemplo': 'Sacos' },
      { 'Campo': 'SKU', 'Descripción': 'Código interno del material (Opcional, ayuda a vincular con el catálogo)', 'Ejemplo': 'CEM-001' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wsIns = XLSX.utils.json_to_sheet(instructionData);

    // Apply Styles to Headers (Datos)
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "F59E0B" } }, // Amber-500
      alignment: { horizontal: "center", vertical: "center" }
    };

    ['A1', 'B1', 'C1', 'D1'].forEach(cell => {
      if (ws[cell]) ws[cell].s = headerStyle;
    });

    // Apply Styles to Headers (Instrucciones)
    const insHeaderStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "0F172A" } }, // Slate-900
      alignment: { horizontal: "center", vertical: "center" }
    };

    ['A1', 'B1', 'C1'].forEach(cell => {
      if (wsIns[cell]) wsIns[cell].s = insHeaderStyle;
    });

    // Configurar anchos de columna para la hoja principal
    ws['!cols'] = [
      { wch: 30 }, // Material
      { wch: 10 }, // Cantidad
      { wch: 15 }, // Unidad
      { wch: 15 }, // SKU
    ];

    // Configurar anchos para instrucciones
    wsIns['!cols'] = [
      { wch: 15 },
      { wch: 50 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos para Importar');
    XLSX.utils.book_append_sheet(wb, wsIns, 'Instrucciones');
    
    XLSX.writeFile(wb, 'Plantilla_Solicitud_Materiales.xlsx');
  };

  const onNewMaterialSaved = async (data: MaterialInput) => {
    try {
      const resp = await createMaterialMaster(data);
      await refetchMateriales();
      return resp;
    } catch (error) {
      console.error('Error al crear material maestro:', error);
      throw error;
    }
  };

  return (
    <div>
      {/* Page Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-600">Módulo 1</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Solicitudes de Materiales
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Gestiona las solicitudes de materiales para cada proyecto de obra.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={downloadTemplate}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              title="Descargar plantilla Excel para importación"
            >
              <Download size={18} className="text-amber-500" />
              Plantilla
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowAnuladas(!showAnuladas)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                  showAnuladas 
                    ? 'bg-slate-800 text-white shadow-lg' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-sm'
                }`}
              >
                {showAnuladas ? 'Ver Activas' : 'Ver Anuladas'}
              </button>

              <button
                onClick={() => setShowBulkImport(true)}
                className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
              >
                <Upload size={18} className="text-slate-400" />
                Importación Masiva
              </button>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 hover:shadow-amber-500/30 active:scale-[0.98]"
            >
              <Plus size={18} />
              Nueva Solicitud
            </button>
          </div>

        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Pendientes por Cotizar', value: solicitudes?.filter((s: any) => s.estado === 'Pendiente').length || 0, color: 'text-amber-600', bg: 'bg-amber-50', iconBg: 'bg-amber-100', icon: <FileText size={18} />, title: 'Solicitudes de materiales que aún no tienen cotizaciones enviadas a proveedores. Necesitan crear solicitudes de cotización.' },
          { label: 'En Cotización', value: solicitudes?.filter((s: any) => s.estado === 'Cotizando').length || 0, color: 'text-blue-600', bg: 'bg-blue-50', iconBg: 'bg-blue-100', icon: <Send size={18} />, title: 'Solicitudes con cotizaciones ya enviadas a proveedores, esperando respuesta de precios' },
          { label: 'Aprobadas / Con OC', value: solicitudes?.filter((s: any) => s.estado === 'Aprobado').length || 0, color: 'text-emerald-600', bg: 'bg-emerald-50', iconBg: 'bg-emerald-100', icon: <PackageCheck size={18} />, title: 'Solicitudes con cotización aprobada u orden de compra generada' },
        ].map(stat => (
          <div key={stat.label} title={stat.title} className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 dark:bg-slate-800/50 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</p>
                <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.iconBg} ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-xl bg-white p-6 shadow-sm dark:bg-[#111827]/40 dark:border dark:border-slate-800">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Ordenadas por prioridad: Pendientes → En Cotización → Aprobadas
          </p>
          <DataTable
            columns={columns}
            data={sortedSolicitudes}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por proyecto, solicitante..."
            emptyTitle="Sin solicitudes"
            emptyMessage="Crea tu primera solicitud de materiales"
          />
        </div>
      </motion.div>

      {/* Create Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Nueva Solicitud de Materiales"
        subtitle="Agrega los materiales requeridos para el proyecto"
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Proyecto</label>
              <select
                required
                value={form.proyecto_id}
                onChange={e => setForm({ ...form, proyecto_id: e.target.value })}
                title="Proyecto para el cual se solicitan los materiales"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              >
                <option value="">Seleccionar proyecto...</option>
                {proyectos?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Solicitante</label>
              <input
                required
                type="text"
                value={form.solicitante}
                onChange={e => setForm({ ...form, solicitante: e.target.value })}
                placeholder="Nombre de quien solicita"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Fecha requerida en terreno</label>
              <input
                type="date"
                value={form.fecha_requerida}
                onChange={e => setForm({ ...form, fecha_requerida: e.target.value })}
                title="Fecha en que se necesita el material físicamente en terreno"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Materiales</label>
              <button 
                type="button" 
                onClick={addItem} 
                className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600 shadow-sm border border-amber-100 transition-all hover:bg-amber-100 hover:shadow-md active:scale-95 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20"
              >
                <Plus size={14} /> Agregar ítem
              </button>
            </div>
            <div className="space-y-3">
              {(() => {
                const materialOptions = masterMateriales?.map((m: any) => ({
                  value: m.id,
                  label: `${m.nombre} ${m.sku ? `(${m.sku})` : ''} — ${m.unidad_abreviatura}`,
                  material: m
                })) || [];

                return form.items.map((item, idx) => {
                  const selectedOption = item.material_id 
                    ? materialOptions.find((opt: any) => opt.value === item.material_id)
                    : item.nombre_material ? { value: item.nombre_material, label: item.nombre_material, isManual: true } : null;

                  return (
                    <div key={idx} className="flex flex-col md:flex-row items-stretch md:items-start gap-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                      
                      {/* Búsqueda o Entrada Manual */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold uppercase text-slate-400">Material / Insumo</label>
                          <button
                            type="button"
                            onClick={() => setIsMaterialModalOpen(true)}
                            className="flex items-center gap-1 rounded-md bg-amber-50/50 px-2 py-0.5 text-[10px] font-bold text-amber-600 border border-amber-100/50 transition-all hover:bg-amber-100 hover:text-amber-700 dark:bg-amber-500/5 dark:border-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/10"
                            title="Registrar nuevo material en el catálogo"
                          >
                            <Plus size={10} /> Nuevo en catálogo
                          </button>
                        </div>
                        <CreatableSelect
                          isClearable
                          menuPortalTarget={document.body}
                          placeholder="Buscar catálogo o escribir nuevo..."
                          noOptionsMessage={() => "No encontrado. Escribe para crear manual."}
                          formatCreateLabel={(inputValue) => `Usar ingreso manual: "${inputValue}"`}
                          options={materialOptions}
                          value={selectedOption}
                          onChange={(newValue: any, actionMeta) => {
                            if (actionMeta.action === 'create-option' || (newValue && newValue.isManual)) {
                              // Ingreso manual
                              setForm(prev => ({
                                ...prev,
                                items: prev.items.map((it, i) => i === idx ? {
                                  ...it,
                                  material_id: null,
                                  nombre_material: newValue.value,
                                } : it)
                              }));
                            } else if (newValue && newValue.material) {
                              // Selección de catálogo
                              const mat = newValue.material;
                              setForm(prev => ({
                                ...prev,
                                items: prev.items.map((it, i) => i === idx ? {
                                  ...it,
                                  material_id: mat.id,
                                  nombre_material: mat.nombre,
                                  unidad: mat.unidad_abreviatura,
                                  codigo: mat.sku || '',
                                } : it)
                              }));
                            } else {
                              // Limpiado
                              setForm(prev => ({
                                ...prev,
                                items: prev.items.map((it, i) => i === idx ? {
                                  ...it,
                                  material_id: null,
                                  nombre_material: '',
                                } : it)
                              }));
                            }
                          }}
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              minHeight: '38px',
                              borderRadius: '0.375rem',
                              borderColor: state.isFocused ? '#fbbf24' : '#e2e8f0',
                              boxShadow: state.isFocused ? '0 0 0 1px #fbbf24' : 'none',
                              backgroundColor: 'inherit',
                              color: 'inherit',
                              '&:hover': {
                                borderColor: state.isFocused ? '#fbbf24' : '#cbd5e1'
                              },
                              fontSize: '0.875rem'
                            }),
                            singleValue: (base) => ({
                              ...base,
                              color: 'inherit'
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: '#94a3b8'
                            }),
                            input: (base) => ({
                              ...base,
                              color: 'inherit'
                            }),
                            menuPortal: (base) => ({
                              ...base,
                              zIndex: 9999
                            }),
                            menu: (base) => ({
                              ...base,
                              fontSize: '0.875rem',
                              backgroundColor: '#1e293b',
                              color: '#f8fafc'
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected ? '#f59e0b' : state.isFocused ? '#334155' : 'transparent',
                              color: state.isSelected ? 'white' : '#f8fafc',
                              '&:active': {
                                backgroundColor: '#f59e0b'
                              }
                            })
                          }}
                        />
                      </div>

                      <div className="flex gap-2">
                        {/* Código */}
                        <div className="w-24">
                          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Código</label>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={item.codigo}
                            onChange={e => updateItem(idx, 'codigo', e.target.value)}
                            className="w-full h-[38px] rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-mono outline-none focus:border-amber-400 focus:bg-white transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-amber-500/50 dark:focus:bg-slate-800 dark:placeholder-slate-600"
                          />
                        </div>

                        {/* Cantidad */}
                        <div className="w-20">
                          <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Cant.</label>
                          <input
                            required
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.cantidad_requerida}
                            onChange={e => updateItem(idx, 'cantidad_requerida', e.target.value)}
                            className="w-full h-[38px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-amber-400 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-amber-500/50 dark:focus:bg-slate-800"
                          />
                        </div>

                        {/* Unidad */}
                        <div className="w-24">
                           <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">Unidad</label>
                           <select
                            value={item.unidad}
                             onChange={e => updateItem(idx, 'unidad', e.target.value)}
                             className="w-full h-[38px] rounded-md border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-amber-400 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:focus:border-amber-500/50 dark:focus:bg-slate-800"
                          >
                            {masterUnidades?.map((u: any) => (
                              <option key={u.id} value={u.abreviatura}>{u.abreviatura}</option>
                            )) || unidadesStatic.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        
                        {/* Botón Eliminar */}
                        <div className="flex items-end pb-[6px]">
                          {form.items.length > 1 ? (
                            <button type="button" onClick={() => removeItem(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Eliminar ítem">
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <div className="w-[28px]"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-60"
            >
              <FileText size={16} />
              {submitting ? 'Creando...' : 'Crear Solicitud'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!showDetail}
        onClose={() => setShowDetail(null)}
        title={showDetail ? `Solicitud SOL-${String(showDetail.id).padStart(3, '0')}` : ''}
        subtitle={showDetail?.proyecto_nombre}
        size="lg"
      >
        {showDetail && (
          <div className="space-y-4">
            <FlowStepper currentStep={0} estado={showDetail.estado} tipo="solicitud" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Solicitante</p>
                <p className="text-sm font-bold text-slate-800">{showDetail.solicitante}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Fecha</p>
                <p className="text-sm font-bold text-slate-800">{new Date(showDetail.fecha).toLocaleDateString('es-ES')}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase text-slate-400">Estado</p>
                <StatusBadge status={showDetail.estado} size="md" />
              </div>
            </div>

            {showDetail.fecha_requerida && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-[10px] font-bold uppercase text-amber-600">Fecha requerida en terreno</p>
                <p className="text-sm font-bold text-amber-800">{new Date(showDetail.fecha_requerida + 'T12:00:00').toLocaleDateString('es-ES')}</p>
              </div>
            )}

            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2">Ítems de la solicitud</p>
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50"><tr>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Material</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Código/SKU</th>
                  <th className="px-3 py-2 text-right text-[10px] font-bold uppercase text-slate-500">Cantidad</th>
                  <th className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">Unidad</th>
                </tr></thead>
                <tbody>
                  {loadingDetail ? (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-400">Cargando ítems...</td></tr>
                  ) : showDetail.items ? showDetail.items.map((item: any) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {item.material_oficial_nombre || item.nombre_material}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">
                          {item.material_sku || item.codigo || '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">{Number(item.cantidad_requerida).toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-500">{item.unidad_abreviatura || item.unidad}</td>
                      </tr>
                    )) : (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-slate-400">Sin ítems</td></tr>
                  )}
                </tbody>
              </table>
            </div>




          </div>
        )}
      </Modal>

      <MaterialModal 
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        onSave={onNewMaterialSaved}
        unidades={masterUnidades || []}
      />

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        proyectos={proyectos || []}
        masterMateriales={masterMateriales || []}
        onSuccess={() => {
          refetch();
          setShowBulkImport(false);
        }}
      />
    </div>

  );
}
