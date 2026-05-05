import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import {
  list,
  getById,
  create,
  updateEntrega,
  exportarHtml,
  exportarPdf,
} from '../controllers/ordenes.controller';

const router = Router();

// GET /api/ordenes — Listar órdenes de compra
router.get('/', list);

// GET /api/ordenes/:id — Detalle con cotización y solicitud
router.get('/:id', getById);

// POST /api/ordenes — Generar OC desde cotización aprobada
router.post('/', authMiddleware, requirePermission('ordenes.create'), create);

// PATCH /api/ordenes/:id/entrega — Actualizar estado de entrega
router.patch('/:id/entrega', updateEntrega);

// GET /api/ordenes/:id/exportar — Exportar OC como HTML
router.get('/:id/exportar', exportarHtml);

// GET /api/ordenes/:id/descargar — Exportar OC como PDF (server-side via puppeteer)
router.get('/:id/descargar', exportarPdf);

export default router;
