import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  solicitudesMensual,
  gastoPorProyecto,
  tiempoConversion,
  resumen,
  proyectos,
  solicitudesUrgentes,
} from '../controllers/dashboard.controller';

const router = Router();

router.use(authMiddleware);

router.get('/solicitudes-mensual', solicitudesMensual);
router.get('/gasto-por-proyecto', gastoPorProyecto);
router.get('/tiempo-conversion', tiempoConversion);
router.get('/resumen', resumen);
router.get('/proyectos', proyectos);
router.get('/solicitudes-urgentes', solicitudesUrgentes);

export default router;
