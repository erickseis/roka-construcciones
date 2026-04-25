import express from 'express';
import cors from 'cors';

import solicitudesRouter from './routes/solicitudes';
import cotizacionesRouter from './routes/cotizaciones';
import ordenesRouter from './routes/ordenes';
import dashboardRouter from './routes/dashboard';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import configRouter from './routes/config';
import proyectosRouter from './routes/proyectos';
import presupuestosRouter from './routes/presupuestos';
import notificacionesRouter from './routes/notificaciones';
import materialesRouter from './routes/materiales';
import proveedoresRouter from './routes/proveedores';
import chatRouter from './routes/chat';

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

export function createRokaApp(): express.Application {
  const app = express();

  app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));

  app.use('/api/solicitudes', solicitudesRouter);
  app.use('/api/cotizaciones', cotizacionesRouter);
  app.use('/api/ordenes', ordenesRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/config', configRouter);
  app.use('/api/proyectos', proyectosRouter);
  app.use('/api/presupuestos', presupuestosRouter);
  app.use('/api/notificaciones', notificacionesRouter);
  app.use('/api/materiales', materialesRouter);
  app.use('/api/proveedores', proveedoresRouter);
  app.use('/api/chat', chatRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}