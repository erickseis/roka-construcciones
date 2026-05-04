import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import * as userModel from '../models/users.model';

/**
 * Algoritmo de validacion de RUT Chileno
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

export async function list(_req: Request, res: Response) {
  try {
    const users = await userModel.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

export async function create(req: Request, res: Response) {
  const {
    nombre, apellido, rut, correo, telefono,
    departamento_id, cargo_id, rol_id, password,
  } = req.body;

  if (!nombre || !apellido || !rut || !correo || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!isValidRUT(rut)) {
    return res.status(400).json({ error: 'El RUT ingresado no es valido' });
  }

  try {
    const existing = await userModel.findExistingUser(rut, correo);
    if (existing.length > 0) {
      if (existing.find((u) => u.rut === rut)) {
        return res.status(409).json({ error: 'El RUT ya se encuentra registrado' });
      }
      if (existing.find((u) => u.correo === correo)) {
        return res.status(409).json({ error: 'El correo electronico ya se encuentra registrado' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = await userModel.createUser({
      nombre, apellido, rut, correo, telefono,
      departamento_id, cargo_id, rol_id, password_hash,
    });

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    await userModel.softDeleteUser(id);
    res.json({ message: 'Usuario desactivado correctamente' });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({ error: 'Error al desactivar usuario' });
  }
}
