import { describe, it, expect } from 'vitest';
import { buildSolicitudHtml } from '../controllers/solicitudes.controller';

describe('buildSolicitudHtml', () => {
  const mockSolicitud = {
    id: 1,
    solicitante: 'Juan Pérez',
    fecha: '2026-05-01T12:00:00',
    fecha_requerida: '2026-05-15T12:00:00',
    estado: 'Pendiente',
    proyecto_nombre: 'Edificio Los Andes',
    estado_changed_by_nombre: 'María García',
    aprobado_by_nombre: 'Carlos Rojas',
  };

  const mockItems = [
    {
      id: 1,
      nombre_material: 'Cemento Gris',
      cantidad_requerida: 10,
      unidad: 'Sacos',
      material_sku: 'CEM-001',
      material_oficial_nombre: 'Cemento Portland',
      unidad_abreviatura: 'sc',
      codigo: null,
    },
    {
      id: 2,
      nombre_material: 'Varilla 1/2"',
      cantidad_requerida: 50,
      unidad: 'Piezas',
      material_sku: null,
      codigo: 'VAR-002',
      material_oficial_nombre: null,
      unidad_abreviatura: null,
    },
  ];

  function getHtml(solicitud = mockSolicitud, items = mockItems): string {
    return buildSolicitudHtml(solicitud, items);
  }

  // ─── Estructura básica ─────────────────────────────────────────

  it('debe generar un documento HTML con DOCTYPE', () => {
    const html = getHtml();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="es">');
    expect(html).toContain('</html>');
  });

  it('debe tener head con charset UTF-8 y title', () => {
    const html = getHtml();
    expect(html).toContain('charset="UTF-8"');
    expect(html).toContain('<title>SM-001 — Solicitud de Materiales</title>');
  });

  // ─── Folio ─────────────────────────────────────────────────────

  it('debe mostrar el folio SM-XXX con 3 dígitos', () => {
    const html = getHtml();
    expect(html).toContain('SM-001');
  });

  it('debe padding correcto para IDs mayores a 1 dígito', () => {
    const html = buildSolicitudHtml({ ...mockSolicitud, id: 42 }, mockItems);
    expect(html).toContain('SM-042');
  });

  // ─── Título ────────────────────────────────────────────────────

  it('debe mostrar "SOLICITUD DE MATERIALES" como título', () => {
    const html = getHtml();
    expect(html).toContain('SOLICITUD DE MATERIALES');
  });

  it('debe mostrar "Sistema de Compras y Abastecimiento"', () => {
    const html = getHtml();
    expect(html).toContain('Sistema de Compras y Abastecimiento');
  });

  // ─── Datos empresa ─────────────────────────────────────────────

  it('debe incluir los datos de Constructora Roka SpA', () => {
    const html = getHtml();
    expect(html).toContain('Constructora Roka SpA');
    expect(html).toContain('General Arteaga');
    expect(html).toContain('77.122.411-3');
  });

  // ─── Datos de la solicitud ─────────────────────────────────────

  it('debe mostrar el nombre del solicitante', () => {
    const html = getHtml();
    expect(html).toContain('Juan Pérez');
  });

  it('debe mostrar el año 2026 en la fecha', () => {
    const html = getHtml();
    expect(html).toMatch('2026');
  });

  it('debe mostrar el año 2026 en la fecha requerida', () => {
    const html = getHtml();
    expect(html).toMatch('2026');
  });

  it('debe mostrar "-" cuando fecha_requerida es null', () => {
    const html = buildSolicitudHtml(
      { ...mockSolicitud, fecha_requerida: null },
      mockItems
    );
    expect(html).toContain('Fecha Requerida');
    expect(html).toContain('>-</td>');
  });

  // ─── Estado ────────────────────────────────────────────────────

  it('debe mostrar el badge de estado Pendiente', () => {
    const html = getHtml();
    expect(html).toContain('Pendiente');
  });

  it('debe usar color verde para estado Aprobado', () => {
    const html = buildSolicitudHtml({ ...mockSolicitud, estado: 'Aprobado' }, mockItems);
    expect(html).toContain('#16a34a');
  });

  it('debe usar color ámbar para estado Cotizando', () => {
    const html = buildSolicitudHtml({ ...mockSolicitud, estado: 'Cotizando' }, mockItems);
    expect(html).toContain('#f59e0b');
  });

  it('debe usar color rojo para estado Anulada', () => {
    const html = buildSolicitudHtml({ ...mockSolicitud, estado: 'Anulada' }, mockItems);
    expect(html).toContain('#dc2626');
  });

  // ─── Proyecto ──────────────────────────────────────────────────

  it('debe mostrar el nombre del proyecto', () => {
    const html = getHtml();
    expect(html).toContain('Edificio Los Andes');
  });

  it('debe mostrar "-" cuando proyecto_nombre es null', () => {
    const html = buildSolicitudHtml({ ...mockSolicitud, proyecto_nombre: null }, mockItems);
    expect(html).toContain('-');
    expect(html).toContain('DATOS DE LA SOLICITUD');
  });

  // ─── Items - estructura de tabla ───────────────────────────────

  it('debe tener 5 columnas: #, Código/SKU, Descripción, Cantidad, Unidad', () => {
    const html = getHtml();
    expect(html).toContain('Código / SKU');
    expect(html).toContain('Descripción');
    expect(html).toContain('Cantidad');
    expect(html).toContain('Unidad');
  });

  it('NO debe incluir columnas de precio (P. Unitario, Subtotal)', () => {
    const html = getHtml();
    expect(html).not.toContain('P. Unitario');
    expect(html).not.toContain('Subtotal');
    expect(html).not.toContain('Precio');
  });

  // ─── Items - datos ─────────────────────────────────────────────

  it('debe mostrar el SKU del material cuando existe', () => {
    const html = getHtml();
    expect(html).toContain('CEM-001');
  });

  it('debe usar codigo como fallback cuando material_sku es null', () => {
    const html = getHtml();
    expect(html).toContain('VAR-002');
  });

  it('debe mostrar la descripción del material', () => {
    const html = getHtml();
    expect(html).toContain('Cemento Portland');
  });

  it('debe usar nombre_material cuando no hay material_oficial_nombre', () => {
    const html = getHtml();
    expect(html).toContain('Varilla 1/2');
  });

  it('debe mostrar la cantidad formateada', () => {
    const html = getHtml();
    expect(html).toContain('>10</td>');
    expect(html).toContain('>50</td>');
  });

  // ─── Items vacíos ──────────────────────────────────────────────

  it('debe mostrar mensaje cuando no hay items', () => {
    const html = buildSolicitudHtml(mockSolicitud, []);
    expect(html).toContain('Esta solicitud no tiene items cargados');
  });

  it('debe usar colspan="5" cuando no hay items', () => {
    const html = buildSolicitudHtml(mockSolicitud, []);
    expect(html).toContain('colspan="5"');
  });

  // ─── Total Ítems ───────────────────────────────────────────────

  it('debe mostrar el total de ítems (con 2 items)', () => {
    const html = getHtml();
    expect(html).toContain('Total Ítems');
    expect(html).toContain('>2</td>');
  });

  it('debe mostrar 0 cuando no hay items', () => {
    const html = buildSolicitudHtml(mockSolicitud, []);
    expect(html).toContain('>0</td>');
  });

  // ─── Firmas ────────────────────────────────────────────────────

  it('debe mostrar los tres bloques de firma', () => {
    const html = getHtml();
    expect(html).toContain('Solicitado por');
    expect(html).toContain('Revisado por');
    expect(html).toContain('Aprobado por');
  });

  it('debe mostrar el nombre del solicitante en la firma', () => {
    const html = getHtml();
    expect(html).toContain('Solicitado por');
    expect(html).toContain('Juan Pérez');
  });

  it('debe mostrar el nombre de quien revisó (audit trail)', () => {
    const html = getHtml();
    expect(html).toContain('Revisado por');
    expect(html).toContain('María García');
  });

  it('debe mostrar el nombre de quien aprobó (audit trail)', () => {
    const html = getHtml();
    expect(html).toContain('Aprobado por');
    expect(html).toContain('Carlos Rojas');
  });

  it('debe mostrar "-" en firma cuando audit trail es null', () => {
    const html = buildSolicitudHtml(
      { ...mockSolicitud, estado_changed_by_nombre: null, aprobado_by_nombre: null },
      mockItems
    );
    // Auditoría null → "-"
    expect(html).toContain('Revisado por');
    expect(html).toContain('Aprobado por');
    expect(html).toContain('>-</div>');
  });

  // ─── Footer ────────────────────────────────────────────────────

  it('debe incluir el pie de página "Documento generado por ROKA"', () => {
    const html = getHtml();
    expect(html).toContain('Documento generado por ROKA');
  });

  it('debe incluir la sección OBSERVACIONES', () => {
    const html = getHtml();
    expect(html).toContain('OBSERVACIONES');
  });

  // ─── Estilos CSS ───────────────────────────────────────────────

  it('debe incluir estilos para impresión (@media print)', () => {
    const html = getHtml();
    expect(html).toContain('@media print');
    expect(html).toContain('size:A4 portrait');
  });

  it('debe usar el logo SVG de ROKA', () => {
    const html = getHtml();
    expect(html).toContain('viewBox="0 0 1079 1079"');
    expect(html).toContain('#ea9a00');
  });
});
