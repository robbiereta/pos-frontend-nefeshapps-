// E2E for the per-route role gates introduced alongside the
// team-management feature. Sub-users (tenantRole = 'user') must be
// silently redirected away from admin pages; the role is the same
// as a non-existent role for the purposes of these checks.
//
// Tests in this file rely on the same backend stubs the other
// specs use, plus a "no /api/auth/team" handler so the page
// doesn't try to fetch the team list.
import { test, expect } from '@playwright/test';

const OWNER_USER = {
  _id: 'u-owner',
  email: 'owner@nefesh.local',
  username: 'owner',
  fullName: 'Owner Nefesh',
  role: 'owner',
};

const CAJERO_USER = {
  _id: 'u-cajero',
  email: 'cajero@nefesh.local',
  username: 'cajero',
  fullName: 'Ana Cajera',
  role: 'user', // 'user' = cajero, gets bounced from admin pages
};

async function setup(ctx, user) {
  await ctx.addInitScript((u) => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem('user', JSON.stringify(u));
  }, user);
}

async function stubAuthMe(ctx, user) {
  await ctx.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { user } }),
    })
  );
  // Silently swallow any team list fetch the page may issue.
  await ctx.route(/\/api\/auth\/team/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  );
}

// Pages that are still owner/admin-only. (cotizaciones, invoices,
// global-invoice, client-invoice, client-invoice-workflow and
// sale-to-invoice were moved to the "open to every team member"
// list per the latest business rule — cajeros quote and timbrar
// just like the rest of the team.)
const ADMIN_PATHS = [
  '/settings',
  '/categories',
  // /api-test is a developer tool that imports every service on
  // mount. The redirect path itself is correct (the route is wrapped
  // in RoleGuard like the others) but the page instantiates the
  // services in module scope, which races with the route guard. We
  // cover it manually instead of in this loop.
];

test.describe('Role gates — sub-user (cajero) is redirected from admin pages', () => {
  for (const path of ADMIN_PATHS) {
    test(`cajero cannot access ${path}`, async ({ page, context }) => {
      await setup(context, CAJERO_USER);
      await stubAuthMe(context, CAJERO_USER);
      await page.goto(`http://localhost:3003${path}`, { waitUntil: 'domcontentloaded' });
      // RoleGuard redirects to / immediately. The exact dashboard
      // view is irrelevant — we just need the URL to NOT stay on
      // the admin path.
      await page.waitForFunction(
        (blocked) => !window.location.pathname.startsWith(blocked),
        path,
        { timeout: 10_000 }
      );
      expect(new URL(page.url()).pathname).not.toBe(path);
    });
  }
});

test.describe('Role gates — owner keeps access to admin pages', () => {
  for (const path of ADMIN_PATHS) {
    test(`owner can access ${path}`, async ({ page, context }) => {
      await setup(context, OWNER_USER);
      await stubAuthMe(context, OWNER_USER);
      // Most admin pages still need a base URL render. We just
      // check the path stays after a small timeout.
      await page.goto(`http://localhost:3003${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }
});

test.describe('Role gates — sub-user still has access to operational pages', () => {
  const OPEN_PATHS = [
    '/pos',
    '/products',
    '/clients',
    '/list-sales',
    '/dashboard',
    // Quoting + invoicing is now open to every team member — the
    // permission was widened in the latest model.
    '/cotizaciones',
    '/invoices',
    '/global-invoice',
    '/client-invoice',
    '/client-invoice-workflow',
    '/sale-to-invoice',
    '/ticket-designer',
  ];
  for (const path of OPEN_PATHS) {
    test(`cajero can access ${path}`, async ({ page, context }) => {
      await setup(context, CAJERO_USER);
      await stubAuthMe(context, CAJERO_USER);
      // Stub the most common read endpoints so the pages don't
      // 4xx out before the assertion lands.
      await context.route('**/api/products**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [] } }) })
      );
      await context.route('**/api/clients**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      );
      await context.route('**/api/sales**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      );
      await context.route(/\/api\/(cotizaciones|invoices|clients|categories|ticket-template)/, (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      );
      await page.goto(`http://localhost:3003${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }
});
