import { Request, Response } from 'express';
import * as proyectoModel from '../models/proyectos.model';
import path from 'path';

export async function list(req: Request, res: Response) {
  try {
    const { estado, is_active } = req.query;
    const filters: { estado?: string; is_active?: boolean } = {};

    if (estado && typeof estado === 'string') {
      filters.estado = estado;
    }

    if (typeof is_active !== 'undefined') {
      filters.is_active = is_active === 'true';
    }

    const proyectos = await proyectoModel.getAllProyectos(filters);
    res.json(proyectos);
  } catch (error) {
    console.error('Error al listar proyectos:', error);
    res.status(500).json({ error: 'Error al listar proyectos' });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const proyecto = await proyectoModel.getProyectoById(id);
    if (!proyecto) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    const [resumenPresupuesto, metricas] = await Promise.all([
      proyectoModel.getResumenPresupuesto(id),
      proyectoModel.getMetricasProyecto(id),
    ]);

    res.json({ ...proyecto, resumen_presupuesto: resumenPresupuesto, metricas });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    res.status(500).json({ error: 'Error al obtener proyecto' });
  }
}

export async function create(req: Request, res: Response) {
  const {
    nombre, ubicacion, estado, fecha_inicio, fecha_fin,
    responsable_usuario_id, numero_licitacion, descripcion_licitacion,
    fecha_apertura_licitacion, monto_referencial_licitacion,
  } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
  }

  try {
    const archivo_licitacion_path = req.file ? `uploads/licitaciones/${req.file.filename}` : null;
    const archivo_licitacion_nombre = req.file ? req.file.originalname : null;

    const created = await proyectoModel.createProyecto({
      nombre,
      ubicacion: ubicacion || null,
      estado: estado || 'Planificacion',
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      responsable_usuario_id: responsable_usuario_id ? Number(responsable_usuario_id) : null,
      numero_licitacion: numero_licitacion || null,
      descripcion_licitacion: descripcion_licitacion || null,
      fecha_apertura_licitacion: fecha_apertura_licitacion || null,
      monto_referencial_licitacion: monto_referencial_licitacion ? Number(monto_referencial_licitacion) : null,
      archivo_licitacion_path,
      archivo_licitacion_nombre,
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear proyecto:', error);
    res.status(500).json({ error: 'Error al crear proyecto' });
  }
}

export async function update(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  const {
    nombre, ubicacion, estado, fecha_inicio, fecha_fin,
    responsable_usuario_id, numero_licitacion, descripcion_licitacion,
    fecha_apertura_licitacion, monto_referencial_licitacion,
  } = req.body;

  try {
    let archivo_licitacion_path: string | null = null;
    let archivo_licitacion_nombre: string | null = null;

    if (req.file) {
      archivo_licitacion_path = `uploads/licitaciones/${req.file.filename}`;
      archivo_licitacion_nombre = req.file.originalname;
    }

    const data: Record<string, any> = {
      nombre: nombre || null,
      ubicacion: ubicacion || null,
      estado: estado || null,
      fecha_inicio: fecha_inicio || null,
      fecha_fin: fecha_fin || null,
      responsable_usuario_id: responsable_usuario_id ? Number(responsable_usuario_id) : null,
      numero_licitacion: numero_licitacion || null,
      descripcion_licitacion: descripcion_licitacion || null,
      fecha_apertura_licitacion: fecha_apertura_licitacion || null,
      monto_referencial_licitacion: monto_referencial_licitacion ? Number(monto_referencial_licitacion) : null,
    };

    // Only include archivo fields if a file was uploaded
    if (req.file) {
      data.archivo_licitacion_path = archivo_licitacion_path;
      data.archivo_licitacion_nombre = archivo_licitacion_nombre;
    }

    const updated = await proyectoModel.updateProyecto(id, data);
    if (!updated) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar proyecto:', error);
    res.status(500).json({ error: 'Error al actualizar proyecto' });
  }
}

export async function toggleActive(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'ID invalido' });
  }

  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ error: 'is_active debe ser booleano' });
  }

  try {
    const updated = await proyectoModel.toggleActive(id, is_active);
    if (!updated) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error al cambiar estado del proyecto:', error);
    res.status(500).json({ error: 'Error al cambiar estado del proyecto' });
  }
}

export async function downloadLicitacion(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const archivo = await proyectoModel.getLicitacionArchivo(id);
    if (!archivo || !archivo.archivo_licitacion_path) {
      return res.status(404).json({ error: 'Archivo de licitacion no encontrado' });
    }

    const filePath = path.join(process.cwd(), archivo.archivo_licitacion_path);
    res.download(filePath, archivo.archivo_licitacion_nombre || undefined);
  } catch (error) {
    console.error('Error al descargar archivo de licitacion:', error);
    res.status(500).json({ error: 'Error al descargar archivo' });
  }
}
