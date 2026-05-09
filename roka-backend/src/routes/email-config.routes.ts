import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { requirePermission } from '../middleware/permissions';
import {
  isEventEnabled,
  sendEmail,
  testEmailConnection,
  getEmailSystemConfig,
  updateEmailSystemConfig,
} from '../lib/email';
import pool from '../db';

const router = Router();

router.use(authMiddleware, requirePermission('config.manage'));

// GET /api/config/email/eventos — listar eventos con estado
router.get('/eventos', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, codigo, nombre, descripcion, habilitado FROM email_notification_eventos ORDER BY id'
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener eventos de email:', err);
    res.status(500).json({ error: 'Error al obtener eventos' });
  }
});

// PATCH /api/config/email/eventos/:codigo — toggle habilitado
router.patch('/eventos/:codigo', async (req: Request, res: Response) => {
  try {
    const { codigo } = req.params;
    const { habilitado } = req.body;

    if (typeof habilitado !== 'boolean') {
      return res.status(400).json({ error: 'El campo habilitado debe ser boolean' });
    }

    const { rows, rowCount } = await pool.query(
      `UPDATE email_notification_eventos
       SET habilitado = $1, updated_at = NOW()
       WHERE codigo = $2
       RETURNING id, codigo, nombre, habilitado`,
      [habilitado, codigo]
    );

    if (!rowCount) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error al actualizar evento de email:', err);
    res.status(500).json({ error: 'Error al actualizar evento' });
  }
});

// GET /api/config/email/sistema — leer config (con tokens enmascarados)
router.get('/sistema', async (_req: Request, res: Response) => {
  try {
    const config = await getEmailSystemConfig();
    res.json(config);
  } catch (err) {
    console.error('Error al obtener config de email:', err);
    res.status(500).json({ error: 'Error al obtener configuración' });
  }
});

// PUT /api/config/email/sistema — guardar config
router.put('/sistema', async (req: Request, res: Response) => {
  try {
    await updateEmailSystemConfig(req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error al guardar config de email:', err);
    res.status(500).json({ error: 'Error al guardar configuración' });
  }
});

// POST /api/config/email/test — enviar email de prueba
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { destinatario } = req.body;
    if (!destinatario) {
      return res.status(400).json({ error: 'Se requiere destinatario' });
    }

    await testEmailConnection();
    await sendEmail({
      to: destinatario,
      subject: 'Prueba de conexión — Sistema ROKA',
      html: `<p>La configuración de correo electrónico del Sistema ROKA está funcionando correctamente.</p><p style="color:#666;font-size:12px">Enviado desde ROKA Construcciones.</p>`,
      eventoCodigo: 'test',
    });

    res.json({ ok: true, mensaje: `Email de prueba enviado a ${destinatario}` });
  } catch (err: any) {
    console.error('Error al enviar email de prueba:', err);
    res.status(500).json({ error: err.message || 'Error al enviar email de prueba' });
  }
});

// GET /api/config/email/logs — log de envíos recientes
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const { rows } = await pool.query(
      `SELECT id, evento_codigo, destinatario, asunto, estado, error_msg, entidad_tipo, entidad_id, created_at
       FROM email_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener logs de email:', err);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
});

// ──────────────────────────────────────────────
// Alertas de fecha de entrega
// ──────────────────────────────────────────────

// GET /api/config/email/alertas — obtener configuración de alertas
router.get('/alertas', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM alerta_email_config WHERE id = 1'
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Configuración de alertas no encontrada' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al obtener config de alertas:', err);
    res.status(500).json({ error: 'Error al obtener configuración de alertas' });
  }
});

// PUT /api/config/email/alertas — actualizar configuración de alertas
router.put('/alertas', async (req: Request, res: Response) => {
  try {
    const {
      habilitada,
      umbral_tipo,
      umbral_valor,
      recordatorios_habilitados,
      recordatorios_cantidad,
      recordatorios_frecuencia_hs,
      destinatarios_usuario_ids,
    } = req.body;

    // Validaciones
    if (umbral_tipo !== undefined && !['horas', 'dias'].includes(umbral_tipo)) {
      return res.status(400).json({ error: 'umbral_tipo debe ser "horas" o "dias"' });
    }
    if (umbral_valor !== undefined && (typeof umbral_valor !== 'number' || umbral_valor < 1)) {
      return res.status(400).json({ error: 'umbral_valor debe ser un número positivo' });
    }
    if (recordatorios_cantidad !== undefined && (typeof recordatorios_cantidad !== 'number' || recordatorios_cantidad < 0)) {
      return res.status(400).json({ error: 'recordatorios_cantidad debe ser un número no negativo' });
    }
    if (recordatorios_frecuencia_hs !== undefined && (typeof recordatorios_frecuencia_hs !== 'number' || recordatorios_frecuencia_hs < 1)) {
      return res.status(400).json({ error: 'recordatorios_frecuencia_hs debe ser un número positivo' });
    }
    if (destinatarios_usuario_ids !== undefined) {
      if (!Array.isArray(destinatarios_usuario_ids)) {
        return res.status(400).json({ error: 'destinatarios_usuario_ids debe ser un arreglo de números' });
      }
      for (const id of destinatarios_usuario_ids) {
        if (typeof id !== 'number' || !Number.isInteger(id)) {
          return res.status(400).json({ error: 'Cada elemento de destinatarios_usuario_ids debe ser un número entero' });
        }
      }
    }

    const { rows } = await pool.query(
      `UPDATE alerta_email_config
       SET habilitada = COALESCE($1, habilitada),
           umbral_tipo = COALESCE($2, umbral_tipo),
           umbral_valor = COALESCE($3, umbral_valor),
           recordatorios_habilitados = COALESCE($4, recordatorios_habilitados),
           recordatorios_cantidad = COALESCE($5, recordatorios_cantidad),
           recordatorios_frecuencia_hs = COALESCE($6, recordatorios_frecuencia_hs),
           destinatarios_usuario_ids = COALESCE($7, destinatarios_usuario_ids),
           updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [
        habilitada ?? null,
        umbral_tipo ?? null,
        umbral_valor ?? null,
        recordatorios_habilitados ?? null,
        recordatorios_cantidad ?? null,
        recordatorios_frecuencia_hs ?? null,
        destinatarios_usuario_ids ?? null,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Error al actualizar config de alertas:', err);
    res.status(500).json({ error: 'Error al actualizar configuración de alertas' });
  }
});

// GET /api/config/email/alertas/usuarios — listar usuarios activos para selector
router.get('/alertas/usuarios', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.nombre, u.apellido, u.correo, r.nombre AS rol_nombre
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       WHERE u.is_active = TRUE
       ORDER BY u.nombre, u.apellido`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener usuarios para alertas:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

export default router;
