-- Eventos de notificación por email configurables
CREATE TABLE IF NOT EXISTS email_notification_eventos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(80) UNIQUE NOT NULL,
  nombre VARCHAR(150) NOT NULL,
  descripcion VARCHAR(255),
  habilitado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Configuración del sistema de email (clave-valor)
CREATE TABLE IF NOT EXISTS email_system_config (
  clave VARCHAR(80) PRIMARY KEY,
  valor TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Log de emails enviados
CREATE TABLE IF NOT EXISTS email_logs (
  id SERIAL PRIMARY KEY,
  evento_codigo VARCHAR(80),
  destinatario VARCHAR(150) NOT NULL,
  asunto VARCHAR(255),
  estado VARCHAR(30) DEFAULT 'enviado',
  error_msg TEXT,
  entidad_tipo VARCHAR(50),
  entidad_id INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_created ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_evento ON email_logs(evento_codigo);

-- Seeds de eventos
INSERT INTO email_notification_eventos (codigo, nombre, descripcion, habilitado) VALUES
  ('solicitud.creada', 'Solicitud de Material Creada', 'Notifica al equipo de Adquisiciones cuando se crea una nueva solicitud de material', false),
  ('solicitud.aprobada', 'Solicitud Aprobada (OC generada)', 'Notifica al solicitante cuando su solicitud es aprobada mediante una Orden de Compra', false),
  ('cotizacion.creada', 'Solicitud de Cotización Creada', 'Notifica al equipo de Adquisiciones cuando se crea una nueva solicitud de cotización a proveedor', false),
  ('sc.envio_proveedor', 'Envío de SC a Proveedor', 'Habilita el botón de envío manual de solicitudes de cotización al proveedor por correo', false),
  ('oc.envio_proveedor', 'Envío de OC a Proveedor', 'Habilita el botón de envío manual de órdenes de compra al proveedor por correo', false)
ON CONFLICT (codigo) DO NOTHING;
