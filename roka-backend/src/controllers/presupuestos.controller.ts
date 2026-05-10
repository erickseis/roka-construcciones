import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as presupuestosModel from '../models/presupuestos.model';
import { comprometerPresupuesto } from '../services/presupuestos.service';
import pool from '../db';

export async function list(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await presupuestosModel.getAllPresupuestos();
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function getByProyecto(req: AuthRequest, res: Response) {
  try {
    const { proyectoId } = req.params;
    const presupuesto = await presupuestosModel.getPresupuestoByProyecto(Number(proyectoId));

    if (!presupuesto) {
      return res.status(404).json({ error: 'Presupuesto no encontrado para el proyecto' });
    }

    res.json(presupuesto);
  } catch (error) {
    console.error('Error al obtener presupuesto:', error);
    res.status(500).json({ error: 'Error al obtener presupuesto' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  const { proyecto_id, monto_total, umbral_alerta, estado, categorias } = req.body;

  if (!proyecto_id || !monto_total) {
    return res.status(400).json({ error: 'proyecto_id y monto_total son requeridos' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingId = await presupuestosModel.checkExistingPresupuesto(proyecto_id, client);
    if (existingId) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'El proyecto ya tiene un presupuesto' });
    }

    const presupuesto = await presupuestosModel.createPresupuesto(
      { proyecto_id, monto_total, umbral_alerta, estado, created_by_usuario_id: req.user?.id || null },
      client
    );

    if (Array.isArray(categorias) && categorias.length > 0) {
      const validas = categorias.filter((c: any) => c.nombre && c.monto_asignado);
      const sumCategorias = validas.reduce((acc: number, c: any) => acc + Number(c.monto_asignado), 0);
      if (sumCategorias > Number(monto_total)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `La sumatoria de las categorías ($${sumCategorias.toLocaleString()}) supera el monto total del presupuesto ($${Number(monto_total).toLocaleString()}).` });
      }

      if (validas.length > 0) {
        const placeholders = validas.map((_: any, j: number) => {
          const base = j * 3;
          return `($${base + 1}, $${base + 2}, $${base + 3})`;
        });
        const values = validas.flatMap((c: any) => [presupuesto.id, c.nombre, c.monto_asignado]);
        await client.query(
          `INSERT INTO presupuesto_categorias (presupuesto_id, nombre, monto_asignado)
           VALUES ${placeholders.join(', ')}`,
          values
        );
      }
    }

    await client.query('COMMIT');

    const enriched = await presupuestosModel.getPresupuestoByIdEnriched(presupuesto.id);
    res.status(201).json(enriched || presupuesto);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear presupuesto:', error);
    res.status(500).json({ error: 'Error al crear presupuesto' });
  } finally {
    client.release();
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const updated = await presupuestosModel.updatePresupuesto(Number(id), req.body);

    if (!updated) {
      return res.status(404).json({ error: 'Presupuesto no encontrado' });
    }

    res.json(updated);
  } catch (error: any) {
    if (error.message && error.message.includes('no puede ser menor')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al actualizar presupuesto:', error);
    res.status(500).json({ error: 'Error al actualizar presupuesto' });
  }
}

export async function addCategoria(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const { nombre, monto_asignado } = req.body;

  if (!nombre || !monto_asignado) {
    return res.status(400).json({ error: 'nombre y monto_asignado son requeridos' });
  }

  try {
    const presupuesto = await presupuestosModel.getPresupuestoById(Number(id));
    if (!presupuesto) return res.status(404).json({ error: 'Presupuesto no encontrado' });

    const categoriasActuales = await presupuestosModel.getCategoriasByPresupuesto(Number(id));
    const totalAsignado = categoriasActuales.reduce((acc: number, c: any) => acc + Number(c.monto_asignado), 0);
    const montoNuevo = Number(monto_asignado);

    if (totalAsignado + montoNuevo > Number(presupuesto.monto_total)) {
      return res.status(400).json({ error: `No se puede agregar la categoría. La sumatoria total superaría el presupuesto total del proyecto ($${Number(presupuesto.monto_total).toLocaleString()}).` });
    }

    const categoria = await presupuestosModel.createCategoria({
      presupuesto_id: Number(id),
      nombre,
      monto_asignado: montoNuevo,
    });
    res.status(201).json(categoria);
  } catch (error) {
    console.error('Error al crear categoría presupuestaria:', error);
    res.status(500).json({ error: 'Error al crear categoría presupuestaria' });
  }
}

export async function updateCategoria(req: AuthRequest, res: Response) {
  try {
    const { categoriaId } = req.params;
    const { monto_asignado } = req.body;

    const currentCat = await presupuestosModel.getCategoriaById(Number(categoriaId)); // Need to ensure this exists or use getCategoriasByPresupuesto
    if (!currentCat) return res.status(404).json({ error: 'Categoría no encontrada' });

    if (typeof monto_asignado !== 'undefined') {
      const presupuesto = await presupuestosModel.getPresupuestoById(currentCat.presupuesto_id);
      const categorias = await presupuestosModel.getCategoriasByPresupuesto(currentCat.presupuesto_id);
      const totalOtros = categorias
        .filter((c: any) => c.id !== Number(categoriaId))
        .reduce((acc: number, c: any) => acc + Number(c.monto_asignado), 0);

      if (totalOtros + Number(monto_asignado) > Number(presupuesto!.monto_total)) {
        return res.status(400).json({ error: `El nuevo monto asignado superaría el presupuesto total del proyecto ($${Number(presupuesto!.monto_total).toLocaleString()}).` });
      }
    }

    const updated = await presupuestosModel.updateCategoria(Number(categoriaId), req.body);
    if (!updated) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(updated);
  } catch (error: any) {
    if (error.message && error.message.includes('no puede ser menor')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
}

export async function removeCategoria(req: AuthRequest, res: Response) {
  try {
    const { categoriaId } = req.params;
    const deleted = await presupuestosModel.deleteCategoria(Number(categoriaId));

    if (!deleted) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ message: 'Categoría eliminada' });
  } catch (error: any) {
    if (error.message && error.message.includes('monto comprometido')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
}

export async function alertasListado(_req: AuthRequest, res: Response) {
  try {
    const rows = await presupuestosModel.getAlertasListado();
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener alertas de presupuesto:', error);
    res.status(500).json({ error: 'Error al obtener alertas de presupuesto' });
  }
}

export async function comprometer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await comprometerPresupuesto(req.body, req.user?.id || null);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
