import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import OpenAI from 'openai';

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

// Convert PDF to PNG images using Ghostscript (gs) directly
// This avoids dependency on GraphicsMagick/ImageMagick system packages
function convertPdfToImages(pdfPath: string): string[] {
  const outputDir = path.join(path.dirname(pdfPath), 'ocr_temp');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const baseName = path.basename(pdfPath, '.pdf');

  try {
    execSync(
      `gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r200 ` +
      `-sOutputFile="${outputDir}/${baseName}-%d.png" ` +
      `-dFirstPage=1 -dLastPage=3 ` +
      `-dTextAlphaBits=4 -dGraphicsAlphaBits=4 ` +
      `"${pdfPath}"`,
      { timeout: 30000 }
    );
  } catch (err) {
    throw Object.assign(
      new Error('No se pudo convertir el PDF a imagen. Verifique que Ghostscript (gs) esté instalado y el archivo sea un PDF válido.'),
      { statusCode: 400 }
    );
  }

  const files = fs.readdirSync(outputDir)
    .filter(f => f.startsWith(baseName))
    .sort()
    .map(f => path.join(outputDir, f));

  if (files.length === 0) {
    throw Object.assign(
      new Error('No se pudo convertir el PDF a imagen. El archivo puede estar vacío o dañado.'),
      { statusCode: 400 }
    );
  }

  return files;
}

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

