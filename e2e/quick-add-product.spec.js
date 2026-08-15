import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOT_DIR = path.join(process.cwd(), 'e2e', 'screenshots', 'quick-add-product');
fs.mkdirSync(SHOT_DIR, { recursive: true });

// Stub: products list (search) — returns Café + Pan
const stubSearchProducts = (q) => {
  const all = [
    { _id: 'p1', nombre: 'Café Americano', precioVenta: 35, claveProdServ: '01010101', claveUnidad: 'E48', unidad: 'Pieza', objetoImp: '02', categoria: 'Bebidas', sku: 'CAFE-001' },
    { _id: 'p2', nombre: 'Pan Dulce', precioVenta: 18, claveProdServ: '01010101', claveUnidad: 'E48', unidad: 'Pieza', objetoImp: '02', categoria: 'Panadería', sku: 'PAN-001' },
    { _id: 'p3', nombre: 'Cappuccino', precioVenta: 45, claveProdServ: '01010101', claveUnidad: 'E48', unidad: 'Pieza', objetoImp: '02', categoria: 'Bebidas', sku: 'CAP-001' },
  ];
  const ql = (q || '').toLowerCase();
  if (!ql) return all;
  return all.filter(
    (p) => p.nombre.toLowerCase().includes(ql) || (p.sku || '').toLowerCase().includes(ql),
  );
};

test('quick-add product modal: search flow', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem(
      'user',
      JSON.stringify({ email: 'demo@nefesh.local', nombre: 'Demo' }),
    );
  });

  // Stub products list / search
  await page.route('**/api/products**', async (route) => {
    const url = new URL(route.request().url());
    const q = url.searchParams.get('search') || '';
    const products = stubSearchProducts(q);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          products,
          pagination: { total: products.length, pages: 1, page: 1, limit: 20 },
        },
      }),
    });
  });
  await page.route('**/api/clients**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { clients: [] } }) }),
  );
  await page.route('**/api/users/emisor-config**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { rfc: 'XAXX010101000', nombre: 'Demo SA' } }) }),
  );

  // 1) POS landing — empty cart shows the new "Agregar" button in the header
  await page.goto('/pos', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: /Carrito/ })).toBeVisible();
  const addBtn = page.locator('button[aria-label="Buscar o crear producto"]');
  await expect(addBtn).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '01-pos-empty-cart.png'), fullPage: false });

  // 2) Open the modal
  await addBtn.click();
  const modal = page.getByRole('heading', { name: /Agregar Producto/ });
  await expect(modal).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '02-modal-search-empty.png') });

  // 3) Type to search
  const searchInput = page.getByPlaceholder(/Buscar por nombre o SKU/);
  await searchInput.fill('caf');
  // Wait for debounce + results, scoped to the modal
  const modalContent = page.locator('.modal-content');
  await expect(modalContent.getByText('Café Americano')).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '03-modal-search-results.png') });

  // 4) Pick the first result (in the modal, not the catalog)
  await modalContent.getByText('Café Americano').click();
  await expect(modalContent.getByText('Precio catálogo:')).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '04-modal-qty-price.png') });

  // 5) Set qty = 3 and add to cart
  const qtyInput = page.locator('input[type="number"]').first();
  await qtyInput.fill('3');
  await page.getByRole('button', { name: /Agregar al carrito/ }).click();

  // 6) Back to POS, cart should have Café Americano ×3
  await expect(page.getByText('Café Americano').first()).toBeVisible();
  // Look for the qty in the cart item
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '05-pos-cart-with-item.png'), fullPage: false });
});

test('quick-add product modal: create flow', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fake.jwt.token');
    localStorage.setItem(
      'user',
      JSON.stringify({ email: 'demo@nefesh.local', nombre: 'Demo' }),
    );
  });

  // Track POST /api/products calls
  const createdProducts = [];
  await page.route('**/api/products**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      const newProduct = {
        _id: 'new-' + Date.now(),
        nombre: body.nombre,
        sku: body.sku || '',
        precioVenta: body.precioVenta,
        categoria: body.categoria || 'General',
        claveUnidad: body.claveUnidad || 'E48',
        claveProdServ: body.claveProdServ || '01010101',
        unidad: 'Pieza',
        objetoImp: '02',
      };
      createdProducts.push(newProduct);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: newProduct }),
      });
      return;
    }
    // GET list
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

  await page.goto('/pos', { waitUntil: 'networkidle' });
  await page.locator('button[aria-label="Buscar o crear producto"]').click();

  // Switch to "Crear nuevo" tab
  await page.getByRole('button', { name: /Crear nuevo/ }).click();
  await expect(page.getByPlaceholder('Ej: Hamburguesa Especial')).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '06-modal-create-empty.png') });

  // Fill the form
  await page.getByPlaceholder('Ej: Hamburguesa Especial').fill('Taco de Pastor');
  await page.getByPlaceholder('Opcional').fill('TAC-PAST-01');
  await page.getByPlaceholder('0.00').fill('65');
  await page.screenshot({ path: path.join(SHOT_DIR, '07-modal-create-filled.png') });

  // Submit
  await page.getByRole('button', { name: /Crear y agregar/ }).click();

  // The cart should now show the new product
  await expect(page.getByText('Taco de Pastor').first()).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '08-pos-cart-after-create.png'), fullPage: false });

  // Verify backend was hit
  expect(createdProducts).toHaveLength(1);
  expect(createdProducts[0].nombre).toBe('Taco de Pastor');
  expect(createdProducts[0].precioVenta).toBe(65);
});
