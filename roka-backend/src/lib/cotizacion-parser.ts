import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import xlsx from 'xlsx';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ParsedQuotation, ParsedItem } from '../types/cotizacion-import.types';

const execFileAsync = promisify(execFile);

/**
 * Prompt para extraer datos estructurados de cotizaciones
 */
const COTIZACION_EXTRACTION_PROMPT = `Eres un asistente especializado en extraer información estructurada de cotizaciones comerciales en español.

Extrae los siguientes datos del documento de cotización y devuelve SOLO un objeto JSON válido (sin texto adicional):

1. **proveedor_rut**: RUT del proveedor (formato: XX.XXX.XXX-X)
2. **proveedor_nombre**: Nombre o razón social del proveedor
3. **proveedor_direccion**: Dirección del proveedor (puede ser null si no aparece)
4. **proveedor_telefono**: Teléfono de contacto (puede ser null)
5. **proveedor_correo**: Correo electrónico (puede ser null)
6. **numero_cov**: Número de cotización/folio del documento
7. **fecha**: Fecha de la cotización (formato YYYY-MM-DD)
8. **vendedor**: Nombre del vendedor (puede ser null)
9. **validez**: Validez de la oferta en días (puede ser null)
10. **items**: Array de ítems con:
    - codigo: Código del producto
    - descripcion: Descripción del producto
    - cantidad: Cantidad solicitada
    - unidad: Unidad de medida
    - precio_neto_unitario: Precio unitario sin IVA
    - descuento_porcentaje: Descuento aplicado (0 si no hay)
    - total_linea: Total de la línea (cantidad * precio - descuento)
11. **condicion_pago**: Condiciones de pago (puede ser null)
12. **condicion_entrega**: Condiciones de entrega (puede ser null)
13. **subtotal_neto**: Subtotal sin IVA
14. **iva**: Monto del IVA (19% típicamente)
15. **total**: Total con IVA
16. **observaciones**: Observaciones adicionales (puede ser null)
17. **descuento_global_porcentaje**: Descuento general aplicado al subtotal (puede ser null)
18. **descuento_global_monto**: Monto del descuento global (puede ser null)

Si no puedes extraer algún campo, usa null. Para números, usa valores numéricos (no strings con "$").

Ejemplo de respuesta esperada:
{
  "proveedor_rut": "76.123.456-7",
  "proveedor_nombre": "Comercial ABC SpA",
  "proveedor_direccion": "Av. Principal 123, Santiago",
  "proveedor_telefono": "+56 2 1234 5678",
  "proveedor_correo": "ventas@comercialabc.cl",
  "numero_cov": "COT-2024-001",
  "fecha": "2024-01-15",
  "vendedor": "Juan Pérez",
  "validez": "30",
  "items": [
    {
      "codigo": "MAT001",
      "descripcion": "Cemento Portland 25kg",
      "cantidad": 50,
      "unidad": "sacos",
      "precio_neto_unitario": 12500,
      "descuento_porcentaje": 0,
      "total_linea": 625000
    }
  ],
  "condicion_pago": "Neto 30 días",
  "condicion_entrega": "Despacho a obra",
  "subtotal_neto": 625000,
  "iva": 118750,
  "total": 743750,
  "observaciones": null,
  "descuento_global_porcentaje": null,
  "descuento_global_monto": null
}`;

/**
 * Inicializa el cliente de OpenAI con la API de NVIDIA
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY no está configurada en las variables de entorno');
  }

  return new OpenAI({
    apiKey,
    baseURL: 'https://integrate.api.nvidia.com/v1',
  });
}

/**
 * Convierte un archivo a base64
 */
