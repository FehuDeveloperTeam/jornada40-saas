import { expect, test } from '@playwright/test';
import { consultar, entrar, restaurarBase } from './utiles';

/**
 * Acceso Ley Karin: el titular designa al encargado, este crea su clave, entra
 * por su propia puerta y ve solo su panel reservado; su sesión no abre el panel
 * de la empresa y el titular solo ve que hubo actividad.
 */
const ROSA = { rut: '15.555.551-3', clave: 'Clave-Rosa-2026', correo: 'rosa@example.com' };

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

test('el titular designa al encargado y este entra por su acceso reservado', async ({ page }) => {
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
  await expect(seccion.getByText('Invitado: aún no crea su clave')).toBeVisible();

  const enlace = consultar(
    'from django.contrib.auth.tokens import default_token_generator as g; from django.utils.http import urlsafe_base64_encode as b;'
    + ' from core.models import EncargadoKarin; u = EncargadoKarin.objects.get().usuario;'
    + ' print(f"/karin/clave/{b(str(u.pk).encode())}/{g.make_token(u)}")');
  await page.context().clearCookies();
  await page.goto(enlace);
  await page.getByLabel('Clave nueva').fill(ROSA.clave);
  await page.getByLabel('Repite la clave').fill(ROSA.clave);
  await page.getByRole('button', { name: 'Guardar clave' }).click();
  await expect(page.getByText('Tu clave quedó guardada')).toBeVisible();
  await page.getByRole('button', { name: 'Ir al ingreso Ley Karin' }).click();

  await page.getByLabel('Tu RUT').fill(ROSA.rut);
  await page.getByLabel('Clave', { exact: true }).fill(ROSA.clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/karin\/panel$/);
  await expect(page.getByRole('heading', { name: 'Hola, Rosa' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Inició sesión' })).toBeVisible();
  await page.getByRole('button', { name: 'Comprobar que nadie lo alteró' }).click();
  await expect(page.getByText(/Íntegro: los \d+ registros/)).toBeVisible();

  // La sesión Ley Karin no abre el panel de la empresa.
  await page.goto('/app');
  await expect(page).toHaveURL(/\/login/);
});

test('el titular solo ve que hubo actividad, sin detalle', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/equipo?tab=bitacora');
  await expect(page.getByRole('cell', { name: /Hubo actividad en el acceso Ley Karin/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Inició sesión Rosa/ })).toHaveCount(0);
});
