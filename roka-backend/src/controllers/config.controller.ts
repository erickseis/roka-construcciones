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

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nombre, descripcion } = req.body;
      if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

      const updated = await configModel.updateDepartamento(id, nombre, descripcion || null);
      if (!updated) return res.status(404).json({ error: 'Departamento no encontrado' });
      res.json(updated);
    } catch (error) {
      console.error('Error al actualizar departamento:', error);
      res.status(500).json({ error: 'Error al actualizar departamento' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { migrar_a_id } = req.body;

      const usuariosAfectados = await configModel.getUserCountByDepartamento(id);

      if (usuariosAfectados > 0 && !migrar_a_id) {
        const disponibles = await configModel.getAvailableDepartamentos(id);
        return res.json({
          necesita_migracion: true,
          usuarios_afectados: usuariosAfectados,
          disponibles,
        });
      }

      if (usuariosAfectados > 0 && migrar_a_id) {
        const migrados = await configModel.migrateUsersDepartamento(id, migrar_a_id);
        await configModel.deleteDepartamento(id);
        return res.json({
          message: `Departamento eliminado. ${migrados} usuario${migrados > 1 ? 's' : ''} migrado${migrados > 1 ? 's' : ''}.`,
          usuarios_migrados: migrados,
        });
      }

      const deleted = await configModel.deleteDepartamento(id);
      if (!deleted) return res.status(404).json({ error: 'Departamento no encontrado' });
      res.json({ message: 'Departamento eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar departamento:', error);
      res.status(500).json({ error: 'Error al eliminar departamento' });
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

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nombre, departamento_id } = req.body;
      if (!nombre || !departamento_id) return res.status(400).json({ error: 'Nombre y departamento requeridos' });

      const updated = await configModel.updateCargo(id, nombre, departamento_id);
      if (!updated) return res.status(404).json({ error: 'Cargo no encontrado' });
      res.json(updated);
    } catch (error) {
      console.error('Error al actualizar cargo:', error);
      res.status(500).json({ error: 'Error al actualizar cargo' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { migrar_a_id } = req.body;

      const usuariosAfectados = await configModel.getUserCountByCargo(id);

      if (usuariosAfectados > 0 && !migrar_a_id) {
        const disponibles = await configModel.getAvailableCargos(id);
        return res.json({
          necesita_migracion: true,
          usuarios_afectados: usuariosAfectados,
          disponibles,
        });
      }

      if (usuariosAfectados > 0 && migrar_a_id) {
        const migrados = await configModel.migrateUsersCargo(id, migrar_a_id);
        await configModel.deleteCargo(id);
        return res.json({
          message: `Cargo eliminado. ${migrados} usuario${migrados > 1 ? 's' : ''} migrado${migrados > 1 ? 's' : ''}.`,
          usuarios_migrados: migrados,
        });
      }

      const deleted = await configModel.deleteCargo(id);
      if (!deleted) return res.status(404).json({ error: 'Cargo no encontrado' });
      res.json({ message: 'Cargo eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar cargo:', error);
      res.status(500).json({ error: 'Error al eliminar cargo' });
    }
  },
};

// ================================================
// Roles
// ================================================

export const roles = {
  async list(req: Request, res: Response) {
    try {
      const incluirInactivos = req.query.incluir_inactivos === 'true';
      const result = await configModel.getAllRoles(undefined, incluirInactivos);
      res.json(result);
    } catch (error) {
      console.error('Error al obtener roles:', error);
      res.status(500).json({ error: 'Error al obtener roles' });
    }
  },

  async create(req: Request, res: Response) {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    try {
      const role = await configModel.createRole(nombre);
      res.status(201).json(role);
    } catch (error) {
      console.error('Error al crear rol:', error);
      res.status(500).json({ error: 'Error al crear rol' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nombre } = req.body;
      if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

      const updated = await configModel.updateRole(id, nombre);
      if (!updated) return res.status(404).json({ error: 'Rol no encontrado' });
      res.json(updated);
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      res.status(500).json({ error: 'Error al actualizar rol' });
    }
  },

  async remove(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { migrar_a_id } = req.body;

      const usuariosAfectados = await configModel.getUserCountByRol(id);

      if (usuariosAfectados > 0 && !migrar_a_id) {
        const disponibles = await configModel.getAvailableRoles(id);
        return res.json({
          necesita_migracion: true,
          usuarios_afectados: usuariosAfectados,
          disponibles,
        });
      }

      if (usuariosAfectados > 0 && migrar_a_id) {
        const migrados = await configModel.migrateUsersRol(id, migrar_a_id);
        await configModel.softDeleteRole(id);
        return res.json({
          message: `Rol desactivado. ${migrados} usuario${migrados > 1 ? 's' : ''} migrado${migrados > 1 ? 's' : ''}.`,
          usuarios_migrados: migrados,
        });
      }

      const deleted = await configModel.softDeleteRole(id);
      if (!deleted) return res.status(404).json({ error: 'Rol no encontrado' });
      res.json({ message: 'Rol desactivado correctamente' });
    } catch (error) {
      console.error('Error al eliminar rol:', error);
      res.status(500).json({ error: 'Error al eliminar rol' });
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

  async reactivate(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const role = await configModel.reactivateRole(id);
      if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
      res.json(role);
    } catch (error) {
      console.error('Error al reactivar rol:', error);
      res.status(500).json({ error: 'Error al reactivar rol' });
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
