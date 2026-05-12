import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';
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
    const pid = (browserInstance as any).process()?.pid;
    if (pid) {
      if (process.platform === 'win32') {
        execSync(`taskkill /F /PID ${pid} /T`, { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGKILL');
      }
    }
  } catch {}
  browserInstance = null;
  browserPromise = null;
  // Time for OS to release the userDataDir
  await new Promise(r => setTimeout(r, 1000));
}

async function launchBrowser(retries = 3): Promise<Browser> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await puppeteer.launch({
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
      });
    } catch (err: any) {
      if (attempt < retries - 1 && err.message?.includes?.('already running')) {
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Failed to launch browser');
}

function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) {
    return Promise.resolve(browserInstance);
  }

  if (!browserPromise) {
    if (!CHROME_EXECUTABLE) {
      return Promise.reject(new Error('Chrome executable not found. Set CHROME_PATH env var.'));
    }

    if (!fs.existsSync(USER_DATA_DIR)) {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }

    browserPromise = killOrphanedChrome().then(() => launchBrowser()).then((browser) => {
      browserInstance = browser;
      browser.on('disconnected', () => {
        browserInstance = null;
        browserPromise = null;
      });
      return browser;
    }).catch((err) => {
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
