import pool from '../db';

export interface TriageConfigRow {
  id: number;
  codigo: string;
  nombre: string;
  valor: number;
  descripcion: string | null;
}

export async function getTriageConfig(): Promise<TriageConfigRow[]> {
  const { rows } = await pool.query(
    'SELECT * FROM triage_config ORDER BY id'
  );
  return rows;
}

export async function updateTriageConfig(
  codigo: string,
  valor: number
): Promise<TriageConfigRow | null> {
  const { rows: [row] } = await pool.query(
    `UPDATE triage_config SET valor = $1, updated_at = NOW()
     WHERE codigo = $2 RETURNING *`,
    [valor, codigo]
  );
  return row || null;
}
