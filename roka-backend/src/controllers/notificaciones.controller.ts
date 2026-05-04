import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as notificacionModel from '../models/notificaciones.model';

export async function list(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const soloNoLeidas = req.query.solo_no_leidas === 'true';
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const notificaciones = await notificacionModel.getAllNotificaciones(
      userId, soloNoLeidas, limit, offset
    );
    res.json(notificaciones);
  } catch (error) {
    console.error('Error al listar notificaciones:', error);
    res.status(500).json({ error: 'Error al listar notificaciones' });
  }
}

export async function unreadCount(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const result = await notificacionModel.getUnreadCount(userId);
    res.json(result);
  } catch (error) {
    console.error('Error al obtener contador de no leidas:', error);
    res.status(500).json({ error: 'Error al obtener contador de no leidas' });
  }
}

export async function markLeida(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const id = Number(req.params.id);
    const leida = typeof req.body?.leida === 'boolean' ? req.body.leida : true;

    const updated = await notificacionModel.markAsLeida(id, userId, leida);
    if (!updated) {
      return res.status(404).json({ error: 'Notificacion no encontrada' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar notificacion:', error);
    res.status(500).json({ error: 'Error al actualizar notificacion' });
  }
}

export async function marcarTodasLeidas(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const updated = await notificacionModel.marcarTodasLeidas(userId);
    res.json({ updated });
  } catch (error) {
    console.error('Error al marcar notificaciones:', error);
    res.status(500).json({ error: 'Error al marcar notificaciones' });
  }
}
