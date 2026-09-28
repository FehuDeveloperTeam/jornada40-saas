import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MATIAS, consultar, descargar, entrar, periodo, restaurarBase, ultimoCodigoPortal } from './utiles';

// Portal del trabajador: ingreso con código y con clave, invitación a crear
// la clave, liquidaciones y salida. El backend permite un código por minuto
// por RUT: solo la primera prueba pide uno; las demás entran con la clave.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

const CLAVE = 'Portal-Matias-2026';

async function entrarConClave(page: Page) {
  await page.goto('/trabajador');
  await page.getByLabel('Tu RUT').fill(MATIAS.rut);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Ingresa tu clave' })).toBeVisible();
  await page.getByLabel('Clave', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/trabajador\/portal$/);
}

test('el trabajador entra con código, crea su clave y vuelve a entrar con ella', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Soy trabajador', exact: true }).click();
  await expect(page).toHaveURL(/\/trabajador$/);

  // Primera vez: sin clave, el código llega al correo registrado por el empleador.
  await page.getByLabel('Tu RUT').fill(MATIAS.rut);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Ingresa el código' })).toBeVisible();
  await expect(page.getByText('ma***@example.com')).toBeVisible();
  await expect(page.getByText(/Reenviar en \d+ s/)).toBeVisible();
  await expect.poll(() => ultimoCodigoPortal(MATIAS.correo)).toMatch(/^\d{6}$/);
  await page.getByLabel('Código de 6 dígitos').fill(ultimoCodigoPortal(MATIAS.correo));

  // Invitación a crear la clave: se omite y queda el aviso.
  await expect(page).toHaveURL(/\/trabajador\/portal$/);
  const invitacion = page.getByRole('dialog', { name: 'Crea tu clave de acceso' });
  await expect(invitacion).toBeVisible();
  await invitacion.getByRole('button', { name: 'Omitir' }).click();
  await expect(invitacion).toHaveCount(0);
  await expect(page.getByText('Puedes crear tu clave cuando quieras desde Seguridad, en el menú.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hola, Matías' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Firmar' })).toBeVisible();   // contrato pendiente de firma
  // Las liquidaciones de meses cerrados sin firmar esperan en Inicio (cinco de seis; la última está firmada).
  await expect(page.getByRole('button', { name: 'Firmar' })).toHaveCount(5);

  // Liquidaciones: solo la firmada, que es la que se descarga.
  await page.getByRole('navigation', { name: 'Portal' }).getByRole('link', { name: 'Liquidaciones' }).click();
  await expect(page.getByRole('heading', { name: 'Liquidaciones', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Descargar liquidación de / })).toHaveCount(1);
  const nombre = await descargar(page, () => page.getByRole('button', { name: `Descargar liquidación de ${periodo(-1)}` }).click());
  expect(nombre).toMatch(/\.pdf$/);

  // Seguridad: crea la clave (entró con código, no se pide la actual).
  await page.getByRole('navigation', { name: 'Portal' }).getByRole('link', { name: 'Seguridad' }).click();
  await expect(page.getByLabel('Clave actual')).toHaveCount(0);
  await page.getByLabel('Clave', { exact: true }).fill(CLAVE);
  await page.getByLabel('Repite la clave').fill(CLAVE);
  await page.getByRole('button', { name: 'Crear clave' }).click();
  await expect(page.getByText(/Tu clave quedó creada/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cambiar clave' })).toBeVisible();

  // Salir y volver: ahora pide la clave; "Cambiar RUT" vuelve al primer paso.
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/trabajador$/);
  await page.getByLabel('Tu RUT').fill(MATIAS.rut);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Ingresa tu clave' })).toBeVisible();
  await expect(page.getByText(MATIAS.rut)).toBeVisible();
  await page.getByRole('button', { name: 'Cambiar RUT' }).click();
  await expect(page.getByRole('heading', { name: 'Portal del trabajador' })).toBeVisible();

  await page.getByLabel('Tu RUT').fill(MATIAS.rut);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('Clave', { exact: true }).fill('Otra-clave-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByText('RUT o clave incorrectos.')).toBeVisible();
  await page.getByLabel('Clave', { exact: true }).fill(CLAVE);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/trabajador\/portal$/);
  await expect(page.getByRole('heading', { name: 'Hola, Matías' })).toBeVisible();
  // La invitación ya no aparece: tiene clave.
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('en el teléfono no hay desborde horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const sinDesborde = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Soy trabajador', exact: true })).toBeVisible();
  await sinDesborde();

  await entrarConClave(page);
  await sinDesborde();
  const barra = page.getByRole('navigation', { name: 'Portal' });
  for (const [enlace, titulo] of [['Sueldos', 'Liquidaciones'], ['Documentos', 'Documentos'], ['Vacaciones', 'Vacaciones'], ['Pedir', 'Solicitudes'], ['Seguridad', 'Seguridad']]) {
    await barra.getByRole('link', { name: enlace }).click();
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
    await sinDesborde();
  }
  await barra.getByRole('link', { name: 'Documentos' }).click();
  await expect(page.getByRole('list', { name: 'Documentos' }).getByText('Contrato de trabajo')).toBeVisible();
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page).toHaveURL(/\/trabajador$/);

  // Sin sesión, el portal devuelve al ingreso.
  await page.goto('/trabajador/portal/liquidaciones');
  await expect(page).toHaveURL(/\/trabajador$/);
});

