import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as authCtrl from '../controllers/auth.controller';

const router = Router();

router.post('/login', authCtrl.login);
router.get('/me', authMiddleware, authCtrl.me);

export default router;
