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
- El JSON debe ser 100% válido para JSON.parse().`;

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

  try {
    if (IMAGE_EXTENSIONS.includes(ext)) {
      // Direct image - send as-is
      const base64Data = encodeImageBase64(archivoPath);
      const mimeType = getImageMimeType(ext);
      content = [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
      ];
    } else if (ext === '.pdf') {
      // Convert PDF to PNG images using pdfjs-dist + canvas (no external binaries)
      const imagePaths = await convertPdfToImages(archivoPath);
      tempDir = path.join(path.dirname(archivoPath), 'ocr_temp');

      // Extract raw text from PDF (if it has a text layer) and inject it into the prompt.
      // This preserves Chilean number formatting (e.g. "61.716" as literal chars), letting
      // the vision model cross-check against the rendered image and avoid the ÷1000 bug.
      const pdfText = await extractPdfText(archivoPath);
      let userTextWithContext = userText;
      if (pdfText && pdfText.trim().length > 0) {
        const truncated = pdfText.substring(0, 4000);
        userTextWithContext = `${userText}

TEXTO CRUDO EXTRAÍDO DEL PDF (úsalo como referencia exacta de números; respeta los puntos como separador de miles tal cual aparecen aquí — NO inventes valores ni los acortes):
"""
${truncated}
"""`;
      }

      // Send first page (most quotation data is on page 1)
      // If multiple pages, we could process them all, but start with page 1
      const base64Data = encodeImageBase64(imagePaths[0]);
      content = [
        { type: 'text', text: userTextWithContext },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64Data}` } }
      ];

      // If there are more pages, add them (max 3 pages to stay within token limits)
      for (let i = 1; i < Math.min(imagePaths.length, 3); i++) {
        const pageBase64 = encodeImageBase64(imagePaths[i]);
        content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${pageBase64}` } });
      }
    } else if (ext === '.csv') {
      // CSV - send as text (no image needed)
      const csvContent = fs.readFileSync(archivoPath, 'utf-8');
      content = [
        { type: 'text', text: `${userText}\n\nContenido del archivo CSV:\n${csvContent.substring(0, 8000)}` }
      ];
    } else if (['.xlsx', '.xls'].includes(ext)) {
      // Excel - try to convert to image or send as text notice
      // For now, we'll try PDF conversion path or send as text
      content = [
        { type: 'text', text: `${userText}\n\n[Archivo Excel - se requiere conversión manual a imagen o CSV para procesamiento OCR óptimo]` }
      ];
    } else {
      throw Object.assign(
        new Error(`Formato de archivo no soportado: ${ext}. Formatos aceptados: PDF, PNG, JPG, WEBP, CSV`),
        { statusCode: 400 }
      );
    }

    // Call NVIDIA Nemotron Nano VL model
    const client = getNvidiaClient();
    const completion = await client.chat.completions.create({
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

    const text = completion.choices?.[0]?.message?.content || '';

    if (!text) {
      throw Object.assign(
        new Error('El modelo de IA no retornó respuesta. Intente con un archivo más claro o legible.'),
        { statusCode: 500 }
      );
    }

    // Parse JSON from response (with enable_thinking:false, output should be clean JSON)
    let parsed: any;
    let rawText = text.trim();
    try {
      // Try direct parse first (expected with reasoning disabled)
      if (rawText.startsWith('{')) {
        parsed = JSON.parse(rawText);
      } else {
        // Fallback: extract JSON block if model wrapped it in markdown or reasoning
        const jsonMatch = rawText.match(/\{[\s\S]*"items"[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON block found in response');
        }
      }
    } catch (firstError) {
      // Attempt JSON repair before giving up
      try {
        console.warn('JSON malformado, intentando reparar:', rawText.substring(0, 200));
        const repaired = repairJson(rawText);
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

    // 2. Validación semántica por item: forzar match='none' si Jaccard < 0.3
    const scItemsById = new Map(scItems.map(it => [it.solicitud_item_id, it]));
    let invalidatedMatches = 0;
    for (const item of items) {
      if (item.solicitud_item_id != null) {
        const scItem = scItemsById.get(item.solicitud_item_id);
        if (scItem) {
          const sim = jaccardSimilarity(scItem.nombre_material, item.nombre_extraido);
          if (sim < 0.3) {
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