test('una liquidación de un mes cerrado se firma desde Inicio', async ({ page }) => {
  await entrarConClave(page);
  // Sin la firma del empleador configurada, se explica y no avanza.
  await page.getByRole('button', { name: 'Firmar' }).first().click();
  await expect(page.getByText(/aún no habilita la firma electrónica/)).toBeVisible();
  consultar("from core.models import Empresa; Empresa.objects.filter(nombre_legal='COMERCIAL LOS ANDES SPA')"
    + ".update(firma_imagen='data:image/png;base64,iVBORw0KGgo='); print('ok')");
  await page.getByRole('button', { name: 'Firmar' }).first().click();
  await expect(page).toHaveURL(/\/firma\/[0-9a-f-]+\?desde=portal$/);
  await expect(page.getByText(/Liquidación de Sueldo/i).first()).toBeVisible();
  // De vuelta en Inicio, esa liquidación ya figura como solicitud con su enlace.
  await page.goto('/trabajador/portal');
  await expect(page.getByRole('button', { name: 'Firmar' })).toHaveCount(4);
  await expect(page.getByRole('link', { name: 'Firmar' })).toHaveCount(2);
});

test('el trabajador pide documentos y el empleador los atiende', async ({ page }) => {
  await entrarConClave(page);
  await page.getByRole('navigation', { name: 'Portal' }).getByRole('link', { name: 'Solicitudes' }).click();
  await expect(page.getByRole('heading', { name: 'Solicitudes', level: 1 })).toBeVisible();
  // Finiquito no se ofrece: sigue trabajando.
  await expect(page.getByLabel('Documento').locator('option', { hasText: 'Finiquito' })).toHaveCount(0);

  // Liquidación: el segundo desplegable muestra solo meses cerrados sin emitir.
  await page.getByLabel('Documento').selectOption('LIQUIDACION');
  const meses = page.getByLabel('Mes y año');
  await expect(meses.locator('option', { hasText: periodo(-1) })).toHaveCount(0);   // ya emitida
  const texto = (await meses.locator('option').nth(1).textContent())!.trim();
  await meses.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByText('Solicitud enviada. Tu empleador la verá en su panel.')).toBeVisible();
  const lista = page.getByRole('list', { name: 'Tus solicitudes' });
  await expect(lista.getByText(`Liquidación de sueldo · ${texto}`)).toBeVisible();

  await page.getByLabel('Documento').selectOption('OTRO');
  await page.getByLabel('¿Qué documento necesitas?').fill('Certificado de antigüedad');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(lista.getByText('Certificado de antigüedad')).toBeVisible();

  // El empleador las ve por atender: descarta la liquidación con motivo y resuelve la otra.
  await page.context().clearCookies();
  await entrar(page);
  await page.goto('/app/solicitudes');
  const panel = page.getByRole('region', { name: 'Solicitudes' });
  await expect(panel.getByText(`Liquidación de sueldo · ${texto}`)).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Emitir liquidación' })).toBeVisible();
  await panel.getByRole('button', { name: 'Descartar' }).last().click();   // la más reciente va primero
  const modal = page.getByRole('dialog', { name: 'Descartar solicitud' });
  await modal.getByRole('textbox').fill('Ese mes estabas con licencia completa');
  await modal.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByText(/Solicitud descartada/)).toBeVisible();
  await panel.getByRole('button', { name: 'Marcar resuelta' }).click();
  await expect(page.getByText('No hay solicitudes por atender.')).toBeVisible();

  // De vuelta en el portal, el trabajador ve el resultado y el motivo.
  await page.context().clearCookies();
  await entrarConClave(page);
  await page.goto('/trabajador/portal/solicitudes');
  await expect(lista.getByText('Respuesta de tu empleador: Ese mes estabas con licencia completa')).toBeVisible();
  await expect(lista.getByText('Resuelta')).toBeVisible();
});
