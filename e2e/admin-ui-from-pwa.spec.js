import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'admin-ui-from-pwa');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// Browsers normalize hex to rgb(), so match the rgb() form of the pwa gradient
// (#667eea → rgb(102, 126, 234), #764ba2 → rgb(118, 75, 162)).
const PWA_GRADIENT_RGB = /rgb\(102,\s*126,\s*234\).*rgb\(118,\s*75,\s*162\)/;

test('login page renders with the pwa brand gradient', async ({ page }) => {
  await page.goto('/login');
  await page.waitForSelector('.login-shell', { timeout: 10_000 });
  await page.screenshot({ path: path.join(SHOT_DIR, '01-login.png'), fullPage: true });
  const bg = await page.locator('.login-aside').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain('linear-gradient');
  expect(bg).toMatch(PWA_GRADIENT_RGB);
});

test('dashboard renders with the pwa page-title-hero', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem(
      'user',
      JSON.stringify({ email: 'demo@nefesh.local', nombre: 'Demo' }),
    );
  });

  await page.route('**/api/invoices**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { _id: 'inv-1', folio: 'A-0001', uuid: '11111111-2222-3333-4444-555555555555', fecha: '2026-08-12T00:00:00Z', total: 12340.5 },
          { _id: 'inv-2', folio: 'A-0002', uuid: null, fecha: '2026-08-13T00:00:00Z', total: 980, status: 'pendiente' },
          { _id: 'inv-3', folio: 'A-0003', uuid: '66666666-7777-8888-9999-AAAAAAAAAAAA', fecha: '2026-08-14T00:00:00Z', total: 5420 },
        ],
      }),
    }),
  );
  await page.route('**/api/auth/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: { email: 'demo@nefesh.local' } } }) }),
  );

  await page.goto('/dashboard');
  await page.waitForSelector('.navbar-modern', { timeout: 10_000 });
  await page.waitForSelector('.page-title-hero', { timeout: 10_000 });
  await page.screenshot({ path: path.join(SHOT_DIR, '02-dashboard.png'), fullPage: true });

  const heroBg = await page.locator('.page-title-hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(heroBg).toContain('linear-gradient');
  expect(heroBg).toMatch(PWA_GRADIENT_RGB);

  const markBg = await page.locator('.navbar-modern__brand-mark').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(markBg).toMatch(PWA_GRADIENT_RGB);

  const kpiCount = await page.locator('.kpi-grid .kpi, .stats-grid .stat-card').count();
  expect(kpiCount).toBeGreaterThanOrEqual(3);
});
