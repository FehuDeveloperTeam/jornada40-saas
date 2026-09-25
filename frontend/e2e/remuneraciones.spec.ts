import { expect, test } from '@playwright/test';
import { descargar, entrar, periodo, restaurarBase } from './utiles';

// Remuneraciones del período y catálogo de conceptos.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

test('emitir una liquidación con la vista previa del servidor', async ({ page }) => {
  await entrar(page);
  await page.getByRole('link', { name: 'Remuneraciones' }).first().click();
  await expect(page.getByText(periodo(0)).first()).toBeVisible();

  const fila = page.getByRole('row').filter({ hasText: 'Javiera' });
  await fila.getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByText('Calculado por el servidor')).toBeVisible();
  const liquido = page.locator('section[aria-live] span.text-\\[24px\\]');
  const antes = await liquido.textContent();

  const selector = page.getByLabel('Agregar concepto');
  await expect(selector.locator('option', { hasText: 'Horas extras 100%' })).toHaveCount(1);
  const opciones = await selector.locator('option').allTextContents();
  await selector.selectOption({ label: opciones.find((o) => /bono/i.test(o))! });
  await page.getByLabel('Monto').last().fill('50000');
  await selector.selectOption({ label: opciones.find((o) => /Horas extras 100/i.test(o))! });
  await page.getByLabel('Horas').last().fill('5');
  // El recargo parte del concepto (HORA_EXTRA_100 → 100 %).
  await expect(page.getByLabel('Recargo').last()).toHaveValue('100');
  await expect(liquido).not.toHaveText(antes ?? '');
  const despues = (await liquido.textContent())!.trim();

  await page.getByRole('button', { name: 'Emitir liquidación' }).click();
  await expect(fila.getByText(despues)).toBeVisible();
});

test('recargo bajo el mínimo legal se rechaza', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/remuneraciones');
  await page.getByRole('row').filter({ hasText: 'Pedro' }).getByRole('button', { name: 'Emitir' }).click();
  const selector = page.getByLabel('Agregar concepto');
  await expect(selector.locator('option', { hasText: 'Horas extras 50%' })).toHaveCount(1);
  const opciones = await selector.locator('option').allTextContents();
  await selector.selectOption({ label: opciones.find((o) => /Horas extras 50/i.test(o))! });
  const horas = page.getByRole('textbox', { name: /^Horas/ });
  await expect(horas).toBeVisible();
  await horas.fill('2');
  await page.getByRole('textbox', { name: /^Recargo/ }).fill('30');
  await expect(page.getByText(/recargo mínimo legal/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Emitir liquidación' })).toBeDisabled();
});

test('emisión masiva y archivos del período', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/remuneraciones');
  await page.getByRole('button', { name: /Emitir \d+ pendiente/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Emitir' }).click();
  await expect(page.getByText('Todas emitidas')).toBeVisible({ timeout: 30_000 });
  for (const [boton, extension] of [['Archivo Previred', /\.txt$/], ['Libro (Excel)', /\.xlsx$/], ['PDF en ZIP', /\.zip$/]] as const) {
    expect(await descargar(page, () => page.getByRole('button', { name: boton }).click())).toMatch(extension);
  }
  // Libro de Remuneraciones Electrónico: el servidor revisa el período antes de descargar.
  await page.getByRole('button', { name: 'Libro electrónico DT' }).click();
  const lre = page.getByRole('dialog');
  await expect(lre.getByText(/4 trabajadores listos para declarar/)).toBeVisible();
  expect(await descargar(page, () => lre.getByRole('button', { name: 'Descargar archivo' }).click()))
    .toMatch(/^76123456-0_\d{6}\.csv$/);
});

test('el libro electrónico exige liquidación de todos los trabajadores', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/remuneraciones');
  await page.getByRole('button', { name: 'Período anterior' }).click();
  await expect(page.getByText(periodo(-1)).first()).toBeVisible();
  await page.getByRole('button', { name: 'Libro electrónico DT' }).click();
  const lre = page.getByRole('dialog');
  await expect(lre.getByText(/sin liquidación del período/).first()).toBeVisible();
  await expect(lre.getByRole('button', { name: 'Descargar archivo' })).toBeDisabled();
});

test('una liquidación firmada no se modifica', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/remuneraciones');
  await page.getByRole('button', { name: 'Período anterior' }).click();
  await expect(page.getByText(periodo(-1)).first()).toBeVisible();
  await page.getByRole('row').filter({ hasText: 'Matías' }).getByRole('button', { name: 'Abrir' }).click();
  await expect(page.getByText(/ya firmó esta liquidación/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
});

test('catálogo de conceptos', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/remuneraciones/conceptos');
  await page.getByRole('button', { name: 'Nuevo concepto' }).click();
  await page.getByLabel('Nombre').fill('Bono de turno noche');
  await expect(page.getByText('BONO_TURNO_NOCHE')).toBeVisible();
  await page.getByText('Haber no imponible', { exact: true }).last().click();
  await page.getByRole('button', { name: 'Crear concepto' }).click();
  const fila = page.getByRole('row').filter({ hasText: 'Bono de turno noche' });
  await expect(fila).toBeVisible();
  await fila.getByRole('switch').click();
  await expect(fila.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await fila.getByRole('switch').click();
  await expect(fila.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Nuevo concepto' }).click();
  await page.getByLabel('Nombre').fill('Bono de turno noche');
  await expect(page.getByText(/Ya existe un concepto con este código/)).toBeVisible();
});
