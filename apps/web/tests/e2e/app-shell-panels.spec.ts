import { expect, test } from '@playwright/test';
import { loginTopografo, saveScreenshot } from './helpers';

const PANEL_BUTTONS = [
  'Projetos',
  'Editor (Desenho/CAD)',
  'Validar Desenho',
  'Identificar Vizinhos',
  'Gerar Peças',
  'Documentos',
  'Financeiro',
];

test('painel principal abre e navega pelas seções', async ({ page }, testInfo) => {
  test.skip(
    !process.env.E2E_TOPO_EMAIL || !process.env.E2E_TOPO_PASSWORD,
    'Defina E2E_TOPO_EMAIL e E2E_TOPO_PASSWORD para validar o AppShell autenticado.'
  );

  await loginTopografo(page);
  await saveScreenshot(page, testInfo, 'app-home');

  for (const name of PANEL_BUTTONS) {
    const button = page.getByRole('button', { name }).first();
    await button.click();
    await expect(button).toBeVisible();
    await page.waitForTimeout(400);
    await saveScreenshot(page, testInfo, `panel-${name}`);
  }
});
