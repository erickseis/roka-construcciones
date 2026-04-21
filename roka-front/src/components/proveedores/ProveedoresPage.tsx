import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Edit, Trash2, Truck, User } from 'lucide-react';
import { DataTable } from '../ui/DataTable';
import { useApi } from '@/hooks/useApi';
import {
  getProveedores,
  deleteProveedor
} from '@/lib/api';
import ProveedorModal from './ProveedorModal';

export default function ProveedoresPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState<any | null>(null);
  const { data: proveedores, loading, refetch } = useApi(() => getProveedores(), []);

  const handleEdit = (proveedor: any) => {
    setEditingProveedor(proveedor);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Desactivar este proveedor?')) return;
    try {
      await deleteProveedor(id);
      refetch();
    } catch {
      alert('Error al eliminar');
    }
  };

  const openNewForm = () => {
    setEditingProveedor(null);
    setShowForm(true);
  };

  const handleModalClose = () => {
    setShowForm(false);
    setEditingProveedor(null);
    refetch();
  };

  const columns = [
    {
      key: 'nombre',
      header: 'Proveedor',
      render: (row: any) => (
        <div>
          <p className="font-bold text-slate-800">{row.nombre}</p>
          {row.razon_social && <p className="text-xs text-slate-500">{row.razon_social}</p>}
        </div>
      ),
    },
    {
      key: 'rut',
      header: 'RUT',
      render: (row: any) => (
        <span className="font-mono text-sm text-slate-600">{row.rut || '—'}</span>
      ),
    },
    {
      key: 'contacto_nombre',
      header: 'Atención',
      render: (row: any) => (
        row.contacto_nombre ? (
          <div className="flex items-center gap-2">
            <User size={14} className="text-slate-400" />
            <span className="text-sm">{row.contacto_nombre}</span>
          </div>
        ) : <span className="text-slate-400">—</span>
      ),
    },
    {
      key: 'telefono',
      header: 'Teléfono',
      render: (row: any) => (
        <span className="text-sm">{row.telefono || row.contacto_telefono || '—'}</span>
      ),
    },
    {
      key: 'correo',
      header: 'Correo',
      render: (row: any) => (
        row.correo ? (
          <a href={`mailto:${row.correo}`} className="text-blue-600 hover:underline text-sm">
            {row.correo}
          </a>
        ) : <span className="text-slate-400">—</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (row: any) => (
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-600">Catálogos</p>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-slate-900">
              Proveedores
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Gestiona el catálogo de proveedores para cotizaciones y órdenes de compra.
            </p>
          </div>
          <button
            onClick={openNewForm}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 hover:shadow-amber-500/30 active:scale-[0.98]"
          >
            <Plus size={18} />
            Nuevo Proveedor
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <DataTable
            columns={columns}
            data={proveedores || []}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por nombre, RUT o contacto..."
            emptyTitle="Sin proveedores"
            emptyMessage="Agrega tu primer proveedor al catálogo"
          />
        </div>
      </motion.div>

      <ProveedorModal
        isOpen={showForm}
        onClose={handleModalClose}
        editingProveedor={editingProveedor}
      />
    </div>
  );
}