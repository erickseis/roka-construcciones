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

// Download materiales file
router.get('/:id/materiales-archivo', authMiddleware, requirePermission('proyectos.view'), proyectoCtrl.downloadMateriales);

// Get proyecto by ID with budget summary and metrics
router.get('/:id', authMiddleware, requirePermission('proyectos.view'), proyectoCtrl.getById);

// Create proyecto (multipart for optional licitacion and materiales files)
router.post('/', authMiddleware, requirePermission('proyectos.manage'), upload.fields([
  { name: 'archivo_licitacion', maxCount: 1 },
  { name: 'archivo_materiales', maxCount: 1 }
]), proyectoCtrl.create);

// Update proyecto (multipart for optional licitacion and materiales files)
router.patch('/:id', authMiddleware, requirePermission('proyectos.manage'), upload.fields([
  { name: 'archivo_licitacion', maxCount: 1 },
  { name: 'archivo_materiales', maxCount: 1 }
]), proyectoCtrl.update);

// Toggle active status
router.patch('/:id/active', authMiddleware, requirePermission('proyectos.manage'), proyectoCtrl.toggleActive);

// Procesar archivo de materiales como solicitud
router.post('/:id/procesar-materiales', authMiddleware, requirePermission('proyectos.manage'), proyectoCtrl.procesarMateriales);

export default router;
