CREATE TABLE IF NOT EXISTS triage_config (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  valor INT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO triage_config (codigo, nombre, valor, descripcion) VALUES
  ('critico_dias', 'Crítico (días)', 2, 'Solicitudes con días restantes ≤ este valor se marcan como Crítica'),
  ('atrasado_dias', 'Atrasado (días)', 5, 'Solicitudes con días restantes entre crítico y este valor se marcan como Atrasada')
ON CONFLICT (codigo) DO NOTHING;
