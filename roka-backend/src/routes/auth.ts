import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'roka_super_secret_key_123';

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  try {
    const { rows: [user] } = await pool.query(
      `SELECT u.*, r.nombre as rol_nombre 
       FROM usuarios u
       LEFT JOIN roles r ON r.id = u.rol_id
       WHERE u.correo = $1 AND u.is_active = true`,
      [correo]
    );

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, correo: user.correo, rol_id: user.rol_id },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Don't send password hash back
    const { password_hash, ...userData } = user;

    res.json({
      message: 'Login exitoso',
      token,
      user: userData
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows: [user] } = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, u.rut, u.correo, u.rol_id, r.nombre as rol_nombre
       FROM usuarios u
       LEFT JOIN roles r ON r.id = u.rol_id
       WHERE u.id = $1`,
      [req.user?.id]
    );

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

export default router;
