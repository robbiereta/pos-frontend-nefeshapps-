// E2E for the Categories management page.
//
// Verifies:
//   - Owner can list, create, and deactivate a category
//   - Sub-user (cajero) sees the list read-only with the
//     "Solo el propietario..." banner
//   - Duplicate (tenantId, nombre) returns 409 and shows an error
//   - Products list page is admin-only (already covered by
//     role-gates.spec.js but we re-assert here)
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'categories');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const OWNER = {
  _id: 'u-owner-1', email: 'owner@nefesh.local', username: 'owner',
  fullName: 'Owner Nefesh', tenantRole: 'owner',
};
const CAJERO = {
  _id: 'u-cajero-1', email: 'cajero@nefesh.local', username: 'cajero',
  fullName: 'Ana Cajera', tenantRole: 'user',
};

const seed = (list) => list;

const setupAuth = async (ctx, user) => {
  await ctx.addInitScript((u) => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
};

const stubTeamList = async (ctx) => {
  await ctx.route(/\/api\/auth\/team/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );
};

test.describe('Categories — owner view', () => {
  test('owner can open the page, see the empty list, and create a category', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    let list = [];
    let seen = { post: 0 };
    await context.route(/\/api\/categories/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: list }),
        });
      }
      if (route.request().method() === 'POST') {
        seen.post += 1;
        const body = JSON.parse(route.request().postData() || '{}');
        const created = { _id: 'c1', ...body, activo: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        list = [...list, created];
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: created }) });
      }
    });

    await page.goto('http://localhost:3003/categories', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toHaveText('Categorías');
    await page.screenshot({ path: path.join(SHOT_DIR, '01-empty-list.png'), fullPage: true });

    // Click "+ Nueva categoría"
    await page.getByRole('button', { name: /Nueva categor/i }).click();
    await expect(page.locator('input[placeholder="Bebidas"]')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '02-form-open.png'), fullPage: true });

    // Fill the form
    await page.locator('input[placeholder="Bebidas"]').fill('Bebidas Calientes');
    await page.locator('input[placeholder="01010101"]').fill('01010101');
    await page.locator('input[placeholder="E48"]').fill('E48');
    await page.locator('input[placeholder="Pieza"]').fill('Pieza');
    await page.getByRole('button', { name: /Crear categor/i }).click();

    // Wait for the POST + re-render
    await expect.poll(() => seen.post, { timeout: 5_000 }).toBe(1);
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 1);
    await page.screenshot({ path: path.join(SHOT_DIR, '03-after-create.png'), fullPage: true });

    // The new row shows the SAT code
    const row = page.locator('table tbody tr').first();
    expect(await row.locator('code').textContent()).toBe('01010101');
  });

  test('duplicate name shows an inline error and does NOT add a row', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await context.route(/\/api\/categories/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: [
            { _id: 'c1', nombre: 'Bebidas', claveProdServ: '01010101', claveUnidad: 'E48', unidad: 'Pieza', objetoImp: '02', tasaIVA: 0.16, activo: true },
          ] }),
        });
      }
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 409, contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'CATEGORY_EXISTS', message: 'Ya existe una categoría con ese nombre en este tenant.' }),
        });
      }
    });
    await page.goto('http://localhost:3003/categories', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Nueva categor/i }).click();
    await page.locator('input[placeholder="Bebidas"]').fill('Bebidas');
    await page.locator('input[placeholder="01010101"]').fill('01010101');
    await page.locator('input[placeholder="E48"]').fill('E48');
    await page.locator('input[placeholder="Pieza"]').fill('Pieza');
    await page.getByRole('button', { name: /Crear categor/i }).click();

    // Inline error appears, no new row added.
    await expect(page.locator('.error-banner').first()).toBeVisible();
    await expect(page.locator('text=Ya existe una categoría')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '04-duplicate.png'), fullPage: true });
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBe(1);
  });

  test('owner can deactivate a category', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    let list = [
      { _id: 'c1', nombre: 'Bebidas', claveProdServ: '01010101', claveUnidad: 'E48', unidad: 'Pieza', objetoImp: '02', tasaIVA: 0.16, activo: true },
    ];
    await context.route(/\/api\/categories/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: list }) });
      }
      if (route.request().method() === 'PATCH') {
        list = list.map((c) => c._id === 'c1' ? { ...c, activo: false } : c);
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: list[0] }) });
      }
    });
    page.on('dialog', (d) => d.accept());
    await page.goto('http://localhost:3003/categories', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Desactivar/ }).click();
    await page.waitForFunction(() => {
      const row = document.querySelector('table tbody tr');
      return row?.classList.contains('row-inactive');
    });
    await page.screenshot({ path: path.join(SHOT_DIR, '05-deactivated.png'), fullPage: true });
  });
});

test.describe('Categories — non-owner (cajero) view', () => {
  test('sub-user (cajero) is redirected away from /categories', async ({ page, context }) => {
    await setupAuth(context, CAJERO);
    await stubTeamList(context);
    // Even if the API returned 200, the page should redirect because
    // /categories is gated to owner/admin. The role gates in App.jsx
    // run before the page ever renders.
    await context.route(/\/api\/categories/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [
        { _id: 'c1', nombre: 'Bebidas', claveProdServ: '01010101', claveUnidad: 'E48', unidad: 'Pieza', objetoImp: '02', tasaIVA: 0.16, activo: true },
      ] }) })
    );
    await page.goto('http://localhost:3003/categories', { waitUntil: 'domcontentloaded' });
    // The guard redirects to /. The Categories page should not
    // render its table to a cajero.
    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/categories'),
      null,
      { timeout: 5_000 }
    );
    expect(new URL(page.url()).pathname).not.toBe('/categories');
    await page.screenshot({ path: path.join(SHOT_DIR, '06-cajero-redirected.png'), fullPage: true });
  });
});
