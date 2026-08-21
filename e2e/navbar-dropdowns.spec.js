// E2E for the new dropdown navbar.
//
// Verifies:
//   - Each section is rendered as a dropdown trigger (Operación,
//     Finanzas, Sistema) instead of flat links
//   - Clicking a trigger opens a panel with that section's items
//   - Clicking a different trigger swaps the open panel
//   - Clicking a link inside the panel navigates and closes the
//     panel
//   - Click-outside closes the open panel
//   - Pressing Escape closes the open panel
//   - The section that owns the current route gets the
//     `is-current` class so users know where they are
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'navbar-dropdowns');
fs.mkdirSync(SHOT_DIR, { recursive: true });

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

const OWNER = {
  _id: 'u-owner', email: 'owner@nefesh.local', username: 'owner',
  fullName: 'Owner Nefesh', tenantRole: 'owner',
};

test.describe('Navbar — section dropdowns', () => {
  test('the three section triggers are present', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await context.route(/\/api\/(products|clients|sales|clients)/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [] } }) })
    );
    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Operación/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Finanzas/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sistema/ })).toBeVisible();
  });

  test('clicking a trigger opens the panel with the section items', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await context.route(/\/api\/(products|clients|sales)/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [] } }) })
    );
    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });

    // Open Operación
    await page.getByRole('button', { name: /Operación/ }).click();
    const operacionPanel = page.locator('.nav-dropdown[data-section="operacion"] .nav-dropdown__panel');
    await expect(operacionPanel).toBeVisible();
    await expect(operacionPanel.getByRole('menuitem', { name: 'POS' })).toBeVisible();
    await expect(operacionPanel.getByRole('menuitem', { name: 'Productos' })).toBeVisible();
    await expect(operacionPanel.getByRole('menuitem', { name: 'Ventas' })).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '01-operacion-open.png'), fullPage: false });
  });

  test('clicking a link in the panel navigates and closes the panel', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await context.route(/\/api\/(products|clients|sales)/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [] } }) })
    );
    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Operación/ }).click();
    await page.getByRole('menuitem', { name: 'Productos' }).click();
    await page.waitForURL('**/products', { timeout: 5_000 });
    // Panel is closed after navigation
    await expect(page.locator('.nav-dropdown[data-section="operacion"] .nav-dropdown__panel')).not.toBeVisible();
  });

  test('clicking a different trigger swaps the open panel', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await context.route(/\/api\/(products|clients|sales)/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [] } }) })
    );
    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Operación/ }).click();
    await expect(page.locator('.nav-dropdown[data-section="operacion"] .nav-dropdown__panel')).toBeVisible();
    await page.getByRole('button', { name: /Finanzas/ }).click();
    await expect(page.locator('.nav-dropdown[data-section="operacion"] .nav-dropdown__panel')).not.toBeVisible();
    await expect(page.locator('.nav-dropdown[data-section="finanzas"] .nav-dropdown__panel')).toBeVisible();
  });

  test('clicking outside the navbar closes the open panel', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await context.route(/\/api\/(products|clients|sales)/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [] } }) })
    );
    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Operación/ }).click();
    await expect(page.locator('.nav-dropdown[data-section="operacion"] .nav-dropdown__panel')).toBeVisible();
    // Click on the page main content
    await page.locator('body').click({ position: { x: 50, y: 600 } });
    await expect(page.locator('.nav-dropdown[data-section="operacion"] .nav-dropdown__panel')).not.toBeVisible();
  });

  test('pressing Escape closes the open panel', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await context.route(/\/api\/(products|clients|sales)/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [] } }) })
    );
    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Operación/ }).click();
    await expect(page.locator('.nav-dropdown[data-section="operacion"] .nav-dropdown__panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.nav-dropdown[data-section="operacion"] .nav-dropdown__panel')).not.toBeVisible();
  });

  test('the section owning the current route is marked as current', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await context.route(/\/api\/products/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [] } }) })
    );
    await page.goto('http://localhost:3003/products', { waitUntil: 'domcontentloaded' });
    const operacion = page.locator('.nav-dropdown[data-section="operacion"]');
    await expect(operacion).toHaveClass(/is-current/);
    const finanzas = page.locator('.nav-dropdown[data-section="finanzas"]');
    await expect(finanzas).not.toHaveClass(/is-current/);
    await page.screenshot({ path: path.join(SHOT_DIR, '02-operacion-current.png'), fullPage: false });
  });
});
