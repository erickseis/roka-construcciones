import { Request, Response } from 'express';
import * as dashboardModel from '../models/dashboard.model';

export async function solicitudesMensual(_req: Request, res: Response) {
  try {
    const result = await dashboardModel.getSolicitudesMensual();
    res.json(result);
  } catch (error) {
    console.error('Error KPI solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener KPI de solicitudes' });
  }
}

export async function gastoPorProyecto(_req: Request, res: Response) {
  try {
    const result = await dashboardModel.getGastoPorProyecto();
    res.json(result);
  } catch (error) {
    console.error('Error KPI gasto:', error);
    res.status(500).json({ error: 'Error al obtener KPI de gasto' });
  }
}

export async function tiempoConversion(_req: Request, res: Response) {
  try {
    const result = await dashboardModel.getTiempoConversion();
    res.json(result);
  } catch (error) {
    console.error('Error KPI conversion:', error);
    res.status(500).json({ error: 'Error al obtener KPI de conversion' });
  }
}

export async function resumen(_req: Request, res: Response) {
  try {
    const result = await dashboardModel.getResumen();
    res.json(result);
  } catch (error) {
    console.error('Error dashboard resumen:', error);
    res.status(500).json({ error: 'Error al obtener resumen del dashboard' });
  }
}

export async function proyectos(_req: Request, res: Response) {
  try {
    const result = await dashboardModel.getAllProyectosSimple();
    res.json(result);
  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    res.status(500).json({ error: 'Error al obtener proyectos' });
  }
}

export async function solicitudesUrgentes(_req: Request, res: Response) {
  try {
    const result = await dashboardModel.getSolicitudesUrgentes();
    res.json(result);
  } catch (error) {
    console.error('Error solicitudes urgentes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes urgentes' });
  }
}
