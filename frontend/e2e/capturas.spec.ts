import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MATIAS, consultar, entrar, restaurarBase, ultimoCodigoPortal } from './utiles';

/**
 * Capturas de pantalla del documento técnico (capítulo 7), con los datos de la base
 * semilla. No es una prueba: solo corre con CAPTURAS_DOC=1 y deja las imágenes en
 * docs/tecnico/figuras/07-*.png.
 *
 *   CAPTURAS_DOC=1 npx playwright test capturas
 */
const FIGURAS = path.resolve(import.meta.dirname, '../../docs/tecnico/figuras');
const ROSA = { rut: '15.555.551-3', clave: 'Clave-Rosa-2026', correo: 'rosa@example.com' };
const FISCALIZADOR = 'fiscalizador@dt.gob.cl';

test.skip(!process.env.CAPTURAS_DOC, 'Solo para el documento técnico (CAPTURAS_DOC=1).');
test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
test.beforeAll(() => restaurarBase());

/** Espera datos y transiciones terminadas, y guarda la pantalla visible. */
async function capturar(page: Page, nombre: string) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.getAnimations()
    .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  await page.screenshot({ path: path.join(FIGURAS, `07-${nombre}.png`) });
}

test('panel del empleador', async ({ page }) => {
  test.setTimeout(180_000);
  await entrar(page);
  await capturar(page, 'panel-inicio');

  await page.goto(`/app/trabajadores/${MATIAS.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await capturar(page, 'panel-carpeta');

  await page.goto('/app/remuneraciones');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await capturar(page, 'panel-remuneraciones');

  await page.goto('/app/dt');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await capturar(page, 'panel-dt');
});

test('portal del trabajador y firma', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/trabajador');
  await page.getByLabel('Tu RUT').fill(MATIAS.rut);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect.poll(() => ultimoCodigoPortal(MATIAS.correo)).toMatch(/^\d{6}$/);
  await page.getByLabel('Código de 6 dígitos').fill(ultimoCodigoPortal(MATIAS.correo));
  const invitacion = page.getByRole('dialog', { name: 'Crea tu clave de acceso' });
  await invitacion.getByRole('button', { name: 'Omitir' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Matías' })).toBeVisible();
  // El aviso de la clave se va solo: la captura queda sin él.
  await expect(page.getByText('Puedes crear tu clave cuando quieras')).toHaveCount(0, { timeout: 20_000 });
  await capturar(page, 'portal-inicio');

  await page.getByRole('link', { name: 'Firmar' }).first().click();
  await expect(page).toHaveURL(/\/firma\//);
  await expect(page.getByRole('heading', { name: 'Confirma tu identidad' })).toBeVisible();
  await capturar(page, 'firma');
});

test('portal de fiscalización', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/inspeccion');
  await page.getByLabel('RUT del empleador').fill('76.123.456-0');
  await page.getByLabel('Tu nombre completo').fill('Carolina Fuentes Inspectora');
  await page.getByLabel('Tu RUT').fill('11.111.111-1');
  await page.getByLabel('Correo institucional').fill(FISCALIZADOR);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect.poll(() => ultimoCodigoPortal(FISCALIZADOR)).toMatch(/^\d{6}$/);
  await page.getByLabel('Código de 6 dígitos').fill(ultimoCodigoPortal(FISCALIZADOR));
  await expect(page.getByRole('heading', { name: 'COMERCIAL LOS ANDES SPA' })).toBeVisible();
  await capturar(page, 'inspeccion');
});

test('acceso Ley Karin', async ({ page }) => {
  test.setTimeout(180_000);
  await entrar(page);
  await page.goto('/app/reglamento');
  const seccion = page.locator('section').filter({ hasText: 'Ley Karin: encargado de denuncias' });
  await seccion.getByRole('button', { name: 'Designar encargado' }).click();
  await page.getByLabel('RUT del encargado').fill(ROSA.rut);
  await page.getByLabel('Nombres').fill('Rosa');
  await page.getByLabel('Apellidos').fill('Díaz');
  await page.getByLabel('Correo', { exact: true }).fill(ROSA.correo);
  await page.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page.getByText(`Invitación enviada a ${ROSA.correo}`)).toBeVisible();

  const enlace = consultar(
    'from django.contrib.auth.tokens import default_token_generator as g; from django.utils.http import urlsafe_base64_encode as b;'
    + ' from core.models import EncargadoKarin; u = EncargadoKarin.objects.get().usuario;'
    + ' print(f"/karin/clave/{b(str(u.pk).encode())}/{g.make_token(u)}")');
  await page.context().clearCookies();
  await page.goto(enlace);
  await page.getByLabel('Clave nueva').fill(ROSA.clave);
  await page.getByLabel('Repite la clave').fill(ROSA.clave);
  await page.getByRole('button', { name: 'Guardar clave' }).click();
  await page.getByRole('button', { name: 'Ir al ingreso Ley Karin' }).click();
  await page.getByLabel('Tu RUT').fill(ROSA.rut);
  await page.getByLabel('Clave', { exact: true }).fill(ROSA.clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Hola, Rosa' })).toBeVisible();
  await capturar(page, 'karin');
});
