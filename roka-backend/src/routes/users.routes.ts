import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as usersController from '../controllers/users.controller';

const router = Router();

router.get('/', authMiddleware, usersController.list);

router.post('/', usersController.create);

router.put('/:id', authMiddleware, usersController.update);
router.delete('/:id', authMiddleware, usersController.remove);
router.put('/:id/password', authMiddleware, usersController.updatePassword);

export default router;
