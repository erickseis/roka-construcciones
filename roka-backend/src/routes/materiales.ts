import { Router, Request, Response } from 'express';
import pool from '../db';

const router = Router();

// ================================================
// UNIDADES DE MEDIDA
// ================================================

// GET /api/materiales/unidades — Listar unidades de medida
router.get('/unidades', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM unidades_medida ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener unidades:', error);
    res.status(500).json({ error: 'Error al obtener unidades de medida' });
  }
});

// POST /api/materiales/unidades — Crear unidad de medida
router.post('/unidades', async (req: Request, res: Response) => {
  const { nombre, abreviatura } = req.body;
  if (!nombre || !abreviatura) {
    return res.status(400).json({ error: 'Nombre y abreviatura son requeridos' });
  }
  try {
    const { rows: [nueva] } = await pool.query(
      'INSERT INTO unidades_medida (nombre, abreviatura) VALUES ($1, $2) RETURNING *',
      [nombre, abreviatura]
    );
    res.status(201).json(nueva);
  } catch (error: any) {
    console.error('Error al crear unidad:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe una unidad con ese nombre o abreviatura' });
    res.status(500).json({ error: 'Error al crear unidad de medida' });
  }
});

// PUT /api/materiales/unidades/:id — Actualizar unidad de medida
router.put('/unidades/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, abreviatura } = req.body;
  try {
    const { rows: [actualizada] } = await pool.query(
      'UPDATE unidades_medida SET nombre = $1, abreviatura = $2 WHERE id = $3 RETURNING *',
      [nombre, abreviatura, id]
    );
    if (!actualizada) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json(actualizada);
  } catch (error: any) {
    console.error('Error al actualizar unidad:', error);
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe otra unidad con ese nombre o abreviatura' });
    res.status(500).json({ error: 'Error al actualizar unidad de medida' });
  }
});

// DELETE /api/materiales/unidades/:id — Eliminar unidad de medida
router.delete('/unidades/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Verificar si está siendo usada por algún material
    const { rows: [uso] } = await pool.query('SELECT id FROM materiales WHERE unidad_medida_id = $1 LIMIT 1', [id]);
    if (uso) {
      return res.status(400).json({ error: 'No se puede eliminar la unidad porque está siendo usada por materiales' });
    }
    const { rowCount } = await pool.query('DELETE FROM unidades_medida WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Unidad no encontrada' });
    res.json({ message: 'Unidad eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar unidad:', error);
    res.status(500).json({ error: 'Error al eliminar unidad de medida' });
  }
});

// ================================================
// CATEGORIAS DE MATERIALES
// ================================================

