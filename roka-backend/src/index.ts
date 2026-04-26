import express from 'express';
// import cors from 'cors';
import dotenv from 'dotenv';

import { createRokaApp } from './app.js';
import { runMigrations } from './lib/migrations';

dotenv.config();

const PORT = process.env.PORT || 3001;

const app = createRokaApp();

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        `🏗️  Roka Construcciones API corriendo en http://localhost:${PORT}`,
      );
    });
  })
  .catch((err) => {
    console.error(
      '❌ Fallo al iniciar el servidor debido a errores de migración:',
      err,
    );
    process.exit(1);
  });
