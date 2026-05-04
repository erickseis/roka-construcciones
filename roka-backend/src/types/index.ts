import { Pool, QueryResultRow } from 'pg';
import pool from '../db';

export type Queryable = {
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

export function getDb(db?: Queryable): Queryable {
  return db || pool;
}
