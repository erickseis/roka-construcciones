import { Router } from 'express';
import {
  unidades,
  categorias,
  solicitados,
  materiales,
} from '../controllers/materiales.controller';

const router = Router();

// Unidades de Medida
router.get('/unidades', unidades.list);
router.post('/unidades', unidades.create);
router.put('/unidades/:id', unidades.update);
router.delete('/unidades/:id', unidades.remove);

// Categorias de Materiales
router.get('/categorias', categorias.list);
router.post('/categorias', categorias.create);
router.put('/categorias/:id', categorias.update);
router.delete('/categorias/:id', categorias.remove);

// Materiales Solicitados
router.get('/solicitados', solicitados.list);

// Materiales (Maestro)
router.get('/', materiales.list);
router.get('/:id', materiales.getById);
router.post('/', materiales.create);
router.put('/:id', materiales.update);
router.delete('/:id', materiales.remove);

export default router;
