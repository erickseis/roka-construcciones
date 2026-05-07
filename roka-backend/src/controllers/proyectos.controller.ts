import { Request, Response } from 'express';
import * as proyectoModel from '../models/proyectos.model';
import { importMaterialesFromExcel } from '../services/materialesImport.service';
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
    mandante, moneda, procesar_materiales, plazo_ejecucion_dias,
  } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre del proyecto es requerido' });
  }

  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const licitacionFile = files?.['archivo_licitacion']?.[0];
    const materialesFile = files?.['archivo_materiales']?.[0];

    const archivo_licitacion_path = licitacionFile ? `uploads/licitaciones/${licitacionFile.filename}` : null;
    const archivo_licitacion_nombre = licitacionFile ? licitacionFile.originalname : null;
    const archivo_materiales_path = materialesFile ? `uploads/materiales/${materialesFile.filename}` : null;
    const archivo_materiales_nombre = materialesFile ? materialesFile.originalname : null;

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
      archivo_materiales_path,
      archivo_materiales_nombre,
      mandante: mandante || null,
      moneda: moneda || 'CLP',
      plazo_ejecucion_dias: plazo_ejecucion_dias ? Number(plazo_ejecucion_dias) : null,
    });

    if (procesar_materiales === 'true' && archivo_materiales_path) {
      try {
        const solicitante = req.body.solicitante || 'Importación automática';
        await importMaterialesFromExcel(created.id, solicitante);
      } catch (importErr) {
        console.error('Error al importar materiales:', importErr);
      }
    }

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
    mandante, moneda, plazo_ejecucion_dias,
  } = req.body;

  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const licitacionFile = files?.['archivo_licitacion']?.[0];
    const materialesFile = files?.['archivo_materiales']?.[0];

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
      mandante: mandante || null,
      moneda: moneda || null,
      plazo_ejecucion_dias: plazo_ejecucion_dias ? Number(plazo_ejecucion_dias) : null,
    };

    // Only include archivo fields if files were uploaded
    if (licitacionFile) {
      data.archivo_licitacion_path = `uploads/licitaciones/${licitacionFile.filename}`;
      data.archivo_licitacion_nombre = licitacionFile.originalname;
    }
    if (materialesFile) {
      data.archivo_materiales_path = `uploads/materiales/${materialesFile.filename}`;
      data.archivo_materiales_nombre = materialesFile.originalname;
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

export async function procesarMateriales(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID invalido' });
    }

    const { solicitante } = req.body;
    if (!solicitante) {
      return res.status(400).json({ error: 'El nombre del solicitante es requerido' });
    }

    const result = await importMaterialesFromExcel(id, solicitante);
    res.json(result);
  } catch (error: any) {
    console.error('Error al procesar materiales:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ error: error.message || 'Error al procesar materiales' });
  }
}
