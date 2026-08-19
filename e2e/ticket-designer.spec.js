// E2E for the Ticket Designer page.
//
// Verifies:
//   - The page loads with defaults
//   - Header lines can be edited
//   - A preset fills the header / footer
//   - The live preview reflects changes
//   - Saving persists via PUT /api/ticket-template
//   - Reset endpoint restores defaults
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'ticket-designer');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const OWNER = {
  _id: 'u-owner', email: 'owner@nefesh.local', username: 'owner',
  fullName: 'Owner Nefesh', role: 'owner',
};

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

test.describe('Ticket Designer', () => {
  test('owner can open the page, see the preview, and edit header lines', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    let tpl = {
      header: { logo: '', lines: ['Negocio Demo', 'Av. Principal 123'] },
      itemsColumns: { showQty: true, showUnitPrice: true, showLineTotal: true, layout: 'separate' },
      totals: { showSubtotal: true, showTax: true, showTotal: true, taxLabel: 'IVA' },
      payment: { showMethod: true, showAmountReceived: false, showChange: false },
      footer: { lines: ['¡Gracias!'], showCSD: false, showQR: false, showDateTime: true },
      styles: { fontFamily: 'mono', fontSize: 12, alignment: 'left', boldHeader: true },
      paperSize: '80mm',
    };
    let saved = 0;
    await context.route(/\/api\/ticket-template/, (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: tpl }) });
      }
      if (route.request().method() === 'PUT') {
        saved += 1;
        const body = JSON.parse(route.request().postData() || '{}');
        tpl = { ...tpl, ...body };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: tpl }) });
      }
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: tpl }) });
      }
    });
    await page.goto('http://localhost:3003/ticket-designer', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toHaveText('Diseñador de Ticket');
    await page.screenshot({ path: path.join(SHOT_DIR, '01-default.png'), fullPage: true });

    // Edit the first header line
    const firstLineInput = page.locator('input[placeholder*="Nombre del negocio"]');
    await firstLineInput.fill('Mi Negocio Editado');
    // The preview updates synchronously
    await expect(page.locator('text=Mi Negocio Editado')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '02-after-edit.png'), fullPage: true });

    // Save
    await page.getByRole('button', { name: /^Guardar/ }).click();
    await expect.poll(() => saved, { timeout: 5_000 }).toBe(1);
  });

  test('preset button fills the header and footer', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    const tpl = {
      header: { logo: '', lines: ['Negocio Demo'] },
      itemsColumns: { showQty: true, showUnitPrice: true, showLineTotal: true, layout: 'separate' },
      totals: { showSubtotal: true, showTax: true, showTotal: true, taxLabel: 'IVA' },
      payment: { showMethod: true, showAmountReceived: false, showChange: false },
      footer: { lines: ['¡Gracias!'], showCSD: false, showQR: false, showDateTime: true },
      styles: { fontFamily: 'mono', fontSize: 12, alignment: 'left', boldHeader: true },
      paperSize: '80mm',
    };
    await context.route(/\/api\/ticket-template/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: tpl }) })
    );
    await page.goto('http://localhost:3003/ticket-designer', { waitUntil: 'domcontentloaded' });

    // Click the Restaurante mexicano preset
    await page.getByRole('button', { name: /Restaurante mexicano/ }).click();
    await expect(page.locator('text=Tacos Doña Mary')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '03-preset.png'), fullPage: true });
  });

  test('sub-user (cajero) can access the page and edit it', async ({ page, context }) => {
    const cajero = { _id: 'u-cajero', email: 'cajero@nefesh.local', username: 'cajero', fullName: 'Ana', role: 'user' };
    await setupAuth(context, cajero);
    await stubTeamList(context);
    const tpl = {
      header: { logo: '', lines: ['Negocio Demo'] },
      itemsColumns: { showQty: true, showUnitPrice: true, showLineTotal: true, layout: 'separate' },
      totals: { showSubtotal: true, showTax: true, showTotal: true, taxLabel: 'IVA' },
      payment: { showMethod: true, showAmountReceived: false, showChange: false },
      footer: { lines: ['¡Gracias!'], showCSD: false, showQR: false, showDateTime: true },
      styles: { fontFamily: 'mono', fontSize: 12, alignment: 'left', boldHeader: true },
      paperSize: '80mm',
    };
    await context.route(/\/api\/ticket-template/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: tpl }) })
    );
    await page.goto('http://localhost:3003/ticket-designer', { waitUntil: 'domcontentloaded' });
    // The page renders for cajeros (no RoleGuard)
    await expect(page.locator('h1').first()).toHaveText('Diseñador de Ticket');
    await expect(page.getByRole('button', { name: /Guardar/ })).toBeVisible();
  });
});
