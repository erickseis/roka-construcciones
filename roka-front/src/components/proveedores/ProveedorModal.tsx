import React, { useState } from 'react';
import { Truck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import {
  createProveedor,
  updateProveedor
} from '@/lib/api';

interface ProveedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (proveedor: any) => Promise<void>;
  editingProveedor?: any | null;
}

export default function ProveedorModal({ isOpen, onClose, onSave, editingProveedor }: ProveedorModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const initialForm = {
    rut: '',
    nombre: '',
    razon_social: '',
    direccion: '',
    telefono: '',
    correo: '',
    contacto_nombre: '',
    contacto_telefono: '',
    contacto_correo: '',
    condiciones_pago: '',
    condicion_despacho: '',
    plazo_entrega: '',
    moneda: 'CLP'
  };

  const [form, setForm] = useState(initialForm);

  React.useEffect(() => {
    if (editingProveedor) {
      setForm({
        rut: editingProveedor.rut || '',
        nombre: editingProveedor.nombre || '',
        razon_social: editingProveedor.razon_social || '',
        direccion: editingProveedor.direccion || '',
        telefono: editingProveedor.telefono || '',
        correo: editingProveedor.correo || '',
        contacto_nombre: editingProveedor.contacto_nombre || '',
        contacto_telefono: editingProveedor.contacto_telefono || '',
        contacto_correo: editingProveedor.contacto_correo || '',
        condiciones_pago: editingProveedor.condiciones_pago || '',
        condicion_despacho: editingProveedor.condicion_despacho || '',
        plazo_entrega: editingProveedor.plazo_entrega || '',
        moneda: editingProveedor.moneda || 'CLP'
      });
    } else {
      setForm(initialForm);
    }
  }, [editingProveedor, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let savedProveedor;
      if (editingProveedor) {
        savedProveedor = await updateProveedor(editingProveedor.id, form);
      } else {
        savedProveedor = await createProveedor(form);
      }
      
      if (onSave) {
        await onSave(savedProveedor);
      }
      
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProveedor ? 'Editar Proveedor' : 'Nuevo Proveedor'}
      subtitle="Ingresa los datos del proveedor"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">RUT</label>
            <input
              type="text"
              value={form.rut}
              onChange={e => setForm({ ...form, rut: e.target.value })}
              placeholder="12.345.678-9"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Nombre *</label>
            <input
              required
              type="text"
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre del proveedor"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Razón Social</label>
          <input
            type="text"
            value={form.razon_social}
            onChange={e => setForm({ ...form, razon_social: e.target.value })}
            placeholder="Razón social completa"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Dirección</label>
          <input
            type="text"
            value={form.direccion}
            onChange={e => setForm({ ...form, direccion: e.target.value })}
            placeholder="Dirección del proveedor"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Teléfono</label>
            <input
              type="text"
              value={form.telefono}
              onChange={e => setForm({ ...form, telefono: e.target.value })}
              placeholder="+56 2 1234 5678"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Correo</label>
            <input
              type="email"
              value={form.correo}
              onChange={e => setForm({ ...form, correo: e.target.value })}
              placeholder="correo@proveedor.cl"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Datos de Contacto (A quién acotar)</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Nombre Contacto</label>
              <input
                type="text"
                value={form.contacto_nombre}
                onChange={e => setForm({ ...form, contacto_nombre: e.target.value })}
                placeholder="Nombre de la persona de contacto"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Teléfono Contacto</label>
              <input
                type="text"
                value={form.contacto_telefono}
                onChange={e => setForm({ ...form, contacto_telefono: e.target.value })}
                placeholder="+56 9 1234 5678"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Correo Contacto</label>
            <input
              type="email"
              value={form.contacto_correo}
              onChange={e => setForm({ ...form, contacto_correo: e.target.value })}
              placeholder="contacto@proveedor.cl"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
            Condiciones Comerciales
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Condiciones de Pago</label>
              <input
                type="text"
                value={form.condiciones_pago}
                onChange={e => setForm({ ...form, condiciones_pago: e.target.value })}
                placeholder="Neto 30 días, Contado, etc."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Condición de Despacho</label>
              <input
                type="text"
                value={form.condicion_despacho}
                onChange={e => setForm({ ...form, condicion_despacho: e.target.value })}
                placeholder="Despacho a obra, Retiro en bodega"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Plazo de Entrega</label>
              <input
                type="text"
                value={form.plazo_entrega}
                onChange={e => setForm({ ...form, plazo_entrega: e.target.value })}
                placeholder="5 días hábiles, Inmediato, etc."
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Moneda</label>
              <input
                type="text"
                value={form.moneda}
                onChange={e => setForm({ ...form, moneda: e.target.value })}
                placeholder="CLP, USD, EUR"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition-all hover:bg-amber-600 disabled:opacity-60"
          >
            <Truck size={16} />
            {submitting ? 'Guardando...' : editingProveedor ? 'Actualizar' : 'Crear Proveedor'}
          </button>
        </div>
      </form>
    </Modal>
  );
}