function fileToBase64(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * Convierte la primera página de un PDF a imagen PNG usando ImageMagick directamente.
 * Fallback: extrae texto del PDF usando pdftotext si está disponible.
 */
async function convertPdfPageToImage(pdfPath: string): Promise<{ base64: string; isImage: boolean }> {
  const outputPath = `/tmp/cotizacion_${Date.now()}.png`;
  
  // Método 1: Convertir PDF a PNG usando ImageMagick (magick convert)
  try {
    // Try 'magick' first (IM7), then 'convert' (IM6/IM7 alias)
    let command = 'magick';
    let args = ['convert', '-density', '150', '-quality', '90', `${pdfPath}[0]`, outputPath];
    
    try {
      const { stdout, stderr } = await execFileAsync(command, args, { timeout: 30000 });
      console.log('PDF converted to image using magick convert');
    } catch (magickError: any) {
      // If 'magick' fails, try 'convert' directly (IM6 or IM7 with legacy support)
      console.warn('magick command failed, trying convert:', magickError.message?.substring(0, 100));
      command = 'convert';
      args = ['-density', '150', '-quality', '90', `${pdfPath}[0]`, outputPath];
      await execFileAsync(command, args, { timeout: 30000 });
      console.log('PDF converted to image using convert');
    }
    
    // Read the generated PNG file
    if (fs.existsSync(outputPath)) {
      const imageBuffer = fs.readFileSync(outputPath);
      const base64 = imageBuffer.toString('base64');
      
      // Clean up temp file
      try { fs.unlinkSync(outputPath); } catch {}
      
      if (base64.length > 0) {
        console.log('PDF to image conversion successful, base64 length:', base64.length);
        return { base64, isImage: true };
      }
    }
  } catch (error) {
    console.warn('ImageMagick conversion failed:', (error as Error).message);
    // Clean up temp file if it exists
    try { fs.unlinkSync(outputPath); } catch {}
  }
  
  // Método 2: Extraer texto del PDF usando pdftotext (si está disponible)
  try {
    const { stdout } = await execFileAsync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], { timeout: 15000 });
    if (stdout && stdout.trim().length > 50) {
      console.log('PDF text extraction succeeded using pdftotext, length:', stdout.length);
      return { base64: stdout, isImage: false };
    }
  } catch (error) {
    console.warn('pdftotext not available or failed:', (error as Error).message?.substring(0, 100));
  }
  
  // Método 3: Intentar leer el PDF como texto crudo (último recurso)
  try {
    const fileBuffer = fs.readFileSync(pdfPath);
    // Extract text content from PDF buffer (simple regex-based extraction)
    const textContent = fileBuffer.toString('latin1')
      .replace(/[^\x20-\x7E\xA0-\xFF\n\r]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Check if we got meaningful text (more than just binary garbage)
    const meaningfulText = textContent.match(/[a-zA-Z]{3,}/g);
    if (meaningfulText && meaningfulText.length > 20) {
      console.log('PDF raw text extraction found meaningful content');
      // This is low quality but better than nothing
      return { base64: textContent.substring(0, 50000), isImage: false };
    }
  } catch (error) {
    console.warn('Raw text extraction also failed:', (error as Error).message);
  }
  
  throw new Error(
    'No se pudo procesar el PDF. Asegúrese de que ImageMagick esté instalado y que el PDF contenga contenido. ' +
    'Para PDFs escaneados, se requiere ImageMagick para convertir a imagen.'
  );
}

/**
 * Parsea un archivo de cotización usando NVIDIA Nemotron
 * Soporta tanto imágenes como texto extraído de PDF
 */
