import { Request, Response } from 'express';
import * as proveedorModel from '../models/proveedores.model';

export async function list(_req: Request, res: Response) {
  try {
    const proveedores = await proveedorModel.getAllProveedores(true);
    res.json(proveedores);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const proveedor = await proveedorModel.getProveedorById(id);
    if (!proveedor) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json(proveedor);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
}

export async function create(req: Request, res: Response) {
  const {
    rut, nombre, razon_social, direccion, telefono, correo,
    contacto_nombre, contacto_telefono, contacto_correo,
    condiciones_pago, condicion_despacho, plazo_entrega, moneda,
  } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del proveedor es requerido' });
  }

  try {
    const created = await proveedorModel.createProveedor({
      rut, nombre, razon_social, direccion, telefono, correo,
      contacto_nombre, contacto_telefono, contacto_correo,
      condiciones_pago, condicion_despacho, plazo_entrega, moneda,
    });
    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error al crear proveedor:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un proveedor con ese RUT' });
    }
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const {
    rut, nombre, razon_social, direccion, telefono, correo,
    contacto_nombre, contacto_telefono, contacto_correo, is_active,
    condiciones_pago, condicion_despacho, plazo_entrega, moneda,
  } = req.body;

  try {
    const updated = await proveedorModel.updateProveedor(id, {
      rut, nombre, razon_social, direccion, telefono, correo,
      contacto_nombre, contacto_telefono, contacto_correo, is_active,
      condiciones_pago, condicion_despacho, plazo_entrega, moneda,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error al actualizar proveedor:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe otro proveedor con ese RUT' });
    }
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  try {
    const deleted = await proveedorModel.softDeleteProveedor(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }
    res.json({ message: 'Proveedor desactivado correctamente' });
  } catch (error) {
    console.error('Error al desactivar proveedor:', error);
    res.status(500).json({ error: 'Error al desactivar proveedor' });
  }
}
