import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { consultar, restaurarBase, revisarAccesibilidad } from './utiles';

// Código de prueba: la cuenta nace con el plan Pyme gratis por 3 meses (core/pruebas.py).
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

const RUT = '17.888.999-0';
const CLAVE = 'Clave-Segura-2026';
let codigo = '';

async function completarCuenta(page: Page, rut: string, correo: string) {
  await page.getByLabel('Nombres').fill('Rosa');
  await page.getByLabel('Apellido paterno').fill('Muñoz');
  await page.getByLabel('Tu RUT (titular de la cuenta)').fill(rut);
  await page.getByLabel('Correo electrónico').fill(correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Continuar' }).click();
}

test('crear la cuenta con el enlace del código', async ({ page }) => {
  codigo = consultar("from core import pruebas; from core.models import Plan; "
    + "print(pruebas.generar(Plan.objects.get(nombre='Pyme'), nota='Piloto e2e')[0][1])");
  await page.goto(`/register?codigo=${codigo}`);
  await expect(page.getByText('Plan Pyme gratis por 3 meses')).toBeVisible();
  await revisarAccesibilidad(page, 'registro con código de prueba');

  await completarCuenta(page, RUT, 'rosa@example.com');
  await expect(page.getByRole('heading', { name: 'Tu plan de prueba' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Acepto los términos/ }).check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  // Sin pasar por el pago: el plan quedó activo hasta el fin de la prueba.
  await expect(page).toHaveURL(/\/bienvenida/);
  await expect(page.getByText(/Cuenta creada · plan Pyme\s+gratis hasta el \d{2}-\d{2}-\d{4}/)).toBeVisible();
});

test('el código ya no sirve para otra cuenta', async ({ page }) => {
  await page.goto(`/register?codigo=${codigo}`);
  await expect(page.getByText(/no es válido, ya se usó o venció/).first()).toBeVisible();
  await completarCuenta(page, '16.444.333-7', 'otra@example.com');
  // Sin código, el paso 2 vuelve a ofrecer los planes y permite escribir otro.
  await expect(page.getByRole('heading', { name: 'Elige tu plan' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Código de prueba' }).fill(codigo.toLowerCase());
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('alert').filter({ hasText: /ya se usó/ })).toBeVisible();
});

test('el plan muestra la prueba y, al terminar, el plan gratuito', async ({ page }) => {
  consultar("from django.contrib.auth.models import User; from core.models import Empresa; "
    + `Empresa.objects.create(owner=User.objects.get(username='${RUT}'), nombre_legal='FERRETERÍA EL CLAVO SPA', rut='76.555.444-6')`);
  await page.goto('/login');
  await page.getByLabel('RUT del titular de la cuenta').fill(RUT);
  await page.getByLabel('Contraseña', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.goto('/app/plan');
  await expect(page.getByText(/Tienes el plan Pyme gratis hasta el/)).toBeVisible();
  await expect(page.getByText('Prueba gratis hasta')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Contratar Pyme' }).first()).toBeVisible();
  await revisarAccesibilidad(page, 'plan en prueba');

  // Venció ayer y el proceso diario aún no corre: ya rige el plan gratuito.
  consultar("import datetime; from django.utils import timezone; from core.models import Suscripcion; "
    + `Suscripcion.objects.filter(cliente__rut='${RUT}').update(prueba_hasta=timezone.localdate() - datetime.timedelta(days=1))`);
  await page.reload();
  await expect(page.getByText(/Tu prueba del plan Pyme terminó el/)).toBeVisible();
  await expect(page.getByText('Terminó tu prueba del plan Pyme')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar aviso' }).click();
  await expect(page.getByText('Terminó tu prueba del plan Pyme')).toBeHidden();
});
