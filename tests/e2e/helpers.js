// E2E test helpers — launch Chrome with extension loaded
const path = require('path');
const { chromium } = require('@playwright/test');

const EXTENSION_PATH = path.resolve(__dirname, '../../browser/chrome');

/**
 * Launch a persistent Chromium context with the Ibid extension loaded.
 * Returns { context, extensionId, popupUrl, sidepanelUrl }.
 */
async function launchWithExtension() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
      '--disable-popup-blocking',
    ],
  });

  // Wait for the service worker to register and get the extension ID
  let extensionId;
  let retries = 0;
  while (!extensionId && retries < 20) {
    const workers = context.serviceWorkers();
    const sw = workers.find(w => w.url().includes('chrome-extension://'));
    if (sw) {
      extensionId = sw.url().split('/')[2];
    } else {
      await new Promise(r => setTimeout(r, 500));
      retries++;
    }
  }

  if (!extensionId) {
    // Try background pages as fallback
    const pages = context.backgroundPages();
    if (pages.length > 0) {
      extensionId = pages[0].url().split('/')[2];
    }
  }

  if (!extensionId) {
    throw new Error('Could not find extension ID after 10s');
  }

  const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
  const sidepanelUrl = `chrome-extension://${extensionId}/sidepanel/sidepanel.html`;
  const optionsUrl = `chrome-extension://${extensionId}/options/options.html`;

  return { context, extensionId, popupUrl, sidepanelUrl, optionsUrl };
}

/**
 * Open the popup page in a new tab (since we can't click the toolbar icon).
 */
async function openPopup(context, popupUrl) {
  const page = await context.newPage();
  await page.goto(popupUrl);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/**
 * Open the popup with metadata pre-populated via DOI enhance.
 * Since Playwright can't trigger the real popup via toolbar click,
 * we open the popup page, enter a DOI, and click Enhance.
 */
async function openPopupOnUrl(context, popupUrl, targetUrl) {
  // Open the target page (for reference, but popup can't extract from it in test mode)
  const targetPage = await context.newPage();
  await targetPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await targetPage.waitForTimeout(2000);

  // Open popup
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForTimeout(2000);

  // Check if fields are already populated (may have extracted from the active tab)
  const title = await popup.$eval('#field-title', el => el.value);
  if (!title) {
    // Fields empty — the popup couldn't extract from the target tab
    // Use DOI enhance as a workaround to populate fields
    const doi = extractDoiFromUrl(targetUrl);
    if (doi) {
      await popup.fill('#field-doi', doi);
      await popup.click('#btn-enhance');
      await popup.waitForTimeout(8000); // wait for CrossRef response
    }
  }

  return { popup, targetPage };
}

/**
 * Extract DOI from a known URL pattern.
 */
function extractDoiFromUrl(url) {
  // Nature: https://www.nature.com/articles/s41586-024-08219-w → 10.1038/s41586-024-08219-w
  const natureMatch = url.match(/nature\.com\/articles\/(s[\d]+-[\d]+-[\d]+-[\w]+)/);
  if (natureMatch) return `10.1038/${natureMatch[1]}`;
  // Generic DOI in URL
  const doiMatch = url.match(/(10\.\d{4,}\/[^\s&?#]+)/);
  if (doiMatch) return doiMatch[1];
  return null;
}

/**
 * Wait for WASM to be ready by checking via the popup.
 */
async function waitForWasm(popup, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ready = await popup.evaluate(() => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'getVersion' }, res => {
          resolve(res?.wasmReady === true);
        });
      });
    });
    if (ready) return true;
    await popup.waitForTimeout(500);
  }
  return false;
}

/**
 * Collect console errors from a page.
 */
function collectErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  return errors;
}

module.exports = {
  EXTENSION_PATH,
  launchWithExtension,
  openPopup,
  openPopupOnUrl,
  waitForWasm,
  collectErrors,
};
