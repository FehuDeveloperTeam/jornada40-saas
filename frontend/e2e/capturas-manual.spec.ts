import fs, { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as XLSX from 'xlsx';
import { MATIAS, consultar, dibujarFirma, entrar, restaurarBase, ultimoCodigoOtp, ultimoCodigoPortal } from './utiles';

XLSX.set_fs(fs);

/**
 * Capturas de pantalla del manual de usuario (docs/manual/), con los datos de la base
 * semilla: Comercial Los Andes SpA y sus trabajadores ficticios. No es una prueba:
 * solo corre con CAPTURAS_MANUAL=1 y deja las imágenes en docs/manual/figuras/.
 *
 *   CAPTURAS_MANUAL=1 npx playwright test capturas-manual
 */
const FIGURAS = path.resolve(import.meta.dirname, '../../docs/manual/figuras');
const PEDRO = 3;   // contrato sin firmar y sin liquidación del mes: sirve para el editor, la liquidación y el finiquito
const CUENTA_NUEVA = { nombres: 'Daniela', apellido: 'Fuentes', rut: '11.111.111-1', correo: 'daniela@example.com', clave: 'Clave-Segura-2026' };

test.skip(!process.env.CAPTURAS_MANUAL, 'Solo para el manual de usuario (CAPTURAS_MANUAL=1).');
// En orden y con un solo navegador (playwright.config), pero sin cortar: si una captura falla, siguen las demás.
test.use({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2 });
test.beforeAll(() => {
  restaurarBase();
  mkdirSync(FIGURAS, { recursive: true });
  // Una cuenta en regla: con la firma del empleador configurada se puede enviar a firma.
  consultar('from django.utils import timezone; from core.models import Empresa;'
    + ' e = Empresa.objects.get(nombre_legal="COMERCIAL LOS ANDES SPA");'
    + ' e.firma_imagen = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";'
    + ' e.firma_firmante_nombre = "ANDREA ROJAS"; e.firma_firmante_cargo = "REPRESENTANTE LEGAL"; e.firma_configurada_en = timezone.now();'
    + ' e.save(); print("ok")');
});

/**
 * Espera datos y transiciones terminadas, y guarda la pantalla visible. `ocultarPrecios`
 * tapa los montos que empiezan con "$": el manual no muestra precios, que cambian.
 */
async function capturar(page: Page, nombre: string, { ocultarPrecios = false } = {}) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.getAnimations()
    .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  await page.screenshot({
    path: path.join(FIGURAS, `${nombre}.png`),
    ...(ocultarPrecios ? { mask: [page.getByRole('main').getByText(/^\$\s?[\d.]+/)], maskColor: '#E3E9F1' } : {}),
  });
}

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
}

/** Paso 1 del registro con una persona ficticia. */
async function datosDeLaCuenta(page: Page) {
  await page.getByLabel('Nombres').fill(CUENTA_NUEVA.nombres);
  await page.getByLabel('Apellido paterno').fill(CUENTA_NUEVA.apellido);
  await page.getByLabel('Tu RUT (titular de la cuenta)').fill(CUENTA_NUEVA.rut);
  await page.getByLabel('Correo electrónico').fill(CUENTA_NUEVA.correo);
  await page.getByLabel('Contraseña', { exact: true }).fill(CUENTA_NUEVA.clave);
}

test('sitio: ingreso, registro y bienvenida', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await capturar(page, '02-login');

  // El paso 1: el del plan muestra precios, que el manual no incluye.
  await page.goto('/register');
  await datosDeLaCuenta(page);
  await capturar(page, '02-registro');

  const codigo = consultar('from core.pruebas import generar; from core.models import Plan;'
    + ' print(generar(Plan.objects.get(nombre="Pyme"), nota="Capturas del manual")[0][1])');
  await page.goto(`/register?codigo=${encodeURIComponent(codigo)}`);
  await expect(page.getByText(/gratis por 3 meses/).first()).toBeVisible();
  await datosDeLaCuenta(page);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Tu plan de prueba' })).toBeVisible();
  await capturar(page, '02-codigo-prueba');

  // Una cuenta nueva, sin empresas, entra a la bienvenida.
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Datos de la empresa' })).toBeVisible({ timeout: 20_000 });
  await capturar(page, '02-bienvenida');
});

