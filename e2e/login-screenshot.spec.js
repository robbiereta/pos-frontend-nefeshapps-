import { test } from '@playwright/test';
import path from 'node:path';

test('login screenshot — npos branding', async ({ page }) => {
  await page.goto('http://localhost:3003/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: path.join(process.cwd(), 'e2e', 'screenshots', 'walkthrough', 'public_login_npos.png'),
    fullPage: true,
  });
});
