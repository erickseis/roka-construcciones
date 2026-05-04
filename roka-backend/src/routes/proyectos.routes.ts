import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import upload from '../lib/upload';
import * as proyectoCtrl from '../controllers/proyectos.controller';

const router = Router();

// List all proyectos (with optional filters)
router.get('/', authMiddleware, requirePermission('proyectos.view'), proyectoCtrl.list);

// Download licitacion file (before :id to avoid route conflict with 'licitacion-archivo' as id)
router.get('/:id/licitacion-archivo', authMiddleware, requirePermission('proyectos.view'), proyectoCtrl.downloadLicitacion);

// Get proyecto by ID with budget summary and metrics
router.get('/:id', authMiddleware, requirePermission('proyectos.view'), proyectoCtrl.getById);

// Create proyecto (multipart for optional licitacion file)
router.post('/', authMiddleware, requirePermission('proyectos.manage'), upload.single('archivo_licitacion'), proyectoCtrl.create);

// Update proyecto (multipart for optional licitacion file)
router.patch('/:id', authMiddleware, requirePermission('proyectos.manage'), upload.single('archivo_licitacion'), proyectoCtrl.update);

// Toggle active status
router.patch('/:id/active', authMiddleware, requirePermission('proyectos.manage'), proyectoCtrl.toggleActive);

export default router;
