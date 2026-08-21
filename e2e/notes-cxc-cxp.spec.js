// E2E for Notas por Cobrar (CxC) and Notas por Pagar (CxP) pages.
//
// The two pages share the same <NotesList> component (only differs
// in `type` and the API endpoint). This spec covers the flows for
// both — list + summary, status filter, add payment, cancel.
//
// Verifies:
//   - /notes-receivable renders and queries GET /api/notas-por-cobrar
//   - /notes-payable    renders and queries GET /api/notas-por-pagar
//   - Summary cards show Notas, Monto total, Cobrado/Pagado, Saldo
//   - Status filter changes the request and the list
//   - Add payment button opens modal, submits to POST /:id/abonos,
//     shows success toast
//   - Cancel button opens confirm prompt, submits to POST /:id/cancelar
//   - Empty list shows the empty-state copy
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'notes-cxc-cxp');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const OWNER = { _id: 'u-owner', email: 'owner@nefesh.local', username: 'owner', fullName: 'Owner', tenantRole: 'owner' };

// Notas por Cobrar fixtures
const CxcNotes = [
  {
    _id: 'n1', folio: 'NPC-2026-0001',
    clienteSnapshot: { nombre: 'Acme SA de CV', rfc: 'ACM010101AAA', email: 'a@acme.com' },
    clienteId: 'c1',
    concepto: 'Servicios de consultoria',
    descripcion: 'Implementación Q1',
    fechaEmision: '2026-01-15T00:00:00Z',
    fechaVencimiento: '2026-02-15T00:00:00Z',
    montoTotal: 11600, montoAbonado: 5000,
    status: 'parcial',
    permiteParcialidades: true,
    abonos: [{ _id: 'p1', monto: 5000, fecha: '2026-01-30T00:00:00Z', metodoPago: '03', referencia: 'TRF-001' }],
    notas: 'Pago inicial',
  },
  {
    _id: 'n2', folio: 'NPC-2026-0002',
    clienteSnapshot: { nombre: 'Beta SAPI', rfc: 'BET020202BBB', email: 'b@beta.com' },
    clienteId: 'c2',
    concepto: 'Licencia anual',
    descripcion: '',
    fechaEmision: '2026-01-10T00:00:00Z',
    fechaVencimiento: '2026-08-01T00:00:00Z', // vencida (today ~2026-08-21)
    montoTotal: 5000, montoAbonado: 0,
    status: 'vencida',
    permiteParcialidades: true,
    abonos: [],
    notas: '',
  },
  {
    _id: 'n3', folio: 'NPC-2026-0003',
    clienteSnapshot: { nombre: 'Gamma SC', rfc: 'GAM030303CCC' },
    concepto: 'Soporte mensual',
    fechaEmision: '2026-07-01T00:00:00Z',
    fechaVencimiento: '2026-08-30T00:00:00Z',
    montoTotal: 2320, montoAbonado: 2320,
    status: 'pagada',
    permiteParcialidades: true,
    abonos: [{ _id: 'p2', monto: 2320, fecha: '2026-07-20T00:00:00Z', metodoPago: '01' }],
    notas: '',
  },
];

// Notas por Pagar fixtures
const CxpNotes = [
  {
    _id: 'p1', folio: 'NPP-2026-0001',
    proveedorSnapshot: { nombre: 'Distribuidora Norte', rfc: 'DIN040404DDD' },
    proveedorId: 'pr1',
    concepto: 'Compra de inventario',
    descripcion: 'Mercancía para tienda',
    fechaEmision: '2026-07-15T00:00:00Z',
    fechaVencimiento: '2026-08-15T00:00:00Z',
    montoTotal: 25000, montoAbonado: 10000,
    status: 'parcial',
    permiteParcialidades: true,
    abonos: [{ _id: 'pp1', monto: 10000, fecha: '2026-08-01T00:00:00Z', metodoPago: '03' }],
    notas: 'Primer pago',
  },
  {
    _id: 'p2', folio: 'NPP-2026-0002',
    proveedorSnapshot: { nombre: 'Servicios Cloud MX', rfc: 'SCM050505EEE' },
    concepto: 'Hosting mensual',
    fechaEmision: '2026-08-01T00:00:00Z',
    fechaVencimiento: '2026-08-31T00:00:00Z',
    montoTotal: 1200, montoAbonado: 0,
    status: 'pendiente',
    permiteParcialidades: true,
    abonos: [],
    notas: '',
  },
];

