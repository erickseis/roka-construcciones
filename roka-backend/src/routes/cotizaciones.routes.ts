import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import upload from '../lib/upload';
import {
  list,
  getById,
  create,
  approve,
  reject,
  uploadArchivo,
} from '../controllers/cotizaciones.controller';

const router = Router();

// GET /api/cotizaciones — Listar cotizaciones
router.get('/', list);

// GET /api/cotizaciones/:id — Detalle con ítems cotizados
router.get('/:id', getById);

// POST /api/cotizaciones — Crear cotización con precios por ítem
router.post('/', authMiddleware, create);

// PATCH /api/cotizaciones/:id/aprobar — Aprobar cotización
router.patch('/:id/aprobar', authMiddleware, approve);

// PATCH /api/cotizaciones/:id/rechazar — Rechazar cotización
router.patch('/:id/rechazar', authMiddleware, reject);

// PATCH /api/cotizaciones/:id/archivo — Subir archivo adjunto (PDF del proveedor)
router.patch('/:id/archivo', authMiddleware, upload.single('archivo_cotizacion'), uploadArchivo);

export default router;
