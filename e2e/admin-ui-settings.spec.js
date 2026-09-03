import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'admin-ui-settings');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const PWA_GRADIENT_RGB = /rgb\(102,\s*126,\s*234\).*rgb\(118,\s*75,\s*162\)/;

test('settings page uses the pwa admin identity (hero + modern buttons)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem(
      'user',
      JSON.stringify({ email: 'demo@nefesh.local', nombre: 'Demo', fullName: 'Demo User' }),
    );
  });

  await page.route('**/api/auth/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { user: { email: 'demo@nefesh.local', fullName: 'Demo User' } } }),
    }),
  );
  await page.route('**/api/users/emisor-config**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { rfc: 'XAXX010101000', nombre: 'Demo SA', regimenFiscal: '601', codigoPostal: '06000' } }),
    }),
  );

  await page.goto('/settings');
  await page.waitForSelector('.navbar-modern', { timeout: 10_000 });
  await page.waitForSelector('.page-title-hero', { timeout: 10_000 });
  // Click the Emisor tab so the form (with the modern submit button) is visible.
  await page.getByRole('button', { name: /Configuración de Emisor/i }).click();
  await page.waitForSelector('form button.btn-modern', { timeout: 10_000 });
  await page.screenshot({ path: path.join(SHOT_DIR, '01-settings.png'), fullPage: true });

  const heroBg = await page.locator('.page-title-hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(heroBg).toContain('linear-gradient');
  expect(heroBg).toMatch(PWA_GRADIENT_RGB);

  const markBg = await page.locator('.navbar-modern__brand-mark').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(markBg).toMatch(PWA_GRADIENT_RGB);

  // Hero is present, replacing the old .settings-header
  const oldHeader = await page.locator('.settings-header').count();
  expect(oldHeader).toBe(0);

  // Submit button uses the modern Button component
  const modernSubmit = await page.locator('form button.btn-modern').count();
  expect(modernSubmit).toBeGreaterThanOrEqual(1);
});
