import { Request, Response } from 'express';
import * as materialModel from '../models/materiales.model';

// ================================================
// Unidades de Medida
// ================================================

export const unidades = {
  async list(_req: Request, res: Response) {
    try {
      const result = await materialModel.getAllUnidades();
      res.json(result);
    } catch (error) {
      console.error('Error al obtener unidades:', error);
      res.status(500).json({ error: 'Error al obtener unidades de medida' });
    }
  },

  async create(req: Request, res: Response) {
    const { nombre, abreviatura } = req.body;
    if (!nombre || !abreviatura) {
      return res.status(400).json({ error: 'Nombre y abreviatura son requeridos' });
    }
    try {
      const nueva = await materialModel.createUnidad(nombre, abreviatura);
      res.status(201).json(nueva);
    } catch (error: any) {
      console.error('Error al crear unidad:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe una unidad con ese nombre o abreviatura' });
      }
      res.status(500).json({ error: 'Error al crear unidad de medida' });
    }
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const { nombre, abreviatura } = req.body;
    try {
      const actualizada = await materialModel.updateUnidad(id, nombre, abreviatura);
      if (!actualizada) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }
      res.json(actualizada);
    } catch (error: any) {
      console.error('Error al actualizar unidad:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe otra unidad con ese nombre o abreviatura' });
      }
      res.status(500).json({ error: 'Error al actualizar unidad de medida' });
    }
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    try {
      const result = await materialModel.deleteUnidad(id);
      if (result.used) {
        return res.status(400).json({
          error: 'No se puede eliminar la unidad porque esta siendo usada por materiales',
        });
      }
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Unidad no encontrada' });
      }
      res.json({ message: 'Unidad eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar unidad:', error);
      res.status(500).json({ error: 'Error al eliminar unidad de medida' });
    }
  },
};

// ================================================
// Categorias de Materiales
// ================================================

export const categorias = {
  async list(_req: Request, res: Response) {
    try {
      const result = await materialModel.getAllCategorias();
      res.json(result);
    } catch (error) {
      console.error('Error al obtener categorias:', error);
      res.status(500).json({ error: 'Error al obtener categorias' });
    }
  },

  async create(req: Request, res: Response) {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    try {
      const cat = await materialModel.createCategoria(nombre, descripcion);
      res.status(201).json(cat);
    } catch (error) {
      console.error('Error al crear categoria:', error);
      res.status(500).json({ error: 'Error al crear categoria' });
    }
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const { nombre, descripcion } = req.body;
    try {
      const updated = await materialModel.updateCategoria(id, nombre, descripcion);
      if (!updated) {
        return res.status(404).json({ error: 'Categoria no encontrada' });
      }
      res.json(updated);
    } catch (error) {
      console.error('Error al actualizar categoria:', error);
      res.status(500).json({ error: 'Error al actualizar categoria' });
    }
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    try {
      const result = await materialModel.deleteCategoria(id);
      if (result.used) {
        return res.status(400).json({
          error: 'No se puede eliminar la categoria porque tiene materiales asociados',
        });
      }
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Categoria no encontrada' });
      }
      res.json({ message: 'Categoria eliminada exitosamente' });
    } catch (error) {
      console.error('Error al eliminar categoria:', error);
      res.status(500).json({ error: 'Error al eliminar categoria' });
    }
  },
};

// ================================================
// Materiales Solicitados
// ================================================

export const solicitados = {
  async list(req: Request, res: Response) {
    try {
      const q = req.query.q as string | undefined;
      const proyecto_id = req.query.proyecto_id ? Number(req.query.proyecto_id) : undefined;
      const result = await materialModel.getAllMaterialesSolicitados(q, proyecto_id);
      res.json(result);
    } catch (error) {
      console.error('Error al obtener materiales solicitados:', error);
      res.status(500).json({ error: 'Error al obtener materiales solicitados' });
    }
  },
};

// ================================================
// Materiales (Maestro)
// ================================================

export const materiales = {
  async list(req: Request, res: Response) {
    try {
      const { categoria, q } = req.query;
      const categoria_id = req.query.categoria_id ? Number(req.query.categoria_id) : undefined;
      const result = await materialModel.getAllMateriales({
        categoria: categoria as string | undefined,
        categoria_id,
        q: q as string | undefined,
      });
      res.json(result);
    } catch (error) {
      console.error('Error al obtener materiales:', error);
      res.status(500).json({ error: 'Error al obtener materiales' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const material = await materialModel.getMaterialById(id);
      if (!material) {
        return res.status(404).json({ error: 'Material no encontrado' });
      }
      res.json(material);
    } catch (error) {
      console.error('Error al obtener material:', error);
      res.status(500).json({ error: 'Error al obtener material' });
    }
  },

  async create(req: Request, res: Response) {
    const { sku, nombre, descripcion, unidad_medida_id, categoria_id, categoria, precio_referencial } = req.body;

    if (!nombre || !unidad_medida_id) {
      return res.status(400).json({ error: 'Faltan campos requeridos (nombre, unidad_medida_id)' });
    }

    try {
      const inserted = await materialModel.createMaterial({
        sku, nombre, descripcion, unidad_medida_id,
        categoria_id, categoria, precio_referencial,
      });
      res.status(201).json(inserted);
    } catch (error: any) {
      console.error('Error al crear material:', error);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Ya existe un material con ese SKU' });
      }
      res.status(500).json({ error: 'Error al crear material' });
    }
  },

  async update(req: Request, res: Response) {
    const id = Number(req.params.id);
    const { sku, nombre, descripcion, unidad_medida_id, categoria_id, categoria, precio_referencial, is_active } = req.body;

    try {
      const updated = await materialModel.updateMaterial(id, {
        sku, nombre, descripcion, unidad_medida_id,
        categoria_id, categoria, precio_referencial, is_active,
      });
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
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    try {
      const result = await materialModel.deleteMaterial(id);
      if (result.used) {
        return res.status(409).json({
          error: 'No se puede eliminar el material porque ya esta siendo usado en solicitudes de material. Considere desactivarlo.',
        });
      }
      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Material no encontrado' });
      }
      res.json({ message: 'Material eliminado exitosamente' });
    } catch (error) {
      console.error('Error al eliminar material:', error);
      res.status(500).json({ error: 'Error al eliminar material' });
    }
  },
};
