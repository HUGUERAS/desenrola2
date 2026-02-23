import { expect, test } from '@playwright/test';
import { saveScreenshot } from './helpers';

test('cliente via magic link abre fluxo', async ({ page }, testInfo) => {
  const token = process.env.E2E_CLIENTE_TOKEN;
  test.skip(!token, 'Defina E2E_CLIENTE_TOKEN para validar a página /acesso/:token');

  await page.goto(`/acesso/${token}`);
  await expect(page.getByRole('heading', { name: 'Seus dados' })).toBeVisible();
  await saveScreenshot(page, testInfo, 'cliente-dados');

  await page.getByRole('button', { name: 'Próximo →' }).click();
  await expect(page.getByRole('heading', { name: 'Seus vizinhos' })).toBeVisible();
  await saveScreenshot(page, testInfo, 'cliente-vizinhos');
});
