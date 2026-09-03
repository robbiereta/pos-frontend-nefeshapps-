// E2E coverage for frontend pages that don't have a dedicated suite yet.
//
// Pages covered:
//   - Login (/login)
//   - Register (/register)
//   - Dashboard (/dashboard)
//   - ClientsPage (/clients) — list + create + delete
//   - CashDrawer (/cash-drawer) — list view + date range form
//   - ApiTest (/api-test) — admin/owner diagnostic page
//
// Pages already covered elsewhere (skipped here):
//   - /pos → admin-ui-pos + quick-add-product + quick-add-categories
//   - /products → admin-ui-products
//   - /categories → categories
//   - /team → team-management
//   - /ticket-designer → ticket-designer
//   - /settings → settings-sw-csd + admin-ui-settings
//   - /invoices, /global-invoice, /client-invoice,
//     /client-invoice-workflow, /sale-to-invoice → role-gates
//     (smoke only) + the Cotizaciones-specific admin-ui
//   - /notes-receivable, /notes-payable → notes-cxc-cxp
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'missing-modules');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const OWNER = { _id: 'u-owner', email: 'owner@nefesh.local', username: 'owner', fullName: 'Owner', tenantRole: 'owner' };

const setupAuth = async (ctx, user = OWNER) => {
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

const stubMisc = async (ctx) => {
  await ctx.route(/\/api\/(products|clients|sales|categories)/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { products: [], clients: [] } }) })
  );
};

