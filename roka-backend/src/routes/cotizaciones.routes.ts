import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  list,
  getById,
  create,
  approve,
  reject,
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

export default router;
