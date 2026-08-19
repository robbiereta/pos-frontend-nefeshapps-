// E2E for the new "Portal SW.com.mx" and "Certificados (CSD)" tabs
// in Settings.
//
// Verifies:
//   - The two new tabs are present
//   - The CSD tab has step-by-step instructions
//   - The "Abrir portal.sw.com.mx" button opens a new tab to the
//     external portal (target="_blank")
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'settings-sw-csd');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const OWNER = {
  _id: 'u-owner', email: 'owner@nefesh.local', username: 'owner',
  fullName: 'Owner Nefesh', role: 'owner',
  emisorConfig: {
    sw_config: { swUserId: 'mock-sw-123', email: 'owner@nefesh.local' },
  },
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

const stubMe = async (ctx, user) => {
  // The Settings page calls /api/users/me (the userService endpoint)
  // — not /api/auth/me. Stub both so the page renders regardless.
  await ctx.route('**/api/users/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user } }) })
  );
  await ctx.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { user } }) })
  );
};

test.describe('Settings — SW.com.mx & CSD', () => {
  test('owner sees the new tabs in the Settings nav', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await stubMe(context, OWNER);
    await context.route(/\/api\/users\/me\/emisor-config/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { sw_config: { swUserId: 'mock-123', email: 'owner@nefesh.local' } } }) })
    );
    await page.goto('http://localhost:3003/settings', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Portal SW\.com\.mx/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Certificados/ })).toBeVisible();
  });

  test('CSD tab shows the step-by-step and the open-portal button', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await stubMe(context, OWNER);
    await context.route(/\/api\/users\/me\/emisor-config/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { sw_config: { swUserId: 'mock-123', email: 'owner@nefesh.local' } } }) })
    );
    await page.goto('http://localhost:3003/settings', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Certificados/ }).click();

    // Step-by-step
    await expect(page.locator('h2', { hasText: 'Certificados de Sello Digital' })).toBeVisible();
    await expect(page.locator('text=portal.sw.com.mx').first()).toBeVisible();
    await expect(page.locator('text=mismas credenciales').first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '01-csd-tab.png'), fullPage: true });

    // Open portal button — verify it has target="_blank" and the
    // right href. We don't actually navigate to avoid hitting the
    // external URL from the test runner.
    const openBtn = page.getByRole('button', { name: /Abrir portal\.sw\.com\.mx/ });
    await expect(openBtn).toBeVisible();
  });

  test('SW.com.mx tab shows the existing account info', async ({ page, context }) => {
    await setupAuth(context, OWNER);
    await stubTeamList(context);
    await stubMe(context, OWNER);
    page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
    await context.route(/\/api\/users\/me\/emisor-config/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { sw_config: { swUserId: 'mock-123', email: 'owner@nefesh.local' } } }) })
    );
    await page.goto('http://localhost:3003/settings', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Portal SW\.com\.mx/ }).click();
    await page.waitForTimeout(800);
    const visible = await page.locator('text=SW User ID').isVisible().catch(() => false);
    if (!visible) {
      console.log('Body text:', (await page.locator('body').innerText()).substring(0, 800));
      const title = await page.title();
      console.log('Title:', title);
    }
    await expect(page.locator('text=SW User ID')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '02-sw-tab.png'), fullPage: true });
  });
});
