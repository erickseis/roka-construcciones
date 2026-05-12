import { chromium, Browser } from 'playwright';

let browserPromise: Promise<Browser> | null = null;
let browserInstance: Browser | null = null;

function getBrowser(): Promise<Browser> {
  if (browserInstance?.isConnected()) {
    return Promise.resolve(browserInstance);
  }
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }).then((browser: Browser) => {
      browserInstance = browser;
      browser.on('disconnected', () => {
        browserInstance = null;
        browserPromise = null;
      });
      return browser;
    }).catch((err: any) => {
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
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
