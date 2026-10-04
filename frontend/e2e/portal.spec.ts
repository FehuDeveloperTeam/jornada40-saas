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
  for (const [enlace, titulo] of [['Sueldos', 'Liquidaciones'], ['Docs', 'Documentos'], ['Certificados', 'Certificados'],
    ['Vacaciones', 'Vacaciones'], ['Pedir', 'Solicitudes']]) {
    await barra.getByRole('link', { name: enlace }).click();
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
    await sinDesborde();
  }
  // Seguridad no cabe en la barra: va en el encabezado.
  await page.getByRole('banner').getByRole('link', { name: 'Seguridad' }).click();
  await expect(page.getByRole('heading', { name: 'Seguridad', level: 1 })).toBeVisible();
  await sinDesborde();
  // Conciliación familiar (se entra desde Inicio en el teléfono): los botones no empujan la pantalla.
  await page.goto('/trabajador/portal/conciliacion');
  await expect(page.getByRole('heading', { name: 'Conciliación familiar', level: 1 })).toBeVisible();
  await sinDesborde();
  await barra.getByRole('link', { name: 'Docs' }).click();
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
  // Lista cerrada: ni el contrato (ya está en firma) ni el finiquito (sigue trabajando), y sin texto libre.
  const documento = page.getByLabel('Documento');
  await expect(documento.locator('option', { hasText: 'Contrato de trabajo' })).toHaveCount(0);
  await expect(documento.locator('option', { hasText: 'Finiquito' })).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);

  // Liquidación: el segundo desplegable muestra solo meses cerrados sin emitir. Se piden dos.
  const pedidos: string[] = [];
  for (let i = 0; i < 2; i++) {
    await documento.selectOption('LIQUIDACION');
    const meses = page.getByLabel('Mes y año');
    await expect(meses.locator('option', { hasText: periodo(-1) })).toHaveCount(0);   // ya emitida
    pedidos.push((await meses.locator('option').nth(1).textContent())!.trim());
    await meses.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Enviar solicitud' }).click();
    await expect(page.getByText('Solicitud enviada. Tu empleador la verá en su panel.')).toBeVisible();
  }
  const lista = page.getByRole('list', { name: 'Tus solicitudes' });
  for (const p of pedidos) await expect(lista.getByText(`Liquidación de sueldo · ${p}`)).toBeVisible();

  // El empleador las ve por atender: descarta una eligiendo el motivo y envía la otra a firma una vez emitida.
  await page.context().clearCookies();
  await entrar(page);
  await page.goto('/app/solicitudes');
  const panel = page.getByRole('region', { name: 'Solicitudes' });
  await expect(panel.getByRole('link', { name: 'Emitir liquidación' })).toHaveCount(2);
  await panel.getByRole('button', { name: 'Descartar' }).last().click();   // la más antigua va al final
  const modal = page.getByRole('dialog', { name: 'Descartar solicitud' });
  await modal.getByLabel('Motivo (lo verá el trabajador)').selectOption({ label: 'Ese mes no hubo remuneración que liquidar.' });
  await modal.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.getByText(/Solicitud descartada/)).toBeVisible();

  const [mesTexto, anio] = pedidos[1].split(' ');
  const mes = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    .indexOf(mesTexto.toLowerCase()) + 1;
  consultar(`from core.models import Liquidacion; Liquidacion.objects.create(empleado_id=${MATIAS.id}, mes=${mes}, anio=${anio}, `
    + "total_haberes=900000, sueldo_liquido=700000); print('ok')");
  await page.reload();
  await panel.getByRole('button', { name: 'Enviar a firma' }).click();
  await expect(page.getByText(/Documento enviado a firma/)).toBeVisible();
  await expect(page.getByText('No hay solicitudes por atender.')).toBeVisible();

  // De vuelta en el portal, el trabajador ve el resultado y el motivo.
  await page.context().clearCookies();
  await entrarConClave(page);
  await page.goto('/trabajador/portal/solicitudes');
  await expect(lista.getByText('Respuesta de tu empleador: Ese mes no hubo remuneración que liquidar.')).toBeVisible();
  await expect(lista.getByText(/Enviada a tu firma/)).toBeVisible();
});

