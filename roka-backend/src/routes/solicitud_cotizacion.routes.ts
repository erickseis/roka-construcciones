import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import upload from '../lib/upload';
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
  importarArchivo,
  confirmarImportacion,
  enviarProveedor,
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

// Importar respuesta de cotización desde archivo
router.post('/importar', authMiddleware, upload.single('archivo_sc'), importarArchivo);
router.post('/importar/confirmar', authMiddleware, confirmarImportacion);

// Enviar SC al proveedor por email
router.post('/:id/enviar-proveedor', authMiddleware, enviarProveedor);

export default router;
