import { expect, test } from '@playwright/test';
import { descargar, entrar, restaurarBase } from './utiles';

// Dirección del Trabajo: plazos de registro en Mi DT, CSV de carga masiva y consentimiento electrónico.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

test('registro en la DT: plazos, CSV y constancia', async ({ page }) => {
  await entrar(page);
  await page.getByRole('link', { name: /Dirección del Trabajo/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Dirección del Trabajo', level: 1 })).toBeVisible();
  // Contratos de 2019 a 2025 sin constancia de registro: vencidos.
  await expect(page.getByText(/Venció/).first()).toBeVisible();
  expect(await descargar(page, () => page.getByRole('button', { name: /Descargar CSV para Mi DT/ }).click()))
    .toMatch(/^RegistroDT_76123456-0_\d{8}\.zip$/);
  await page.getByRole('button', { name: 'Marcar registrado' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Marcar/ }).click();
  await page.getByRole('button', { name: /^Registrados/ }).click();
  await expect(page.getByText(/Registrado el/).first()).toBeVisible();
});

test('consentimiento para documentos electrónicos', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/dt');
  await expect(page.getByText(/0 de 4 trabajadores autorizados/)).toBeVisible();
  await page.getByRole('button', { name: 'Firmado en papel' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Registrar|Guardar|Confirmar/ }).click();
  await expect(page.getByText(/1 de 4 trabajadores autorizados/)).toBeVisible();
  await page.getByRole('button', { name: 'Solo crear anexos' }).click();
  await expect(page.getByText(/3 anexos? creados?|Creados: 3|creados.*3|3.*creados/i).first()).toBeVisible();
});
