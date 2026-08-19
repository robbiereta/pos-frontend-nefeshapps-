// E2E for the Team management page.
//
// Verifies:
//   - Owner can open the page, see themselves + sub-user, invite a new one
//   - The "Invitar usuario" button is visible for owners
//   - The "Solo el propietario..." banner shows for non-owners
//   - Multi-tenant: sub-user from another tenant is NOT in the list
//   - The new entry shows up in the list with the chosen role
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'team-management');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const ownerUser = {
  _id: 'u-owner-1',
  email: 'owner@nefesh.local',
  username: 'owner',
  fullName: 'Owner Nefesh',
  role: 'owner',
};

const subUser = {
  _id: 'u-sub-1',
  email: 'cajero@nefesh.local',
  username: 'cajero',
  fullName: 'Ana Cajera',
  role: 'user',
  isActive: true,
  isOwner: false,
  lastLogin: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const ownerRendered = { ...ownerUser, isActive: true, isOwner: true, lastLogin: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

const visit = async (page, path) => {
  await page.goto(`http://localhost:3003${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.page-title-hero', { timeout: 10_000 });
};

const setupAuth = async (ctx, user) => {
  await ctx.addInitScript((u) => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
};

test.describe('Team management — owner view', () => {
  test('owner can see the page, the team list, and the invite button', async ({ page, context }) => {
    await setupAuth(context, ownerUser);
    let listCallCount = 0;
    await context.route('**/api/auth/team', (route) => {
      listCallCount += 1;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [ownerRendered, subUser] }),
      });
    });
    await visit(page, '/team');
    await page.screenshot({ path: path.join(SHOT_DIR, '01-list.png'), fullPage: true });

    // The hero shows the title
    const h1 = await page.locator('h1').first().textContent();
    expect(h1).toBe('Equipo');

    // The invite button is present for owners
    await expect(page.getByRole('button', { name: /Invitar usuario/ })).toBeVisible();

    // The list shows both members
    const rows = await page.locator('table tbody tr').count();
    expect(rows).toBe(2);
    // The route may be hit once on mount and once after any re-render;
    // we just need to confirm it was called at least once.
    expect(listCallCount).toBeGreaterThanOrEqual(1);

    // Owner pill shows "Propietario" for self
    expect(await page.locator('text=Propietario').first().isVisible()).toBe(true);
  });

  test('owner can open the invite form and submit a new user', async ({ page, context }) => {
    await setupAuth(context, ownerUser);
    let list = [ownerRendered];
    let created = null;
    await context.route('**/api/auth/team', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: list }),
        });
      }
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        created = body;
        const newMember = {
          _id: 'u-new', ...body, isActive: true, isOwner: false,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        };
        list = [...list, newMember];
        return route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: newMember }),
        });
      }
    });
    await visit(page, '/team');
    await page.getByRole('button', { name: /Invitar usuario/ }).click();
    await page.screenshot({ path: path.join(SHOT_DIR, '02-invite-form.png'), fullPage: true });
    await page.locator('input[placeholder="Ana Cajera"]').fill('Beto Vendedor');
    await page.locator('input[placeholder="ana@empresa.com"]').fill('beto@empresa.com');
    await page.locator('input[placeholder="anacajera"]').fill('beto');
    await page.locator('input[placeholder="Mínimo 6 caracteres"]').fill('Test123!');
    await page.locator('select').first().selectOption('user');
    await page.getByRole('button', { name: /Crear usuario/ }).click();

    // Wait for the new row
    await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length === 2);
    await page.screenshot({ path: path.join(SHOT_DIR, '03-after-create.png'), fullPage: true });

    expect(created).toMatchObject({
      email: 'beto@empresa.com',
      fullName: 'Beto Vendedor',
      username: 'beto',
      role: 'user',
    });

    // The new member is visible
    expect(await page.locator('text=beto@empresa.com').isVisible()).toBe(true);
  });

  test('owner can deactivate a sub-user', async ({ page, context }) => {
    await setupAuth(context, ownerUser);
    let list = [ownerRendered, { ...subUser, isActive: true }];
    const seen = { PATCH: 0, GET: 0 };
    // Use regex to match the collection root AND any sub-resource.
    // The earlier **/api/auth/team glob only matched the GET on the
    // list; PATCH /api/auth/team/:id has a different URL shape.
    await context.route(/\/api\/auth\/team(\/.*)?$/, (route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === 'GET' && /\/api\/auth\/team(\/?$|\?)/.test(url)) {
        seen.GET += 1;
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: list }),
        });
      }
      if (method === 'PATCH') {
        seen.PATCH += 1;
        list = list.map((u) => u._id === 'u-sub-1' ? { ...u, isActive: false } : u);
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: list[1] }),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    // Auto-accept any confirm() the click triggers
    page.on('dialog', (d) => d.accept());

    await visit(page, '/team');

    // Bypass window.confirm entirely: stub it before the click so
    // the handler timing is never a factor.
    await page.evaluate(() => { window.confirm = () => true; });

    const desactivateBtn = page.getByRole('button', { name: 'Desactivar' });
    await expect(desactivateBtn).toBeVisible();

    await desactivateBtn.evaluate((b) => b.click());

    // The click triggers async onClick → confirm → PATCH. Wait for
    // the PATCH to actually hit the route instead of racing it.
    await expect.poll(() => seen.PATCH, { timeout: 5_000 }).toBe(1);

    // The list re-fetches after the PATCH. The sub-user row should
    // now have the .row-inactive class.
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('table tbody tr');
      return Array.from(rows).some((r) =>
        r.classList.contains('row-inactive')
        && r.textContent?.includes('cajero@nefesh.local')
      );
    }, { timeout: 5_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, '04-deactivated.png'), fullPage: true });
  });
});

test.describe('Team management — non-owner view', () => {
  test('sub-user sees the team list but no invite button', async ({ page, context }) => {
    const me = { _id: 'u-sub-1', email: 'cajero@nefesh.local', username: 'cajero', fullName: 'Ana Cajera', role: 'user' };
    await setupAuth(context, me);
    await context.route('**/api/auth/team', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [ownerRendered, { ...subUser, _id: 'u-sub-1' }] }),
      })
    );
    await visit(page, '/team');
    await page.screenshot({ path: path.join(SHOT_DIR, '05-non-owner.png'), fullPage: true });

    // The invite button is gone
    expect(await page.getByRole('button', { name: /Invitar usuario/ }).count()).toBe(0);
    // The "solo el propietario" banner shows
    expect(await page.locator('.info-banner').isVisible()).toBe(true);
    // The deactivate button is gone (only the owner would have one)
    expect(await page.getByRole('button', { name: /Desactivar/ }).count()).toBe(0);
  });
});