async function parseWithVisionModel(content: string, isImage: boolean, mimeType?: string): Promise<ParsedQuotation> {
  const openai = getOpenAIClient();

  // Verificar tamaño de la imagen si es un formato de imagen
  if (isImage && content.length > 10 * 1024 * 1024) {
    throw new Error('La imagen es demasiado grande para procesar. El tamaño máximo es 10MB.');
  }

  let messages: any[];

  if (isImage) {
    // Modo imagen - enviar al modelo de visión
    const contentType = mimeType || 'image/png';
    messages = [
      {
        role: 'user',
        content: [
          { type: 'text', text: COTIZACION_EXTRACTION_PROMPT },
          {
            type: 'image_url',
            image_url: { url: `data:${contentType};base64,${content}` }
          }
        ]
      }
    ];
  } else {
    // Modo texto - enviar texto extraído al modelo
    messages = [
      {
        role: 'user',
        content: `${COTIZACION_EXTRACTION_PROMPT}\n\n--- CONTENIDO DEL PDF ---\n${content}\n--- FIN DEL PDF ---`
      }
    ];
  }

  const completion = await openai.chat.completions.create({
    model: 'nvidia/nemotron-nano-12b-v2-vl',
    messages,
    max_tokens: 4096,
    temperature: 0.1,
  });

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('No se recibió respuesta del modelo de visión');
  }

  // Limpiar la respuesta y parsear como JSON
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No se pudo extraer JSON de la respuesta del modelo');
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return normalizeParsedQuotation(parsed);
  } catch (error) {
    console.error('Error parsing JSON response:', responseText);
    throw new Error('La respuesta del modelo no es un JSON válido');
  }
}

/**
 * Normaliza los datos parseados para asegurar tipos correctos
 */
function normalizeParsedQuotation(data: any): ParsedQuotation {
  return {
    proveedor_rut: String(data.proveedor_rut || '').trim(),
    proveedor_nombre: String(data.proveedor_nombre || '').trim(),
    proveedor_direccion: data.proveedor_direccion || null,
    proveedor_telefono: data.proveedor_telefono || null,
    proveedor_correo: data.proveedor_correo || null,
    numero_cov: String(data.numero_cov || '').trim() || 'SIN-NUMERO',
    fecha: data.fecha || new Date().toISOString().split('T')[0],
    vendedor: data.vendedor || null,
    validez: data.validez || null,
    items: Array.isArray(data.items) ? data.items.map((item: any) => ({
      codigo: String(item.codigo || '').trim() || 'SIN-CODIGO',
      descripcion: String(item.descripcion || '').trim(),
      cantidad: Number(item.cantidad) || 0,
      unidad: String(item.unidad || '').trim() || 'und',
      precio_neto_unitario: Number(item.precio_neto_unitario) || 0,
      descuento_porcentaje: Number(item.descuento_porcentaje) || 0,
      total_linea: Number(item.total_linea) || 0,
    })) : [],
    condicion_pago: data.condicion_pago || null,
    condicion_entrega: data.condicion_entrega || null,
    subtotal_neto: Number(data.subtotal_neto) || 0,
    iva: Number(data.iva) || 0,
    total: Number(data.total) || 0,
    observaciones: data.observaciones || null,
    descuento_global_porcentaje: data.descuento_global_porcentaje != null ? Number(data.descuento_global_porcentaje) : null,
    descuento_global_monto: data.descuento_global_monto != null ? Number(data.descuento_global_monto) : null,
  };
}

/**
 * Normaliza el nombre de una columna de Excel para matching
 */
function normalizeColumnName(col: string): string {
  return col.toLowerCase().trim()
    .replace(/[_\-\s]+/g, '')
    .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u');
}

/**
 * Mapea nombres de columnas comunes a campos estándar
 */
function mapColumnToField(colName: string): string | null {
  const normalized = normalizeColumnName(colName);
  
  const mappings: Record<string, string> = {
    'codigo': 'codigo',
    'sku': 'codigo',
    'código': 'codigo',
    'descripcion': 'descripcion',
    'desc': 'descripcion',
    'descripción': 'descripcion',
    'producto': 'descripcion',
    'item': 'descripcion',
    'cantidad': 'cantidad',
    'cant': 'cantidad',
    'cantidadrequerida': 'cantidad',
    'qty': 'cantidad',
    'um': 'unidad',
    'unidad': 'unidad',
    'u.m.': 'unidad',
    'medida': 'unidad',
    'pneto': 'precio_neto_unitario',
    'preciounitario': 'precio_neto_unitario',
    'precio': 'precio_neto_unitario',
    'precioneto': 'precio_neto_unitario',
    'neto': 'precio_neto_unitario',
    'descuento': 'descuento_porcentaje',
    'desc%': 'descuento_porcentaje',
    'descuento%': 'descuento_porcentaje',
    'total': 'total_linea',
    'subtotal': 'total_linea',
    'montototal': 'total_linea',
  };

  return mappings[normalized] || null;
}