test('el trabajador genera un certificado y un tercero lo verifica', async ({ page }) => {
  await entrarConClave(page);
  await page.getByRole('navigation', { name: 'Portal' }).getByRole('link', { name: 'Certificados' }).click();
  await expect(page.getByRole('heading', { name: 'Certificados', level: 1 })).toBeVisible();
  // Renta necesita liquidaciones firmadas consecutivas: aún no alcanza y se explica por qué.
  await expect(page.getByRole('list', { name: 'Certificados no disponibles' }).getByText(/Certificado de renta/)).toBeVisible();

  await page.getByLabel('Certificado', { exact: true }).selectOption('ANTIGUEDAD');
  const nombre = await descargar(page, () => page.getByRole('button', { name: 'Generar certificado' }).click());
  expect(nombre).toMatch(/^C-\d{7}\.pdf$/);
  const emitidos = page.getByRole('list', { name: 'Certificados emitidos' });
  await expect(emitidos.getByText('Certificado de antigüedad laboral')).toBeVisible();
  const codigo = (await emitidos.locator('.j40-mono').first().textContent())!.trim();
  expect(codigo).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

  // Verificación pública, sin sesión: con el código correcto y con uno inventado.
  await page.context().clearCookies();
  await page.goto('/verificar');
  await page.getByLabel('Código de verificación').fill(codigo.toLowerCase());
  await page.getByRole('button', { name: 'Verificar' }).click();
  const resultado = page.getByRole('region', { name: 'Resultado de la verificación' });
  await expect(resultado.getByText('Certificado auténtico')).toBeVisible();
  await expect(resultado.getByText(/RUT ••\.•••\.112-K/)).toBeVisible();
  await page.goto('/verificar/ZZZZ-ZZZZ-ZZZZ');
  await expect(page.getByText('No encontramos un documento con ese código')).toBeVisible();

  // El empleador lo ve en la carpeta del trabajador.
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=documentos`);
  await expect(page.getByText('Certificados emitidos por el trabajador')).toBeVisible();
  await expect(page.getByText(codigo)).toBeVisible();

  // Lo anula (p. ej. tenía un dato erróneo): la verificación pública pasa a decir que no es válido.
  await page.getByRole('button', { name: /^Anular Certificado de antigüedad laboral/ }).click();
  const modal = page.getByRole('dialog', { name: 'Anular certificado' });
  await modal.getByLabel('Motivo').selectOption('DATO_ERRONEO');
  await modal.getByRole('button', { name: 'Anular' }).click();
  await expect(page.getByText(/Anulado el .*: contenía un dato erróneo/)).toBeVisible();
  await page.goto(`/verificar/${codigo}`);
  await expect(page.getByText('Certificado anulado: no es válido')).toBeVisible();
});

test('el empleador ve en la carpeta que el trabajador usa su portal y le reenvía las instrucciones', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}`);
  const bloque = page.locator('section', { has: page.getByRole('heading', { name: 'Portal del trabajador' }) });
  await expect(bloque.getByText('Ya usa su portal')).toBeVisible();
  await expect(bloque.getByText(/Último ingreso/)).toBeVisible();
  await bloque.getByRole('button', { name: 'Reenviar instrucciones' }).click();
  await expect(page.getByText(/Invitación enviada a/)).toBeVisible();
  await expect(bloque.getByRole('button', { name: 'Reenviar instrucciones' })).toBeDisabled();
});

/** Un lunes a `semanas` semanas de hoy (aaaa-mm-dd, hora de Chile). */
function lunes(semanas: number): string {
  const d = new Date(Date.now() + semanas * 7 * 86_400_000);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
}

test('el trabajador pide vacaciones y teletrabajo; el empleador responde', async ({ page }) => {
  await entrarConClave(page);
  await page.goto('/trabajador/portal/vacaciones');
  await page.getByRole('button', { name: 'Pedir vacaciones' }).click();
  const pedir = page.getByRole('dialog', { name: 'Pedir vacaciones' });
  await pedir.getByLabel('Desde').fill(lunes(5));
  await pedir.getByLabel('Hasta').fill(lunes(5));
  // El cálculo lo hace el backend (un feriado puede dejarlo en 0): basta con que lo muestre.
  await expect(pedir.getByText(/\d+ días?\s+hábiles/)).toBeVisible();
  await pedir.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByText(/tu empleador recibió tu solicitud/)).toBeVisible();
  await expect(page.getByText('Esperando respuesta')).toBeVisible();

  await page.goto('/trabajador/portal/conciliacion');
  await page.getByRole('button', { name: 'Pedir teletrabajo' }).click();
  const tele = page.getByRole('dialog', { name: 'Teletrabajo o trabajo a distancia' });
  await tele.getByLabel('¿A quién cuidas?').selectOption('MENOR_14');
  await tele.getByRole('button', { name: 'Enviar solicitud' }).click();
  await expect(page.getByText(/debe responderte a más tardar el/)).toBeVisible();

  // El empleador ve ambas en Solicitudes: aprueba las vacaciones y la conciliación se responde en la ficha.
  await entrar(page);
  await page.goto('/app/solicitudes');
  const bloque = page.getByRole('region', { name: 'Vacaciones, permisos y conciliación' });
  await expect(bloque.getByText('Feriado legal (vacaciones)')).toBeVisible();
  await expect(bloque.getByText('Teletrabajo o trabajo a distancia (Ley 21.645)')).toBeVisible();
  await bloque.getByRole('button', { name: 'Aprobar' }).click();
  await expect(page.getByText(/Aprobada\. El trabajador recibió la respuesta/)).toBeVisible();
  await bloque.getByRole('link', { name: 'Responder en su ficha' }).click();
  await expect(page.getByRole('heading', { name: /Solicitudes por responsabilidades de cuidado/ })).toBeVisible();

  // Su sesión del portal sigue abierta en este navegador: ve la respuesta.
  await page.goto('/trabajador/portal/vacaciones');
  await expect(page.getByText('Aprobada', { exact: true })).toBeVisible();
});