test('panel: cuenta, empresa e inicio', async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page);
  await capturar(page, '03-inicio');

  await page.keyboard.press('Control+k');
  const buscador = page.getByRole('dialog', { name: 'Buscar o ejecutar' });
  await buscador.getByRole('combobox').or(buscador.getByLabel('Buscar')).first().fill('mat');
  await expect(buscador.getByText(/Matías/i).first()).toBeVisible();
  await capturar(page, '03-buscador');
  await page.keyboard.press('Escape');

  await abrir(page, '/app/empresa');
  await capturar(page, '02-empresa');

  await abrir(page, '/app/cuenta');
  await capturar(page, '15-cuenta');

  await abrir(page, '/app/plan');
  await capturar(page, '16-plan', { ocultarPrecios: true });

  // Aviso de inactividad: la última actividad queda 4 minutos y 20 segundos atrás.
  await page.goto('/app');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem('j40-actividad-panel', String(Date.now() - 260_000)));
  await page.reload();
  await expect(page.getByRole('dialog', { name: '¿Sigues ahí?' })).toBeVisible({ timeout: 20_000 });
  await capturar(page, '02-inactividad');
  await page.getByRole('button', { name: 'Seguir trabajando' }).click();
});

test('panel: trabajadores y contratos', async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page);

  await abrir(page, '/app/trabajadores');
  await capturar(page, '04-trabajadores');

  await page.getByRole('button', { name: 'Agregar trabajador' }).first().click();
  const alta = page.getByRole('dialog', { name: 'Agregar trabajador' });
  await alta.getByLabel('RUT').fill('9.876.543-3');
  await alta.getByLabel('Nombres').fill('Rocío');
  await alta.getByLabel('Apellido paterno').fill('Valdés');
  await alta.getByLabel('Cargo').fill('Cajera');
  await alta.getByLabel('Sueldo base').fill('600000');
  await capturar(page, '04-agregar');
  await alta.getByRole('button', { name: 'Cancelar' }).click();

  const archivo = path.join(mkdtempSync(path.join(tmpdir(), 'j40-')), 'trabajadores.xlsx');
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet([
    { rut: '9.876.543-3', nombres: 'Rocío', apellido_paterno: 'Valdés', cargo: 'Cajera', fecha_ingreso: '01-06-2025', sueldo_base: 600000, horas_laborales: 42 },
    { rut: '8.765.432-K', nombres: 'Ignacia', apellido_paterno: 'Lagos', cargo: 'Guardia', fecha_ingreso: '15-01-2026', sueldo_base: 620000, horas_laborales: 45 },
    { rut: MATIAS.rut, cargo: 'Contador senior' },
    { rut: '11.111.111-2', nombres: 'Tomás', apellido_paterno: 'Mena' },
  ]), 'Trabajadores');
  XLSX.writeFile(libro, archivo);
  await abrir(page, '/app/trabajadores/importar');
  await page.locator('input[type=file]').setInputFiles(archivo);
  await expect(page.getByText('Filas leídas')).toBeVisible();
  await capturar(page, '04-importar');

  await abrir(page, `/app/trabajadores/${MATIAS.id}`);
  await capturar(page, '04-carpeta');

  await abrir(page, `/app/trabajadores/${PEDRO}/contrato`);
  await capturar(page, '05-editor-contrato');

  await page.goto(`/app/trabajadores/${MATIAS.id}?accion=anexo`);
  const anexo = page.getByRole('dialog', { name: 'Anexo de contrato' });
  await anexo.getByLabel('Título').fill('Aumento de sueldo');
  await capturar(page, '05-anexo');
});

test('panel: documentos, vacaciones y término', async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page);

  await abrir(page, `/app/trabajadores/${MATIAS.id}?tab=documentos`);
  await expect(page.getByText('Historial de documentos')).toBeVisible();
  await capturar(page, '06-documentos');

  await page.goto(`/app/trabajadores/${MATIAS.id}?accion=documento&tipo=DESPIDO`);
  const carta = page.getByRole('dialog', { name: 'Documento legal' });
  await carta.getByLabel('Causal de término').selectOption('161_1');
  await expect(carta.getByText('Sustitutiva del aviso previo')).toBeVisible({ timeout: 20_000 });
  await capturar(page, '06-carta-termino');

  await page.goto(`/app/trabajadores/${MATIAS.id}?accion=laboral&tipo=HORAS_EXTRA`);
  await expect(page.getByRole('dialog', { name: 'Pactos y constancias' }).getByText('Duración')).toBeVisible();
  await capturar(page, '06-pactos');

  await abrir(page, `/app/trabajadores/${MATIAS.id}?tab=vacaciones`);
  await expect(page.getByText('Registro de vacaciones y permisos')).toBeVisible();
  await capturar(page, '09-vacaciones');

  await abrir(page, `/app/trabajadores/${PEDRO}/finiquito`);
  await page.getByLabel('Causal de término').selectOption('161_1');
  await expect(page.getByText('Total a pagar')).toBeVisible({ timeout: 20_000 });
  await capturar(page, '10-finiquito');
});

