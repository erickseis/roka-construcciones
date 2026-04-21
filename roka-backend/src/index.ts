import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

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
import { runMigrations } from './lib/migrations';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.static('uploads'));

// Run migrations on startup
runMigrations().then(() => {
  // Routes (only mount after migrations for safety)
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

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.listen(PORT, () => {
    console.log(`🏗️  Roka Construcciones API corriendo en http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Fallo al iniciar el servidor debido a errores de migración:', err);
  process.exit(1);
});
