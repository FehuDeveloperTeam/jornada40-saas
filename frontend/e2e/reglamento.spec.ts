import { expect, test } from '@playwright/test';
import { consultar, descargar, entrar, restaurarBase } from './utiles';

test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

/** PDF mínimo válido (con su tabla xref), para subir como "reglamento terminado". */
function pdfMinimo(): Buffer {
  const objetos = [
    '<</Type/Catalog/Pages 2 0 R>>', '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>',
  ];
  let cuerpo = '%PDF-1.4\n';
  const posiciones: number[] = [];
  objetos.forEach((o, i) => { posiciones.push(cuerpo.length); cuerpo += `${i + 1} 0 obj${o}endobj\n`; });
  const xref = cuerpo.length;
  cuerpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
    + posiciones.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer<</Size ${objetos.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(cuerpo, 'latin1');
}
const PDF = pdfMinimo();

test('reglamento interno: plantilla por rubro, versión, remisión y entrega', async ({ page }) => {
  consultar("from core.models import Empresa; Empresa.objects.update(firma_imagen='data:image/png;base64,iVBORw0KGgo='); print('ok')");
  await entrar(page);
  await page.goto('/app/reglamento');
  await expect(page.getByRole('heading', { name: 'Reglamento y Ley Karin' })).toBeVisible();

  const plantilla = page.getByRole('button', { name: 'Descargar en Word para completar' });
  await expect(plantilla).toBeDisabled();
  await page.getByLabel('Rubro de su empresa').selectOption({ label: 'Construcción' });
  expect(await descargar(page, () => plantilla.click())).toMatch(/\.docx$/);

  await page.getByLabel('Archivo del reglamento (PDF)').setInputFiles({ name: 'reglamento.pdf', mimeType: 'application/pdf', buffer: PDF });
  await page.getByRole('button', { name: 'Guardar reglamento' }).click();
  await expect(page.getByText('Reglamento guardado')).toBeVisible();
  await expect(page.getByText(/versión 1\. Regirá desde/)).toBeVisible();

  await page.getByRole('listitem').filter({ hasText: 'Dirección del Trabajo (en Mi DT' }).getByRole('button', { name: 'Ya lo envié' }).click();
  await expect(page.getByText(/Mi DT, trámite «Reglamento interno»\) · enviado el/)).toBeVisible();

  await page.getByRole('button', { name: /^Enviar a firma a \d+ trabajador/ }).click();
  await expect(page.getByText(/Reglamento enviado a firma a \d+/)).toBeVisible();
});

test('Ley Karin: canal de denuncias y aviso del semestre', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/reglamento');
  const enviar = page.getByRole('button', { name: /^Enviar el aviso a/ });
  await expect(enviar).toBeDisabled();
  await page.getByLabel('Quién recibe las denuncias (persona o cargo)').fill('Jefa de personas');
  await page.getByLabel('Correo para denuncias').fill('denuncias@empresa.cl');
  await page.getByRole('button', { name: 'Guardar canal' }).click();
  await expect(page.getByText('Canal de denuncias guardado')).toBeVisible();
  await enviar.click();
  await expect(page.getByText(/Aviso enviado a firma a \d+/)).toBeVisible();
  await expect(page.getByText(/semestre de \d{4}: informado a [1-9]/)).toBeVisible();
});
