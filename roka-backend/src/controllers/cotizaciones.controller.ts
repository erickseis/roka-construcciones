import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import * as cotizacionesModel from '../models/cotizaciones.model';
import {
  crearCotizacion,
  aprobarCotizacion,
  rechazarCotizacion,
} from '../services/cotizaciones.service';

export async function list(req: AuthRequest, res: Response) {
  try {
    const { solicitud_id, estado, solicitud_cotizacion_id } = req.query;
    const filters: { solicitud_id?: number; estado?: string; solicitud_cotizacion_id?: number } = {};
    if (solicitud_id) filters.solicitud_id = Number(solicitud_id);
    if (estado) filters.estado = String(estado);
    if (solicitud_cotizacion_id) filters.solicitud_cotizacion_id = Number(solicitud_cotizacion_id);

    const rows = await cotizacionesModel.getAllCotizaciones(filters);
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener cotizaciones:', error);
    res.status(500).json({ error: 'Error al obtener cotizaciones' });
  }
}

export async function getById(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const cotizacion = await cotizacionesModel.getCotizacionById(Number(id));

    if (!cotizacion) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }

    const items = await cotizacionesModel.getCotizacionItems(Number(id));
    res.json({ ...cotizacion, items });
  } catch (error) {
    console.error('Error al obtener cotización:', error);
    res.status(500).json({ error: 'Error al obtener cotización' });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const cotizacion = await crearCotizacion(req.body, req.user?.id || null);
    res.status(201).json(cotizacion);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al crear cotización:', error);
    res.status(statusCode).json({ error: error.message || 'Error al crear cotización' });
  }
}

export async function approve(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const cotizacion = await aprobarCotizacion(Number(id), req.user?.id || null);
    res.json(cotizacion);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al aprobar cotización:', error);
    res.status(statusCode).json({ error: error.message || 'Error al aprobar cotización' });
  }
}

export async function reject(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const cotizacion = await rechazarCotizacion(Number(id), req.user?.id || null);
    res.json(cotizacion);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    console.error('Error al rechazar cotización:', error);
    res.status(statusCode).json({ error: error.message || 'Error al rechazar cotización' });
  }
}

export async function uploadArchivo(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'Archivo no proporcionado' });
    }
    const cotizacion = await cotizacionesModel.updateCotizacionArchivo(
      Number(id),
      req.file.path,
      req.file.originalname
    );
    if (!cotizacion) {
      return res.status(404).json({ error: 'Cotización no encontrada' });
    }
    res.json(cotizacion);
  } catch (error) {
    console.error('Error al subir archivo adjunto:', error);
    res.status(500).json({ error: 'Error al subir archivo adjunto' });
  }
}
