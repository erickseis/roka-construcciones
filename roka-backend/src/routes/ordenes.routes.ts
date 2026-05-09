import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import {
  list,
  getById,
  create,
  createManual,
  updateEntrega,
  exportarHtml,
  exportarPdf,
  generarPdfLink,
  enviarProveedor,
} from '../controllers/ordenes.controller';

const router = Router();

// GET /api/ordenes — Listar órdenes de compra
router.get('/', list);

// GET /api/ordenes/:id — Detalle con cotización y solicitud
router.get('/:id', getById);

// POST /api/ordenes — Generar OC desde cotización aprobada
router.post('/', authMiddleware, requirePermission('ordenes.create'), create);

// POST /api/ordenes/manual — OC manual/esporádica (urgencias)
router.post('/manual', authMiddleware, requirePermission('ordenes.create'), createManual);

// PATCH /api/ordenes/:id/entrega — Actualizar estado de entrega
router.patch('/:id/entrega', authMiddleware, updateEntrega);

// GET /api/ordenes/:id/exportar — Exportar OC como HTML
router.get('/:id/exportar', exportarHtml);

// GET /api/ordenes/:id/html — Alias de /exportar
router.get('/:id/html', exportarHtml);

// GET /api/ordenes/:id/descargar — Exportar OC como PDF (server-side via puppeteer)
router.get('/:id/descargar', exportarPdf);

// GET /api/ordenes/:id/pdf-link — Genera PDF y devuelve URL descargable
router.get('/:id/pdf-link', generarPdfLink);

// POST /api/ordenes/:id/enviar-proveedor — Enviar OC al proveedor por email
router.post('/:id/enviar-proveedor', authMiddleware, enviarProveedor);

export default router;
