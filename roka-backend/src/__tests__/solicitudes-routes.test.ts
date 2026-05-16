import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock db module BEFORE importing routes
vi.mock('../db', () => ({
  default: {
    query: vi.fn().mockResolvedValue({ rows: [{ id: 1, codigo: 'proyectos.view' }] }),
    connect: vi.fn(),
  },
}));

// Mock models used by solicitudes controller
vi.mock('../models/solicitudes.model', () => ({
  getSolicitudById: vi.fn(),
  getSolicitudItems: vi.fn(),
  getAllSolicitudes: vi.fn(),
  updateSolicitudEstado: vi.fn(),
  deleteSolicitud: vi.fn(),
}));

// Mock auth middleware - passthrough with fake user
vi.mock('../middleware/authMiddleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 1, rol_id: 1, nombre: 'Admin' };
    next();
  },
  AuthRequest: {} as any,
}));

// Mock email lib
vi.mock('../lib/email', () => ({
  isEventEnabled: vi.fn().mockResolvedValue(false),
  sendEmail: vi.fn(),
  getUserEmailsByPermission: vi.fn().mockResolvedValue([]),
  getUserEmailById: vi.fn().mockResolvedValue(null),
  buildSolicitudCreadaHtml: vi.fn().mockReturnValue(''),
  buildSolicitudCotizandoHtml: vi.fn().mockReturnValue(''),
  buildSolicitudRechazadaHtml: vi.fn().mockReturnValue(''),
}));

// Mock notifications lib
vi.mock('../lib/notifications', () => ({
  createNotifications: vi.fn().mockResolvedValue(undefined),
  resolveRecipientUserIds: vi.fn().mockResolvedValue([]),
  getActorDisplayName: vi.fn().mockResolvedValue('Test User'),
}));

import { createRokaApp } from '../app';
import * as solicitudModel from '../models/solicitudes.model';

const mockSolicitud = {
  id: 1,
  proyecto_id: 1,
  solicitante: 'Juan Pérez',
  fecha: '2026-05-01',
  fecha_requerida: '2026-05-15',
  estado: 'Pendiente',
  proyecto_nombre: 'Edificio Los Andes',
  total_items: 2,
  estado_changed_by_nombre: null,
  aprobado_by_nombre: null,
  created_by_usuario_id: 1,
};

const mockItems = [
  {
    id: 1,
    solicitud_id: 1,
    material_id: 1,
    nombre_material: 'Cemento',
    cantidad_requerida: 10,
    unidad: 'Sacos',
    material_sku: 'CEM-001',
    material_oficial_nombre: 'Cemento Portland',
    unidad_abreviatura: 'sc',
    codigo: null,
    precio_referencial: null,
  },
];

describe('Solicitudes PDF Routes', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createRokaApp();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── /api/solicitudes/:id/html ─────────────────────────────────

  describe('GET /api/solicitudes/:id/html', () => {
    it('debe responder 200 con HTML válido', async () => {
      vi.mocked(solicitudModel.getSolicitudById).mockResolvedValue(mockSolicitud as any);
      vi.mocked(solicitudModel.getSolicitudItems).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/solicitudes/1/html');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('SOLICITUD DE MATERIALES');
    });

    it('debe devolver 400 para ID no numérico', async () => {
      const res = await request(app).get('/api/solicitudes/abc/html');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ID inválido');
    });

    it('debe devolver 404 si la solicitud no existe', async () => {
      vi.mocked(solicitudModel.getSolicitudById).mockResolvedValue(null);

      const res = await request(app).get('/api/solicitudes/999/html');
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no encontrada');
    });

    it('debe incluir Content-Disposition attachment', async () => {
      vi.mocked(solicitudModel.getSolicitudById).mockResolvedValue(mockSolicitud as any);
      vi.mocked(solicitudModel.getSolicitudItems).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/solicitudes/1/html');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('SM-001.html');
    });
  });

  // ─── /api/solicitudes/:id/exportar (alias de html) ──────────────

  describe('GET /api/solicitudes/:id/exportar', () => {
    it('debe ser alias de /html y devolver 200', async () => {
      vi.mocked(solicitudModel.getSolicitudById).mockResolvedValue(mockSolicitud as any);
      vi.mocked(solicitudModel.getSolicitudItems).mockResolvedValue(mockItems);

      const res = await request(app).get('/api/solicitudes/1/exportar');
      expect(res.status).toBe(200);
      expect(res.text).toContain('SOLICITUD DE MATERIALES');
    });
  });

  // ─── /api/solicitudes/:id/descargar ─────────────────────────────

  describe('GET /api/solicitudes/:id/descargar', () => {
    it('debe devolver 400 para ID inválido', async () => {
      const res = await request(app).get('/api/solicitudes/abc/descargar');
      expect(res.status).toBe(400);
    });

    it('debe devolver 404 si la solicitud no existe', async () => {
      vi.mocked(solicitudModel.getSolicitudById).mockResolvedValue(null);

      const res = await request(app).get('/api/solicitudes/999/descargar');
      expect(res.status).toBe(404);
    });
  });

  // ─── /api/solicitudes/:id/pdf-link ──────────────────────────────

  describe('GET /api/solicitudes/:id/pdf-link', () => {
    it('debe devolver 400 para ID inválido', async () => {
      const res = await request(app).get('/api/solicitudes/abc/pdf-link');
      expect(res.status).toBe(400);
    });

    it('debe devolver 404 si la solicitud no existe', async () => {
      vi.mocked(solicitudModel.getSolicitudById).mockResolvedValue(null);

      const res = await request(app).get('/api/solicitudes/999/pdf-link');
      expect(res.status).toBe(404);
    });
  });

  // ─── Verificación de registro de rutas ──────────────────────────

  describe('Registro de rutas', () => {
    it('debe responder en /api/solicitudes/:id/html', async () => {
      vi.mocked(solicitudModel.getSolicitudById).mockResolvedValue(mockSolicitud as any);
      vi.mocked(solicitudModel.getSolicitudItems).mockResolvedValue([]);

      const res = await request(app).get('/api/solicitudes/1/html');
      expect(res.status).toBe(200);
    });

    it('GET /api/solicitudes/:id sin calificador devuelve JSON', async () => {
      vi.mocked(solicitudModel.getSolicitudById).mockResolvedValue(mockSolicitud as any);
      vi.mocked(solicitudModel.getSolicitudItems).mockResolvedValue(mockItems);

      const jsonRes = await request(app).get('/api/solicitudes/1');
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body).toHaveProperty('id');
      expect(jsonRes.body).toHaveProperty('items');
      expect(jsonRes.body.id).toBe(1);
    });
  });
});
