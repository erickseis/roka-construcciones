import { Request, Response } from 'express';
import { getChatResponse } from '../services/chat.service';

export async function complete(req: Request, res: Response) {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }

    const result = await getChatResponse(message);
    res.json(result);
  } catch (error) {
    console.error('Error en el chat de Roka AI:', error);
    res.status(500).json({ error: 'Error al procesar la consulta del chat' });
  }
}
