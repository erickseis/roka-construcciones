import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import puppeteer, { Browser } from 'puppeteer-core';

function detectChromePath(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        ]
      : [
          '/usr/bin/google-chrome-stable',
          '/usr/bin/google-chrome',
          '/usr/bin/chromium-browser',
        ];
  return candidates.find((p) => fs.existsSync(p));
}

const CHROME_EXECUTABLE = detectChromePath();

// Singleton browser — una instancia para toda la vida del proceso.
// Chrome en Windows usa mutex global: no permite múltiples procesos simultáneos.
let browserPromise: Promise<Browser> | null = null;
let browserInstance: Browser | null = null;

function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) {
    return Promise.resolve(browserInstance);
  }
  if (!browserPromise) {
    if (!CHROME_EXECUTABLE) {
      return Promise.reject(new Error('Chrome executable not found. Set CHROME_PATH env var.'));
    }
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer_'));
    browserPromise = puppeteer
      .launch({
        executablePath: CHROME_EXECUTABLE,
        userDataDir,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      .then((browser) => {
        browserInstance = browser;
        browser.on('disconnected', () => {
          browserInstance = null;
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

export { getBrowser };

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
