import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect } from '@playwright/test';
import type { Download, Page } from '@playwright/test';

/** Datos de la base semilla (backend/e2e/management/commands/preparar_e2e.py). */
export const USUARIO = { rut: '123456785', clave: 'Clave-Segura-2026' };
export const MATIAS = { id: 1, rut: '11.111.112-K' };

const BACKEND = path.resolve(import.meta.dirname, '../../backend');
const python = process.env.PYTHON ?? 'python';

function manage(...args: string[]): string {
  return execFileSync(python, ['manage.py', ...args], {
    cwd: BACKEND, env: { ...process.env, DJANGO_SETTINGS_MODULE: 'config.settings_e2e' }, encoding: 'utf8',
  }).trim();
}

/** Deja la base como la sembró preparar_e2e. Cada archivo de pruebas la llama al empezar. */
export function restaurarBase() {
  manage('preparar_e2e', '--reset');
}

/** Ejecuta código Python contra la base e2e y devuelve la última línea impresa. */
export function consultar(codigo: string): string {
  return manage('shell', '-c', codigo).split('\n').pop() ?? '';
}

export function ultimoCodigoOtp(token: string): string {
  return consultar(`from core.models import OTPFirma; print(OTPFirma.objects.filter(solicitud__token='${token}').latest('creado_en').codigo)`);
}

export async function entrar(page: Page, clave = USUARIO.clave) {
  await page.goto('/login');
  await page.getByLabel('RUT del titular de la cuenta').fill(USUARIO.rut);
  await page.getByLabel('Contraseña', { exact: true }).fill(clave);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** Espera la descarga que dispara `accion` y devuelve el nombre sugerido. */
export async function descargar(page: Page, accion: () => Promise<unknown>): Promise<string> {
  const [d]: [Download, unknown] = await Promise.all([page.waitForEvent('download'), accion()]);
  return d.suggestedFilename();
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** "Agosto 2026" para el mes actual (0) o los anteriores (-1, -2…), como los muestra el panel. */
export function periodo(desplazamiento = 0): string {
  const hoy = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const f = new Date(hoy.getFullYear(), hoy.getMonth() + desplazamiento, 1);
  return `${MESES[f.getMonth()]} ${f.getFullYear()}`;
}

/** Dibuja un trazo en un canvas de firma. */
export async function dibujarFirma(page: Page, canvas: ReturnType<Page['locator']>) {
  const caja = (await canvas.boundingBox())!;
  await page.mouse.move(caja.x + 30, caja.y + caja.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(caja.x + 30 + i * (caja.width - 60) / 24, caja.y + caja.height * (0.6 - 0.3 * Math.sin(i / 3)), { steps: 2 });
  }
  await page.mouse.up();
}
