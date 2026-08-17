import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'notes-identity');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const PWA_GRADIENT_RGB = /rgb\(102,\s*126,\s*234\).*rgb\(118,\s*75,\s*162\)/;

async function visit(page, url) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem('user', JSON.stringify({ email: 'demo@nefesh.local', nombre: 'Demo' }));
  });
  await page.route('**/api/auth/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: { email: 'demo@nefesh.local' } } }) }),
  );
  await page.route('**/api/auth/me**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: { email: 'demo@nefesh.local' } } }) }),
  );
  await page.route('**/api/users/me**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user: { email: 'demo@nefesh.local' } } }) }),
  );
  await page.route('**/api/notifications**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  );
  await page.route('**/api/notes/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) }),
  );
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.page-title-hero', { timeout: 10_000 });
  await page.waitForTimeout(500);
}

test('cxc uses pwa admin identity (page-title-hero + modern Button)', async ({ page }) => {
  await visit(page, '/notes-receivable');
  await page.screenshot({ path: path.join(SHOT_DIR, '01-cxc.png'), fullPage: true });
  const heroBg = await page.locator('.page-title-hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(heroBg).toContain('linear-gradient');
  expect(heroBg).toMatch(PWA_GRADIENT_RGB);
  const newBtn = page.locator('.page-title-hero .btn-modern');
  await expect(newBtn).toHaveCount(1);
});

test('cxp uses pwa admin identity (page-title-hero + modern Button)', async ({ page }) => {
  await visit(page, '/notes-payable');
  await page.screenshot({ path: path.join(SHOT_DIR, '02-cxp.png'), fullPage: true });
  const heroBg = await page.locator('.page-title-hero').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(heroBg).toMatch(PWA_GRADIENT_RGB);
  const newBtn = page.locator('.page-title-hero .btn-modern');
  await expect(newBtn).toHaveCount(1);
});
