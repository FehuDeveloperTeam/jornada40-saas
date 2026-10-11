import { expect, test } from '@playwright/test';
import { consultar, entrar, restaurarBase, revisarAccesibilidad } from './utiles';

/**
 * Accesibilidad (WCAG 2.1 A y AA, con axe) de las pantallas principales: el
 * sitio público, la firma del trabajador y el panel. Muchos titulares son
 * personas mayores: contraste, etiquetas y nombres accesibles importan.
 */
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

const PUBLICAS = ['/', '/login', '/register', '/trabajador', '/verificar', '/inspeccion', '/equipo', '/karin', '/terminos'];
const PANEL = ['/app', '/app/trabajadores', '/app/trabajadores/1', '/app/remuneraciones', '/app/firmas', '/app/dt',
  '/app/reglamento', '/app/empresa', '/app/plan', '/app/cuenta', '/app/equipo', '/app/solicitudes'];

test('sitio público y firma del trabajador', async ({ page }) => {
  for (const ruta of PUBLICAS) {
    await page.goto(ruta);
    await expect(page.locator('main, [role="main"], form').first()).toBeVisible();
    await revisarAccesibilidad(page, ruta);
  }
  const token = consultar("from core.models import SolicitudFirma; print(SolicitudFirma.objects.filter(estado='PENDIENTE').first().token)");
  await page.goto(`/firma/${token}`);
  await expect(page.getByLabel('RUT')).toBeVisible();
  await revisarAccesibilidad(page, '/firma/<token>');
});

test('panel del titular', async ({ page }) => {
  await entrar(page, undefined, { confirmarIdentidad: false });
  for (const ruta of PANEL) {
    await page.goto(ruta);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await revisarAccesibilidad(page, ruta);
  }
});
