import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SCREENSHOTS_DIR = '/tmp/products-crud-verification';
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function verify() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🧪 PRODUCTS CRUD VERIFICATION\n');

    // Step 1: Navigate to login
    console.log('1️⃣ Navigating to login page...');
    await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-login-page.png` });
    console.log('   ✅ Login page loaded');

    // Step 2: Login
    console.log('2️⃣ Logging in with test credentials...');
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="email" i]', 'test@example.com');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-email-entered.png` });

    await page.fill('input[type="password"]', 'Test123!');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-password-entered.png` });

    await page.click('button:has-text("Login"), button:has-text("Iniciar Sesión"), button:has-text("Sign In")');

    // Wait for redirect or error
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-after-login.png` });

    const currentUrl = page.url();
    console.log(`   URL after login: ${currentUrl}`);

    // Step 3: Navigate to Products
    console.log('3️⃣ Navigating to Products page...');
    await page.goto('http://localhost:3000/products', { waitUntil: 'networkidle', timeout: 10000 }).catch(e => {
      console.log(`   Navigation attempt: ${e.message}`);
    });

    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/05-products-page.png` });

    const productsUrl = page.url();
    console.log(`   Current URL: ${productsUrl}`);

    // Check if page loaded
    const hasProductsTitle = await page.locator('text=/Products|Productos|productos/i').isVisible().catch(() => false);
    const hasProductsTable = await page.locator('table').isVisible().catch(() => false);
    const hasSearchBox = await page.locator('input[placeholder*="search" i], input[placeholder*="busca" i]').isVisible().catch(() => false);

    console.log(`   Products page elements: Title=${hasProductsTitle}, Table=${hasProductsTable}, Search=${hasSearchBox}`);

    // Step 4: Check product list
    console.log('4️⃣ Checking product list...');
    const rows = await page.locator('tr').count();
    console.log(`   Found ${rows} table rows (including header)`);

    if (rows > 1) {
      console.log('   ✅ Products table populated');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/06-products-list.png` });
    } else {
      console.log('   ℹ️  No products in list yet');
    }

    // Step 5: Try to create a product
    console.log('5️⃣ Testing create product button...');
    const createBtn = await page.locator('button:has-text("Create"), button:has-text("Crear"), button:has-text("Add Product"), button:has-text("Nuevo")').first().isVisible().catch(() => false);

    if (createBtn) {
      console.log('   ✅ Create button found');
      await page.locator('button:has-text("Create"), button:has-text("Crear"), button:has-text("Add Product"), button:has-text("Nuevo")').first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/07-create-modal.png` });

      // Check if modal opened
      const modalVisible = await page.locator('text=/New Product|Nuevo Producto|Create Product/i, [class*="modal"]:visible').isVisible().catch(() => false);
      console.log(`   Modal opened: ${modalVisible}`);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    } else {
      console.log('   ⚠️  Create button not found');
    }

    // Step 6: Test search functionality
    console.log('6️⃣ Testing search functionality...');
    const searchInputs = await page.locator('input[placeholder*="search" i], input[placeholder*="busca" i]');
    const searchCount = await searchInputs.count();

    if (searchCount > 0) {
      console.log(`   ✅ Found ${searchCount} search input(s)`);
      await searchInputs.first().fill('test');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/08-search-test.png` });
      console.log('   ✅ Search input accepted text');
    } else {
      console.log('   ⚠️  Search input not found');
    }

    // Step 7: Check inventory stats
    console.log('7️⃣ Checking inventory stats...');
    const statsVisible = await page.locator('text=/Inventory|Inventario|Stats|Stock/i').isVisible().catch(() => false);
    console.log(`   Stats section visible: ${statsVisible}`);
    if (statsVisible) {
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/09-stats-section.png` });
    }

    // Final screenshot
    console.log('📸 Taking final full page screenshot...');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/10-final-state.png` });

    console.log('\n✅ VERIFICATION COMPLETE\n');
    console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
    console.log('Check the PNG files for visual verification\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/ERROR.png` });
    throw error;
  } finally {
    await browser.close();
  }
}

verify().catch(console.error);
