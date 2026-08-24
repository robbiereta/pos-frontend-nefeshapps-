// Full app walkthrough — visits every page in the POS and captures
// a screenshot of each. Used as a visual smoke test before
// releases and to produce material for the marketing reel.
//
// Routes covered (admin/owner user):
//   /login, /register
//   /dashboard, /pos, /products, /list-sales, /clients
//   /invoices, /notes-receivable, /notes-payable, /cash-drawer
//   /team, /categories, /ticket-designer, /settings
//   /cotizaciones, /global-invoice, /client-invoice,
//   /client-invoice-workflow, /sale-to-invoice
//   /api-test
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'walkthrough');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const OWNER = {
  _id: 'u-owner', email: 'owner@nefesh.local', username: 'owner',
  fullName: 'Owner Nefesh', tenantRole: 'owner',
};

const PUBLIC_ROUTES = ['/login', '/register'];
const PROTECTED_ROUTES = [
  '/dashboard',
  '/pos',
  '/products',
  '/list-sales',
  '/clients',
  '/invoices',
  '/notes-receivable',
  '/notes-payable',
  '/cash-drawer',
  '/team',
  '/categories',
  '/ticket-designer',
  '/settings',
  '/cotizaciones',
  '/global-invoice',
  '/client-invoice',
  '/client-invoice-workflow',
  '/sale-to-invoice',
  '/api-test',
];

// Stub: catches every API call and returns an empty success shape.
// Pages render their empty state; the goal of this walkthrough is
// to confirm each page LOADS, not to test every interaction.
const stubEverything = async (ctx) => {
  await ctx.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    // /api/categories is a GET that returns { data: [...] } (array, not object)
    if (url.pathname === '/api/categories') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    }
    if (url.pathname === '/api/auth/team') {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    }
    // Default shape
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
};

const setupAuth = async (ctx) => {
  await ctx.addInitScript((u) => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem('user', JSON.stringify(u));
  }, OWNER);
};

const slugify = (p) => p.replace(/\//g, '_').replace(/^_/, '') || 'root';

test.describe('Walkthrough — public pages (no auth)', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      await page.goto(`http://localhost:3003${route}`, { waitUntil: 'domcontentloaded' });
      // Page should render its main heading or form (not redirect
      // to /login, not 404, not blank).
      await expect(page.locator('body')).toBeVisible();
      // Give React a moment to mount and render
      await page.waitForTimeout(500);
      const main = await page.locator('main, body > div').first().textContent();
      expect(main?.length || 0).toBeGreaterThan(20);
      await page.screenshot({
        path: path.join(SHOT_DIR, `public_${slugify(route)}.png`),
        fullPage: true,
      });
    });
  }
});

test.describe('Walkthrough — protected pages (auth as owner)', () => {
  test.beforeEach(async ({ context }) => {
    await setupAuth(context);
    await stubEverything(context);
  });

  for (const route of PROTECTED_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const res = await page.goto(`http://localhost:3003${route}`, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `expected 2xx for ${route}, got ${res?.status()}`).toBeLessThan(400);
      // The page should mount something meaningful — not be blank
      // and not redirect to /login.
      const finalUrl = page.url();
      expect(finalUrl).toContain(route);

      // Wait for any lazy-loaded content (KPI cards, charts, etc.)
      await page.waitForTimeout(800);

      const main = await page.locator('main').first();
      await expect(main, `${route} did not render a <main>`).toBeVisible();
      const text = (await main.textContent()) || '';
      expect(text.length, `${route} main was empty`).toBeGreaterThan(20);

      // Screenshot
      const safeName = slugify(route);
      await page.screenshot({
        path: path.join(SHOT_DIR, `auth_${safeName}.png`),
        fullPage: true,
      });
    });
  }
});

test.describe('Walkthrough — nav reachable from any page', () => {
  test('every dropdown item navigates to a real route', async ({ page, context }) => {
    await setupAuth(context);
    await stubEverything(context);

    // Start at the dashboard so the nav is mounted
    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Open each section dropdown and collect the menuitem links
    const sections = ['Operación', 'Finanzas', 'Sistema'];
    const links = [];
    for (const section of sections) {
      await page.getByRole('button', { name: new RegExp(`^${section}$`) }).click();
      await page.waitForTimeout(200);
      const items = await page.locator('.nav-dropdown.is-open [role="menuitem"]').all();
      for (const item of items) {
        const text = (await item.textContent())?.trim() || '';
        const href = await item.getAttribute('href');
        if (href) links.push({ section, label: text, href });
      }
      // Close the dropdown
      await page.getByRole('button', { name: new RegExp(`^${section}$`) }).click();
      await page.waitForTimeout(200);
    }

    // Verify every link corresponds to a real route
    expect(links.length).toBeGreaterThanOrEqual(10);
    for (const link of links) {
      const res = await page.goto(`http://localhost:3003${link.href}`, { waitUntil: 'domcontentloaded' });
      expect(res?.status(), `${link.label} → ${link.href} returned ${res?.status()}`).toBeLessThan(400);
      const main = await page.locator('main').first();
      await expect(main, `${link.label} did not render a <main>`).toBeVisible();
    }
  });
});
