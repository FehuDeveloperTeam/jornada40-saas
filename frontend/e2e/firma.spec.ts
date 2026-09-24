import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MATIAS, consultar, descargar, dibujarFirma, entrar, periodo, restaurarBase, ultimoCodigoOtp } from './utiles';

// Firma electrónica: panel del empleador y página pública del trabajador.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

const tokenPendiente = (tipo: string) => consultar(
  `from core.models import SolicitudFirma as S; print(S.objects.filter(tipo_documento='${tipo}', estado='PENDIENTE').latest('enviado_en').token)`);

async function pedirCodigo(page: Page, token: string) {
  await page.goto(`/firma/${token}`);
  await page.getByLabel('Tu RUT').fill(MATIAS.rut);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect(page.getByRole('heading', { name: 'Ingresa el código' })).toBeVisible();
}

test('firma del empleador y envío a firma', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/firmas');
  await expect(page.getByText('Falta la firma del empleador.')).toBeVisible();
  await page.getByRole('button', { name: 'Configurar ahora' }).click();
  await dibujarFirma(page, page.getByRole('dialog').locator('canvas'));
  await page.getByRole('button', { name: 'Guardar firma' }).click();
  await expect(page.getByText('Falta la firma del empleador.')).toHaveCount(0);

  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=documentos`);
  const fila = page.locator('div', { hasText: new RegExp(`^Liquidación de sueldo · ${periodo(-2)}`) })
    .filter({ has: page.getByRole('button', { name: 'Enviar a firma' }) }).last();
  await fila.getByRole('button', { name: 'Enviar a firma' }).click();
  await expect(page.getByText(/enviado a firma/i)).toBeVisible();

  // La amonestación rechazada se envía de nuevo desde el panel.
  await page.goto('/app/firmas');
  await page.getByRole('button', { name: /Rechazadas/ }).click();
  await page.getByRole('button', { name: 'Enviar de nuevo' }).first().click();
  await expect(page.getByText('Documento enviado a firma de nuevo')).toBeVisible();
});

test('el trabajador firma desde el teléfono', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const token = tokenPendiente('LIQUIDACION');
  await page.goto(`/firma/${token}`);
  await expect(page.getByRole('heading', { name: 'Confirma tu identidad' })).toBeVisible();
  // 16 px: iOS no hace zoom al enfocar.
  expect(await page.getByLabel('Tu RUT').evaluate((e) => getComputedStyle(e).fontSize)).toBe('16px');
  await page.getByLabel('Tu RUT').fill('12.345.678-5');
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect(page.getByText(/RUT no coincide/)).toBeVisible();

  await pedirCodigo(page, token);
  await page.getByLabel('Código de 6 dígitos').fill('000000');
  await expect(page.getByText(/Código incorrecto/)).toBeVisible();
  await page.getByLabel('Código de 6 dígitos').fill(ultimoCodigoOtp(token));

  await expect(page.getByRole('heading', { name: 'Revisa el documento' })).toBeVisible();
  await expect(page.locator('canvas[aria-label^="Página 1"]')).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Documento a firmar').evaluate((e) => { e.scrollTop = e.scrollHeight; e.dispatchEvent(new Event('scroll')); });
  const casilla = page.getByRole('checkbox');
  await expect(casilla).toBeEnabled();
  await casilla.check();
  await page.getByRole('button', { name: 'Continuar a la firma' }).click();

  await dibujarFirma(page, page.locator('canvas').first());
  await page.getByRole('button', { name: 'Firmar documento' }).click();
  await expect(page.getByRole('heading', { name: 'Documento firmado' })).toBeVisible({ timeout: 30_000 });
  const folio = (await page.getByText(/^J40-\d{4}-\d{6}$/).textContent())!;
  await expect(page.getByText(/^[0-9a-f]{64}$/)).toBeVisible();
  expect(await descargar(page, () => page.getByRole('button', { name: 'Descargar PDF firmado' }).click())).toMatch(/_firmado\.pdf$/);

  // Volver a abrir el enlace muestra el comprobante.
  await page.reload();
  await expect(page.getByText(folio)).toBeVisible();
});

test('el trabajador rechaza con motivo', async ({ page }) => {
  const token = tokenPendiente('AMONESTACION');
  await pedirCodigo(page, token);
  await page.getByLabel('Código de 6 dígitos').fill(ultimoCodigoOtp(token));
  await expect(page.getByRole('heading', { name: 'Revisa el documento' })).toBeVisible();
  await page.getByRole('button', { name: /rechazar/ }).click();
  await page.getByText('Otro motivo').click();
  await page.getByPlaceholder(/Cuéntale/).fill('La fecha de los hechos está mal');
  await page.getByRole('dialog').getByRole('button', { name: 'Rechazar' }).click();
  await expect(page.getByRole('heading', { name: 'Documento rechazado' })).toBeVisible();
});

test('el panel refleja firmas y rechazos', async ({ page, context }) => {
  await entrar(page);
  await page.goto('/app/firmas');
  await page.getByRole('button', { name: /Firmadas/ }).click();
  await expect(page.getByText(/J40-\d{4}-\d{6}/).first()).toBeVisible();
  const [ventana] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'PDF firmado' }).first().click()]);
  expect(ventana).toBeTruthy();
  await page.getByText('Detalle de verificación').first().click();
  await expect(page.getByText('Token').first()).toBeVisible();

  await page.getByRole('button', { name: /Rechazadas/ }).click();
  await expect(page.getByText('Motivo: La fecha de los hechos está mal')).toBeVisible();
  await page.getByRole('button', { name: /Pendientes/ }).click();
  await page.getByRole('button', { name: 'Cancelar' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar solicitud' }).click();
  await expect(page.getByText('Solicitud cancelada')).toBeVisible();
});