// Main function: Parse a vendor quotation file and extract items with prices
export async function parseCotizacionArchivo(
  archivoPath: string,
  scItems: Array<{ id: number; solicitud_item_id: number; nombre_material: string; cantidad_requerida: number; unidad: string }>,
  proveedorEsperado?: string
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

  // System prompt — structured JSON extraction from vendor quotation documents
  const systemPrompt = `/no_think
Eres un extractor de datos de cotizaciones de proveedores de materiales de construcción en Chile.
Responde EXCLUSIVAMENTE con JSON válido. Sin texto adicional, sin markdown, sin explicaciones.

FORMATO NUMÉRICO CHILENO — LEE ESTO CUIDADOSAMENTE:
En Chile, el punto (.) separa MILES y la coma (,) separa decimales.
Ejemplos de conversión del documento al JSON:
  "$3.500" en el documento → 3500 en el JSON
  "$2.000" en el documento → 2000 en el JSON
  "$324.000" en el documento → 324000 en el JSON
  "$1.250,50" en el documento → 1250.50 en el JSON
NUNCA escribas 3.5 si el documento dice $3.500. Eso es TRES MIL QUINIENTOS = 3500.

Esquema de respuesta:
{
  "numero_cov": "string|null",
  "proveedor_nombre": "string|null",
  "proveedor_rut": "string|null",
  "monto_total": number|null,
  "condiciones_pago": "string|null",
  "plazo_entrega": "string|null",
  "items": [{
    "solicitud_item_id": number|null,
    "nombre_extraido": "string",
    "precio_unitario": number,
    "cantidad_extraida": number|null,
    "unidad_extraida": "string|null",
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

  const userText = `Extrae los ítems y precios del documento de cotización adjunto.

Haz matching con estos ítems de solicitud:
${itemsList}

REGLAS:
1. NO FUERCES MATCH. Si un ítem no coincide con ninguno de la solicitud, asígnale "solicitud_item_id": null.
2. Compara semánticamente: tipo de material, dimensiones, uso.
3. match_confidence: "high" = coincidencia exacta, "medium" = mismo tipo diferente variante, "low" = mismo material base, "none" = sin relación.
4. Un solicitud_item_id solo puede asignarse a un ítem.
5. NÚMEROS: Lee cuidadosamente. $3.500 = 3500, $2.000 = 2000, $324.000 = 324000. El punto en montos chilenos es separador de miles, NO decimal.
6. Verifica: precio_unitario × cantidad = subtotal_linea.
7. Extrae a nivel global: número de cotización, proveedor, RUT, monto total neto, condiciones, plazo.`;

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
      // Convert PDF to PNG images first using Ghostscript
      const imagePaths = convertPdfToImages(archivoPath);
      tempDir = path.join(path.dirname(archivoPath), 'ocr_temp');

      // Send first page (most quotation data is on page 1)
      // If multiple pages, we could process them all, but start with page 1
      const base64Data = encodeImageBase64(imagePaths[0]);
      content = [
        { type: 'text', text: userText },
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
    // SANITIZACIÓN: Corrige el error de separador de miles chileno.
    // El modelo de IA puede leer "$4.500" como 4.5 (en vez de 4500)
    // porque interpreta el punto como decimal (formato anglosajón).
    // Si precio * cantidad ≈ subtotal/1000, multiplicamos todo x1000.
    // ---------------------------------------------------------------
    function sanitizeCLPValue(raw: any): number {
      const n = Number(raw);
      return isNaN(n) ? 0 : n;
    }

    function fixThousandsSeparator(precio: number, cantidad: number | undefined, subtotal: number | undefined): number {
      if (!precio || precio === 0) return precio;
      // Si el precio parece un float con máximo 3 decimales (ej. 4.5, 324.0)
      // y tenemos subtotal, verificamos si precio*1000*cantidad ≈ subtotal
      if (subtotal && cantidad && subtotal > 0) {
        const calcNormal = precio * cantidad;
        const calcX1000 = precio * 1000 * cantidad;
        const diffNormal = Math.abs(calcNormal - subtotal) / subtotal;
        const diffX1000 = Math.abs(calcX1000 - subtotal) / subtotal;
        if (diffX1000 < 0.01 && diffNormal > 0.5) {
          // La versión ×1000 encaja mucho mejor con el subtotal
          return precio * 1000;
        }
      }
      // Heurística adicional: si el precio tiene parte decimal que parece miles
      // (ej. 4.5 → el .5 representa 500, así que es 4500)
      // Detectamos cuando precio < 1000 y el precio en el documento claramente
      // debería ser un número de 4+ dígitos (precio tiene decimales .5, .25, etc.)
      if (precio < 1000 && !Number.isInteger(precio)) {
        const decimals = precio - Math.floor(precio);
        // Si los decimales son múltiplos exactos de 0.1, 0.25, 0.5 → probablemente miles mal leídos
        const roundedDecimals = Math.round(decimals * 1000);
        if (roundedDecimals % 100 === 0 || roundedDecimals % 250 === 0 || roundedDecimals % 500 === 0) {
          // Verificar con subtotal si está disponible
          if (subtotal && cantidad) {
            const candidatePrice = Math.floor(precio) * 1000 + roundedDecimals;
            const candidateTotal = candidatePrice * cantidad;
            if (Math.abs(candidateTotal - subtotal) / subtotal < 0.01) {
              return candidatePrice;
            }
          }
        }
      }
      return precio;
    }

    // Validate and normalize the response
    const items = (parsed.items || []).map((item: any) => {
      const rawPrecio = sanitizeCLPValue(item.precio_unitario);
      const rawCantidad = item.cantidad_extraida != null ? Number(item.cantidad_extraida) : undefined;
      const rawSubtotal = item.subtotal_linea != null ? sanitizeCLPValue(item.subtotal_linea) : undefined;

      // Auto-correct subtotal if it also suffered thousands-as-decimal issue
      let correctedSubtotal = rawSubtotal;
      if (rawSubtotal && rawCantidad) {
        const calcSubtotalX1000 = rawPrecio * 1000 * rawCantidad;
        const calcSubtotalNormal = rawPrecio * rawCantidad;
        if (rawSubtotal > 0) {
          const diffNormal = Math.abs(calcSubtotalNormal - rawSubtotal) / rawSubtotal;
          const diffX1000 = Math.abs(calcSubtotalX1000 - rawSubtotal * 1000) / (rawSubtotal * 1000);
          if (diffX1000 < 0.01 && diffNormal > 0.5) {
            correctedSubtotal = rawSubtotal * 1000;
          }
        }
      }

      const correctedPrecio = fixThousandsSeparator(rawPrecio, rawCantidad, correctedSubtotal);

      return {
        solicitud_item_id: item.solicitud_item_id ?? null,
        nombre_extraido: String(item.nombre_extraido || ''),
        precio_unitario: correctedPrecio,
        cantidad_extraida: rawCantidad,
        unidad_extraida: item.unidad_extraida ? String(item.unidad_extraida) : undefined,
        subtotal_linea: correctedSubtotal,
        descuento_porcentaje: item.descuento_porcentaje != null ? Number(item.descuento_porcentaje) : undefined,
        codigo_proveedor: item.codigo_proveedor ? String(item.codigo_proveedor) : undefined,
        match_confidence: ['high', 'medium', 'low', 'none'].includes(item.match_confidence)
          ? item.match_confidence
          : 'none',
      };
    });

    // ---------------------------------------------------------------
    // VALIDACIONES POST-LLM: detectar hallucinations
    // ---------------------------------------------------------------
    const warnings: string[] = [];

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
    const montoTotal = parsed.monto_total != null ? Number(parsed.monto_total) : null;
    if (montoTotal && sumSubtotales > 0) {
      const diff = Math.abs(montoTotal - sumSubtotales) / Math.max(montoTotal, sumSubtotales);
      if (diff > 0.05) {
        warnings.push(
          `Discrepancia: monto total del documento ($${montoTotal.toLocaleString('es-CL')}) no coincide con suma de subtotales ($${sumSubtotales.toLocaleString('es-CL')}).`
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

    return {
      items,
      numero_cov: parsed.numero_cov || undefined,
      proveedor_nombre: parsed.proveedor_nombre || undefined,
      proveedor_rut: parsed.proveedor_rut || undefined,
      monto_total: montoTotal ?? undefined,
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
