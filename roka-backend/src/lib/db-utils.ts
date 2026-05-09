import pool from '../db';

/**
 * Execute a callback within a database transaction.
 * Automatically BEGIN, COMMIT on success, ROLLBACK on error.
 * 
 * Usage:
 *   const result = await withTransaction(async (client) => {
 *     const { rows } = await client.query('INSERT INTO ... RETURNING *', [...]);
 *     await client.query('INSERT INTO ...', [...]);
 *     return rows[0];
 *   });
 */
export async function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
