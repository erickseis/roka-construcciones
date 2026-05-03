const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const { createRokaApp } = require('./roka-backend/dist/app.js');
const { runMigrations } = require('./roka-backend/dist/lib/migrations.js');

dotenv.config({ path: path.join(__dirname, 'roka-backend', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://localhost:5173',
    'https://localhost:5174',
    'https://localhost:4173',
    'http://localhost:4173',
    'https://miramar-encuestas.netlify.app',
    'https://roka-construcciones.netlify.app',
    'http://miramar-encuestas.netlify.app'
  ],
  credentials: true,
}));
app.use(express.json());

// ROKA app
const rokaApp = createRokaApp();
app.use('/api/roka', rokaApp);

// Encuestas backend (ESM) - load .env first
const encuestasDotenv = require('dotenv');
encuestasDotenv.config({ path: path.join(__dirname, 'encuesta_backend', '.env') });

// MCP server env vars (ROKA_EMAIL, ROKA_PASSWORD)
const mcpDotenv = require('dotenv');
mcpDotenv.config({ path: path.join(__dirname, 'roka-mcp', '.env') });

async function setupEncuestas() {
  try {
    const encuestasModule = await import('./encuesta_backend/index.js');
    const createEncuestasApp = encuestasModule.createEncuestasApp || encuestasModule.default?.createEncuestasApp;
    if (createEncuestasApp && typeof createEncuestasApp === 'function') {
      const encuestasApp = createEncuestasApp();
      app.use('/api/encuestas', encuestasApp);
      console.log('✅ Encuestas backend cargado en /api/encuestas');
    } else {
      console.warn('⚠️ createEncuestasApp no encontrada');
    }
  } catch (err) {
    console.warn('⚠️ Encuestas backend no disponible:', err.message);
  }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: { roka: 'ok', encuestas: 'ok', mcp: 'ok' }
  });
});

// MCP server setup
async function setupMcp() {
  try {
    const mcpModule = await import('./roka-mcp/dist/index.js');
    if (mcpModule.mountMcpServer && typeof mcpModule.mountMcpServer === 'function') {
      await mcpModule.mountMcpServer(app, '/api/mcp');
      console.log('✅ MCP server montado en /api/mcp');
    } else {
      console.warn('⚠️ mountMcpServer no encontrada en roka-mcp');
    }
  } catch (err) {
    console.warn('⚠️ MCP server no disponible:', err.message);
  }
}

// Start server
async function startServer() {
  await setupEncuestas();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor unificado corriendo en http://localhost:${PORT}`);
    console.log(`   ROKA:      http://localhost:${PORT}/api/roka`);
    console.log(`   Encuestas: http://localhost:${PORT}/api/encuestas`);
    console.log(`   MCP:       http://localhost:${PORT}/api/mcp`);
    // Start MCP after listen so it can authenticate against itself
    setupMcp();
  });
}

// Try ROKA migrations, but don't fail if they don't work
runMigrations()
  .then(() => console.log('✅ ROKA migraciones completadas'))
  .catch(err => console.warn('⚠️ ROKA migraciones:', err.message))
  .finally(() => startServer());