/**
 * Parsea un archivo Excel de cotización
 */
function parseExcelFile(filePath: string): ParsedQuotation {
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  if (data.length < 2) {
    throw new Error('El archivo Excel está vacío o no tiene datos');
  }

  // Primera fila es el header
  const headers = data[0].map((col, idx) => {
    const value = String(col || `col_${idx}`).trim();
    return { original: value, field: mapColumnToField(value) };
  });

  // Buscar proveedor info en las primeras filas (no en la tabla de items)
  let proveedor_rut = '';
  let proveedor_nombre = '';
  let numero_cov = '';
  let fecha = new Date().toISOString().split('T')[0];
  let condicion_pago: string | null = null;
  let subtotal_neto = 0;
  let iva = 0;
  let total = 0;

  // Buscar metadata en las primeras filas antes de los items
  const metadataRows = data.slice(1, 10);
  for (const row of metadataRows) {
    if (!row || row.length === 0) continue;
    const rowStr = String(row[0] || '').toLowerCase();
    
    if (rowStr.includes('rut') || rowStr.includes('proveedor')) {
      proveedor_rut = String(row[1] || '').trim();
    }
    if (rowStr.includes('razón social') || rowStr.includes('nombre') || rowStr.includes('proveedor')) {
      if (!proveedor_nombre && row[1]) {
        proveedor_nombre = String(row[1]).trim();
      }
    }
    if (rowStr.includes('folio') || rowStr.includes('número') || rowStr.includes('cov')) {
      numero_cov = String(row[1] || '').trim();
    }
    if (rowStr.includes('fecha')) {
      const dateVal = row[1];
      if (dateVal) {
        if (typeof dateVal === 'number') {
          const excelDate = new Date((dateVal - 25569) * 86400 * 1000);
          fecha = excelDate.toISOString().split('T')[0];
        } else {
          fecha = String(dateVal).split('T')[0];
        }
      }
    }
    if (rowStr.includes('pago') || rowStr.includes('condición')) {
      condicion_pago = String(row[1] || '').trim() || null;
    }
  }

  // Buscar totales al final del archivo
  const totalRowIdx = data.findIndex((row, idx) => {
    if (idx < 10) return false;
    const firstCell = String(row?.[0] || '').toLowerCase();
    return firstCell.includes('total') || firstCell.includes('neto') || firstCell.includes('iva');
  });

  if (totalRowIdx > 0) {
    const totalRow = data[totalRowIdx];
    const totalColIdx = headers.findIndex(h => h.field === 'total_linea');
    if (totalColIdx >= 0 && totalRow[totalColIdx]) {
      total = Number(totalRow[totalColIdx]) || 0;
    }
    
    // Buscar neto e iva
    for (let i = Math.max(0, totalRowIdx - 3); i <= totalRowIdx; i++) {
      const row = data[i];
      const firstCell = String(row?.[0] || '').toLowerCase();
      if (firstCell.includes('neto') || firstCell.includes('subtotal')) {
        const valColIdx = headers.findIndex(h => h.field === 'total_linea');
        if (valColIdx >= 0 && row[valColIdx]) {
          subtotal_neto = Number(row[valColIdx]) || 0;
        }
      }
      if (firstCell.includes('iva')) {
        const valColIdx = headers.findIndex(h => h.field === 'total_linea');
        if (valColIdx >= 0 && row[valColIdx]) {
          iva = Number(row[valColIdx]) || 0;
        }
      }
    }
  }

  // Parsear items (buscar donde empiezan los items)
  const itemsStartIdx = data.findIndex((row, idx) => {
    if (idx < 5) return false;
    const firstCell = String(row?.[0] || '').toLowerCase();
    return firstCell.includes('codigo') || firstCell.includes('sku') || firstCell.includes('cantidad');
  });

  const items: ParsedItem[] = [];
  const startRow = itemsStartIdx >= 0 ? itemsStartIdx + 1 : 2;

  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;
    
    // Skip rows that look like totals or metadata
    const firstCell = String(row[0] || '').toLowerCase();
    if (firstCell.includes('total') || firstCell.includes('subtotal') || firstCell.includes('iva')) {
      continue;
    }

    const item: any = {};
    let hasData = false;

    for (let colIdx = 0; colIdx < headers.length; colIdx++) {
      const field = headers[colIdx].field;
      if (field && row[colIdx] !== undefined && row[colIdx] !== null && row[colIdx] !== '') {
        const value = row[colIdx];
        
        if (field === 'cantidad' || field === 'precio_neto_unitario' || field === 'descuento_porcentaje' || field === 'total_linea') {
          item[field] = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, '')) || 0;
        } else {
          item[field] = String(value).trim();
        }
        hasData = true;
      }
    }

    if (hasData && (item.codigo || item.descripcion)) {
      items.push({
        codigo: item.codigo || 'SIN-CODIGO',
        descripcion: item.descripcion || '',
        cantidad: item.cantidad || 0,
        unidad: item.unidad || 'und',
        precio_neto_unitario: item.precio_neto_unitario || 0,
        descuento_porcentaje: item.descuento_porcentaje || 0,
        total_linea: item.total_linea || (item.cantidad * item.precio_neto_unitario) || 0,
      });
    }
  }

  // Calcular totales si no se encontraron
  if (total === 0) {
    total = items.reduce((sum, item) => sum + item.total_linea, 0);
  }
  if (subtotal_neto === 0) {
    subtotal_neto = total / 1.19;
    iva = total - subtotal_neto;
  }

  return {
    proveedor_rut,
    proveedor_nombre,
    proveedor_direccion: null,
    proveedor_telefono: null,
    proveedor_correo: null,
    numero_cov: numero_cov || 'SIN-NUMERO',
    fecha,
    vendedor: null,
    validez: null,
    items,
    condicion_pago,
    condicion_entrega: null,
    subtotal_neto,
    iva,
    total,
    observaciones: null,
    descuento_global_porcentaje: null,
    descuento_global_monto: null,
  };
}

/**
 * Parsea un archivo de cotización (PDF, Excel o imagen)
 */
export async function parseCotizacionFile(
  filePath: string,
  mimetype: string
): Promise<ParsedQuotation> {
  const ext = path.extname(filePath).toLowerCase();

  // Excel files
  if (mimetype.includes('spreadsheet') || mimetype.includes('excel') || ext === '.xlsx' || ext === '.xls') {
    console.log('Parsing Excel file:', filePath);
    return parseExcelFile(filePath);
  }

  // PDF files - convert to image or extract text and use vision model
  if (mimetype === 'application/pdf' || ext === '.pdf') {
    console.log('Converting PDF to image for vision parsing:', filePath);
    const { base64, isImage } = await convertPdfPageToImage(filePath);
    return parseWithVisionModel(base64, isImage, isImage ? 'image/png' : undefined);
  }

  // Image files - use vision model directly
  if (mimetype.startsWith('image/')) {
    console.log('Parsing image file with vision model:', filePath);
    const base64Image = fileToBase64(filePath);
    return parseWithVisionModel(base64Image, true, mimetype);
  }

  throw new Error(`Tipo de archivo no soportado: ${mimetype}`);
}