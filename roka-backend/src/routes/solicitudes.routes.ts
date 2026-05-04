import { Router } from 'express';
import * as solicitudCtrl from '../controllers/solicitudes.controller';

const router = Router();

router.get('/', solicitudCtrl.list);
router.get('/:id', solicitudCtrl.getById);
router.post('/', solicitudCtrl.create);
router.patch('/:id/estado', solicitudCtrl.changeEstado);
router.delete('/:id', solicitudCtrl.remove);

export default router;
