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

// --- Cargos ---
router.get('/cargos', cargos.list);
router.post('/cargos', cargos.create);

// --- Roles ---
router.get('/roles', roles.list);

// --- Permisos (protegidos) ---
router.get('/permisos', authMiddleware, requirePermission('config.manage'), permisos.list);
router.get('/roles/:id/permisos', authMiddleware, requirePermission('config.manage'), roles.getPermisos);
router.put('/roles/:id/permisos', authMiddleware, requirePermission('config.manage'), roles.updatePermisos);

export default router;
