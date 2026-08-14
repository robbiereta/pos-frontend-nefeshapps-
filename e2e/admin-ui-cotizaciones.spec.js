import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'admin-ui-cotizaciones');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// Browsers normalize hex to rgb() — match the pwa gradient rgb form.
const PWA_GRADIENT_RGB = /rgb\(102,\s*126,\s*234\).*rgb\(118,\s*75,\s*162\)/;

test('cotizaciones page uses the pwa admin identity (hero + Button + invoice-table)', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem(
      'user',
      JSON.stringify({ email: 'demo@nefesh.local', nombre: 'Demo' }),
    );
  });

  await page.route('**/api/cotizaciones**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cotizaciones: [
          { _id: 'c1', folio: 'COT-2026-0001', estado: 'borrador', clienteSnapshot: { nombre: 'Acme SA', rfc: 'ACM010101AAA' }, items: [{}, {}], total: 15000, vigencia: '2026-09-30T00:00:00Z' },
          { _id: 'c2', folio: 'COT-2026-0002', estado: 'enviada', clienteSnapshot: { nombre: 'Comercial Norte', rfc: 'CNT990303BBB' }, items: [{}], total: 4250, vigencia: '2026-09-15T00:00:00Z' },
          { _id: 'c3', folio: 'COT-2026-0003', estado: 'aceptada', clienteSnapshot: { nombre: 'Distribuidora Sur', rfc: 'DSU880505CCC' }, items: [{}, {}, {}], total: 28750, vigencia: '2026-10-01T00:00:00Z' },
        ],
        pagination: { total: 3, pages: 1, page: 1, limit: 20 },
      }),
    }),
  );
  await page.route('**/api/auth/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: { email: 'demo@nefesh.local' } } }) }),
  );

  await page.goto('/cotizaciones');
  await page.waitForSelector('.navbar-modern', { timeout: 10_000 });
  await page.waitForSelector('.page-title-hero', { timeout: 10_000 });
  await page.waitForSelector('.data-table', { timeout: 10_000 });
  await page.screenshot({ path: path.join(SHOT_DIR, '01-cotizaciones.png'), fullPage: true });

  // Hero must be the pwa gradient
  const heroBg = await page.locator('.page-title-hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(heroBg).toContain('linear-gradient');
  expect(heroBg).toMatch(PWA_GRADIENT_RGB);

  // Navbar brand mark gradient
  const markBg = await page.locator('.navbar-modern__brand-mark').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(markBg).toMatch(PWA_GRADIENT_RGB);

  // Header has the new CTA via the modern Button
  const headerBtnCount = await page.locator('.page-title-hero .btn-modern').count();
  expect(headerBtnCount).toBeGreaterThanOrEqual(1);

  // Data table also picks up the pwa .invoice-table styling
  const dataTable = page.locator('.data-table');
  const tableClasses = await dataTable.evaluate((el) => el.className);
  expect(tableClasses).toContain('invoice-table');

  // 3 rows render
  const rows = await page.locator('.data-table tbody tr').count();
  expect(rows).toBeGreaterThanOrEqual(3);

  // Pagination now uses the modern Button
  const paginationBtns = await page.locator('.pagination .btn-modern').count();
  expect(paginationBtns).toBeGreaterThanOrEqual(2);
});
