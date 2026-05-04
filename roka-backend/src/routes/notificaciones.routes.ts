import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import * as notificacionesController from '../controllers/notificaciones.controller';

const router = Router();

router.use(authMiddleware, requirePermission('notificaciones.view'));

router.get('/', notificacionesController.list);
router.get('/unread-count', notificacionesController.unreadCount);
router.patch('/:id/leida', notificacionesController.markLeida);
router.patch('/marcar-todas-leidas', notificacionesController.marcarTodasLeidas);

export default router;