// ─────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────
test.describe('Login / Register', () => {
  test('login form posts to /api/auth/login and redirects on success', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accessToken: 'new.token.here',
            user: { _id: 'u1', email: 'demo@nefesh.local', tenantRole: 'admin' },
          },
        }),
      }),
    );

    await page.goto('http://localhost:3003/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Bienvenido de vuelta/i })).toBeVisible();

    await page.getByLabel(/Correo electr/i).fill('demo@nefesh.local');
    await page.getByLabel('Contraseña').fill('Test123!');
    await page.screenshot({ path: path.join(SHOT_DIR, '01-login-filled.png') });

    await page.getByRole('button', { name: /Entrar/i }).click();

    // The login handler does window.location.href = '/dashboard'
    await page.waitForURL('**/dashboard', { timeout: 5000 });
    // The token was stored
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBe('new.token.here');
  });

  test('login shows error toast on bad credentials', async ({ page }) => {
    // With the fix in services/api.js, the request helper now
    // reads the response body BEFORE the 401 redirect, so the
    // user sees the actual message instead of a generic
    // "Unauthorized" toast.
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401, contentType: 'application/json',
        body: JSON.stringify({ message: 'Credenciales inválidas' }),
      }),
    );

    await page.goto('http://localhost:3003/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Correo electr/i).fill('bad@nefesh.local');
    await page.getByLabel('Contraseña').fill('wrongpass');
    await page.getByRole('button', { name: /Entrar/i }).click();

    await expect(page.getByText(/Credenciales inválidas/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('register form validates password mismatch client-side', async ({ page }) => {
    await page.goto('http://localhost:3003/register', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /CFDI|Crea tu cuenta/i }).first()).toBeVisible();

    await page.locator('input[name="username"]').fill('demo');
    await page.locator('input[name="email"]').fill('demo@nefesh.local');
    await page.locator('input[name="fullName"]').fill('Demo User');
    await page.locator('input[name="rfc"]').fill('XAXX010101000');
    await page.locator('input[name="password"]').fill('Test123!');
    await page.locator('input[name="confirmPassword"]').fill('Different1!');
    await page.screenshot({ path: path.join(SHOT_DIR, '02-register-mismatch.png') });

    await page.getByRole('button', { name: /Crear Cuenta/i }).click();
    // Client-side validation kicks in (toast or error div)
    await expect(page.getByText(/contraseñas no coinciden/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('register happy path POSTs and stores the returned token', async ({ page }) => {
    let postedBody = null;
    await page.route('**/api/auth/register', (route) => {
      postedBody = JSON.parse(route.request().postData() || '{}');
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({
          data: {
            accessToken: 'reg.token',
            refreshToken: 'reg.refresh',
            user: { _id: 'u-new', email: postedBody.email, tenantRole: 'admin' },
          },
        }),
      });
    });

    await page.goto('http://localhost:3003/register', { waitUntil: 'domcontentloaded' });
    await page.locator('input[name="username"]').fill('demo2');
    await page.locator('input[name="email"]').fill('demo2@nefesh.local');
    await page.locator('input[name="fullName"]').fill('Demo Two');
    await page.locator('input[name="password"]').fill('Test123!');
    await page.locator('input[name="confirmPassword"]').fill('Test123!');

    await page.getByRole('button', { name: /Crear Cuenta/i }).click();

    // The handler redirects to /dashboard after 1.5s
    await page.waitForURL('**/dashboard', { timeout: 5000 });
    expect(postedBody.username).toBe('demo2');
    expect(postedBody.email).toBe('demo2@nefesh.local');
    const stored = await page.evaluate(() => localStorage.getItem('token'));
    expect(stored).toBe('reg.token');
  });
});

// ─────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────
test.describe('Dashboard', () => {
  test('renders KPI cards and recent invoices from /api/invoices', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);

    await context.route('**/api/invoices**', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { _id: 'i1', folio: 'A-0001', uuid: 'ABC123-...', fecha: '2026-08-15', total: 1160 },
            { _id: 'i2', folio: 'A-0002', uuid: null,        fecha: '2026-08-18', total: 2320 },
          ],
        }),
      }),
    );

    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // KPI cards
    await expect(page.getByText('Total facturas')).toBeVisible();
    await expect(page.getByText('Timbradas')).toBeVisible();
    await expect(page.getByText('Pendientes')).toBeVisible();
    await expect(page.getByText('Monto facturado')).toBeVisible();

    // The "Timbradas" count is 1 (one of the fixtures has uuid)
    await expect(page.locator('.kpi').filter({ hasText: 'Timbradas' })).toContainText('1');
    await expect(page.locator('.kpi').filter({ hasText: 'Pendientes' })).toContainText('1');

    // Recent invoices table. The dashboard renders the UUID (or
    // "Folio X" when there isn't one) in a .invoice-row .mono
    // cell; we just look for both invoices by their unique strings.
    await expect(page.getByText('ABC123-')).toBeVisible();
    await expect(page.getByText('Folio A-0002')).toBeVisible();
    await expect(page.getByText('Timbrada').first()).toBeVisible();
    await expect(page.getByText('Borrador').first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '03-dashboard.png'), fullPage: true });
  });

  test('shows empty-state when there are no invoices', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await context.route('**/api/invoices**', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      }),
    );

    await page.goto('http://localhost:3003/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/Aún no hay facturas/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────
// ClientsPage
// ─────────────────────────────────────────────────────────────────
test.describe('ClientsPage', () => {
  const seedClients = [
    { _id: 'c1', rfc: 'ACM010101AAA', nombre: 'Acme SA de CV', email: 'a@acme.com', telefono: '+52 55 1111', codigoPostal: '11550', regimenFiscal: '601' },
    { _id: 'c2', rfc: 'BET020202BBB', nombre: 'Beta SAPI',     email: 'b@beta.com', telefono: '+52 55 2222', codigoPostal: '03100', regimenFiscal: '616' },
  ];

  test('renders the client list from /api/clients', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    await context.route('**/api/clients**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: seedClients }),
        });
      }
      return route.continue();
    });

    await page.goto('http://localhost:3003/clients', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('cell', { name: 'ACM010101AAA' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Beta SAPI' })).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ Nuevo Cliente/i })).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '04-clients-list.png') });
  });

  test('search filters the list by RFC / nombre / email', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    await context.route('**/api/clients**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: seedClients }),
        });
      }
      return route.continue();
    });

    await page.goto('http://localhost:3003/clients', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('cell', { name: 'Acme SA de CV' })).toBeVisible();

    const search = page.getByPlaceholder(/Buscar por nombre/i);
    await search.fill('BETA');
    await expect(page.getByRole('cell', { name: 'Acme SA de CV' })).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'Beta SAPI' })).toBeVisible();

    await search.fill('acme.com');  // email fragment (matches a@acme.com)
    await expect(page.getByRole('cell', { name: 'Beta SAPI' })).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'Acme SA de CV' })).toBeVisible();
  });

  test('click "+ Nuevo Cliente" opens the form', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    await context.route('**/api/clients**', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: seedClients }),
        });
      }
      return route.continue();
    });

    await page.goto('http://localhost:3003/clients', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /\+ Nuevo Cliente/i }).click();
    await expect(page.locator('input[name="rfc"]')).toBeVisible();
    await expect(page.locator('input[name="nombre"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Guardar|Crear/i })).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '05-clients-form.png') });
  });

  test('create client POSTs to /api/clients and refreshes the list', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);

    let postedBody = null;
    const allClients = [...seedClients];
    await context.route('**/api/clients**', (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        postedBody = JSON.parse(req.postData() || '{}');
        const newC = { _id: 'c-new', ...postedBody };
        allClients.push(newC);
        return route.fulfill({
          status: 201, contentType: 'application/json',
          body: JSON.stringify({ data: newC }),
        });
      }
      if (req.method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: allClients }),
        });
      }
      return route.continue();
    });

    await page.goto('http://localhost:3003/clients', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /\+ Nuevo Cliente/i }).click();

    await page.locator('input[name="rfc"]').fill('GAM030303CCC');
    await page.locator('input[name="nombre"]').fill('Gamma SC');
    await page.locator('input[name="email"]').fill('contacto@gamma.com');
    await page.locator('input[name="telefono"]').fill('+52 55 3333');
    await page.locator('input[name="codigoPostal"]').fill('11000');

    await page.getByRole('button', { name: /Guardar|Crear/i }).click();

    expect(postedBody).not.toBeNull();
    expect(postedBody.rfc).toBe('GAM030303CCC');
    expect(postedBody.nombre).toBe('Gamma SC');

    // With the fix in ClientsPage (imports useToast), the form now
    // closes + the list refreshes. The success toast should appear
    // and the new client should be visible in the table.
    await expect(page.getByRole('cell', { name: 'Gamma SC' })).toBeVisible({ timeout: 5000 });
    // The form should be closed (no more inputs)
    await expect(page.locator('input[name="rfc"]')).toHaveCount(0);
  });

  test('delete client confirms via window.confirm and calls DELETE', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    const deletes = [];
    const allClients = [...seedClients];
    await context.route('**/api/clients**', (route) => {
      const req = route.request();
      if (req.method() === 'DELETE') {
        deletes.push(new URL(req.url()).pathname);
        const id = new URL(req.url()).pathname.split('/').pop();
        const i = allClients.findIndex(c => c._id === id);
        if (i >= 0) allClients.splice(i, 1);
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { _id: id } }),
        });
      }
      if (req.method() === 'GET') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: allClients }),
        });
      }
      return route.continue();
    });

    await page.goto('http://localhost:3003/clients', { waitUntil: 'domcontentloaded' });
    page.on('dialog', (d) => d.accept());
    const row = page.locator('tr', { hasText: 'Acme SA de CV' });
    await row.getByRole('button', { name: /Eliminar/ }).click();

    await expect.poll(() => deletes.length, { timeout: 5000 }).toBe(1);
    expect(deletes[0]).toMatch(/\/c1$/);
  });
});

