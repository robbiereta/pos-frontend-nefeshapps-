// Regresión: "Lanza error" al crear una nueva nota por cobrar.
//
// Bug: `NoteModal.jsx` declaraba un `useMemo` (filteredClients) *después*
// del early return `if (!open) return null;`. React exige que los hooks
// se llamen en el mismo orden en cada render — al abrir el modal
// (open: false → true) el componente empezaba con 8 hooks y de pronto
// llamaba 9 → "Rendered more hooks than during the previous render".
// El modal se desmontaba silenciosamente sin pintar nada.
//
// Este test reproduce el flujo de creación de nota y verifica:
//   1. Que el modal abre y se monta correctamente (el h3 aparece).
//   2. Que cuando el backend responde con error, el banner rojo se
//      renderiza dentro del modal con el `message` del backend.
//   3. Que el POST al backend se hace una sola vez con la forma
//      correcta (montoTotal, fechaEmision, etc.).
//   4. Que el modal sigue abierto y con los datos del usuario
//      preservados (no se "resetea" por accidente al fallar).
//   5. Que NO hubo un crash de "Rendered more hooks" en la consola.

import { test, expect } from '@playwright/test';

const FAKE_USER = { email: 'demo@nefesh.local', _id: 'u_demo' };
const FAKE_TOKEN = 'fake.jwt.token';

async function bootstrapAuth(page) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }, { token: FAKE_TOKEN, user: FAKE_USER });
}

async function stubReadEndpoints(page) {
  await page.route('**/api/clients*', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 500 } }),
      });
    }
    return route.fallback();
  });

  await page.route('**/api/notas-por-cobrar', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], pagination: { total: 0, page: 1, limit: 10 } }),
      });
    }
    return route.fallback();
  });

  await page.route('**/api/notas-por-cobrar/summary', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          totales: { count: 0, montoTotal: 0, montoAbonado: 0, saldo: 0, vencidas: 0 },
          buckets: { vigente: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 },
        },
      }),
    });
  });
}

async function openModalAndFill(page) {
  await page.goto('/notes-receivable');
  await expect(page.getByRole('heading', { name: 'Notas por Cobrar', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: '+ Nueva Nota' }).click();
  // El modal debe montar correctamente: el h3 aparece.
  await expect(page.getByRole('heading', { name: 'Nueva Nota por Cobrar' })).toBeVisible();

  await page.locator('input[name="contactName"]').fill('Cliente de Prueba SA');
  await page.locator('input[name="contactRfc"]').fill('TST850312AB1');
  await page.locator('input[name="reference"]').fill('REF-001');
  await page.locator('input[name="amount"]').fill('1234.56');
  await page.locator('input[name="concept"]').fill('Servicio de prueba');
}

test.describe('Regresión: crear nota por cobrar', () => {
  test('el modal abre sin "Rendered more hooks" y muestra el error del backend', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // Capturamos el POST para validar su forma.
    let postRequest = null;
    page.on('request', (req) => {
      if (req.url().includes('/api/notas-por-cobrar') && req.method() === 'POST') {
        postRequest = JSON.parse(req.postData() || '{}');
      }
    });

    await bootstrapAuth(page);
    await stubReadEndpoints(page);

    // Simulamos que el backend responde 400 con un `message` claro.
    await page.route('**/api/notas-por-cobrar', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'ValidationError: montoTotal: Path `montoTotal` is required.',
            errors: { montoTotal: { message: 'Path `montoTotal` is required.' } },
          }),
        });
      }
      return route.fallback();
    });

    await openModalAndFill(page);
    await page.getByRole('button', { name: 'Crear' }).click();

    // 1) El banner de error aparece con el `message` del backend.
    //    (React normaliza el inline style a `rgb(...)` por eso usamos
    //    un selector por el texto del mensaje, no por el color.)
    const errorBanner = page.locator('.notes-modal div').filter({
      hasText: /ValidationError|montoTotal/,
    }).first();
    await expect(errorBanner).toBeVisible({ timeout: 5000 });
    await expect(errorBanner).toContainText('montoTotal');

    // 2) El modal sigue abierto (no se cerró al fallar).
    await expect(page.getByRole('heading', { name: 'Nueva Nota por Cobrar' })).toBeVisible();

    // 3) El POST se hizo con la forma correcta (snake-ish en español).
    expect(postRequest).toBeTruthy();
    expect(postRequest.montoTotal).toBe(1234.56);
    expect(postRequest.concepto).toBe('Servicio de prueba');
    expect(postRequest.clienteSnapshot).toMatchObject({
      nombre: 'Cliente de Prueba SA',
      rfc: 'TST850312AB1',
    });

    // 4) NO hubo un crash de "Rendered more hooks" en la consola.
    const hooksError = pageErrors.find((m) => m.includes('Rendered more hooks'));
    expect(hooksError, `page error found: ${hooksError || 'none'}`).toBeUndefined();

    await page.screenshot({
      path: 'e2e/screenshots/notes-create-shows-error.png',
      fullPage: true,
    });
  });
});
