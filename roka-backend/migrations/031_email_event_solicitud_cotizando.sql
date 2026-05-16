-- Agregar evento de email para solicitud en cotización
INSERT INTO email_notification_eventos (codigo, nombre, descripcion, habilitado)
VALUES ('solicitud.cotizando', 'Solicitud en Cotización', 'Notifica al creador de la solicitud cuando esta pasa a estado Cotizando', true)
ON CONFLICT (codigo) DO NOTHING;
