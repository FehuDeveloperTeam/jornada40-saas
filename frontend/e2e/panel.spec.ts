import { expect, test } from '@playwright/test';
import { MATIAS, descargar, entrar, periodo, restaurarBase } from './utiles';

// Panel: Inicio, Trabajadores y carpeta del trabajador.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

test('inicio muestra lo que requiere atención', async ({ page }) => {
  await entrar(page);
  await expect(page.getByText(/Documento rechazado/).first()).toBeVisible();
  await expect(page.getByText(/Firma por vencer/).first()).toBeVisible();
  await expect(page.getByText('Composición del equipo')).toBeVisible();
});

test('lista de trabajadores y carpeta', async ({ page }) => {
  await entrar(page);
  await page.getByRole('link', { name: 'Trabajadores' }).first().click();
  await expect(page.getByRole('heading', { name: 'Trabajadores', level: 1 })).toBeVisible();
  // Art. 22 se muestra como tal, no con horas.
  await expect(page.getByText('Art. 22').first()).toBeVisible();

  await page.getByText('Matías Soto Muñoz').first().click();
  await expect(page.getByRole('heading', { name: /Matías Ignacio Soto Muñoz/ })).toBeVisible();
  await expect(page.getByText(`Última liquidación · ${periodo(-1)}`)).toBeVisible();

  for (const [pestana, texto] of [
    ['Datos personales', 'Identificación'], ['Contrato y jornada', 'Distribución semanal'],
    ['Remuneraciones', 'Liquidaciones emitidas'], ['Vacaciones', 'Registro de vacaciones y permisos'],
    ['Documentos', 'Historial de documentos'],
  ]) {
    await page.getByRole('navigation', { name: 'Secciones de la carpeta' }).getByRole('link', { name: pestana }).click();
    await expect(page.getByText(texto, { exact: true }).first()).toBeVisible();
  }
});

test('descargas de la carpeta', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=remuneraciones`);
  const pdf = await descargar(page, () => page.getByRole('button', { name: `Descargar liquidación de ${periodo(-1)}` }).click());
  expect(pdf).toMatch(/^Liquidacion_.*\.pdf$/);
  const zip = await descargar(page, () => page.getByRole('button', { name: 'Descargar carpeta' }).click());
  expect(zip).toMatch(/\.zip$/);
});

test('editar datos personales', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=personal`);
  const seccion = page.locator('section', { hasText: 'Contacto' }).first();
  await seccion.getByRole('button', { name: 'Editar' }).click();
  await seccion.getByLabel('Teléfono').fill('+56 9 5555 0001');
  await seccion.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(/\+56 ?9 ?5555 ?0001/).first()).toBeVisible();
});

test('navegación y buscador', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}`);
  await page.getByRole('link', { name: 'Trabajador anterior' }).click();
  await expect(page.getByRole('heading', { name: /Carla Andrea Pérez/, level: 1 })).toBeVisible();

  await page.keyboard.press('Control+k');
  await page.keyboard.type('pedro');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /Pedro/, level: 1 })).toBeVisible();
});

test('direcciones antiguas redirigen', async ({ page }) => {
  await entrar(page);
  await page.goto(`/dashboard?empleado=${MATIAS.id}&tab=vacaciones`);
  await expect(page).toHaveURL(new RegExp(`/app/trabajadores/${MATIAS.id}\\?tab=vacaciones$`));
  await page.goto('/empresas');
  await expect(page).toHaveURL(/\/app\/empresas$/);
  await page.goto('/suscripcion');
  await expect(page).toHaveURL(/\/app\/plan$/);
});

test('móvil sin desborde horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
