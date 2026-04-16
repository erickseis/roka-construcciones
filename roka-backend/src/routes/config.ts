import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';

const router = Router();

// --- Departamentos ---
router.get('/departamentos', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM departamentos ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener departamentos' });
  }
});

router.post('/departamentos', 
  // authMiddleware,
   async (req: Request, res: Response) => {
  const { nombre, descripcion } = req.body;
  try {
    const { rows: [dept] } = await pool.query(
      'INSERT INTO departamentos (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre, descripcion]
    );
    res.status(201).json(dept);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear departamento' });
  }
});

// --- Cargos ---
router.get('/cargos', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, d.nombre as departamento_nombre 
      FROM cargos c
      JOIN departamentos d ON d.id = c.departamento_id
      ORDER BY c.nombre
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cargos' });
  }
});

router.post('/cargos',
  
  // authMiddleware,
  
  async (req: Request, res: Response) => {
  const { nombre, departamento_id } = req.body;
  try {
    const { rows: [cargo] } = await pool.query(
      'INSERT INTO cargos (nombre, departamento_id) VALUES ($1, $2) RETURNING *',
      [nombre, departamento_id]
    );
    res.status(201).json(cargo);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear cargo' });
  }
});

// --- Roles ---
router.get('/roles', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM roles ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener roles' });
  }
});

// --- Permisos por Rol ---
router.get('/permisos', authMiddleware, requirePermission('config.manage'), async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM permisos ORDER BY codigo');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener permisos' });
  }
});

router.get('/roles/:id/permisos', authMiddleware, requirePermission('config.manage'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT p.codigo
       FROM rol_permisos rp
       JOIN permisos p ON p.id = rp.permiso_id
       WHERE rp.rol_id = $1
       ORDER BY p.codigo`,
      [id]
    );

    res.json(rows.map(r => r.codigo));
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener permisos del rol' });
  }
});

router.put('/roles/:id/permisos', authMiddleware, requirePermission('config.manage'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { codigos } = req.body;

  if (!Array.isArray(codigos)) {
    return res.status(400).json({ error: 'codigos debe ser un arreglo de strings' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM rol_permisos WHERE rol_id = $1', [id]);

    if (codigos.length > 0) {
      const { rows: permisos } = await client.query(
        'SELECT id, codigo FROM permisos WHERE codigo = ANY($1::text[])',
        [codigos]
      );

      for (const permiso of permisos) {
        await client.query(
          'INSERT INTO rol_permisos (rol_id, permiso_id) VALUES ($1, $2)',
          [id, permiso.id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Permisos del rol actualizados correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al actualizar permisos del rol' });
  } finally {
    client.release();
  }
});

export default router;
