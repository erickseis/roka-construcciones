import { Router } from 'express';
import * as chatCtrl from '../controllers/chat.controller';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// POST /api/chat/complete — Endpoint for the virtual assistant (authenticated)
router.post('/complete', authMiddleware, chatCtrl.complete);

export default router;
