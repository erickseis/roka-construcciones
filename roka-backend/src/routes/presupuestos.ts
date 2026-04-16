import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import {
  createNotifications,
  getActorDisplayName,
  resolveRecipientUserIds,
} from '../lib/notifications';

const router = Router();

// GET /api/presupuestos
router.get('/', authMiddleware, requirePermission('presupuestos.view'), async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        pp.*,
        p.nombre AS proyecto_nombre,
        p.estado AS proyecto_estado,
        COALESCE((pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso,
        (pp.monto_total - pp.monto_comprometido)::numeric AS monto_disponible
      FROM presupuestos_proyecto pp
      JOIN proyectos p ON p.id = pp.proyecto_id
      ORDER BY p.nombre
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al listar presupuestos:', error);
    res.status(500).json({ error: 'Error al listar presupuestos' });
  }
});

// GET /api/presupuestos/proyecto/:proyectoId
router.get('/proyecto/:proyectoId', authMiddleware, requirePermission('presupuestos.view'), async (req: Request, res: Response) => {
  try {
    const { proyectoId } = req.params;

    const { rows: [presupuesto] } = await pool.query(
      `SELECT pp.*, p.nombre AS proyecto_nombre,
              (pp.monto_total - pp.monto_comprometido)::numeric AS monto_disponible,
              COALESCE((pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso
       FROM presupuestos_proyecto pp
       JOIN proyectos p ON p.id = pp.proyecto_id
       WHERE pp.proyecto_id = $1`,
      [proyectoId]
    );

    if (!presupuesto) {
      return res.status(404).json({ error: 'Presupuesto no encontrado para el proyecto' });
    }

    const { rows: categorias } = await pool.query(
      `SELECT
          pc.*,
          (pc.monto_asignado - pc.monto_comprometido)::numeric AS monto_disponible,
          COALESCE((pc.monto_comprometido / NULLIF(pc.monto_asignado, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso
       FROM presupuesto_categorias pc
       WHERE pc.presupuesto_id = $1
       ORDER BY pc.nombre`,
      [presupuesto.id]
    );

    res.json({ ...presupuesto, categorias });
  } catch (error) {
    console.error('Error al obtener presupuesto:', error);
    res.status(500).json({ error: 'Error al obtener presupuesto' });
  }
});

// POST /api/presupuestos
router.post('/', authMiddleware, requirePermission('presupuestos.manage'), async (req: Request, res: Response) => {
  const { proyecto_id, monto_total, umbral_alerta, estado, categorias } = req.body;

  if (!proyecto_id || !monto_total) {
    return res.status(400).json({ error: 'proyecto_id y monto_total son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: existing } = await client.query(
      'SELECT id FROM presupuestos_proyecto WHERE proyecto_id = $1',
      [proyecto_id]
    );

    if (existing.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El proyecto ya tiene un presupuesto' });
    }

    const { rows: [presupuesto] } = await client.query(
      `INSERT INTO presupuestos_proyecto (proyecto_id, monto_total, umbral_alerta, estado)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [proyecto_id, monto_total, umbral_alerta || 80, estado || 'Vigente']
    );

    if (Array.isArray(categorias) && categorias.length > 0) {
      for (const c of categorias) {
        if (!c.nombre || !c.monto_asignado) continue;
        await client.query(
          `INSERT INTO presupuesto_categorias (presupuesto_id, nombre, monto_asignado)
           VALUES ($1, $2, $3)`,
          [presupuesto.id, c.nombre, c.monto_asignado]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(presupuesto);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear presupuesto:', error);
    res.status(500).json({ error: 'Error al crear presupuesto' });
  } finally {
    client.release();
  }
});

// PATCH /api/presupuestos/:id
router.patch('/:id', authMiddleware, requirePermission('presupuestos.manage'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { monto_total, umbral_alerta, estado } = req.body;

  try {
    const { rows: [current] } = await pool.query(
      'SELECT * FROM presupuestos_proyecto WHERE id = $1',
      [id]
    );

    if (!current) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }

    const nextMontoTotal = typeof monto_total !== 'undefined' ? Number(monto_total) : Number(current.monto_total);
    if (nextMontoTotal < Number(current.monto_comprometido)) {
      return res.status(400).json({ error: 'El monto total no puede ser menor al comprometido actual' });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE presupuestos_proyecto
       SET
         monto_total = COALESCE($1, monto_total),
         umbral_alerta = COALESCE($2, umbral_alerta),
         estado = COALESCE($3, estado),
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [monto_total ?? null, umbral_alerta ?? null, estado ?? null, id]
    );

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar presupuesto:', error);
    res.status(500).json({ error: 'Error al actualizar presupuesto' });
  }
});

// POST /api/presupuestos/:id/categorias
router.post('/:id/categorias', authMiddleware, requirePermission('presupuestos.manage'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { nombre, monto_asignado } = req.body;

  if (!nombre || !monto_asignado) {
    return res.status(400).json({ error: 'nombre y monto_asignado son requeridos' });
  }

  try {
    const { rows: [created] } = await pool.query(
      `INSERT INTO presupuesto_categorias (presupuesto_id, nombre, monto_asignado)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, nombre, monto_asignado]
    );

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear categoría presupuestaria:', error);
    res.status(500).json({ error: 'Error al crear categoría presupuestaria' });
  }
});

