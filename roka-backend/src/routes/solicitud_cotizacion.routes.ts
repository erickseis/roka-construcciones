import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  list,
  getById,
  create,
  createBatch,
  changeEstado,
  remove,
  exportarHtml,
  exportarPdf,
  generarPdfLink,
} from '../controllers/solicitud_cotizacion.controller';

const router = Router();

router.get('/', list);
router.get('/:id', getById);
router.post('/', authMiddleware, create);
router.post('/batch', authMiddleware, createBatch);
router.patch('/:id/estado', authMiddleware, changeEstado);
router.delete('/:id', authMiddleware, remove);

router.get('/:id/exportar', exportarHtml);
router.get('/:id/descargar', exportarPdf);
router.get('/:id/pdf-link', generarPdfLink);

export default router;
