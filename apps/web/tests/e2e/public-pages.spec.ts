import { expect, test } from '@playwright/test';
import { saveScreenshot } from './helpers';

test('landing renderiza', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByText('Desenrola')).toBeVisible();
  await saveScreenshot(page, testInfo, 'landing');
});

test('/login renderiza', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await saveScreenshot(page, testInfo, 'login');
});

test('/signup renderiza', async ({ page }, testInfo) => {
  await page.goto('/signup');
  await expect(page.getByRole('heading', { name: 'Criar Conta' })).toBeVisible();
  await saveScreenshot(page, testInfo, 'signup');
});