test('panel: remuneraciones', async ({ page }) => {
  test.setTimeout(240_000);
  await entrar(page);

  await abrir(page, '/app/remuneraciones');
  await page.getByRole('button', { name: 'Período anterior' }).click();
  await expect(page.getByText('Liquidaciones del período')).toBeVisible();
  await capturar(page, '07-remuneraciones');

  await page.getByRole('button', { name: 'Libro electrónico DT' }).click();
  const lre = page.getByRole('dialog', { name: 'Libro de Remuneraciones Electrónico' });
  await expect(lre.getByText(/Revisando/)).toHaveCount(0, { timeout: 20_000 });
  await capturar(page, '07-lre');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Certificado N°6 (SII)' }).click();
  await expect(page.getByRole('dialog', { name: 'Certificado N°6 (SII)' }).getByText('Año comercial')).toBeVisible();
  await capturar(page, '07-certificado6');
  await page.keyboard.press('Escape');

  await page.goto(`/app/remuneraciones?trabajador=${PEDRO}`);
  await expect(page.getByText('Líquido a pagar')).toBeVisible({ timeout: 20_000 });
  await capturar(page, '07-liquidacion');

  await abrir(page, '/app/remuneraciones/conceptos');
  await capturar(page, '07-conceptos');

  await abrir(page, '/app/reportes');
  await page.getByText('Todo el año', { exact: true }).click();
  await expect(page.getByRole('img', { name: 'Costo empleador por mes' })).toBeVisible({ timeout: 20_000 });
  await capturar(page, '07-reportes');
});

test('panel: firma, DT, reglamento, solicitudes y equipo', async ({ page }) => {
  test.setTimeout(240_000);
  consultar('import datetime; from django.utils import timezone; from core.models import Empleado, VacacionEmpleado, SolicitudDocumento;'
    + ' hoy = timezone.localdate(); jav = Empleado.objects.get(nombres="JAVIERA");'
    + ' VacacionEmpleado.objects.create(empleado=jav, empresa=jav.empresa, tipo="VACACION_LEGAL", estado="PENDIENTE", origen="PORTAL",'
    + ' fecha_inicio=hoy + datetime.timedelta(days=21), fecha_fin=hoy + datetime.timedelta(days=25));'
    + ' m = hoy.replace(day=1) - datetime.timedelta(days=1);'
    + ' SolicitudDocumento.objects.create(empleado=Empleado.objects.get(nombres="CARLA ANDREA"), tipo="LIQUIDACION", mes=m.month, anio=m.year);'
    + ' print("ok")');
  await entrar(page);

  await abrir(page, '/app/firmas');
  await page.getByRole('button', { name: /^Todas/ }).click();
  await capturar(page, '08-firmas');

  await abrir(page, '/app/dt');
  await capturar(page, '11-registro-dt');
  await page.getByRole('button', { name: 'Ver ficha' }).first().click();
  await expect(page.getByRole('button', { name: 'Copiar' }).first()).toBeVisible({ timeout: 20_000 });
  await capturar(page, '11-ficha-dt');

  await abrir(page, '/app/reglamento');
  await capturar(page, '12-reglamento');

  await abrir(page, '/app/solicitudes');
  await capturar(page, '13-solicitudes');

  await abrir(page, '/app/equipo');
  await page.getByRole('button', { name: 'Invitar usuario' }).click();
  const invitar = page.getByRole('dialog', { name: 'Invitar usuario' });
  await invitar.getByLabel('RUT de la persona').fill('15.555.551-3');
  await invitar.getByLabel('Nombres').fill('Ricardo');
  await invitar.getByLabel('Apellidos').fill('Mella Díaz');
  await invitar.getByLabel('Correo', { exact: true }).fill('ricardo@example.com');
  await capturar(page, '14-equipo');
  await invitar.getByRole('button', { name: 'Cancelar' }).click();

  await abrir(page, '/app/equipo?tab=bitacora');
  await expect(page.getByRole('heading', { name: 'Registros' })).toBeVisible();
  await capturar(page, '14-bitacora');
});

