import { expect, test } from '@playwright/test';
import { consultar, descargar, dibujarFirma, entrar, restaurarBase, revisarAccesibilidad, ultimoCodigoPortal } from './utiles';

// Firma del empleador a distancia (plan Corporativo): el panel se la pide por correo
// al representante legal, que la registra desde su teléfono con RUT, código y trazo.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => {
  restaurarBase();
  consultar('from core.models import Cliente, Plan;'
    + ' Cliente.objects.filter(rut="12.345.678-5").update(plan=Plan.objects.get(nombre="Corporativo")); print("ok")');
});

const REPRESENTANTE = { nombre: 'Rodrigo Fuentes Mella', rut: '15.555.551-3', correo: 'rodrigo.fuentes@example.com' };

test('el panel pide la firma y el representante la registra desde su teléfono', async ({ page, browser }) => {
  test.setTimeout(120_000);
  await entrar(page);
  await page.goto('/app/firmas');
  const tarjeta = page.getByRole('region', { name: 'Firma del empleador' });
  await expect(tarjeta.getByText('Falta la firma', { exact: true })).toBeVisible();
  await tarjeta.getByRole('button', { name: 'Pedir firma a distancia' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Pedir la firma a distancia' });
  await dialogo.getByLabel('Nombre completo').fill(REPRESENTANTE.nombre);
  await dialogo.getByLabel('RUT', { exact: true }).fill(REPRESENTANTE.rut);
  await dialogo.getByLabel('Correo del representante').fill(REPRESENTANTE.correo);
  await revisarAccesibilidad(page, 'pedir la firma del empleador a distancia');
  await dialogo.getByRole('button', { name: 'Enviar pedido' }).click();
  const enviado = page.getByRole('dialog', { name: 'Pedido enviado' });
  await expect(enviado.getByText(REPRESENTANTE.correo)).toBeVisible();
  // La empresa tiene otra representante registrada (la titular): se avisa, no se bloquea.
  await expect(enviado.getByText(/no es el del representante legal registrado/)).toBeVisible();
  await enviado.getByRole('button', { name: 'Listo' }).click();
  await expect(tarjeta.getByText('Pedido pendiente')).toBeVisible();
  await expect(tarjeta.getByRole('button', { name: 'Reenviar correo' })).toBeVisible();
  await revisarAccesibilidad(page, 'firma electrónica con un pedido pendiente');

  const token = consultar('from core.models import SolicitudFirmaEmpleador as S; print(S.objects.latest("id").token)');
  const codigo = () => ultimoCodigoPortal(`firma-empleador:${token}`);

  // El representante, en su teléfono y sin sesión del panel.
  const telefono = await browser.newContext({
    baseURL: test.info().project.use.baseURL, viewport: { width: 390, height: 844 }, locale: 'es-CL', timezoneId: 'America/Santiago',
  });
  const rep = await telefono.newPage();
  await rep.goto(`/firma-empleador/${token}`);
  await expect(rep.getByRole('heading', { name: 'Registra tu firma' })).toBeVisible();
  await revisarAccesibilidad(rep, 'firma del empleador a distancia: identidad');
  await rep.getByLabel('Tu RUT').fill('11.111.111-1');
  await rep.getByRole('button', { name: 'Enviar código' }).click();
  await expect(rep.getByText(/RUT no coincide/)).toBeVisible();
  await rep.getByLabel('Tu RUT').fill(REPRESENTANTE.rut);
  await rep.getByRole('button', { name: 'Enviar código' }).click();
  await expect(rep.getByRole('heading', { name: 'Ingresa el código' })).toBeVisible();
  await expect.poll(codigo).toMatch(/^\d{6}$/);
  await rep.getByLabel('Código de 6 dígitos').fill(codigo());

  await expect(rep.getByRole('heading', { name: 'Lee y firma' })).toBeVisible();
  await expect(rep.getByText(/declaro que soy representante legal de COMERCIAL LOS ANDES SPA/)).toBeVisible();
  await revisarAccesibilidad(rep, 'firma del empleador a distancia: declaración');
  await dibujarFirma(rep, rep.locator('canvas'));
  await expect(rep.getByRole('button', { name: 'Registrar mi firma' })).toBeDisabled();   // falta aceptar
  await rep.getByRole('checkbox').check();
  await rep.getByRole('button', { name: 'Registrar mi firma' }).click();
  await expect(rep.getByRole('heading', { name: 'Firma registrada' })).toBeVisible();
  expect(await descargar(rep, () => rep.getByRole('button', { name: 'Descargar constancia' }).click()))
    .toMatch(/^Constancia_firma_empleador_FE-\d{6}\.pdf$/);
  await revisarAccesibilidad(rep, 'firma del empleador a distancia: registrada');
  await telefono.close();

  // En el panel: firma registrada a distancia, con su constancia; ya se puede enviar a firma.
  await page.reload();
  await expect(tarjeta.getByText('Firma registrada', { exact: true })).toBeVisible();
  await expect(tarjeta.getByText(/Rodrigo Fuentes Mella \(Representante Legal\) · registrada a distancia/)).toBeVisible();
  expect(await descargar(page, () => tarjeta.getByRole('button', { name: 'Constancia' }).click())).toMatch(/\.pdf$/);
});
