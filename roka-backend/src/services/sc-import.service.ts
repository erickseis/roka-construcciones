import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';
import { convertPdfToImages } from '../lib/pdf-converter';

// Extract raw text from a PDF (no OCR — only works if PDF has selectable text layer)
async function extractPdfText(pdfPath: string): Promise<string> {
  try {
    const buf = fs.readFileSync(pdfPath);
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const result = await parser.getText();
    await parser.destroy();
    return result.text || '';
  } catch {
    return ''; // scanned PDF or unparseable → skip
  }
}

// ================================================
// NVIDIA Nemotron Nano VL OCR Service for Vendor Quotations
// ================================================
// Uses nvidia/llama-3.1-nemotron-nano-vl-8b-v1 via OpenAI-compatible API
// Vision-Language model optimized for document OCR (invoices, quotations)
// PDFs are converted to PNG before processing (model only accepts images)
// ================================================

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_MODEL = 'nvidia/nemotron-nano-12b-v2-vl';

// Supported image formats for the model
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

// Initialize NVIDIA client
function getNvidiaClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error('NVIDIA_API_KEY no configurada. Configure la variable de entorno para habilitar el parseo de cotizaciones.'),
      { statusCode: 500 }
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: NVIDIA_BASE_URL,
    timeout: 300000,
    maxRetries: 0,
  });
}

// Convert PDF to PNG images using pdfjs-dist + @napi-rs/canvas
// Pure Node.js — no external binary dependencies (Ghostscript not needed)

// Encode image file to base64
function encodeImageBase64(imagePath: string): string {
  const fileBuffer = fs.readFileSync(imagePath);
  return fileBuffer.toString('base64');
}

// Get MIME type from extension
function getImageMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return mimeMap[ext] || 'image/png';
}

// Parse Excel/CSV as text (fallback when no image conversion available)
function parseFileAsText(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.csv') {
    return fs.readFileSync(filePath, 'utf-8');
  }
  // For Excel files, we can't easily read them as text without a library
  // Return a notice that the file needs image conversion
  return `[Archivo ${ext} - se requiere conversión a imagen para procesamiento OCR]`;
}

// Clean up temporary files
function cleanupTempFiles(dir: string): void {
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        fs.unlinkSync(path.join(dir, file));
      }
      fs.rmdirSync(dir);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// Normaliza texto: lowercase, sin tildes, sin puntuación, palabras ≥3 chars
function normalizeWords(s: string): Set<string> {
  if (!s) return new Set();
  const cleaned = s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // tildes
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return new Set(cleaned.split(' ').filter(w => w.length >= 3));
}

// Jaccard similarity entre dos strings
function jaccardSimilarity(a: string, b: string): number {
  const setA = normalizeWords(a);
  const setB = normalizeWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// ================================================
// Deterministic Chilean-amount parser
// Parses a raw text string (e.g. "$4.500", "61.716", "1.250,50")
// into a number based on currency-specific formatting rules.
// For CLP / UF:  . = thousands separator, , = decimal separator
// For USD:        , = thousands separator, . = decimal separator
// Returns null when input is blank/unparseable.
// ================================================
function parseChileanAmount(raw: any, moneda: string): { value: number; raw: string } | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/^\s*[$]\s*/g, '').replace(/\s+/g, '');
  if (s === '') return null;

  if (moneda === 'CLP' || moneda === 'UF') {
    // Has a comma → treat the LAST comma as decimal separator
    if (s.includes(',')) {
      const lastComma = s.lastIndexOf(',');
      const intPart = s.substring(0, lastComma).replace(/\./g, '');
      const decPart = s.substring(lastComma + 1);
      const n = parseFloat(intPart + '.' + decPart);
      return { value: isNaN(n) ? 0 : n, raw };
    }
    // Pattern: digits.ddd.ddd etc. → dots are thousands separators
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      return { value: parseInt(s.replace(/\./g, ''), 10), raw };
    }
    // Single dot with 1-2 digits → decimal
    if (/^\d+\.\d{1,2}$/.test(s)) {
      return { value: parseFloat(s), raw };
    }
    // Plain integer
    if (/^\d+$/.test(s)) {
      return { value: parseInt(s, 10), raw };
    }
    // Fallback
    const n = parseFloat(s);
    return { value: isNaN(n) ? 0 : n, raw };
  }

  // USD / standard: remove commas before parsing
  const n = parseFloat(s.replace(/,/g, ''));
  return { value: isNaN(n) ? 0 : n, raw };
}

