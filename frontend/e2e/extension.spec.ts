import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { consultar, entrar, restaurarBase } from './utiles';

/**
 * Extensión "Jornada40 para Mi DT" cargada de verdad en Chromium, contra el
 * backend e2e y una copia local de Mi DT (las rutas de midt.dirtrab.cl las
 * responde la prueba: nunca se toca el sitio real). El mapeo de esa copia es
 * backend/e2e/mapeos_midt_e2e.json (MAPEOS_MIDT_ARCHIVO en settings_e2e).
 */
test.describe.configure({ mode: 'serial' });

const FRONTEND = path.resolve(import.meta.dirname, '..');
const EXTENSION = path.join(FRONTEND, 'extension', 'dist', 'desarrollo');
const RUTA_CONTRATO = '/empleador/registro-electronico-laboral/registroContratoTrabajo';
const MATIAS = 'MATÍAS IGNACIO SOTO MUÑOZ';

let contexto: BrowserContext;
let panel: Page;
let midt: Page;

/** Copia mínima del formulario de contrato de Mi DT (etapa 1), con lo que Mi DT hace por su cuenta. */
function paginaMiDT(rutEmpleador: string) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Mi DT</title></head><body>
    <header><span id="empleador">Empleador: ${rutEmpleador}</span></header>
    <main>
      <h2 class="card-title">Antecedentes del trabajador</h2>
      <label for="fechaSuscripcion">Fecha de suscripción (*)</label><input id="fechaSuscripcion" type="date">
      <div class="label-form" for="rut">RUT del trabajador (*)</div><input id="rut" name="rut">
      <label for="nombres">Nombres</label><input id="nombres" readonly>
      <label for="correoElectronico">Correo electrónico</label><input id="correoElectronico" name="correoElectronico">
      <label for="comuna">Comuna</label>
      <select id="comuna"><option value="">Seleccione</option><option value="13101">Santiago</option><option value="13123">Providencia</option></select>
      <p>¿La contratación implicó cambio de domicilio?</p>
      <label><input type="radio" name="cambioDomicilio" value="S"> Sí</label>
      <label><input type="radio" name="cambioDomicilio" value="N"> No</label>
      <button id="registrar" type="button">Registrar</button>
    </main>
    <script>
      // Como el Registro Civil: al escribir el RUT, Mi DT trae el nombre (aquí, otro a propósito).
      document.getElementById('rut').addEventListener('change', () => { document.getElementById('nombres').value = 'MARÍA JOSÉ GONZÁLEZ'; });
      document.getElementById('registrar').addEventListener('click', () => {
        document.querySelector('main').innerHTML = '<div class="alert">Contrato registrado exitosamente. N° de registro: 987654</div>';
      });
    </script>
  </body></html>`;
}

test.beforeAll(async () => {
  restaurarBase();
  // La versión "desarrollo" apunta a la API e2e (http://127.0.0.1:8000/api).
  execFileSync(process.execPath, [path.join(FRONTEND, 'extension', 'construir.mjs'), 'desarrollo'], { cwd: FRONTEND, stdio: 'ignore' });
  const rutEmpresa = consultar("from core.models import Empresa; print(Empresa.objects.get(nombre_legal='COMERCIAL LOS ANDES SPA').rut)");
  contexto = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  await contexto.route('https://midt.dirtrab.cl/**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: paginaMiDT(rutEmpresa) }));
  const trabajador = contexto.serviceWorkers()[0] ?? (await contexto.waitForEvent('serviceworker'));
  const id = new URL(trabajador.url()).host;
  // El panel lateral se abre como pestaña; Mi DT queda como la pestaña activa de la ventana.
  panel = contexto.pages()[0] ?? (await contexto.newPage());
  await panel.goto(`chrome-extension://${id}/panel/panel.html`);
  midt = await contexto.newPage();
  await midt.goto(`https://midt.dirtrab.cl${RUTA_CONTRATO}`);
});

test.afterAll(async () => {
  await contexto?.close();
});

