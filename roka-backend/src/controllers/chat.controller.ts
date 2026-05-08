import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { getChatResponse } from '../services/chat.service';

export async function complete(req: AuthRequest, res: Response) {
  try {
    const { message } = req.body;
    const userId = req.user?.id ?? null;
    const rolId = req.user?.rol_id ?? null;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    const result = await getChatResponse(message, userId, rolId);
    res.json(result);
  } catch (error) {
    console.error('Error en el chat de Roka AI:', error);
    res.status(500).json({ error: 'Error al procesar la consulta del chat' });
  }
}