// GET /api/materiales/categorias — Listar categorías
router.get('/categorias', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT * FROM material_categorias ORDER BY nombre');
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// POST /api/materiales/categorias — Crear categoría
router.post('/categorias', async (req: Request, res: Response) => {
  const { nombre, descripcion } = req.body;
  if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
  try {
    const { rows: [cat] } = await pool.query(
      'INSERT INTO material_categorias (nombre, descripcion) VALUES ($1, $2) RETURNING *',
      [nombre, descripcion]
    );
    res.status(201).json(cat);
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

// PUT /api/materiales/categorias/:id — Actualizar categoría
router.put('/categorias/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;
  try {
    const { rows: [updated] } = await pool.query(
      'UPDATE material_categorias SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *',
      [nombre, descripcion, id]
    );
    if (!updated) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

// DELETE /api/materiales/categorias/:id — Eliminar categoría
router.delete('/categorias/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Verificar si hay materiales asociados
    const { rows: [hasMaterials] } = await pool.query('SELECT id FROM materiales WHERE categoria_id = $1 LIMIT 1', [id]);
    if (hasMaterials) {
      return res.status(400).json({ error: 'No se puede eliminar la categoría porque tiene materiales asociados' });
    }
    const { rowCount } = await pool.query('DELETE FROM material_categorias WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json({ message: 'Categoría eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

// GET /api/materiales/solicitados — Listar todos los ítems solicitados con info de proyecto
router.get('/solicitados', async (req: Request, res: Response) => {
  try {
    const { query } = req;
    const q = query.q;
    const proyecto_id = query.proyecto_id;

    let sql = `
      SELECT si.*, sm.proyecto_id, p.nombre AS proyecto_nombre, 
             sm.solicitante, sm.fecha, sm.estado
      FROM solicitud_items si
      JOIN solicitudes_material sm ON sm.id = si.solicitud_id
      JOIN proyectos p ON p.id = sm.proyecto_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (proyecto_id) {
      params.push(proyecto_id);
      sql += ` AND sm.proyecto_id = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND si.nombre_material ILIKE $${params.length}`;
    }

    sql += ' ORDER BY sm.fecha DESC, si.id DESC';

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener materiales solicitados:', error);
    res.status(500).json({ error: 'Error al obtener materiales solicitados' });
  }
});

// ================================================
// MATERIALES (Maestro)
// ================================================

// GET /api/materiales — Listar todos los materiales (con su unidad)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { categoria, categoria_id, q } = req.query;
    let query = `
      SELECT m.*, u.nombre AS unidad_nombre, u.abreviatura AS unidad_abreviatura, 
             mc.nombre AS categoria_nombre
      FROM materiales m
      LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
      LEFT JOIN material_categorias mc ON mc.id = m.categoria_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (categoria_id) {
      params.push(categoria_id);
      query += ` AND m.categoria_id = $${params.length}`;
    } else if (categoria) {
      params.push(categoria);
      query += ` AND m.categoria = $${params.length}`;
    }

    if (q) {
      params.push(`%${q}%`);
      query += ` AND (m.nombre ILIKE $${params.length} OR m.sku ILIKE $${params.length})`;
    }

    query += ' ORDER BY m.nombre ASC';

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener materiales:', error);
    res.status(500).json({ error: 'Error al obtener materiales' });
  }
});

// GET /api/materiales/:id — Detalle de material
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rows: [material] } = await pool.query(`
      SELECT m.*, u.nombre AS unidad_nombre, u.abreviatura AS unidad_abreviatura,
             mc.nombre AS categoria_nombre
      FROM materiales m
      LEFT JOIN unidades_medida u ON u.id = m.unidad_medida_id
      LEFT JOIN material_categorias mc ON mc.id = m.categoria_id
      WHERE m.id = $1
    `, [id]);

    if (!material) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }

    res.json(material);
  } catch (error) {
    console.error('Error al obtener material:', error);
    res.status(500).json({ error: 'Error al obtener material' });
  }
});

// POST /api/materiales — Crear nuevo material
router.post('/', async (req: Request, res: Response) => {
  const { sku, nombre, descripcion, unidad_medida_id, categoria_id, categoria, precio_referencial } = req.body;

  if (!nombre || !unidad_medida_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos (nombre, unidad_medida_id)' });
  }

  try {
    const { rows: [inserted] } = await pool.query(
      `INSERT INTO materiales (sku, nombre, descripcion, unidad_medida_id, categoria_id, categoria, precio_referencial)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sku, nombre, descripcion, unidad_medida_id, categoria_id || null, categoria, precio_referencial]
    );

    res.status(201).json(inserted);
  } catch (error: any) {
    console.error('Error al crear material:', error);
    if (error.code === '23505') { // Unique violation for SKU
      return res.status(409).json({ error: 'Ya existe un material con ese SKU' });
    }
    res.status(500).json({ error: 'Error al crear material' });
  }
});

// PUT /api/materiales/:id — Actualizar material
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sku, nombre, descripcion, unidad_medida_id, categoria_id, categoria, precio_referencial, is_active } = req.body;

  try {
    const { rows: [updated] } = await pool.query(
      `UPDATE materiales 
       SET sku = $1, nombre = $2, descripcion = $3, unidad_medida_id = $4, 
           categoria_id = $5, categoria = $6, precio_referencial = $7, is_active = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [sku, nombre, descripcion, unidad_medida_id, categoria_id || null, categoria, precio_referencial, is_active, id]
    );

    if (!updated) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }

    res.json(updated);
  } catch (error: any) {
    console.error('Error al actualizar material:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Ya existe otro material con ese SKU' });
    }
    res.status(500).json({ error: 'Error al actualizar material' });
  }
});

// DELETE /api/materiales/:id — Eliminar material
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Verificar si está siendo usado (traceabilidad)
    const { rows: [usage] } = await pool.query('SELECT id FROM solicitud_items WHERE material_id = $1 LIMIT 1', [id]);
    
    if (usage) {
      return res.status(409).json({ 
        error: 'No se puede eliminar el material porque ya está siendo usado en solicitudes de material. Considere desactivarlo.' 
      });
    }

    const { rowCount } = await pool.query('DELETE FROM materiales WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Material no encontrado' });
    }
    res.json({ message: 'Material eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar material:', error);
    res.status(500).json({ error: 'Error al eliminar material' });
  }
});

export default router;
