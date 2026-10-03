import { expect, test } from '@playwright/test';
import { consultar, descargar, entrar, restaurarBase } from './utiles';

/**
 * Usuarios del equipo: el titular invita a una persona con "solo ver" en
 * Remuneraciones, ella crea su clave, entra por "Ingreso del equipo" y ve solo
 * lo suyo; el titular revisa la bitácora y descarga una copia verificable.
 */
const CARLA = { rut: '15.555.550-5', clave: 'Clave-Carla-2026', correo: 'carla@example.com' };

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

test('el titular invita, la persona entra y ve solo su sección', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/equipo');
  await expect(page.getByText('Usas 0 de 6 usuarios del equipo')).toBeVisible();
  await page.getByRole('button', { name: 'Invitar usuario' }).click();
  await page.getByLabel('RUT de la persona').fill(CARLA.rut);
  await page.getByLabel('Nombres').fill('Carla');
  await page.getByLabel('Apellidos').fill('Muñoz');
  await page.getByLabel('Correo').fill(CARLA.correo);
  await page.getByRole('radiogroup', { name: 'Acceso a Remuneraciones' }).getByText('Solo ver').click();
  await page.getByRole('checkbox', { name: /Comercial los andes/i }).check();
  await page.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page.getByText(`Invitación enviada a ${CARLA.correo}`)).toBeVisible();
  await expect(page.getByText('Invitado: aún no crea su clave')).toBeVisible();

  // Enlace del correo de invitación (en e2e los correos van a la consola).
  const enlace = consultar(
    'from django.contrib.auth.tokens import default_token_generator as g; from django.utils.http import urlsafe_base64_encode as b;'
    + ' from core.models import UsuarioEquipo; u = UsuarioEquipo.objects.get().usuario;'
    + ' print(f"/equipo/clave/{b(str(u.pk).encode())}/{g.make_token(u)}")');
  await page.context().clearCookies();
  await page.goto(enlace);
  await page.getByLabel('Clave nueva').fill(CARLA.clave);
  await page.getByLabel('Repite la clave').fill(CARLA.clave);
  await page.getByRole('button', { name: 'Guardar clave' }).click();
  await expect(page.getByText('Tu clave quedó guardada')).toBeVisible();

  await page.goto('/login');
  await page.getByRole('link', { name: 'Ingreso del equipo' }).click();
  await page.getByLabel('Tu RUT').fill(CARLA.rut);
  await page.getByLabel('Clave', { exact: true }).fill(CARLA.clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/app$/);

  const menu = page.getByRole('navigation', { name: 'Principal' }).first();
  await expect(menu.getByRole('link', { name: 'Remuneraciones' })).toBeVisible();
  // Firmas: solo las de liquidaciones (su módulo).
  await expect(menu.getByRole('link', { name: 'Firma electrónica' })).toBeVisible();
  for (const oculto of ['Empresa', 'Usuarios y bitácora', 'Dirección del Trabajo', 'Reportes']) {
    await expect(menu.getByRole('link', { name: oculto, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'Agregar trabajador' })).toHaveCount(0);

  await page.goto('/app/remuneraciones');
  await expect(page.getByText('solo lectura', { exact: false })).toBeVisible();
  await page.goto('/app/empresa');
  await expect(page.getByRole('heading', { name: 'No tienes acceso a esta sección' })).toBeVisible();

  await page.goto('/app/cuenta');
  const acceso = page.getByRole('main').getByRole('listitem').filter({ hasText: 'Remuneraciones' });
  await expect(acceso).toContainText('Solo ver');
});

test('el titular ve la bitácora y descarga una copia verificable', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/equipo?tab=bitacora');
  await expect(page.getByRole('cell', { name: /Inició sesión Carla Muñoz \(equipo\)/ })).toBeVisible();
  await page.getByRole('button', { name: 'Verificar integridad' }).click();
  await expect(page.getByText(/Integridad verificada: los \d+ registros/)).toBeVisible();
  const nombre = await descargar(page, () => page.getByRole('button', { name: 'Descargar PDF' }).click());
  expect(nombre).toBe('bitacora_B-000001.pdf');

  const codigo = consultar('from core.models import ExportacionBitacora; print(ExportacionBitacora.objects.get().codigo)');
  await page.goto(`/verificar/${codigo}`);
  await expect(page.getByText('Documento auténtico')).toBeVisible();
  await expect(page.getByText('Bitácora de acciones · folio B-000001', { exact: false })).toBeVisible();
});
