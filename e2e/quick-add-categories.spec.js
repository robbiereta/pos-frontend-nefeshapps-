// E2E for the categories dropdown in the POS QuickAddProductModal.
//
// Verifies:
//   - The "Crear nuevo" tab in QuickAddProductModal renders a
//     <select name="categoriaId"> populated from GET /api/categories
//   - Picking a category pre-fills claveProdServ + claveUnidad in
//     the form
//   - The created product is POSTed with `categoriaId` so the
//     backend's SAT inheritance helper kicks in
//   - When /api/categories is empty, a hint message renders
//     ("Aún no hay categorías…")
import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'quick-add-categories');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const CATEGORIES = [
  { _id: 'cat-bebidas', nombre: 'Bebidas',       claveProdServ: '50202301', claveUnidad: 'H87', unidad: 'Pieza',  objetoImp: '02', tasaIVA: 0.16, activo: true },
  { _id: 'cat-tacos',   nombre: 'Tacos y Tortas',claveProdServ: '90101501', claveUnidad: 'E48', unidad: 'Servicio', objetoImp: '02', tasaIVA: 0.16, activo: true },
];

const setupAuth = async (page) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem('user', JSON.stringify({ email: 'demo@nefesh.local', nombre: 'Demo' }));
  });
};

const stubApi = async (page, opts = {}) => {
  const { categories = CATEGORIES, createdProducts = [] } = opts;
  await page.route('**/api/categories**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: categories }),
    }),
  );
  await page.route('**/api/products**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      const np = {
        _id: 'new-' + Date.now(),
        nombre: body.nombre,
        sku: body.sku || '',
        precioVenta: body.precioVenta,
        categoria: body.categoria || 'General',
        // Mirror the backend semantics: if the frontend sent an
        // empty / undefined categoriaId, this product isn't linked
        // to a category. We use `null` here as a placeholder so the
        // test assertion can distinguish "linked" from "not linked".
        categoriaId: body.categoriaId || null,
        claveUnidad: body.claveUnidad || 'E48',
        claveProdServ: body.claveProdServ || '01010101',
        unidad: 'Pieza',
        objetoImp: '02',
      };
      createdProducts.push(np);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: np }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { products: [], pagination: { total: 0, pages: 1, page: 1, limit: 20 } } }),
    });
  });
  await page.route('**/api/clients**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { clients: [] } }) }),
  );
  await page.route('**/api/users/emisor-config**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { rfc: 'XAXX010101000', nombre: 'Demo SA' } }) }),
  );
};

const openCreateTab = async (page) => {
  await page.goto('/pos', { waitUntil: 'networkidle' });
  await page.locator('button[aria-label="Buscar o crear producto"]').click();
  await page.getByRole('button', { name: /Crear nuevo/ }).click();
  await expect(page.getByPlaceholder('Ej: Hamburguesa Especial')).toBeVisible();
};

test('categories dropdown is populated from /api/categories', async ({ page }) => {
  await setupAuth(page);
  const created = [];
  await stubApi(page, { createdProducts: created });
  await openCreateTab(page);

  // The select renders the categories
  const select = page.locator('select[name="categoriaId"]');
  await expect(select).toBeVisible();
  await expect(select.locator('option', { hasText: 'Bebidas' })).toHaveCount(1);
  await expect(select.locator('option', { hasText: 'Tacos y Tortas' })).toHaveCount(1);
  await expect(select.locator('option', { hasText: 'Sin categoría' })).toHaveCount(1);
  await page.screenshot({ path: path.join(SHOT_DIR, '01-create-with-categories.png') });
});

test('picking a category pre-fills SAT codes', async ({ page }) => {
  await setupAuth(page);
  const created = [];
  await stubApi(page, { createdProducts: created });
  await openCreateTab(page);

  // Pick Tacos y Tortas by its <option> value (the category _id)
  await page.locator('select[name="categoriaId"]').selectOption('cat-tacos');
  // The SAT fields auto-fill
  await expect(page.locator('input[name="claveProdServ"]')).toHaveValue('90101501');
  await expect(page.locator('input[name="claveUnidad"]')).toHaveValue('E48');
  await page.screenshot({ path: path.join(SHOT_DIR, '02-category-prefills-sat.png') });
});

test('creating sends categoriaId to the backend', async ({ page }) => {
  await setupAuth(page);
  const created = [];
  await stubApi(page, { createdProducts: created });
  await openCreateTab(page);

  await page.getByPlaceholder('Ej: Hamburguesa Especial').fill('Taco de Pastor');
  await page.locator('select[name="categoriaId"]').selectOption('cat-tacos');
  await page.getByPlaceholder('0.00').fill('65');
  await page.getByRole('button', { name: /Crear y agregar/ }).click();

  // Cart shows the new product
  await expect(page.getByText('Taco de Pastor').first()).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '03-cart-after-create.png') });

  // Backend was called with categoriaId
  expect(created).toHaveLength(1);
  expect(created[0].categoriaId).toBe('cat-tacos');
  expect(created[0].categoria).toBe('Tacos y Tortas');
  expect(created[0].claveProdServ).toBe('90101501');
  expect(created[0].claveUnidad).toBe('E48');
});

test('shows the "no categories" hint when list is empty', async ({ page }) => {
  await setupAuth(page);
  await stubApi(page, { categories: [] });
  await openCreateTab(page);

  // The select still renders with only the "Sin categoría" option
  const select = page.locator('select[name="categoriaId"]');
  await expect(select).toBeVisible();
  await expect(select.locator('option')).toHaveCount(1);
  // The hint message shows
  await expect(page.getByText(/Aún no hay categorías/)).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '04-no-categories-hint.png') });
});

test('picking "Sin categoría" clears the categoriaId without breaking SAT defaults', async ({ page }) => {
  await setupAuth(page);
  const created = [];
  await stubApi(page, { createdProducts: created });
  await openCreateTab(page);

  // Pick then un-pick
  await page.locator('select[name="categoriaId"]').selectOption('cat-tacos');
  await expect(page.locator('input[name="claveProdServ"]')).toHaveValue('90101501');
  await page.locator('select[name="categoriaId"]').selectOption('');
  // SAT codes stay (user can still edit them), categoriaId is empty
  await expect(page.locator('select[name="categoriaId"]')).toHaveValue('');

  // Submit without categoriaId — backend should NOT receive a
  // categoriaId key (we explicitly strip empty strings to undefined
  // so the backend's SAT inheritance helper short-circuits).
  await page.getByPlaceholder('Ej: Hamburguesa Especial').fill('Test Item');
  await page.getByPlaceholder('0.00').fill('10');
  await page.getByRole('button', { name: /Crear y agregar/ }).click();
  await expect(page.getByText('Test Item').first()).toBeVisible();
  expect(created).toHaveLength(1);
  // The test stub turns `undefined` categoriaId into `null`; the
  // important thing is that the form never sent a real category id.
  expect(created[0].categoriaId).toBeNull();
});