test('conectar, llenar la etapa y marcar el contrato como registrado', async ({ page }) => {
  // El código de un solo uso sale de Jornada40 → Dirección del Trabajo.
  await entrar(page, undefined, { confirmarIdentidad: false });
  await page.goto('/app/dt');
  const tarjeta = page.getByRole('region', { name: 'Extensión para Mi DT' });
  await tarjeta.getByRole('button', { name: 'Conectar un navegador' }).click();
  const codigo = await page.getByRole('dialog').locator('p.j40-mono').innerText();
  expect(codigo).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  await panel.getByLabel('Código').fill(codigo.toLowerCase());
  await panel.getByLabel('Nombre de este computador').fill('Chrome de prueba');
  await panel.getByRole('button', { name: 'Conectar' }).click();
  // Reconoce la empresa por el RUT con que se entró a Mi DT.
  await expect(panel.getByText('Mi DT abierto con COMERCIAL LOS ANDES SPA.')).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Por registrar' })).toBeVisible();

  await panel.getByRole('button', { name: new RegExp(MATIAS) }).click();
  await expect(panel.getByText('Estás en:')).toContainText('Etapa 1 · Identificación de las partes');
  await expect(panel.getByText('Mi DT confirmó el registro')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Llenar esta etapa' }).click();
  await expect(panel.getByText(/Llenamos \d+ datos/)).toBeVisible();
  // Escrito en Mi DT como lo haría la persona; lo que Jornada40 no sabe queda en amarillo.
  await expect(midt.locator('#rut')).toHaveValue('11111112-K');
  await expect(midt.locator('#correoElectronico')).toHaveValue('matias@example.com');
  await expect(midt.locator('#comuna')).toHaveValue('13123');
  await expect(midt.locator('#fechaSuscripcion')).toHaveValue('2019-03-01');
  await expect(midt.locator('input[name="cambioDomicilio"]').first()).toHaveAttribute('data-jornada40', 'amarillo');
  await expect(panel.getByText(/¿La contratación implicó cambio de domicilio\?/).first()).toBeVisible();
  // El nombre que trajo "el Registro Civil" no es el de la ficha: avisa.
  await expect(panel.getByText('El dato de Mi DT no coincide con Jornada40')).toBeVisible();

  // La persona presiona el botón final en Mi DT; la extensión reconoce el comprobante.
  await midt.locator('#registrar').click();
  await expect(panel.getByText('Mi DT confirmó el registro')).toBeVisible();
  await expect(panel.getByLabel('N° de comprobante de Mi DT (si lo muestra)')).toHaveValue('987654');
  await panel.getByRole('button', { name: 'Marcar como registrado' }).click();
  await expect(panel.getByText('Listo: quedó marcado como registrado en Jornada40.')).toBeVisible();
  await expect(panel.getByRole('button', { name: new RegExp(MATIAS) })).toHaveCount(0);

  const registro = consultar(
    "import json; from core.models import RegistroDT; r = RegistroDT.objects.get(clave__startswith='CONTRATO:', comprobante='987654'); "
    + 'print(json.dumps([r.via, r.registrado_por.username == r.empresa.owner.username]))',
  );
  expect(JSON.parse(registro)).toEqual(['EXTENSION', true]);
});

test('levantamiento: guarda la estructura de la pantalla, nunca lo escrito', async () => {
  await midt.reload();
  await midt.locator('#rut').fill('12.345.678-5');
  await panel.getByRole('button', { name: 'Modo levantamiento' }).click();
  await panel.getByRole('button', { name: 'Registrar esta pantalla' }).click();
  await expect(panel.getByText('Campos:')).toBeVisible();
  await panel.getByRole('button', { name: 'Enviar a Jornada40' }).click();
  await expect(panel.getByText('Enviada a Jornada40')).toBeVisible();
  const guardado = consultar('import json; from core.models import LevantamientoMiDT; print(json.dumps(LevantamientoMiDT.objects.get().estructura))');
  expect(guardado).toContain('RUT del trabajador');
  expect(guardado).not.toContain('12.345.678-5');
  expect(guardado).not.toContain('12345678');
});

test('desconectar el navegador desde Jornada40 corta la extensión', async ({ page }) => {
  await entrar(page, undefined, { confirmarIdentidad: false });
  await page.goto('/app/dt');
  const conectados = page.getByRole('list', { name: 'Navegadores conectados' });
  await expect(conectados.getByText('Chrome de prueba')).toBeVisible();
  await conectados.getByRole('button', { name: 'Desconectar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Desconectar' }).click();
  await expect(page.getByText('Aún no hay navegadores conectados.')).toBeVisible();

  // En su próxima consulta a Jornada40, la extensión vuelve a pedir un código.
  await panel.getByRole('button', { name: 'Volver' }).click();
  await panel.getByRole('button', { name: /CARLA ANDREA PÉREZ LAGOS/ }).click();
  await expect(panel.getByText('La extensión se desconectó')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Conectar' })).toBeVisible();
});
