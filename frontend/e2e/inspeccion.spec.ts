import { expect, test } from '@playwright/test';
import { descargar, dibujarFirma, entrar, restaurarBase, ultimoCodigoPortal } from './utiles';

// Portal de fiscalización (Dictamen 0789/15): el inspector entra con el RUT del
// empleador y su correo institucional, ve todo, descarga y ratifica; el
// empleador ve la bitácora en Dirección del Trabajo.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

const CORREO = 'fiscalizador@dt.gob.cl';

test('el inspector entra, descarga y ratifica; el empleador ve la bitácora', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Fiscalización DT' }).click();
  await expect(page.getByRole('heading', { name: 'Acceso para fiscalización' })).toBeVisible();

  await page.getByLabel('RUT del empleador').fill('76.123.456-0');
  await page.getByLabel('Tu nombre completo').fill('Carolina Fuentes Inspectora');
  await page.getByLabel('Tu RUT').fill('11.111.111-1');
  // Solo correo institucional.
  await page.getByLabel('Correo institucional').fill('carolina@gmail.com');
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect(page.getByText(/Usa tu correo institucional/)).toBeVisible();
  await page.getByLabel('Correo institucional').fill(CORREO);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect(page.getByText(/enviamos un código a tu correo institucional/)).toBeVisible();
  await expect.poll(() => ultimoCodigoPortal(CORREO)).toMatch(/^\d{6}$/);
  await page.getByLabel('Código de 6 dígitos').fill(ultimoCodigoPortal(CORREO));

  await expect(page.getByRole('heading', { name: 'COMERCIAL LOS ANDES SPA' })).toBeVisible();
  const lista = page.getByRole('region', { name: 'Documentos' });
  await expect(lista.getByText(/documentos · la descarga entrega la versión firmada/)).toBeVisible();
  await page.getByLabel('Tipo de documento').selectOption('CONTRATO');
  const primero = lista.getByRole('button', { name: /^Descargar Contrato de trabajo/ }).first();
  expect(await descargar(page, () => primero.click())).toMatch(/\.pdf$/);

  await lista.getByRole('button', { name: /^Ratificar Contrato de trabajo/ }).first().click();
  const modal = page.getByRole('dialog', { name: 'Ratificar documento' });
  await dibujarFirma(page, modal.locator('canvas'));
  await modal.getByRole('button', { name: 'Ratificar con mi firma' }).click();
  await expect(lista.getByText('Ratificado por Carolina Fuentes Inspectora').first()).toBeVisible();

  await page.getByRole('tab', { name: /Trabajadores/ }).click();
  await expect(page.getByRole('region', { name: 'Trabajadores' }).getByText('Vigente').first()).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Acceso para fiscalización' })).toBeVisible();

  // El empleador ve cada acción en Dirección del Trabajo.
  await entrar(page);
  await page.goto('/app/dt');
  const bitacora = page.getByRole('region', { name: 'Accesos de fiscalización' });
  for (const accion of ['Ingreso', 'Descarga de documento', 'Ratificación en terreno', 'Salida']) {
    await expect(bitacora.getByText(accion, { exact: true }).first()).toBeVisible();
  }
});
