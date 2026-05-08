import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import {
  departamentos,
  cargos,
  roles,
  permisos,
} from '../controllers/config.controller';

const router = Router();

// --- Departamentos ---
router.get('/departamentos', departamentos.list);
router.post('/departamentos', departamentos.create);
router.put('/departamentos/:id', authMiddleware, requirePermission('config.manage'), departamentos.update);
router.delete('/departamentos/:id', authMiddleware, requirePermission('config.manage'), departamentos.remove);

// --- Cargos ---
router.get('/cargos', cargos.list);
router.post('/cargos', cargos.create);
router.put('/cargos/:id', authMiddleware, requirePermission('config.manage'), cargos.update);
router.delete('/cargos/:id', authMiddleware, requirePermission('config.manage'), cargos.remove);

// --- Roles ---
router.get('/roles', roles.list);
router.post('/roles', authMiddleware, requirePermission('config.manage'), roles.create);
router.put('/roles/:id', authMiddleware, requirePermission('config.manage'), roles.update);
router.delete('/roles/:id', authMiddleware, requirePermission('config.manage'), roles.remove);
router.patch('/roles/:id/reactivar', authMiddleware, requirePermission('config.manage'), roles.reactivate);

// --- Permisos (protegidos) ---
router.get('/permisos', authMiddleware, requirePermission('config.manage'), permisos.list);
router.get('/roles/:id/permisos', authMiddleware, requirePermission('config.manage'), roles.getPermisos);
router.put('/roles/:id/permisos', authMiddleware, requirePermission('config.manage'), roles.updatePermisos);

export default router;
