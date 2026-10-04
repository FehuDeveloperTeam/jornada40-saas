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

test('la sesión se renueva sola al vencer el acceso', async ({ page, context }) => {
  await entrar(page);
  // Simula los 30 minutos: se pierde la cookie de acceso y queda la de renovación.
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(cookies.filter((c) => c.name !== 'jornada40-auth'));
  await page.goto(`/app/trabajadores/${MATIAS.id}`);
  await expect(page.getByText(/Matías/i).first()).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/app/trabajadores/${MATIAS.id}`));
  // Sin ninguna de las dos, vuelve al login recordando la página.
  await context.clearCookies();
  await page.goto('/app/remuneraciones');
  await expect(page).toHaveURL(/\/login\?volver=%2Fapp%2Fremuneraciones/);
  await page.getByLabel('RUT del titular de la cuenta').fill('123456785');
  await page.getByLabel('Contraseña', { exact: true }).fill('Clave-Segura-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/app\/remuneraciones$/);
});

test('alta de un trabajador Art. 22: la ficha avisa qué falta para el contrato', async ({ page }) => {
  await entrar(page);
  await page.getByRole('button', { name: 'Agregar trabajador' }).first().click();
  const drawer = page.getByRole('dialog', { name: 'Agregar trabajador' });
  await drawer.getByLabel('RUT').fill('15.555.551-3');
  await drawer.getByLabel('Nombres').fill('Rosa');
  await drawer.getByLabel('Apellido paterno').fill('Díaz');
  await drawer.getByLabel('Cargo').fill('Gerente general');
  await drawer.getByLabel('Tipo de jornada').selectOption('ART_22');
  await expect(drawer.getByLabel('Jornada semanal (horas)')).toHaveCount(0);
  await drawer.getByLabel('Sueldo base').fill('2500000');
  await drawer.getByRole('button', { name: 'Crear trabajador' }).click();
  await expect(page.getByText(/Completa su ficha para que el contrato salga completo/)).toBeVisible();
  // La carpeta dice qué falta; el horario no, porque Art. 22 no lo tiene.
  await expect(page.getByText('Completa la ficha para que el contrato salga completo')).toBeVisible();
  await expect(page.getByText(/Falta: .*estado civil/)).toBeVisible();
  await expect(page.getByText(/horario de trabajo/i)).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Secciones de la carpeta' }).getByRole('link', { name: 'Contrato y jornada' }).click();
  await expect(page.getByText('Art. 22', { exact: true }).first()).toBeVisible();
});
