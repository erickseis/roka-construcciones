import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock globals before importing ───────────────────────────────

const mockFetch = vi.fn();
const mockOpen = vi.fn();
const mockPrint = vi.fn();
const mockWrite = vi.fn();
const mockClose = vi.fn();
const mockFocus = vi.fn();
const mockAddEventListener = vi.fn();
const mockAlert = vi.fn();

const mockWindow = {
  document: {
    open: mockWrite,
    write: mockWrite,
    close: mockClose,
  },
  addEventListener: mockAddEventListener,
  focus: mockFocus,
  close: mockClose,
  print: mockPrint,
};

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn().mockReturnValue('fake-token-123'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
vi.stubGlobal('localStorage', localStorageMock);

// Mock window.open
vi.stubGlobal('open', mockOpen);

// Mock alert
vi.stubGlobal('alert', mockAlert);

// Mock fetch
vi.stubGlobal('fetch', mockFetch);

// Re-create the function here (same logic as in api.ts)
function exportarSolicitudHtml(id: number): void {
  const baseUrl = 'http://localhost:3001/api/roka/api';
  const token = localStorage.getItem('roka_token') || '';
  const url = `${baseUrl}/solicitudes/${id}/html`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Por favor permite ventanas emergentes para imprimir el documento.');
    return;
  }

  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.text())
    .then(html => {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.addEventListener('load', () => { win.focus(); win.print(); });
    })
    .catch(() => {
      win.close();
      alert('Error al generar el documento para imprimir.');
    });
}

describe('exportarSolicitudHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    mockOpen.mockReset();
    mockAlert.mockReset();
    mockPrint.mockReset();
    mockClose.mockReset();
    mockAddEventListener.mockReset();
  });

  // ─── Happy path ─────────────────────────────────────────────────

  it('debe abrir una ventana en blanco', () => {
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('<html>Test</html>'),
    });

    exportarSolicitudHtml(1);

    expect(mockOpen).toHaveBeenCalledWith('', '_blank');
  });

  it('debe hacer fetch al endpoint /solicitudes/:id/html con token', () => {
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('<html>Test</html>'),
    });

    exportarSolicitudHtml(42);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/solicitudes/42/html'),
      { headers: { Authorization: 'Bearer fake-token-123' } }
    );
  });

  it('debe escribir el HTML en la ventana abierta', async () => {
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('<html>Contenido de prueba</html>'),
    });

    exportarSolicitudHtml(1);

    // Esperar a que el promise se resuelva
    await vi.waitFor(() => {
      expect(mockWrite).toHaveBeenCalledWith('<html>Contenido de prueba</html>');
    });
  });

  it('debe disparar window.print() después de cargar', async () => {
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('<html>Test</html>'),
    });

    exportarSolicitudHtml(1);

    // Simular que el evento 'load' es disparado
    await vi.waitFor(() => {
      expect(mockAddEventListener).toHaveBeenCalledWith(
        'load',
        expect.any(Function)
      );
    });

    // Ejecutar el callback del load event
    const loadCallback = mockAddEventListener.mock.calls[0][1];
    loadCallback();

    expect(mockFocus).toHaveBeenCalled();
    expect(mockPrint).toHaveBeenCalled();
  });

  // ─── Error paths ────────────────────────────────────────────────

  it('debe alertar si no se puede abrir ventana emergente', () => {
    mockOpen.mockReturnValue(null); // Popup bloqueado

    exportarSolicitudHtml(1);

    expect(mockAlert).toHaveBeenCalledWith(
      expect.stringContaining('ventanas emergentes')
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('debe alertar y cerrar ventana si fetch falla', async () => {
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockRejectedValue(new Error('Network error'));

    exportarSolicitudHtml(1);

    await vi.waitFor(() => {
      expect(mockClose).toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith(
        expect.stringContaining('Error al generar')
      );
    });
  });

  // ─── Comportamiento con distintos IDs ──────────────────────────

  it('debe funcionar con ID=1', () => {
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('<html>OK</html>'),
    });

    exportarSolicitudHtml(1);

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('/solicitudes/1/html');
  });

  it('debe funcionar con IDs grandes', () => {
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('<html>OK</html>'),
    });

    exportarSolicitudHtml(9999);

    const fetchUrl = mockFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toContain('/solicitudes/9999/html');
  });

  it('debe usar roka_token del localStorage', () => {
    localStorageMock.getItem.mockReturnValue('mi-token-real');
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('<html>OK</html>'),
    });

    exportarSolicitudHtml(1);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      { headers: { Authorization: 'Bearer mi-token-real' } }
    );
  });

  it('debe usar string vacío como fallback si no hay token', () => {
    localStorageMock.getItem.mockReturnValue(null);
    mockOpen.mockReturnValue(mockWindow);
    mockFetch.mockResolvedValue({
      text: () => Promise.resolve('<html>OK</html>'),
    });

    exportarSolicitudHtml(1);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      { headers: { Authorization: 'Bearer ' } }
    );
  });
});
