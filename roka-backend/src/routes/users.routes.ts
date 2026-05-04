import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as usersController from '../controllers/users.controller';

const router = Router();

router.get('/', authMiddleware, usersController.list);

router.post('/', usersController.create);

router.delete('/:id', authMiddleware, usersController.remove);

export default router;