// Detect when the model returned its schema template instead of actual extracted data
function isTemplateResponse(parsed: any): boolean {
  if (parsed?.proveedor_nombre === 'string') return true;
  if (parsed?.numero_cov === 'string') return true;
  const items = parsed?.items;
  if (Array.isArray(items) && items.length > 0) {
    if (items[0]?.nombre_extraido === 'string') return true;
  }
  return false;
}

// Helper: repair common JSON syntax errors (unclosed quotes, missing braces)
function repairJson(s: string): string {
  let r = s.trim();
  // Try to extract JSON from markdown block if present
  const mdMatch = r.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (mdMatch) r = mdMatch[1].trim();
  // Count unclosed quotes after the last opening brace
  const braceIdx = r.indexOf('{');
  if (braceIdx >= 0) {
    const afterBrace = r.substring(braceIdx);
    const quoteCount = (afterBrace.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) r += '"';
  }
  // Close unclosed braces
  const openCurl = (r.match(/\{/g) || []).length;
  const closeCurl = (r.match(/\}/g) || []).length;
  r += '}'.repeat(openCurl - closeCurl);
  // Close unclosed brackets
  const openBrack = (r.match(/\[/g) || []).length;
  const closeBrack = (r.match(/\]/g) || []).length;
  r += ']'.repeat(openBrack - closeBrack);
  return r;
}

