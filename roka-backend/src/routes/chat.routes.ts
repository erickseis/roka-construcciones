import { Router } from 'express';
import * as chatCtrl from '../controllers/chat.controller';

const router = Router();

// POST /api/chat/complete — Endpoint for the virtual assistant
router.post('/complete', chatCtrl.complete);

export default router;
