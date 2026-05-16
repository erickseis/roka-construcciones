import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL environment variable is required');

const isProduction = process.env.NODE_ENV === 'production';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  statement_timeout: 30_000,
  connectionTimeoutMillis: 10_000,
  // Pool sizing
  max: isProduction ? 20 : 10,       // max connections in pool
  min: isProduction ? 5 : 2,        // min connections to keep
  idleTimeoutMillis: 30_000,         // close idle connections after 30s
  maxUses: 7500,                     // recycle connections after 7500 uses (prevents memory leaks)
  // SSL: required for most cloud providers (Supabase, Neon, Railway, etc.)
  ssl: process.env.DB_SSL === 'true'
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : undefined,
};

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
});

export default pool;
