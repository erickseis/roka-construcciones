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
const USER_DATA_DIR = path.join(os.tmpdir(), 'roka-puppeteer');

let browserPromise: Promise<Browser> | null = null;
let browserInstance: Browser | null = null;

async function killOrphanedChrome(): Promise<void> {
  if (!browserInstance) return;
  try {
    await browserInstance.close();
  } catch {
    try {
      const pid = (browserInstance as any).process()?.pid;
      if (pid) process.kill(pid, 'SIGKILL');
    } catch {}
  }
  browserInstance = null;
  browserPromise = null;
}

function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) {
    return Promise.resolve(browserInstance);
  }

  if (browserInstance) {
    killOrphanedChrome().catch(() => {});
  }

  if (!browserPromise) {
    if (!CHROME_EXECUTABLE) {
      return Promise.reject(new Error('Chrome executable not found. Set CHROME_PATH env var.'));
    }

    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }

    browserPromise = puppeteer
      .launch({
        executablePath: CHROME_EXECUTABLE,
        userDataDir: USER_DATA_DIR,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--no-first-run',
        ],
      })
      .then((browser) => {
        browserInstance = browser;
        browser.on('disconnected', () => {
          killOrphanedChrome().catch(() => {});
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
