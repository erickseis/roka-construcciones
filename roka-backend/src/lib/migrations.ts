import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Utilidad para ejecutar migraciones de base de datos automáticamente
 */
export async function runMigrations() {
  console.log('🔄 Verificando migraciones de base de datos...');
  
  const client = await pool.connect();
  
  try {
    // 1. Crear tabla de control de migraciones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Leer archivos de la carpeta migrations
    const migrationsPath = path.join(__dirname, '../../migrations');
    
    if (!fs.existsSync(migrationsPath)) {
      console.warn('⚠️ La carpeta de migraciones no existe.');
      return;
    }

    const files = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Asegurar orden 001, 002, etc.

    // 3. Obtener migraciones ya aplicadas
    const { rows: appliedRows } = await client.query('SELECT name FROM migrations');
    const appliedMigrations = new Set(appliedRows.map(row => row.name));

    // 4. Ejecutar migraciones pendientes
    for (const file of files) {
      if (!appliedMigrations.has(file)) {
        console.log(`🚀 Aplicando migración: ${file}`);
        
        const sql = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
        
        await client.query('BEGIN');
        try {
          // Ejecutar el SQL del archivo
          await client.query(sql);
          
          // Registrar en la tabla de control
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          
          await client.query('COMMIT');
          console.log(`✅ Migración ${file} aplicada con éxito.`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`❌ Error al aplicar migración ${file}:`, error);
          throw error; // Detener el proceso si una migración falla
        }
      }
    }

    console.log('✨ Base de datos actualizada.');
  } catch (error) {
    console.error('❌ Error crítico en el proceso de migración:', error);
    process.exit(1); // Salir si hay error crítico en migraciones
  } finally {
    client.release();
  }
}