test('firma del trabajador', async ({ page }) => {
  test.setTimeout(180_000);
  // Una liquidación de Matías enviada a firma desde el panel, como en la realidad: así queda su PDF.
  await entrar(page);
  const liquidacion = consultar('from core.models import Liquidacion, SolicitudFirma;'
    + ' firmadas = SolicitudFirma.objects.exclude(liquidacion=None).values_list("liquidacion_id", flat=True);'
    + ` print(Liquidacion.objects.filter(empleado_id=${MATIAS.id}).exclude(id__in=list(firmadas)).order_by("-anio", "-mes").first().id)`);
  const estado = await page.evaluate(async (id) => {
    const csrf = document.cookie.split('; ').find((x) => x.startsWith('csrftoken='))?.split('=')[1] ?? '';
    const r = await fetch('/api/firmas/solicitar/', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify({ empleado_id: 1, tipo_documento: 'LIQUIDACION', liquidacion_id: Number(id) }),
    });
    return `${r.status} ${await r.text()}`;
  }, liquidacion);
  expect(estado).toMatch(/^2\d\d /);
  const token = consultar('from core.models import SolicitudFirma;'
    + ' print(SolicitudFirma.objects.filter(estado="PENDIENTE", tipo_documento="LIQUIDACION").latest("id").token)');
  await page.context().clearCookies();
  await page.goto(`/firma/${token}`);
  await page.getByLabel('Tu RUT').fill(MATIAS.rut);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect.poll(() => ultimoCodigoOtp(token)).toMatch(/^\d{6}$/);
  await page.getByLabel('Código de 6 dígitos').fill(ultimoCodigoOtp(token));
  await expect(page.getByRole('heading', { name: 'Revisa el documento' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('canvas[aria-label^="Página 1"]')).toBeVisible({ timeout: 30_000 });
  await capturar(page, '08-firma-trabajador');
});

test('firma del empleador a distancia', async ({ page }) => {
  test.setTimeout(180_000);
  // Plan Corporativo: la segunda empresa (sin firma ni representante) se la pide a su representante.
  const plan = (nombre: string) => consultar('from core.models import Cliente, Plan;'
    + ` Cliente.objects.filter(rut="12.345.678-5").update(plan=Plan.objects.get(nombre="${nombre}")); print("ok")`);
  plan('Corporativo');
  try {
    await entrar(page);
    await abrir(page, '/app/firmas');
    const tarjeta = page.getByRole('region', { name: 'Firma del empleador' });
    await tarjeta.getByRole('button', { name: /^Ver tus/ }).click();
    await tarjeta.getByRole('button', { name: 'Pedir firma a distancia' }).last().click();
    const dialogo = page.getByRole('dialog', { name: 'Pedir la firma a distancia' });
    await dialogo.getByLabel('Nombre completo').fill('Rodrigo Fuentes Mella');
    await dialogo.getByLabel('RUT', { exact: true }).fill('15.555.551-3');
    await dialogo.getByLabel('Correo del representante').fill('rodrigo.fuentes@example.com');
    await capturar(page, '02-firma-distancia');
    await dialogo.getByRole('button', { name: 'Enviar pedido' }).click();
    await page.getByRole('dialog', { name: 'Pedido enviado' }).getByRole('button', { name: 'Listo' }).click();

    // El representante, en su teléfono.
    const token = consultar('from core.models import SolicitudFirmaEmpleador as S; print(S.objects.latest("id").token)');
    await page.context().clearCookies();
    await page.setViewportSize({ width: 400, height: 980 });
    await page.goto(`/firma-empleador/${token}`);
    await page.getByLabel('Tu RUT').fill('15.555.551-3');
    await page.getByRole('button', { name: 'Enviar código' }).click();
    await expect.poll(() => ultimoCodigoPortal(`firma-empleador:${token}`)).toMatch(/^\d{6}$/);
    await page.getByLabel('Código de 6 dígitos').fill(ultimoCodigoPortal(`firma-empleador:${token}`));
    await expect(page.getByRole('heading', { name: 'Lee y firma' })).toBeVisible();
    await page.getByRole('checkbox').check();
    await dibujarFirma(page, page.locator('canvas'));
    await page.getByRole('heading', { name: 'Lee y firma' }).scrollIntoViewIfNeeded();
    await capturar(page, '02-firma-representante');
  } finally {
    plan('Pyme');
  }
});