const setupAuth = async (ctx) => {
  await ctx.addInitScript((u) => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem('user', JSON.stringify(u));
  }, OWNER);
};

const stubNotesApi = async (ctx, type, notes) => {
  const base = type === 'receivable' ? '**/api/notas-por-cobrar**' : '**/api/notas-por-pagar**';
  await ctx.route(base, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();

    // /summary endpoint
    if (url.pathname.endsWith('/summary')) {
      const total = notes.reduce((s, n) => s + Number(n.montoTotal || 0), 0);
      const paid = notes.reduce((s, n) => s + Number(n.montoAbonado || 0), 0);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { totales: { saldo: total - paid, monto: total, abonado: paid } } }),
      });
    }

    if (method === 'GET' && !/\/[a-f0-9]{20,}$/i.test(url.pathname)) {
      // list
      const statusFilter = url.searchParams.get('status');
      let filtered = notes;
      if (statusFilter) filtered = notes.filter(n => n.status === statusFilter);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: filtered, pagination: { total: filtered.length, pages: 1, page: 1, limit: 100 } }),
      });
    }

    if (method === 'POST' && url.pathname.endsWith('/cancelar')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { ...notes[0], status: 'cancelada', motivoCancelacion: 'Cancelada desde POS' } }),
      });
    }

    if (method === 'POST' && url.pathname.endsWith('/abonos')) {
      const body = JSON.parse(req.postData() || '{}');
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: { ...notes[0], montoAbonado: Number(body.monto || 0) } }),
      });
    }

    // default
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ data: notes }),
    });
  });
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

