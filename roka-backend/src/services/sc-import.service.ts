import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import OpenAI from 'openai';

// ================================================
// NVIDIA Nemotron Omni OCR Service for Vendor Quotations
// ================================================
// Uses nvidia/nemotron-3-nano-omni-30b-a3b-reasoning via OpenAI-compatible API
// Omni-modal reasoning model (30B total, 3B active via MoE)
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

// Main function: Parse a vendor quotation file and extract items with prices
export async function parseCotizacionArchivo(
  archivoPath: string,
  scItems: Array<{ id: number; solicitud_item_id: number; nombre_material: string; cantidad_requerida: number; unidad: string }>
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
}> {
  const ext = path.extname(archivoPath).toLowerCase();

  // Build the items list for matching
  const itemsList = scItems.map(item =>
    `- ID:${item.solicitud_item_id} | ${item.nombre_material} | Cant:${item.cantidad_requerida} ${item.unidad}`
  ).join('\n');

  // System prompt for Nemotron Omni — structured extraction, no reasoning tokens
  const systemPrompt = `Eres un extractor de datos de cotizaciones de proveedores de materiales de construcción.
Responde EXCLUSIVAMENTE con JSON válido, sin texto adicional, sin markdown, sin explicaciones.

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
}`;

  const userText = `Extrae los ítems y precios del documento adjunto. Haz matching con estos ítems de solicitud:
${itemsList}

REGLAS DE MATCHING ESTRICTAS:
1. NO FUERCES UN MATCH. Si un ítem del documento no se parece a NINGUNO de la solicitud, asígnale "solicitud_item_id": null y "match_confidence": "none".
2. Para hacer match, compara SEMÁNTICAMENTE: tipo de material (ej. Tornillo vs Barra), uso (Madera vs Hormigón), dimensiones y características clave.
3. Clasificación de confianza:
   - "high": Coincide exactamente o es un claro sinónimo (ej. "Malla Raschel Negra 80%" vs "Malla Sombra 80% Negra").
   - "medium": Mismo tipo de material pero difiere levemente en marca, dimensión menor o presentación (ej. "Pino 1x4x3.2" vs "Pino Bruto 1x4").
   - "low": Mismo material base pero características diferentes (ej. Tornillo de 1" vs Tornillo de 2").
   - "none": Materiales completamente distintos (ej. Tornillo vs Barra, Malla vs Cemento). NO asignes solicitud_item_id.
4. Un mismo "solicitud_item_id" no puede ser asignado a más de un ítem extraído.
5. Extrae: precio unitario, cantidad, unidad, código proveedor, subtotal línea, descuento.
6. Identifica a nivel global: número COV (cotización), nombre proveedor, RUT, monto total, condiciones pago, plazo entrega.`;

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

    // Call NVIDIA Nemotron model
    const client = getNvidiaClient();
    const completion = await client.chat.completions.create({
      model: NVIDIA_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content }
      ],
      max_tokens: 3072,
      temperature: 0,
      top_p: 1,
      stream: false,
      // Disable reasoning chain for faster structured output (Nemotron Omni specific)
      chat_template_kwargs: { enable_thinking: false },
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
    try {
      // Try direct parse first (expected with reasoning disabled)
      const trimmed = text.trim();
      if (trimmed.startsWith('{')) {
        parsed = JSON.parse(trimmed);
      } else {
        // Fallback: extract JSON block if model wrapped it in markdown or reasoning
        const jsonMatch = trimmed.match(/\{[\s\S]*"items"[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON block found in response');
        }
      }
    } catch (parseError) {
      console.error('Raw AI response:', text.substring(0, 2000));
      throw Object.assign(
        new Error('No se pudo parsear la respuesta de IA como JSON. El documento puede ser ilegible o el formato no es claro.'),
        { statusCode: 500 }
      );
    }

    // Validate and normalize the response
    const items = (parsed.items || []).map((item: any) => ({
      solicitud_item_id: item.solicitud_item_id ?? null,
      nombre_extraido: String(item.nombre_extraido || ''),
      precio_unitario: Number(item.precio_unitario) || 0,
      cantidad_extraida: item.cantidad_extraida != null ? Number(item.cantidad_extraida) : undefined,
      unidad_extraida: item.unidad_extraida ? String(item.unidad_extraida) : undefined,
      subtotal_linea: item.subtotal_linea != null ? Number(item.subtotal_linea) : undefined,
      descuento_porcentaje: item.descuento_porcentaje != null ? Number(item.descuento_porcentaje) : undefined,
      codigo_proveedor: item.codigo_proveedor ? String(item.codigo_proveedor) : undefined,
      match_confidence: ['high', 'medium', 'low', 'none'].includes(item.match_confidence) 
        ? item.match_confidence 
        : 'none',
    }));

    return {
      items,
      numero_cov: parsed.numero_cov || undefined,
      proveedor_nombre: parsed.proveedor_nombre || undefined,
      proveedor_rut: parsed.proveedor_rut || undefined,
      monto_total: parsed.monto_total != null ? Number(parsed.monto_total) : undefined,
      condiciones_pago: parsed.condiciones_pago || undefined,
      plazo_entrega: parsed.plazo_entrega || undefined,
      datos_raw: parsed,
    };
  } finally {
    // Clean up temporary files
    if (tempDir) {
      cleanupTempFiles(tempDir);
    }
  }
}
