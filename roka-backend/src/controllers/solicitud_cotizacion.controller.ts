import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as scModel from '../models/solicitud_cotizacion.model';
import { crearSolicitudCotizacion, crearBatchSolicitudesCotizacion, cambiarEstadoSolicitudCotizacion } from '../services/solicitud_cotizacion.service';

export async function list(req: AuthRequest, res: Response) {
  try {
    const { solicitud_id, estado, proveedor, proyecto_id } = req.query;
    const filters: { solicitud_id?: number; estado?: string; proveedor?: string; proyecto_id?: number } = {};
    if (solicitud_id) filters.solicitud_id = Number(solicitud_id);
    if (estado) filters.estado = String(estado);
    if (proveedor) filters.proveedor = String(proveedor);
    if (proyecto_id) filters.proyecto_id = Number(proyecto_id);

    const rows = await scModel.getAllSolicitudesCotizacion(filters);
    res.json(rows);
  } catch (error) {
    console.error('Error al listar solicitudes de cotización:', error);
    res.status(500).json({ error: 'Error al listar solicitudes de cotización' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const sc = await scModel.getSolicitudCotizacionById(Number(id));
    if (!sc) {
      return res.status(404).json({ error: 'Solicitud de cotización no encontrada' });
    }
    const items = await scModel.getSolicitudCotizacionDetalle(Number(id));
    res.json({ ...sc, items });
  } catch (error) {
    console.error('Error al obtener solicitud de cotización:', error);
    res.status(500).json({ error: 'Error al obtener solicitud de cotización' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const sc = await crearSolicitudCotizacion(req.body, req.user?.id || null);
    res.status(201).json(sc);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al crear solicitud de cotización:', error);
    res.status(statusCode).json({ error: error.message || 'Error al crear solicitud de cotización' });
  }
}

export async function createBatch(req: AuthRequest, res: Response) {
  try {
    const results = await crearBatchSolicitudesCotizacion(req.body, req.user?.id || null);
    res.status(201).json(results);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al crear lote de solicitudes de cotización:', error);
    res.status(statusCode).json({ error: error.message || 'Error al crear lote de solicitudes de cotización' });
  }
}

export async function changeEstado(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado) {
      return res.status(400).json({ error: 'Estado requerido' });
    }
    const sc = await cambiarEstadoSolicitudCotizacion(Number(id), estado, req.user?.id || null);
    res.json(sc);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al cambiar estado:', error);
    res.status(statusCode).json({ error: error.message || 'Error al cambiar estado' });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const deleted = await scModel.deleteSolicitudCotizacion(Number(id));
    if (!deleted) {
      return res.status(400).json({ error: 'No se pudo eliminar. Solo se permite en estado Borrador' });
    }
    res.json({ message: 'Solicitud de cotización eliminada' });
  } catch (error) {
    console.error('Error al eliminar solicitud de cotización:', error);
    res.status(500).json({ error: 'Error al eliminar solicitud de cotización' });
  }
}
