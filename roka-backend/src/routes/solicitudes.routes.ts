import { Router } from 'express';
import * as solicitudCtrl from '../controllers/solicitudes.controller';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

router.get('/', solicitudCtrl.list);

// PDF / HTML export routes — must be before /:id to avoid param capture
router.get('/:id/exportar', solicitudCtrl.exportarHtml);
router.get('/:id/html', solicitudCtrl.exportarHtml);
router.get('/:id/descargar', solicitudCtrl.exportarPdf);
router.get('/:id/pdf-link', solicitudCtrl.generarPdfLink);

router.get('/:id', solicitudCtrl.getById);
router.post('/', solicitudCtrl.create);
router.patch('/:id/estado', solicitudCtrl.changeEstado);
router.delete('/:id', solicitudCtrl.remove);

export default router;
