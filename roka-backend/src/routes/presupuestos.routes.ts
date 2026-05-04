import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import {
  list,
  getByProyecto,
  create,
  update,
  addCategoria,
  updateCategoria,
  removeCategoria,
  alertasListado,
  comprometer,
} from '../controllers/presupuestos.controller';

const router = Router();

// GET /api/presupuestos
router.get('/', authMiddleware, requirePermission('presupuestos.view'), list);

// GET /api/presupuestos/proyecto/:proyectoId
router.get('/proyecto/:proyectoId', authMiddleware, requirePermission('presupuestos.view'), getByProyecto);

// POST /api/presupuestos
router.post('/', authMiddleware, requirePermission('presupuestos.manage'), create);

// PATCH /api/presupuestos/:id
router.patch('/:id', authMiddleware, requirePermission('presupuestos.manage'), update);

// POST /api/presupuestos/:id/categorias
router.post('/:id/categorias', authMiddleware, requirePermission('presupuestos.manage'), addCategoria);

// PATCH /api/presupuestos/categorias/:categoriaId
router.patch('/categorias/:categoriaId', authMiddleware, requirePermission('presupuestos.manage'), updateCategoria);

// DELETE /api/presupuestos/categorias/:categoriaId
router.delete('/categorias/:categoriaId', authMiddleware, requirePermission('presupuestos.manage'), removeCategoria);

// GET /api/presupuestos/alertas/listado
router.get('/alertas/listado', authMiddleware, requirePermission('presupuestos.view'), alertasListado);

// POST /api/presupuestos/comprometer
router.post('/comprometer', authMiddleware, requirePermission('presupuestos.manage'), comprometer);

export default router;
