import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: /notes-identity\.spec\.js/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3011',
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      executablePath: '/root/.cache/ms-playwright/chromium-1223/chrome-linux/chrome',
    },
  },
});
