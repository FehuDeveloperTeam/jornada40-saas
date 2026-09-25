import { expect, test } from '@playwright/test';
import { entrar, restaurarBase } from './utiles';

// Dirección del Trabajo: plazos de registro en Mi DT, CSV de carga masiva y consentimiento electrónico.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

test('registro en la DT: plazos, ficha y constancia', async ({ page }) => {
  await entrar(page);
  await page.getByRole('link', { name: /Dirección del Trabajo/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Dirección del Trabajo', level: 1 })).toBeVisible();
  // Contratos de 2019 a 2025 sin constancia de registro: vencidos.
  await expect(page.getByText(/Venció/).first()).toBeVisible();
  // Ficha para el formulario individual de Mi DT, en el orden de sus 4 etapas.
  await page.getByRole('button', { name: 'Ver ficha' }).first().click();
  const ficha = page.getByRole('dialog');
  for (const etapa of ['Etapa 1', 'Etapa 2', 'Etapa 3', 'Etapa 4']) await expect(ficha.getByText(new RegExp(etapa)).first()).toBeVisible();
  await expect(ficha.getByText('Distribución de jornada (cláusula del contrato)')).toBeVisible();
  await ficha.getByRole('button', { name: 'Ya lo registré' }).click();
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
