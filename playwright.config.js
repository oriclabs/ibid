// @ts-check
const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  workers: 1, // extensions need serial execution
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'tests/e2e/report' }],
  ],
  use: {
    headless: false, // extensions require headed mode
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chrome-extension',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
