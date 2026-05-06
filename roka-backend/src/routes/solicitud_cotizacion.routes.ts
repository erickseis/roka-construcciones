import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  list,
  getById,
  create,
  createBatch,
  changeEstado,
  remove,
} from '../controllers/solicitud_cotizacion.controller';

const router = Router();

router.get('/', list);
router.get('/:id', getById);
router.post('/', authMiddleware, create);
router.post('/batch', authMiddleware, createBatch);
router.patch('/:id/estado', authMiddleware, changeEstado);
router.delete('/:id', authMiddleware, remove);

export default router;