test.describe('Notas por Cobrar (CxC)', () => {
  test('renders list + summary from /api/notas-por-cobrar', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    await stubNotesApi(context, 'receivable', CxcNotes);

    await page.goto('http://localhost:3003/notes-receivable', { waitUntil: 'domcontentloaded' });

    // Title + subtitle
    await expect(page.getByRole('heading', { name: 'Notas por Cobrar' })).toBeVisible();
    await expect(page.getByText(/Cuentas por cobrar/)).toBeVisible();

    // Each fixture note is rendered (in the Folio cell)
    for (const n of CxcNotes) {
      await expect(page.getByRole('cell', { name: n.folio, exact: true })).toBeVisible();
    }
    // Customer name appears
    await expect(page.getByText('Acme SA de CV')).toBeVisible();
    await expect(page.getByText('Beta SAPI')).toBeVisible();

    // Summary cards (use .notes-summary-card scope to avoid matching the nav links)
    const summary = page.locator('.notes-summary');
    await expect(summary.getByText('Notas', { exact: true })).toBeVisible();
    await expect(summary.getByText('Monto total', { exact: true })).toBeVisible();
    await expect(summary.getByText('Cobrado/Pagado', { exact: true })).toBeVisible();
    await expect(summary.getByText('Saldo pendiente', { exact: true })).toBeVisible();

    await page.screenshot({ path: path.join(SHOT_DIR, '01-cxc-list.png'), fullPage: true });
  });

  test('status filter re-queries the API with ?status=', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);

    const requests = [];
    await context.route('**/api/notas-por-cobrar**', async (route) => {
      const req = route.request();
      if (req.method() !== 'GET') return route.continue();
      const url = new URL(req.url());
      if (url.pathname.endsWith('/summary')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
      }
      requests.push(url.search);
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: [CxcNotes[0]], pagination: { total: 1 } }),
      });
    });

    await page.goto('http://localhost:3003/notes-receivable', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('cell', { name: 'NPC-2026-0001', exact: true })).toBeVisible();

    // Pick "Parcial" from the status select
    const statusSelect = page.locator('select').filter({ hasText: 'Todos' }).first();
    await statusSelect.selectOption('partial');
    await expect(page.getByRole('cell', { name: 'NPC-2026-0001', exact: true })).toBeVisible();

    // The most recent request should include ?status=parcial
    const lastReq = requests[requests.length - 1] || '';
    expect(lastReq).toContain('status=parcial');
  });

  test('add payment button opens modal, submits to /:id/abonos', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    await stubNotesApi(context, 'receivable', CxcNotes);

    await page.goto('http://localhost:3003/notes-receivable', { waitUntil: 'domcontentloaded' });

    // Click the payment button (💵 title) on the first row (n1 - partial)
    const row = page.locator('tr', { hasText: 'NPC-2026-0001' });
    await row.getByTitle('Registrar abono').click();

    // Payment modal appears
    await expect(page.getByText(/Registrar Abono|Agregar Abono|Nuevo Abono/i).first()).toBeVisible();
    // Fill the amount
    const amountInput = page.locator('input[type="number"]').last();
    await amountInput.fill('1500');
    await page.screenshot({ path: path.join(SHOT_DIR, '02-cxc-payment-modal.png'), fullPage: true });

    // Save
    await page.getByRole('button', { name: /Guardar|Registrar|Save/i }).first().click();

    // Toast appears
    await expect(page.getByText(/Abono registrado/i)).toBeVisible({ timeout: 5000 });
  });

  test('cancel button prompts for confirm and calls /:id/cancelar', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);

    const cancelCalls = [];
    await context.route('**/api/notas-por-cobrar**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname.endsWith('/cancelar') && req.method() === 'POST') {
        cancelCalls.push(url.pathname);
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ data: { ...CxcNotes[0], status: 'cancelada' } }),
        });
      }
      if (url.pathname.endsWith('/summary')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: {} }) });
      }
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ data: CxcNotes, pagination: { total: CxcNotes.length } }),
      });
    });

    await page.goto('http://localhost:3003/notes-receivable', { waitUntil: 'domcontentloaded' });
    const row = page.locator('tr', { hasText: 'NPC-2026-0001' });

    // Accept the JS confirm() dialog
    page.on('dialog', (d) => d.accept());

    await row.getByTitle('Cancelar nota').click();
    // Wait for the cancel call to fire
    await expect.poll(() => cancelCalls.length, { timeout: 5000 }).toBeGreaterThan(0);
  });

  test('empty list shows the empty-state copy', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    await stubNotesApi(context, 'receivable', []);

    await page.goto('http://localhost:3003/notes-receivable', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/No hay notas|No se encontraron notas|sin notas/i).first()).toBeVisible();
  });
});

test.describe('Notas por Pagar (CxP)', () => {
  test('renders list + summary from /api/notas-por-pagar', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    await stubNotesApi(context, 'payable', CxpNotes);

    await page.goto('http://localhost:3003/notes-payable', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Notas por Pagar' })).toBeVisible();
    await expect(page.getByText(/Cuentas por pagar/)).toBeVisible();

    for (const n of CxpNotes) {
      await expect(page.getByRole('cell', { name: n.folio, exact: true })).toBeVisible();
    }
    await expect(page.getByText('Distribuidora Norte')).toBeVisible();
    await expect(page.getByText('Servicios Cloud MX')).toBeVisible();

    // The "Proveedor" column header is present (CXC uses "Cliente")
    await expect(page.getByRole('columnheader', { name: /Proveedor/ })).toBeVisible();
    await expect(page.getByText('Monto total')).toBeVisible();

    await page.screenshot({ path: path.join(SHOT_DIR, '03-cxp-list.png'), fullPage: true });
  });

  test('add payment button submits to /api/notas-por-pagar/:id/abonos', async ({ page, context }) => {
    await setupAuth(context);
    await stubTeamList(context);
    await stubMisc(context);
    await stubNotesApi(context, 'payable', CxpNotes);

    await page.goto('http://localhost:3003/notes-payable', { waitUntil: 'domcontentloaded' });

    const row = page.locator('tr', { hasText: 'NPP-2026-0001' });
    await row.getByTitle('Registrar abono').click();

    const amountInput = page.locator('input[type="number"]').last();
    await amountInput.fill('5000');
    await page.getByRole('button', { name: /Guardar|Registrar|Save/i }).first().click();

    await expect(page.getByText(/Abono registrado/i)).toBeVisible({ timeout: 5000 });
  });
});
