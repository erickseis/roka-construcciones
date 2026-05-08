import express from 'express';
// import cors from 'cors';

import solicitudesRouter from './routes/solicitudes.routes';
import ordenesRouter from './routes/ordenes.routes';
import dashboardRouter from './routes/dashboard.routes';
import authRouter from './routes/auth.routes';
import usersRouter from './routes/users.routes';
import configRouter from './routes/config.routes';
import proyectosRouter from './routes/proyectos.routes';
import presupuestosRouter from './routes/presupuestos.routes';
import notificacionesRouter from './routes/notificaciones.routes';
import materialesRouter from './routes/materiales.routes';
import proveedoresRouter from './routes/proveedores.routes';
import solicitudCotizacionRouter from './routes/solicitud_cotizacion.routes';
import chatRouter from './routes/chat.routes';
import emailConfigRouter from './routes/email-config.routes';

// const CORS_ORIGIN =
// process.env.CORS_ORIGIN || 'http://localhost:3000' || 'http://localhost:4173';

export function createRokaApp(): express.Application {
  const app = express();

  // app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use('/uploads', express.static('uploads'));

  app.use('/api/solicitudes', solicitudesRouter);
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
  app.use('/api/solicitud-cotizacion', solicitudCotizacionRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/config/email', emailConfigRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}
