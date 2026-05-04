import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/authMiddleware';
import { findUserByEmail, findUserById } from '../models/auth.model';
import { LoginResult, JwtPayload } from '../types/usuario.types';

const JWT_SECRET = process.env.JWT_SECRET || 'roka_super_secret_key_123';

export async function login(req: Request, res: Response) {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  try {
    const user = await findUserByEmail(correo);

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, correo: user.correo, rol_id: user.rol_id } satisfies JwtPayload,
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const { password_hash, ...userData } = user;

    const result: LoginResult = {
      message: 'Login exitoso',
      token,
      user: userData,
    };

    res.json(result);
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    const user = await findUserById(req.user!.id);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error en /me:', error);
    res.status(500).json({ error: 'Error en el servidor' });
  }
}
