import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * Algoritmo de validación de RUT Chileno (Backend version)
 */
function isValidRUT(rut: string): boolean {
  if (!rut) return false;
  const cleanRUT = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
  if (cleanRUT.length < 8) return false;
  const cuerpo = cleanRUT.slice(0, -1);
  const dvInput = cleanRUT.slice(-1);
  if (!/^\d+$/.test(cuerpo)) return false;
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }
  const dvEsperado = 11 - (suma % 11);
  let dvReal = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : dvEsperado.toString();
  return dvReal === dvInput;
}

// GET /api/users — Listar usuarios
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        u.id, u.nombre, u.apellido, u.rut, u.correo, u.telefono, u.is_active,
        d.nombre as departamento_nombre,
        c.nombre as cargo_nombre,
        r.nombre as rol_nombre,
        u.departamento_id, u.cargo_id, u.rol_id
      FROM usuarios u
      LEFT JOIN departamentos d ON d.id = u.departamento_id
      LEFT JOIN cargos c ON c.id = u.cargo_id
      LEFT JOIN roles r ON r.id = u.rol_id
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/users — Crear usuario
router.post('/', 
  // authMiddleware,
   async (req: Request, res: Response) => {
  const { 
    nombre, apellido, rut, correo, telefono, 
    departamento_id, cargo_id, rol_id, password 
  } = req.body;

  // 1. Validaciones básicas
  if (!nombre || !apellido || !rut || !correo || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // 2. Validar RUT real
  if (!isValidRUT(rut)) {
    return res.status(400).json({ error: 'El RUT ingresado no es válido' });
  }

  try {
    // 3. Verificar duplicados (RUT y Email)
    const { rows: existing } = await pool.query(
      'SELECT id, rut, correo FROM usuarios WHERE rut = $1 OR correo = $2',
      [rut, correo]
    );

    if (existing.length > 0) {
      if (existing.find(u => u.rut === rut)) {
        return res.status(409).json({ error: 'El RUT ya se encuentra registrado' });
      }
      if (existing.find(u => u.correo === correo)) {
        return res.status(409).json({ error: 'El correo electrónico ya se encuentra registrado' });
      }
    }

    // 4. Hashear password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 5. Insertar
    const { rows: [newUser] } = await pool.query(
      `INSERT INTO usuarios (
        nombre, apellido, rut, correo, telefono, 
        departamento_id, cargo_id, rol_id, password_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, nombre, apellido, rut, correo`,
      [nombre, apellido, rut, correo, telefono, departamento_id, cargo_id, rol_id, password_hash]
    );

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// DELETE /api/users/:id — Desactivar usuario
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE usuarios SET is_active = false WHERE id = $1', [id]);
    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
});

export default router;
