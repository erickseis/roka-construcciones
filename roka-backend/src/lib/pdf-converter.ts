import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { createCanvas, Path2D, ImageData } from '@napi-rs/canvas';

const _require = createRequire(import.meta.url);
const _pdfjsDistDir = path.dirname(_require.resolve('pdfjs-dist/package.json'));
const STANDARD_FONT_DATA_URL = `file://${_pdfjsDistDir}/standard_fonts/`;

// pdfjs-dist v4 needs Path2D and ImageData as globals in Node.js
(globalThis as any).Path2D = Path2D;
(globalThis as any).ImageData = ImageData;

// Dynamic import of pdfjs-dist (ESM-only, must use import() not require())
let _pdfjsLib: any = null;
async function getPdfjsLib() {
  if (!_pdfjsLib) {
    _pdfjsLib = await import('pdfjs-dist');
  }
  return _pdfjsLib;
}

export async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  const outputDir = path.join(path.dirname(pdfPath), 'ocr_temp');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let data: Uint8Array;
  try {
    data = new Uint8Array(fs.readFileSync(pdfPath));
  } catch (err: any) {
    throw Object.assign(
      new Error(`No se pudo leer el archivo PDF: ${err.message}`),
      { statusCode: 400 }
    );
  }

  const pdfjsLib = await getPdfjsLib();
  let doc: pdfjsLib.PDFDocumentProxy;
  try {
    doc = await pdfjsLib.getDocument({
      data,
      disableWorker: true,
      useSystemFonts: true,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    }).promise;
  } catch (err: any) {
    throw Object.assign(
      new Error(`No se pudo abrir el PDF. El archivo puede estar corrupto o dañado: ${err.message}`),
      { statusCode: 400 }
    );
  }

  const pageCount = Math.min(doc.numPages, 3);
  const imagePaths: string[] = [];
  const baseName = path.basename(pdfPath, '.pdf');

  try {
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });

      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      await page.render({
        canvasContext: ctx as any,
        viewport,
      }).promise;

      const outputPath = path.join(outputDir, `${baseName}-${i}.png`);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      imagePaths.push(outputPath);

      page.cleanup();
    }
  } finally {
    doc.destroy();
  }

  return imagePaths;
}
