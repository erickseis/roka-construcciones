import { Request, Response } from 'express';
import * as configModel from '../models/config.model';

// ================================================
// Departamentos
// ================================================

export const departamentos = {
  async list(_req: Request, res: Response) {
    try {
      const result = await configModel.getAllDepartamentos();
      res.json(result);
    } catch (error) {
      console.error('Error al obtener departamentos:', error);
      res.status(500).json({ error: 'Error al obtener departamentos' });
    }
  },

  async create(req: Request, res: Response) {
    const { nombre, descripcion } = req.body;
    try {
      const dept = await configModel.createDepartamento(nombre, descripcion);
      res.status(201).json(dept);
    } catch (error) {
      console.error('Error al crear departamento:', error);
      res.status(500).json({ error: 'Error al crear departamento' });
    }
  },
};

// ================================================
// Cargos
// ================================================

export const cargos = {
  async list(_req: Request, res: Response) {
    try {
      const result = await configModel.getAllCargos();
      res.json(result);
    } catch (error) {
      console.error('Error al obtener cargos:', error);
      res.status(500).json({ error: 'Error al obtener cargos' });
    }
  },

  async create(req: Request, res: Response) {
    const { nombre, departamento_id } = req.body;
    try {
      const cargo = await configModel.createCargo(nombre, departamento_id);
      res.status(201).json(cargo);
    } catch (error) {
      console.error('Error al crear cargo:', error);
      res.status(500).json({ error: 'Error al crear cargo' });
    }
  },
};

// ================================================
// Roles
// ================================================

export const roles = {
  async list(_req: Request, res: Response) {
    try {
      const result = await configModel.getAllRoles();
      res.json(result);
    } catch (error) {
      console.error('Error al obtener roles:', error);
      res.status(500).json({ error: 'Error al obtener roles' });
    }
  },

  async getPermisos(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await configModel.getPermisosByRol(Number(id));
      res.json(result);
    } catch (error) {
      console.error('Error al obtener permisos del rol:', error);
      res.status(500).json({ error: 'Error al obtener permisos del rol' });
    }
  },

  async updatePermisos(req: Request, res: Response) {
    const { id } = req.params;
    const { codigos } = req.body;

    if (!Array.isArray(codigos)) {
      return res.status(400).json({ error: 'codigos debe ser un arreglo de strings' });
    }

    try {
      await configModel.updatePermisosByRol(Number(id), codigos);
      res.json({ message: 'Permisos del rol actualizados correctamente' });
    } catch (error) {
      console.error('Error al actualizar permisos del rol:', error);
      res.status(500).json({ error: 'Error al actualizar permisos del rol' });
    }
  },
};

// ================================================
// Permisos
// ================================================

export const permisos = {
  async list(_req: Request, res: Response) {
    try {
      const result = await configModel.getAllPermisos();
      res.json(result);
    } catch (error) {
      console.error('Error al obtener permisos:', error);
      res.status(500).json({ error: 'Error al obtener permisos' });
    }
  },
};