// Call NVIDIA model with retry logic for transient network errors
async function callNvidiaWithRetry(
  client: OpenAI,
  systemPrompt: string,
  content: any[]
): Promise<any> {
  let completion: any;
  let lastError: any;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      completion = await client.chat.completions.create({
        model: NVIDIA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
        max_tokens: 4096,
        temperature: 0,
        top_p: 1,
        stream: false,
      } as any);
      break;
    } catch (err: any) {
      lastError = err;
      const isNetworkError = err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET'
        || err.type === 'system' || err.status === undefined;
      if (attempt < 3 && isNetworkError) {
        console.warn(`[sc-import] Attempt ${attempt} failed (${err.code || err.type}), retrying in ${attempt * 2}s...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }
  if (!completion) throw lastError;

  const text = completion.choices?.[0]?.message?.content || '';
  if (!text) {
    throw Object.assign(
      new Error('El modelo de IA no retornó respuesta. Intente con un archivo más claro o legible.'),
      { statusCode: 500 }
    );
  }

  let parsed: any;
  const rawText = text.trim();
  // Sanitize placeholder tokens the model emits when it can't read the document
  const sanitized = rawText
    .replace(/:\s*XXXXX\b/g, ': null')
    .replace(/:\s*"XX[^"]*"/g, ': null')
    .replace(/:\s*XX\.XXX\b/g, ': null');
  try {
    if (sanitized.startsWith('{')) {
      parsed = JSON.parse(sanitized);
    } else {
      const jsonMatch = sanitized.match(/\{[\s\S]*"items"[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON block found');
      }
    }
  } catch {
    try {
      console.warn('JSON malformado, intentando reparar:', sanitized.substring(0, 200));
      const repaired = repairJson(sanitized);
      parsed = JSON.parse(repaired);
      console.warn('JSON reparado exitosamente');
    } catch (repairError) {
      console.error('Raw AI response:', text.substring(0, 2000));
      throw Object.assign(
        new Error('No se pudo parsear la respuesta de IA como JSON. El documento puede ser ilegible o el formato no es claro.'),
        { statusCode: 500 }
      );
    }
  }

  if (isTemplateResponse(parsed)) {
    throw Object.assign(
      new Error('El modelo de IA no pudo leer el documento y retornó un esquema vacío. El PDF puede tener fuentes no embebidas o imágenes de baja calidad.'),
      { statusCode: 422 }
    );
  }

  return parsed;
}

// Main function: Parse a vendor quotation file and extract items with prices
export async function parseCotizacionArchivo(
  archivoPath: string,
  scItems: Array<{ id: number; solicitud_item_id: number; nombre_material: string; cantidad_requerida: number; unidad: string }>,
  proveedorEsperado?: string,
  moneda: string = 'CLP',
): Promise<{
  items: Array<{
    solicitud_item_id: number | null;
    nombre_extraido: string;
    precio_unitario: number;
    cantidad_extraida?: number;
    unidad_extraida?: string;
    subtotal_linea?: number;
    descuento_porcentaje?: number;
    codigo_proveedor?: string;
    match_confidence: 'high' | 'medium' | 'low' | 'none';
  }>;
  numero_cov?: string;
  proveedor_nombre?: string;
  proveedor_rut?: string;
  monto_total?: number;
  condiciones_pago?: string;
  plazo_entrega?: string;
  datos_raw?: any;
  warnings?: string[];
}> {
  const ext = path.extname(archivoPath).toLowerCase();

  // Build the items list for matching
  const itemsList = scItems.map(item =>
    `- ID:${item.solicitud_item_id} | ${item.nombre_material} | Cant:${item.cantidad_requerida} ${item.unidad}`
  ).join('\n');

  // Build currency-aware format hint
  const monedaReglas = moneda === 'CLP' || moneda === 'UF'
    ? `Moneda: ${moneda}
FORMATO NUMÉRICO CHILENO — REGLA ABSOLUTA:
En Chile el punto (.) separa MILES y la coma (,) separa decimales.
Ejemplos:
  Documento: "$3.500"  → precio_unitario: 3500  (NUNCA 3.5)
  Documento: "$2.000"  → precio_unitario: 2000
  Documento: "$324.000" → precio_unitario: 324000
  Documento: "$1.250,50" → precio_unitario: 1250.50
  Documento: "$61.716" → precio_unitario: 61716
ERROR COMÚN: "$4.500" NO es 4.5. Es CUATRO MIL QUINIENTOS = 4500.`
    : `Moneda: ${moneda}
Formato numérico estándar (punto = decimal, coma = miles).`;

  const systemPrompt = `/no_think
Eres un extractor de datos de cotizaciones de proveedores de materiales de construcción.
Responde EXCLUSIVAMENTE con JSON válido. Sin texto adicional, sin markdown, sin explicaciones.

${monedaReglas}

IMPORTANTE — CAMPOS _raw:
Cada número DEBE incluir un campo con sufijo "_raw" que contenga el TEXTO EXACTO del documento (tal cual aparece, incluyendo $, puntos y comas). Esto es obligatorio para validación posterior.
Ejemplo:
  Documento: "$4.500" → precio_unitario_raw: "$4.500"
  Documento: "61.716" → precio_unitario_raw: "61.716"

Esquema de respuesta:
{
  "numero_cov": "string|null",
  "proveedor_nombre": "string|null",
  "proveedor_rut": "string|null",
  "monto_total_raw": "string|null",
  "monto_total": number|null,
  "condiciones_pago": "string|null",
  "plazo_entrega": "string|null",
  "items": [{
    "solicitud_item_id": number|null,
    "nombre_extraido": "string",
    "precio_unitario_raw": "string",
    "precio_unitario": number,
    "cantidad_extraida": number|null,
    "unidad_extraida": "string|null",
    "subtotal_linea_raw": "string|null",
    "subtotal_linea": number|null,
    "descuento_porcentaje": number|null,
    "codigo_proveedor": "string|null",
    "match_confidence": "high|medium|low|none"
  }]
}

VALIDACIÓN OBLIGATORIA:
- precio_unitario * cantidad_extraida DEBE ser igual a subtotal_linea.
- La suma de todos los subtotal_linea DEBE ser igual a monto_total (neto, sin IVA).
- Si no cuadra, RELEE el documento y corrige los valores.
- El JSON debe ser 100% válido para JSON.parse().

ATENCIÓN MULTI-PÁGINA: Si el documento tiene varias páginas, se te enviará cada página por separado.
Extrae SOLO los ítems visibles en la página actual. No asumas ni repitas ítems de otras páginas.
Los resultados de todas las páginas se fusionarán automáticamente.`;

  const currencyLabel = moneda === 'CLP' ? 'pesos chilenos ($)' : moneda === 'UF' ? 'UF' : 'dólares (USD)';
  const userText = `Extrae los ítems y precios del documento de cotización adjunto (moneda: ${currencyLabel}).

Haz matching con estos ítems de solicitud:
${itemsList}

REGLAS:
1. NO FUERCES MATCH. Si un ítem no coincide con ninguno de la solicitud, asígnale "solicitud_item_id": null.
2. Compara semánticamente: tipo de material, dimensiones, uso.
3. match_confidence: "high" = coincidencia exacta, "medium" = mismo tipo diferente variante, "low" = mismo material base, "none" = sin relación.
4. Un solicitud_item_id solo puede asignarse a un ítem.
5. NÚMEROS: Lee cuidadosamente y respeta el formato de la moneda (${currencyLabel}). El campo "precio_unitario_raw" debe contener el texto EXACTO del documento incluyendo $, puntos y comas.
6. DESCUENTOS: Si un ítem tiene descuento, extrae el porcentaje en "descuento_porcentaje" (ej: 15 para 15%, 3.5 para 3.5%). Si no tiene, déjalo como null.
7. Verifica con descuento: precio_unitario × cantidad × (1 - descuento/100) = subtotal_linea. Si no hay descuento: precio_unitario × cantidad = subtotal_linea.
8. Extrae a nivel global los siguientes campos del encabezado del documento:
   - numero_cov: el número o folio del documento del proveedor. Busca etiquetas como "N° Cotización", "Folio", "N° Documento", "Cot. N°", "Cotización N°", "N° Orden", "Referencia", "Número", "Doc. N°", o cualquier código identificador del documento. Si hay un número visible en el encabezado aunque no tenga etiqueta, úsalo.
   - proveedor_nombre: razón social o nombre del proveedor.
   - proveedor_rut: RUT del proveedor (formato XX.XXX.XXX-X o similar).
   - monto_total: total neto sin IVA. Busca "Neto", "Total Neto", "Subtotal", "Afecto". Si solo hay total con IVA, divide por 1.19. Incluye monto_total_raw con el texto exacto.
   - condiciones_pago: forma o condición de pago (ej: "Transferencia 30 días", "Contado", "Crédito 60 días").
   - plazo_entrega: plazo de entrega indicado en el documento.`;

  // Prepare image content for the model
  let content: any[];
  let tempDir: string | null = null;
  let parsed: any;

  try {
    if (IMAGE_EXTENSIONS.includes(ext)) {
      const base64Data = encodeImageBase64(archivoPath);
      const mimeType = getImageMimeType(ext);
      content = [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
      ];

      const client = getNvidiaClient();
      parsed = await callNvidiaWithRetry(client, systemPrompt, content);
    } else if (ext === '.pdf') {
      const pdfText = await extractPdfText(archivoPath);
      const hasUsableText = pdfText && pdfText.trim().length >= 200;
      const client = getNvidiaClient();

      if (hasUsableText) {
        // Text layer present → send text-only. Avoids pdfjs Helvetica path-resolution
        // bug that produces blank PNGs and leads VLM to return schema template.
        const truncated = pdfText.substring(0, 8000);
        const textContent = [
          { type: 'text', text: `${userText}\n\nCONTENIDO DEL PDF (texto extraído):\n"""\n${truncated}\n"""` }
        ];
        parsed = await callNvidiaWithRetry(client, systemPrompt, textContent);
        content = [];
      } else {
        // No text layer (scanned PDF) → fall back to image-based OCR
        const imagePaths = await convertPdfToImages(archivoPath);
        tempDir = path.join(path.dirname(archivoPath), 'ocr_temp');

        let baseUserText = userText;
        if (pdfText && pdfText.trim().length > 0) {
          baseUserText = `${userText}\n\nTEXTO CRUDO EXTRAÍDO DEL PDF:\n"""\n${pdfText.substring(0, 4000)}\n"""`;
        }

        const totalPages = Math.min(imagePaths.length, 2);
        const allRawItems: any[] = [];
        let globalData: any = {};

        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
          const pageBase64 = encodeImageBase64(imagePaths[pageIdx]);
          const pageNum = pageIdx + 1;

          const pagePrompt = totalPages > 1
            ? `PÁGINA ${pageNum} DE ${totalPages}\n\n${baseUserText}`
            : baseUserText;

          const pageContent: any[] = [
            { type: 'text', text: pagePrompt },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${pageBase64}` } }
          ];

          const pageParsed = await callNvidiaWithRetry(client, systemPrompt, pageContent);

          if (pageParsed.items) allRawItems.push(...pageParsed.items);

          if (pageIdx === 0) {
            globalData = {
              numero_cov: pageParsed.numero_cov,
              proveedor_nombre: pageParsed.proveedor_nombre,
              proveedor_rut: pageParsed.proveedor_rut,
              monto_total: pageParsed.monto_total,
              monto_total_raw: pageParsed.monto_total_raw,
              condiciones_pago: pageParsed.condiciones_pago,
              plazo_entrega: pageParsed.plazo_entrega,
              datos_raw: pageParsed,
            };
          }
        }

        parsed = { ...globalData, items: allRawItems };
        content = [];
      }
    } else if (ext === '.csv') {
      const csvContent = fs.readFileSync(archivoPath, 'utf-8');
      content = [
        { type: 'text', text: `${userText}\n\nContenido del archivo CSV:\n${csvContent.substring(0, 8000)}` }
      ];
      const client = getNvidiaClient();
      parsed = await callNvidiaWithRetry(client, systemPrompt, content);
    } else if (['.xlsx', '.xls'].includes(ext)) {
      content = [
        { type: 'text', text: `${userText}\n\n[Archivo Excel - se requiere conversión manual a imagen o CSV para procesamiento OCR óptimo]` }
      ];
      const client = getNvidiaClient();
      parsed = await callNvidiaWithRetry(client, systemPrompt, content);
    } else {
      throw Object.assign(
        new Error(`Formato de archivo no soportado: ${ext}. Formatos aceptados: PDF, PNG, JPG, WEBP, CSV`),
        { statusCode: 400 }
      );
    }





    // ---------------------------------------------------------------
    // PROCESAMIENTO NUMÉRICO DETERMINÍSTICO POR MONEDA
    // 1. Si el LLM incluyó campo _raw → lo parseamos con
    //    parseChileanAmount() según la moneda del proyecto.
    //    Ese valor es la FUENTE DE VERDAD (sobreescribe al LLM).
    // 2. Sin _raw → heurística de ×1000 (como antes).
    // En ambos casos se registran warnings cuando hay discrepancia.
    // ---------------------------------------------------------------
    const items = (parsed.items || []).map((item: any) => {
      const rawCantidad = item.cantidad_extraida != null ? Number(item.cantidad_extraida) : undefined;
      const rawSubtotalLlm = item.subtotal_linea != null ? Number(item.subtotal_linea) : undefined;
      const rawDescuento = item.descuento_porcentaje != null ? Number(item.descuento_porcentaje) : undefined;

      // --- Precio: raw text → deterministic parse → override LLM ---
      const parsedPrecio = parseChileanAmount(item.precio_unitario_raw, moneda);
      const precioDesdeRaw = parsedPrecio?.value;
      let precioFinal: number;
      let precioSource: 'raw_deterministic' | 'llm' | 'llm_x1000' = 'llm';

      if (precioDesdeRaw != null && item.precio_unitario_raw) {
        // Deterministic parse succeeded — use it
        precioFinal = precioDesdeRaw;
        precioSource = 'raw_deterministic';
      } else {
        // Fallback: LLM numeric value
        precioFinal = Number(item.precio_unitario) || 0;
      }

      // --- Subtotal: deterministic parse → override LLM ---
      const parsedSubtotal = parseChileanAmount(item.subtotal_linea_raw, moneda);
      let subtotalFinal = rawSubtotalLlm;

      if (parsedSubtotal != null && item.subtotal_linea_raw) {
        subtotalFinal = parsedSubtotal.value;
      }

      // --- Cross-validate precio vs subtotal (×1000 heuristic as fallback) ---
      // If we used raw text but precio × cantidad doesn't match subtotal,
      // AND the ×1000 version does match → ×1000 correction needed
      if (precioSource === 'raw_deterministic' && precioFinal > 0 && subtotalFinal != null && rawCantidad && subtotalFinal > 0) {
        const calcNormal = precioFinal * rawCantidad;
        const calcX1000 = precioFinal * 1000 * rawCantidad;
        const diffNormal = Math.abs(calcNormal - subtotalFinal) / subtotalFinal;
        const diffX1000 = Math.abs(calcX1000 - subtotalFinal) / subtotalFinal;
        if (diffX1000 < 0.01 && diffNormal > 0.5) {
          precioFinal = Math.round(precioFinal * 1000);
          if (subtotalFinal != null) subtotalFinal = Math.round(subtotalFinal * 1000);
          precioSource = 'llm_x1000';
        }
      }

      // --- Last-resort fallback (no raw text, no ×1000 match) ---
      if (precioSource === 'llm') {
        // Try the old ×1000 heuristic
        let calcSubtotal = subtotalFinal;
        if (rawSubtotalLlm && rawCantidad && rawSubtotalLlm > 0 && precioFinal > 0) {
          const calcNormal = precioFinal * rawCantidad;
          const calcX1000 = precioFinal * 1000 * rawCantidad;
          const diffNormal = Math.abs(calcNormal - rawSubtotalLlm) / rawSubtotalLlm;
          const diffX1000 = Math.abs(calcX1000 - rawSubtotalLlm) / rawSubtotalLlm;
          if (diffX1000 < 0.01 && diffNormal > 0.5) {
            precioFinal = Math.round(precioFinal * 1000);
            calcSubtotal = Math.round(rawSubtotalLlm * 1000);
            precioSource = 'llm_x1000';
          }
          subtotalFinal = calcSubtotal;
        }
      }

      return {
        solicitud_item_id: item.solicitud_item_id ?? null,
        nombre_extraido: String(item.nombre_extraido || ''),
        precio_unitario: precioFinal,
        cantidad_extraida: rawCantidad,
        unidad_extraida: item.unidad_extraida ? String(item.unidad_extraida) : undefined,
        subtotal_linea: subtotalFinal,
        descuento_porcentaje: rawDescuento,
        codigo_proveedor: item.codigo_proveedor ? String(item.codigo_proveedor) : undefined,
        match_confidence: ['high', 'medium', 'low', 'none'].includes(item.match_confidence)
          ? item.match_confidence
          : 'none',
        _precio_source: precioSource,
      } as any;
    });

    // ---------------------------------------------------------------
    // VALIDACIONES POST-LLM: detectar hallucinations / discrepancias
    // ---------------------------------------------------------------
    const warnings: string[] = [];

    // --- Monto total: deterministic parse + ×1000 validation ---
    const parsedMontoTotal = parseChileanAmount(parsed.monto_total_raw, moneda);
    let montoTotalFinal: number | null = parsedMontoTotal?.value ?? null;

    // If no raw text for monto_total, use LLM's value
    if (montoTotalFinal == null && parsed.monto_total != null) {
      montoTotalFinal = Number(parsed.monto_total);
    }

    // --- Count items corrected by raw text / ×1000 for warnings ---
    const itemsRawSource = items.filter((it: any) => it._precio_source === 'raw_deterministic');
    const itemsX1000 = items.filter((it: any) => it._precio_source === 'llm_x1000');

    if (itemsX1000.length > 0) {
      warnings.push(
        `Se aplicó corrección ×1000 a ${itemsX1000.length} ítem(s) porque el subtotal no cuadraba. Verifique los valores antes de confirmar.`
      );
    }

    // ---------------------------------------------------------------
    // RESCUE GLOBAL ÷1000: si el monto_total fue extraído correctamente
    // pero la suma de subtotales está ~1000× por debajo, todos los items
    // están ÷1000. Solo dispara si no hubo correcciones previas.
    // ---------------------------------------------------------------
    if (itemsX1000.length === 0 && montoTotalFinal != null) {
      const sumSubtotalesPreCheck = items.reduce(
        (s: number, it: any) => s + (Number(it.subtotal_linea) || (Number(it.precio_unitario) || 0) * (Number(it.cantidad_extraida) || 1)),
        0
      );
      if (montoTotalFinal > 0 && sumSubtotalesPreCheck > 0) {
        const ratio = montoTotalFinal / sumSubtotalesPreCheck;
        if (ratio > 900 && ratio < 1100) {
          for (const it of items) {
            it.precio_unitario = Math.round(it.precio_unitario * 1000);
            if (it.subtotal_linea != null) it.subtotal_linea = Math.round(it.subtotal_linea * 1000);
          }
          warnings.push(
            `Se detectó escalado ÷1000 global (monto_total $${montoTotalFinal.toLocaleString('es-CL')} vs suma de subtotales $${Math.round(sumSubtotalesPreCheck).toLocaleString('es-CL')}); todos los items fueron multiplicados ×1000. Verifique los valores antes de confirmar.`
          );
        }
      }
    }

    // ---------------------------------------------------------------
    // VALIDACIÓN POST-LLM: descuentos
    // ---------------------------------------------------------------
    for (const item of items) {
      if (item.descuento_porcentaje && item.descuento_porcentaje > 0 && item.subtotal_linea && item.cantidad_extraida) {
        const expectedSubtotal = item.precio_unitario * item.cantidad_extraida * (1 - item.descuento_porcentaje / 100);
        if (Math.abs(expectedSubtotal - item.subtotal_linea) / item.subtotal_linea > 0.05) {
          warnings.push(
            `Ítem "${item.nombre_extraido}": descuento del ${item.descuento_porcentaje}% no cuadra con el subtotal $${item.subtotal_linea}. Se esperaba $${Math.round(expectedSubtotal)}.`
          );
        }
      }
    }

    // 1. Validación de proveedor esperado vs extraído
    if (proveedorEsperado && parsed.proveedor_nombre) {
      const provSim = jaccardSimilarity(proveedorEsperado, parsed.proveedor_nombre);
      if (provSim < 0.2) {
        warnings.push(
          `El proveedor del documento ("${parsed.proveedor_nombre}") no coincide con el proveedor de la SC ("${proveedorEsperado}"). Verifica que el archivo corresponda a esta cotización.`
        );
      }
    }

    // 2. Validación semántica por item: solo invalidar matches cuando Jaccard
    //    sugiere error claro. Para alta/media confianza del LLM, confiar en la
    //    semántica del modelo (materiales de construcción tienen sinónimos que
    //    Jaccard no puede resolver: fierro=barra corrugada, corrugado≠corrugada).
    const scItemsById = new Map(scItems.map(it => [it.solicitud_item_id, it]));
    let invalidatedMatches = 0;
    for (const item of items) {
      if (item.solicitud_item_id != null) {
        const scItem = scItemsById.get(item.solicitud_item_id);
        if (scItem) {
          const sim = jaccardSimilarity(scItem.nombre_material, item.nombre_extraido);
          const confidence = item.match_confidence;
          // 'high' → confiar en IA, sin validación Jaccard
          // 'medium' → solo invalidar si sim === 0 (sin ninguna palabra en común)
          // 'low' → invalidar si sim < 0.15 (umbral relajado desde 0.3)
          if (
            (confidence === 'low' && sim < 0.15) ||
            (confidence === 'medium' && sim === 0)
          ) {
            item.solicitud_item_id = null;
            item.match_confidence = 'none';
            invalidatedMatches++;
          }
        }
      }
    }
    if (invalidatedMatches > 0) {
      warnings.push(
        `Se descartaron ${invalidatedMatches} match(es) automáticos porque los nombres extraídos no coinciden con los items de la SC. Revisa manualmente o sube otro archivo.`
      );
    }

    // 3. Validación de monto total: comparar con suma de subtotales
    const sumSubtotales = items.reduce((s, it) => s + (Number(it.subtotal_linea) || 0), 0);
    if (montoTotalFinal != null && sumSubtotales > 0) {
      const diff = Math.abs(montoTotalFinal - sumSubtotales) / Math.max(montoTotalFinal, sumSubtotales);
      if (diff > 0.05) {
        warnings.push(
          `Discrepancia: monto total del documento ($${montoTotalFinal.toLocaleString('es-CL')}) no coincide con suma de subtotales ($${sumSubtotales.toLocaleString('es-CL')}).`
        );
      }
    }

    // 4. Si TODOS los items quedaron sin match → archivo probablemente no corresponde
    const itemsConMatch = items.filter(it => it.solicitud_item_id != null).length;
    if (items.length > 0 && itemsConMatch === 0 && scItems.length > 0) {
      warnings.unshift(
        `⚠️ Ningún item del documento coincidió con los items de esta SC. Verifica que el archivo corresponda a la cotización correcta.`
      );
    }

    // 5. Warnings informativos por fuente de precio
    if (itemsRawSource.length > 0) {
      warnings.push(
        `${itemsRawSource.length} ítem(s) usaron parseo determinístico desde _raw (fuente: texto exacto del documento).`
      );
    }

    // Strip internal metadata from items
    const cleanItems = (items as any[]).map(({ _precio_source, ...rest }) => rest);

    return {
      items: cleanItems,
      numero_cov: parsed.numero_cov || undefined,
      proveedor_nombre: parsed.proveedor_nombre || undefined,
      proveedor_rut: parsed.proveedor_rut || undefined,
      monto_total: montoTotalFinal ?? undefined,
      condiciones_pago: parsed.condiciones_pago || undefined,
      plazo_entrega: parsed.plazo_entrega || undefined,
      datos_raw: parsed,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } finally {
    // Clean up temporary files
    if (tempDir) {
      cleanupTempFiles(tempDir);
    }
  }
}