// PATCH /api/presupuestos/categorias/:categoriaId
router.patch('/categorias/:categoriaId', authMiddleware, requirePermission('presupuestos.manage'), async (req: Request, res: Response) => {
  const { categoriaId } = req.params;
  const { nombre, monto_asignado } = req.body;

  try {
    const { rows: [current] } = await pool.query(
      'SELECT * FROM presupuesto_categorias WHERE id = $1',
      [categoriaId]
    );

    if (!current) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    const nextMontoAsignado = typeof monto_asignado !== 'undefined' ? Number(monto_asignado) : Number(current.monto_asignado);
    if (nextMontoAsignado < Number(current.monto_comprometido)) {
      return res.status(400).json({ error: 'Monto asignado no puede ser menor al comprometido actual' });
    }

    const { rows: [updated] } = await pool.query(
      `UPDATE presupuesto_categorias
       SET
         nombre = COALESCE($1, nombre),
         monto_asignado = COALESCE($2, monto_asignado),
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [nombre ?? null, monto_asignado ?? null, categoriaId]
    );

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

// DELETE /api/presupuestos/categorias/:categoriaId
router.delete('/categorias/:categoriaId', authMiddleware, requirePermission('presupuestos.manage'), async (req: Request, res: Response) => {
  const { categoriaId } = req.params;

  try {
    const { rows: [categoria] } = await pool.query(
      'SELECT * FROM presupuesto_categorias WHERE id = $1',
      [categoriaId]
    );

    if (!categoria) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    if (Number(categoria.monto_comprometido) > 0) {
      return res.status(400).json({ error: 'No se puede eliminar una categoría con monto comprometido' });
    }

    await pool.query('DELETE FROM presupuesto_categorias WHERE id = $1', [categoriaId]);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

// GET /api/presupuestos/alertas
router.get('/alertas/listado', authMiddleware, requirePermission('presupuestos.view'), async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id AS proyecto_id,
        p.nombre AS proyecto_nombre,
        pp.id AS presupuesto_id,
        pp.monto_total,
        pp.monto_comprometido,
        pp.umbral_alerta,
        COALESCE((pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100, 0)::numeric(8,2) AS porcentaje_uso,
        CASE
          WHEN pp.monto_total = 0 THEN 'Sin presupuesto'
          WHEN (pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100 >= 100 THEN 'Sobreconsumo'
          WHEN (pp.monto_comprometido / NULLIF(pp.monto_total, 0)) * 100 >= pp.umbral_alerta THEN 'Umbral alcanzado'
          ELSE 'OK'
        END AS estado_alerta
      FROM presupuestos_proyecto pp
      JOIN proyectos p ON p.id = pp.proyecto_id
      ORDER BY porcentaje_uso DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Error al obtener alertas de presupuesto:', error);
    res.status(500).json({ error: 'Error al obtener alertas de presupuesto' });
  }
});

// POST /api/presupuestos/comprometer
router.post('/comprometer', authMiddleware, requirePermission('presupuestos.manage'), async (req: AuthRequest, res: Response) => {
  const { presupuesto_id, categoria_id, monto, descripcion } = req.body;

  if (!presupuesto_id || !monto) {
    return res.status(400).json({ error: 'presupuesto_id y monto son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [presupuesto] } = await client.query(
      `SELECT pp.*, p.nombre AS proyecto_nombre
       FROM presupuestos_proyecto pp
       JOIN proyectos p ON p.id = pp.proyecto_id
       WHERE pp.id = $1
       FOR UPDATE`,
      [presupuesto_id]
    );

    if (!presupuesto) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }

    const disponible = Number(presupuesto.monto_total) - Number(presupuesto.monto_comprometido);
    const montoTotal = Number(presupuesto.monto_total);
    const comprometidoPrevio = Number(presupuesto.monto_comprometido);
    const comprometidoNuevo = comprometidoPrevio + Number(monto);
    const porcentajePrevio = montoTotal > 0 ? (comprometidoPrevio / montoTotal) * 100 : 0;
    const porcentajeNuevo = montoTotal > 0 ? (comprometidoNuevo / montoTotal) * 100 : 0;
    const umbral = Number(presupuesto.umbral_alerta);
    if (Number(monto) > disponible) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El monto excede el disponible del presupuesto' });
    }

    if (categoria_id) {
      const { rows: [categoria] } = await client.query(
        'SELECT * FROM presupuesto_categorias WHERE id = $1 AND presupuesto_id = $2 FOR UPDATE',
        [categoria_id, presupuesto_id]
      );

      if (!categoria) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Categoría no encontrada para este presupuesto' });
      }

      const disponibleCategoria = Number(categoria.monto_asignado) - Number(categoria.monto_comprometido);
      if (Number(monto) > disponibleCategoria) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'El monto excede el disponible de la categoría' });
      }

      await client.query(
        `UPDATE presupuesto_categorias
         SET monto_comprometido = monto_comprometido + $1, updated_at = NOW()
         WHERE id = $2`,
        [monto, categoria_id]
      );
    }

    await client.query(
      `UPDATE presupuestos_proyecto
       SET monto_comprometido = monto_comprometido + $1, updated_at = NOW()
       WHERE id = $2`,
      [monto, presupuesto_id]
    );

    await client.query(
      `INSERT INTO presupuesto_movimientos (presupuesto_id, categoria_id, tipo, monto, descripcion, created_by)
       VALUES ($1, $2, 'Compromiso', $3, $4, $5)`,
      [presupuesto_id, categoria_id || null, monto, descripcion || 'Compromiso manual de presupuesto', req.user?.id || null]
    );

    const actorId = req.user?.id || null;
    const actorName = actorId ? await getActorDisplayName(actorId, client) : 'Sistema';
    const crossedThreshold = porcentajePrevio < umbral && porcentajeNuevo >= umbral;
    const crossedExceeded = porcentajePrevio < 100 && porcentajeNuevo >= 100;

    if (crossedThreshold || crossedExceeded) {
      const recipients = await resolveRecipientUserIds(
        {
          roleNames: ['Director de Obra', 'Adquisiciones'],
          excludeUserId: actorId,
        },
        client
      );

      const type = crossedExceeded ? 'presupuesto.sobreconsumo' : 'presupuesto.umbral';
      const title = crossedExceeded ? 'Presupuesto excedido' : 'Umbral de presupuesto alcanzado';
      const alertState = crossedExceeded ? 'Sobreconsumo' : 'Umbral alcanzado';

      await createNotifications(
        recipients.map(uid => ({
          usuario_destino_id: uid,
          tipo: type,
          titulo: title,
          mensaje: `${actorName} comprometió presupuesto y el proyecto ${presupuesto.proyecto_nombre} quedó con ${porcentajeNuevo.toFixed(1)}% de uso.`,
          entidad_tipo: 'presupuesto',
          entidad_id: presupuesto.id,
          payload: {
            proyecto_id: presupuesto.proyecto_id,
            porcentaje_uso: Number(porcentajeNuevo.toFixed(2)),
            umbral_alerta: umbral,
            estado_alerta: alertState,
          },
          enviado_por_usuario_id: actorId,
        })),
        client
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Compromiso registrado correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al comprometer presupuesto:', error);
    res.status(500).json({ error: 'Error al comprometer presupuesto' });
  } finally {
    client.release();
  }
});

export default router;
