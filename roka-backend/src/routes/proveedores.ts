import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// GET /api/proveedores — Listar todos los proveedores
router.get('/', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT * FROM proveedores 
      WHERE is_active = true 
      ORDER BY nombre ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// GET /api/proveedores/:id — Detalle de proveedor
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rows: [proveedor] } = await pool.query(
      'SELECT * FROM proveedores WHERE id = $1',
      [id]
    );

    if (!proveedor) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json(proveedor);
  } catch (error) {
    console.error('Error al obtener proveedor:', error);
    res.status(500).json({ error: 'Error al obtener proveedor' });
  }
});

// POST /api/proveedores — Crear proveedor
router.post('/', async (req: Request, res: Response) => {
  const { 
    rut, nombre, razon_social, direccion, telefono, correo,
    contacto_nombre, contacto_telefono, contacto_correo 
  } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del proveedor es requerido' });
  }

  try {
    const { rows: [created] } = await pool.query(
      `INSERT INTO proveedores (
        rut, nombre, razon_social, direccion, telefono, correo,
        contacto_nombre, contacto_telefono, contacto_correo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [rut || null, nombre, razon_social || null, direccion || null, telefono || null, correo || null,
       contacto_nombre || null, contacto_telefono || null, contacto_correo || null]
    );

    res.status(201).json(created);
  } catch (error: any) {
    console.error('Error al crear proveedor:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe un proveedor con ese RUT' });
    }
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

// PUT /api/proveedores/:id — Actualizar proveedor
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    rut, nombre, razon_social, direccion, telefono, correo,
    contacto_nombre, contacto_telefono, contacto_correo, is_active
  } = req.body;

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE proveedores 
       SET rut = $1, nombre = $2, razon_social = $3, direccion = $4, 
           telefono = $5, correo = $6, contacto_nombre = $7, 
           contacto_telefono = $8, contacto_correo = $9, is_active = $10,
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [rut || null, nombre, razon_social || null, direccion || null, telefono || null, correo || null,
       contacto_nombre || null, contacto_telefono || null, contacto_correo || null, 
       is_active ?? true, id]
    );

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
});

// DELETE /api/proveedores/:id — Desactivar proveedor (soft delete)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rowCount } = await pool.query(
      'UPDATE proveedores SET is_active = false, updated_at = NOW() WHERE id = $1',
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json({ message: 'Proveedor desactivado correctamente' });
  } catch (error) {
    console.error('Error al desactivar proveedor:', error);
    res.status(500).json({ error: 'Error al desactivar proveedor' });
  }
});

export default router;