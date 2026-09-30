import { expect, test } from '@playwright/test';
import { MATIAS, USUARIO, consultar, descargar, entrar, restaurarBase } from './utiles';

// Pactos, autorizaciones y constancias: se crean desde listas cerradas, el
// backend redacta y valida, y se envían a firma desde el historial.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

test('pacto de horas extra y permiso legal desde la carpeta', async ({ page }) => {
  consultar("from core.models import Empresa; Empresa.objects.update(firma_imagen='data:image/png;base64,iVBORw0KGgo='); print('ok')");
  // Sin confirmar la clave: al enviar a firma se pide, y luego el envío sigue solo.
  await entrar(page, undefined, { confirmarIdentidad: false });
  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=documentos`);
  await page.getByRole('link', { name: /Pacto de horas extra/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Pactos y constancias' });
  await expect(drawer.getByLabel('Documento')).toHaveValue('HORAS_EXTRA');
  // Sin completar, el backend explica qué falta.
  await drawer.getByRole('button', { name: 'Crear documento' }).click();
  await expect(drawer.getByText('Indica la duración en meses.')).toBeVisible();
  await drawer.getByLabel('Duración').selectOption('3');
  await drawer.getByLabel('Máximo de horas extra por día').selectOption('2');
  await drawer.getByLabel('Necesidad temporal que lo justifica').selectOption('INVENTARIO');
  // Ley 40 horas: las horas extra pueden cambiarse por días libres (plan Pyme).
  const compensacion = drawer.getByLabel('¿Cómo se compensan las horas extra?');
  await expect(compensacion).toHaveValue('PAGO');
  await compensacion.selectOption('FERIADO');
  await drawer.getByRole('button', { name: 'Crear documento' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByText(/se cambian por días libres/).first()).toBeVisible();

  const fila = page.locator('div', { hasText: /^Pacto de horas extraordinarias/ }).filter({ has: page.getByRole('button', { name: 'Enviar a firma' }) }).last();
  await expect(fila).toBeVisible();
  expect(await descargar(page, () => fila.getByRole('button', { name: /Descargar Pacto de horas extraordinarias/ }).click()))
    .toMatch(/^Horas_Extra_.*\.pdf$/);
  await fila.getByRole('button', { name: 'Enviar a firma' }).click();
  const confirmar = page.getByRole('dialog', { name: 'Confirma tu identidad' });
  await confirmar.getByLabel('Tu clave de Jornada40').fill('clave-equivocada');
  await confirmar.getByRole('button', { name: 'Confirmar y firmar' }).click();
  await expect(confirmar.getByText('Clave incorrecta.')).toBeVisible();
  await confirmar.getByLabel('Tu clave de Jornada40').fill(USUARIO.clave);
  await confirmar.getByRole('button', { name: 'Confirmar y firmar' }).click();
  await expect(page.getByText('Documento enviado a firma. El trabajador recibirá un correo.')).toBeVisible();

  // Permiso por fallecimiento del padre: 4 días hábiles que calcula el sistema.
  await page.getByRole('link', { name: /Permiso legal con goce/ }).click();
  await drawer.getByLabel(/^Permiso/).selectOption('FALLECIMIENTO_PADRES');
  await expect(drawer.getByText('El permiso corre desde el día del fallecimiento (Art. 66).')).toBeVisible();
  await drawer.getByLabel('Fecha del fallecimiento').fill('2026-09-07');
  await drawer.getByRole('button', { name: 'Crear documento' }).click();
  await expect(page.getByText(/4 días hábiles, del 07-09-2026 al 10-09-2026/)).toBeVisible();
});

test('pacto de teletrabajo como anexo y pacto del Art. 164', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=documentos&accion=laboral&tipo=TELETRABAJO`);
  const drawer = page.getByRole('dialog', { name: 'Pactos y constancias' });
  await drawer.getByLabel('Modalidad').selectOption('PARCIAL');
  await drawer.getByText('Martes', { exact: true }).click();
  await drawer.getByLabel('Lugar de trabajo a distancia').selectOption('DOMICILIO');
  await drawer.getByLabel('Duración').selectOption('INDEFINIDA');
  await drawer.getByLabel('Desconexión (12 horas continuas)').selectOption('20:00');
  await drawer.getByText('Computador', { exact: true }).click();
  await drawer.getByRole('button', { name: 'Crear documento' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByText('Anexo · Pacto de trabajo a distancia o teletrabajo')).toBeVisible();

  // Indemnización a todo evento (Matías lleva más de 6 años): aporte de una lista cerrada.
  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=documentos&accion=laboral&tipo=INDEMNIZACION`);
  await drawer.getByLabel(/^Aporte mensual del empleador/).selectOption('4.11');
  await drawer.getByRole('button', { name: 'Crear documento' }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByText(/Aporte de 4,11 % desde/)).toBeVisible();
});
