import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as proveedorCtrl from '../controllers/proveedores.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', proveedorCtrl.list);
router.get('/:id', proveedorCtrl.getById);
router.post('/', proveedorCtrl.create);
router.put('/:id', proveedorCtrl.update);
router.delete('/:id', proveedorCtrl.remove);

export default router;
