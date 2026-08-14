import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'admin-ui-pos');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const PWA_GRADIENT_RGB = /rgb\(102,\s*126,\s*234\).*rgb\(118,\s*75,\s*162\)/;

test('pos page uses the pwa admin identity (hero + stat-card totals)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem(
      'user',
      JSON.stringify({ email: 'demo@nefesh.local', nombre: 'Demo' }),
    );
  });

  // Stub everything the POS page touches so it can render without backend.
  await page.route('**/api/products**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          products: [
            { _id: 'p1', nombre: 'Café', precioVenta: 35, claveProdServ: '01010101', claveUnidad: 'E48', unidad: 'Pieza', objetoImp: '02', categoria: 'Bebidas', sku: 'SKU-001' },
            { _id: 'p2', nombre: 'Pan', precioVenta: 18, claveProdServ: '01010101', claveUnidad: 'E48', unidad: 'Pieza', objetoImp: '02', categoria: 'Panadería', sku: 'SKU-002' },
          ],
          pagination: { total: 2, pages: 1, page: 1, limit: 100 },
        },
      }),
    }),
  );
  await page.route('**/api/clients**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { clients: [] } }) }),
  );
  await page.route('**/api/users/emisor-config**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { rfc: 'XAXX010101000', nombre: 'Demo SA' } }) }),
  );
  await page.route('**/api/auth/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: { email: 'demo@nefesh.local' } } }) }),
  );

  await page.goto('/pos');
  await page.waitForSelector('.navbar-modern', { timeout: 10_000 });
  await page.waitForSelector('.page-title-hero', { timeout: 10_000 });

  // Add the first product to the cart so the totals block renders.
  const firstProduct = page.locator('text=Café').first();
  await firstProduct.click();
  await page.waitForSelector('.stats-grid .stat-card', { timeout: 10_000 });

  await page.screenshot({ path: path.join(SHOT_DIR, '01-pos.png'), fullPage: true });

  // Page hero is the pwa gradient
  const heroBg = await page.locator('.page-title-hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(heroBg).toContain('linear-gradient');
  expect(heroBg).toMatch(PWA_GRADIENT_RGB);

  // Navbar brand mark gradient
  const markBg = await page.locator('.navbar-modern__brand-mark').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(markBg).toMatch(PWA_GRADIENT_RGB);

  // The 'Actualizar catálogo' CTA is rendered via the modern Button component
  const headerBtnCount = await page.locator('.page-title-hero .btn-modern').count();
  expect(headerBtnCount).toBeGreaterThanOrEqual(1);

  // Totals: 3 stat-cards (subtotal, iva, total)
  const statCards = await page.locator('.stats-grid .stat-card').count();
  expect(statCards).toBeGreaterThanOrEqual(3);
});
