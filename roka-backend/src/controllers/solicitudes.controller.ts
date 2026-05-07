import { Request, Response } from 'express';
import * as solicitudModel from '../models/solicitudes.model';
import { crearSolicitudConItems } from '../services/solicitudes.service';

export async function list(req: Request, res: Response) {
  try {
    const { proyecto_id, estado } = req.query;
    const filters: { proyecto_id?: number; estado?: string } = {};

    if (proyecto_id && typeof proyecto_id === 'string') {
      filters.proyecto_id = Number(proyecto_id);
    }

    if (estado && typeof estado === 'string') {
      filters.estado = estado;
    }

    const solicitudes = await solicitudModel.getAllSolicitudes(filters);
    res.json(solicitudes);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const solicitud = await solicitudModel.getSolicitudById(id);
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const items = await solicitudModel.getSolicitudItems(id);
    res.json({ ...solicitud, items });
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({ error: 'Error al obtener solicitud' });
  }
}

export async function create(req: Request, res: Response) {
  const { proyecto_id, solicitante, fecha, fecha_requerida, items } = req.body;

  if (!proyecto_id || !solicitante || !items || items.length === 0) {
    return res
      .status(400)
      .json({ error: 'Faltan campos requeridos (proyecto_id, solicitante, items)' });
  }

  try {
    const result = await crearSolicitudConItems({
      proyecto_id: Number(proyecto_id),
      solicitante,
      fecha: fecha || undefined,
      fecha_requerida: fecha_requerida || null,
      items,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ error: 'Error al crear solicitud' });
  }
}

export async function changeEstado(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const { estado } = req.body;
    if (!['Pendiente', 'Cotizando', 'Aprobado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado invalido' });
    }

    const updated = await solicitudModel.updateSolicitudEstado(id, estado);
    if (!updated) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const deleted = await solicitudModel.deleteSolicitud(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    res.json({ message: 'Solicitud eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({ error: 'Error al eliminar solicitud' });
  }
}
