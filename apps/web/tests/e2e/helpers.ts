import { expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const SHOT_DIR = path.resolve(process.cwd(), '..', '..', 'output', 'playwright', 'e2e');

function safeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function saveScreenshot(page: Page, testInfo: TestInfo, label: string) {
  await fs.mkdir(SHOT_DIR, { recursive: true });
  const file = `${safeName(testInfo.title)}-${safeName(label)}.png`;
  const fullPath = path.join(SHOT_DIR, file);
  await page.screenshot({ path: fullPath, fullPage: true });
  await testInfo.attach(`shot-${label}`, {
    path: fullPath,
    contentType: 'image/png',
  });
}

export async function loginTopografo(page: Page) {
  const email = process.env.E2E_TOPO_EMAIL;
  const senha = process.env.E2E_TOPO_PASSWORD;
  if (!email || !senha) {
    throw new Error('Defina E2E_TOPO_EMAIL e E2E_TOPO_PASSWORD para rodar o fluxo autenticado.');
  }

  await page.goto('/');
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(senha);
  await page.locator('form').getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/app/);
}
