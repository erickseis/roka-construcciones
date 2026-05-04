import { Router } from 'express';
import {
  solicitudesMensual,
  gastoPorProyecto,
  tiempoConversion,
  resumen,
  proyectos,
} from '../controllers/dashboard.controller';

const router = Router();

router.get('/solicitudes-mensual', solicitudesMensual);
router.get('/gasto-por-proyecto', gastoPorProyecto);
router.get('/tiempo-conversion', tiempoConversion);
router.get('/resumen', resumen);
router.get('/proyectos', proyectos);

export default router;