// ─────────────────────────────────────────────────────────────────
// CashDrawer
// ─────────────────────────────────────────────────────────────────
test.describe('CashDrawer', () => {
  const cutoffHistory = [
    {
      _id: 'cd1',
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      totalSales: 12,
      totalAmount: 5400,
      status: 'open',
      createdAt: '2026-08-01T18:00:00Z',
      closedBy: null,
    },
    {
      _id: 'cd2',
      startDate: '2026-07-31',
      endDate: '2026-07-31',
      totalSales: 8,
      totalAmount: 3200,
      status: 'closed',
      createdAt: '2026-07-31T18:00:00Z',
      closedAt: '2026-07-31T22:00:00Z',
    },
  ];

  test('renders the form + cutoff history from /api/cash-drawer', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await context.route('**/api/cash-drawer**', (route) => {
      const req = route.request();
      if (req.method() === 'GET' && !new URL(req.url()).pathname.match(/[a-f0-9]{20,}$/i)) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: cutoffHistory, pagination: { total: 2, pages: 1, page: 1, limit: 100 } }),
        });
      }
      return route.continue();
    });
    await context.route('**/api/sales**', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination: { total: 0 } }),
      }),
    );

    await page.goto('http://localhost:3003/cash-drawer', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Corte de Caja|Cash/i }).first()).toBeVisible();

    // Date range form
    await expect(page.locator('input[type="date"]').first()).toBeVisible();

    // History table — dates render in es-MX locale (d/m/yyyy)
    await expect(page.getByText('1/8/2026').first()).toBeVisible();
    await expect(page.getByText('31/7/2026').first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '06-cash-drawer.png'), fullPage: true });
  });
});

// ─────────────────────────────────────────────────────────────────
// ApiTest (admin/owner only)
//
// Now reachable in `vite dev` because the dev proxy was narrowed
// from `/api` (prefix) to `/api/` (slash-required) — /api-test is
// a SPA route, not a backend endpoint, so it must be served by
// the React Router.
// ─────────────────────────────────────────────────────────────────
test.describe('ApiTest', () => {
  test('admin can open /api-test, the page renders the test buttons', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);

    const stub = (data = {}) => (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ data }),
    });
    await context.route('**/api/users/me', stub({ _id: 'u-owner', email: 'owner@nefesh.local' }));
    await context.route('**/api/users/me/emisor-config', stub({ rfc: 'XAXX010101000', nombre: 'Demo' }));
    await context.route('**/api/sales**', stub([]));
    await context.route('**/api/sales/stats**', stub({}));

    await page.goto('http://localhost:3003/api-test', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /API Connection Test/i })).toBeVisible();
    await expect(page.getByText(/VITE_API_URL|API URL/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /User Profile/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sales List/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate Global Invoice/i })).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, '07-api-test.png') });
  });

  test('clicking "User Profile" calls /api/users/me and shows the result', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    const calls = [];
    const stub = (route) => {
      const url = new URL(route.request().url());
      calls.push(url.pathname);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { _id: 'u-owner', email: 'owner@nefesh.local', tenantRole: 'owner' } }),
      });
    };
    await context.route('**/api/users/me', stub);
    await context.route('**/api/users/me/emisor-config', stub);
    await context.route('**/api/sales**', stub);
    await context.route('**/api/sales/stats**', stub);

    await page.goto('http://localhost:3003/api-test', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /User Profile/i }).click();
    await expect(page.getByText('"email": "owner@nefesh.local"').first()).toBeVisible({ timeout: 5000 });
    expect(calls.some(p => p === '/api/users/me' || p.startsWith('/api/users/me'))).toBe(true);
  });
});
