import { expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { MATIAS, USUARIO, descargar, entrar, periodo, restaurarBase } from './utiles';

// Gestión: contrato, documentos, vacaciones, finiquito, importación, reportes, empresa, plan y cuenta.
test.describe.configure({ mode: 'serial' });
test.beforeAll(() => restaurarBase());

test('editor de contrato con avisos de jornada', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}/contrato`);
  await expect(page.getByRole('heading', { name: 'Editar contrato' })).toBeVisible();
  // 44 h supera el máximo: se avisa, no se bloquea.
  await expect(page.getByText('Jornada sobre el máximo legal').first()).toBeVisible();
  await page.getByLabel(/Horas semanales/).fill('42');
  await page.getByLabel('Salida Lunes').fill('17:24');
  await expect(page.getByText('Jornada sobre el máximo legal')).toHaveCount(0);
  await page.getByRole('button', { name: 'Agregar', exact: true }).first().click();
  await page.getByPlaceholder('Atender a clientes en caja').fill('Llevar la contabilidad mensual');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/trabajadores/${MATIAS.id}\\?tab=contrato$`));
  await expect(page.getByText(/^42 h$/).first()).toBeVisible();
  // El PDF se genera al descargarlo (antes 404 si no se había generado en el panel anterior).
  expect(await descargar(page, () => page.getByRole('button', { name: 'Descargar contrato' }).click())).toMatch(/^Contrato_.*\.pdf$/);
});

test('anexo de contrato y documentos legales', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=contrato`);
  await page.getByRole('link', { name: 'Crear anexo' }).first().click();
  await page.getByLabel('Título').fill('Aumento de sueldo');
  await page.getByRole('dialog').getByText('Sueldo base', { exact: true }).click();
  await page.getByRole('dialog').locator('input[inputmode=numeric]').first().fill('1400000');
  await page.getByRole('button', { name: 'Crear anexo' }).click();
  await expect(page.getByText('Anexo creado: envíalo a firma desde Documentos')).toBeVisible();

  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=documentos`);
  expect(await descargar(page, () => page.getByRole('button', { name: 'Descargar Anexo · Aumento de sueldo' }).click())).toMatch(/^Anexo_.*\.pdf$/);

  await page.getByRole('link', { name: /Amonestación/ }).first().click();
  await page.getByLabel('Hechos').fill('Llegó atrasado cinco veces en el mes.');
  await page.getByRole('button', { name: 'Crear documento' }).click();
  await expect(page.getByText('Amonestación creada')).toBeVisible();

  // Carta de término: las indemnizaciones las calcula el servidor (ingreso 01-03-2019 → 8 años al 30-09-2026).
  await page.getByRole('link', { name: /Carta de término/ }).first().click();
  await page.getByLabel('Causal de término').selectOption('161_1');
  await page.getByLabel('Último día de trabajo').fill('2026-09-30');
  await expect(page.getByText(/Por años de servicio \(8 años\)/)).toBeVisible();
  await page.getByLabel('Hechos').fill('Reestructuración del área contable.');
  await page.getByRole('radio', { name: 'Sí' }).check({ force: true });
  await page.getByRole('button', { name: 'Crear documento' }).click();
  await expect(page.getByText('Carta de término creada')).toBeVisible();
});

test('vacaciones con días hábiles del servidor', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}?tab=vacaciones`);
  await page.getByRole('link', { name: 'Registrar vacaciones' }).first().click();
  await page.getByLabel('Desde').fill('2026-08-31');
  await page.getByLabel('Hasta').fill('2026-09-06');
  // Lunes a domingo = 5 hábiles: el sábado es inhábil para el feriado (Art. 69).
  await expect(page.getByRole('dialog').getByText(/^5$/)).toBeVisible();
  await page.getByRole('button', { name: 'Registrar', exact: true }).click();
  await expect(page.getByText('Vacaciones registradas')).toBeVisible();
});

test('finiquito calculado por el servidor', async ({ page }) => {
  await entrar(page);
  await page.goto(`/app/trabajadores/${MATIAS.id}/finiquito`);
  await page.getByLabel('Causal de término').selectOption('161_1');
  await page.getByLabel('Fecha de término').fill('2026-09-15');
  await expect(page.getByText(/8 años ×/)).toBeVisible();
  await expect(page.getByText('Sustitutiva del aviso previo', { exact: true })).toBeVisible();
  // Base del Art. 172 con lo mensual de las liquidaciones sembradas.
  await page.getByText(/Base de cálculo \(Art\. 172\)/).click();
  await expect(page.getByText('Sueldo base', { exact: true })).toBeVisible();
  await page.getByText('Di el aviso por escrito').click();
  await expect(page.getByText('Se dio el aviso con 30 días')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar borrador' }).click();
  await expect(page.getByText('Finiquito guardado')).toBeVisible();
  expect(await descargar(page, () => page.getByRole('button', { name: 'Descargar PDF' }).click())).toMatch(/\.pdf$/);
});

test('desvincular y reactivar', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/trabajadores/4');
  await page.getByRole('button', { name: 'Desvincular' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Desvincular' }).click();
  await expect(page.getByText('Trabajador desvinculado')).toBeVisible();
  await page.getByRole('button', { name: 'Reactivar' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivar' }).click();
  await expect(page.getByText('Trabajador reactivado')).toBeVisible();
});

test('importar trabajadores con revisión previa', async ({ page }) => {
  // Carpeta temporal del sistema: la de resultados lleva tildes en el nombre del test.
  const archivo = path.join(mkdtempSync(path.join(tmpdir(), 'j40-')), 'importar.xlsx');
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet([
    { RUT: '9.876.543-3', Nombres: 'Rocío', 'Apellido Paterno': 'Valdés', cargo: 'Cajera', fecha_ingreso: '01-06-2025', sueldo_base: 560000, horas_laborales: 42 },
    { RUT: MATIAS.rut, cargo: 'Contador senior' },
    { RUT: '11.111.111-2', Nombres: 'X', 'Apellido Paterno': 'Y' },
    { RUT: '7.654.321-6', Nombres: 'Tomás', 'Apellido Paterno': 'Mena', cargo: 'Chofer', fecha_ingreso: '', sueldo_base: 700000, horas_laborales: 45 },
    { RUT: '8.765.432-K', Nombres: 'Ignacia', 'Apellido Paterno': 'Lagos', cargo: 'Guardia', fecha_ingreso: '15-01-2026', sueldo_base: 620000, horas_laborales: 45 },
  ]), 'Trabajadores');
  XLSX.writeFile(libro, archivo);

  await entrar(page);
  await page.goto('/app/trabajadores/importar');
  await expect(page.getByText('Arrastra la planilla aquí')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles(archivo);
  await expect(page.getByText('Filas leídas')).toBeVisible();
  await expect(page.locator('span.text-\\[22px\\]').first()).toHaveText('5');
  await expect(page.getByText(/RUT inválido/)).toBeVisible();
  await expect(page.getByText(/fecha de ingreso/)).toBeVisible();
  await expect(page.getByText(/Jornada de 45 h/).first()).toBeVisible();
  await expect(page.getByText(/Cambia: cargo/)).toBeVisible();
  await page.getByRole('button', { name: /Importar 3 trabajadores/ }).click();
  await expect(page.getByText('Importación terminada')).toBeVisible();
  await page.getByRole('link', { name: 'Ir a Trabajadores' }).click();
  await expect(page.getByText(/Rocío Valdés/).first()).toBeVisible();
});

test('expedientes ZIP y reportes', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/trabajadores');
  await page.getByRole('button', { name: 'Expedientes ZIP' }).click();
  expect(await descargar(page, () => page.getByRole('button', { name: /^Descargar \d+/ }).click())).toMatch(/\.zip$/);

  await page.goto('/app/reportes');
  // El mes en curso aún no tiene liquidaciones: estado vacío, no error.
  await expect(page.getByText(/No hay liquidaciones emitidas en/)).toBeVisible();
  const [mes] = periodo(-1).split(' ');
  await page.getByLabel('Mes', { exact: true }).selectOption({ label: mes });
  await expect(page.getByText('Costo empleador').first()).toBeVisible();
});

test('empresa, plan y cuenta', async ({ page }) => {
  await entrar(page);
  await page.goto('/app/empresa');
  await expect(page.getByText('Ingreso mínimo mensual')).toBeVisible();
  await page.getByLabel('Giro').fill('Comercio al por menor');
  await page.getByRole('button', { name: 'Guardar' }).first().click();
  await expect(page.getByText('Datos de la empresa guardados')).toBeVisible();

  await page.goto('/app/plan');
  await expect(page.getByRole('button', { name: /Subir a Corporativo/ })).toBeVisible();
  await expect(page.getByText(/este plan permite 3/)).toBeVisible();  // Semilla bloqueada por el uso
  await expect(page.getByRole('heading', { name: 'Historial de pagos' })).toBeVisible();

  await page.goto('/app/cuenta');
  await page.getByLabel('Teléfono').fill('+56 9 7777 8888');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Datos guardados')).toBeVisible();
  const boton = page.getByRole('button', { name: 'Cambiar contraseña' });
  await page.getByLabel('Contraseña actual').fill(USUARIO.clave);
  await page.getByLabel('Nueva contraseña').fill('Nueva-Clave-2027');
  await expect(boton).toBeDisabled();
  await page.getByLabel('Repite la nueva').fill('Nueva-Clave-2027');
  await boton.click();
  await expect(page.getByText('Contraseña actualizada')).toBeVisible();
});

test('crear otra empresa', async ({ page }) => {
  await entrar(page, 'Nueva-Clave-2027');
  await page.goto('/app/empresas');
  await page.getByRole('button', { name: 'Nueva empresa' }).click();
  await page.getByLabel('Razón social').fill('Transportes del Norte SpA');
  await page.getByLabel('RUT de la empresa').fill('77.888.999-4');
  await page.getByRole('button', { name: 'Crear empresa' }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText(/Transportes Del Norte Spa/i).first()).toBeVisible();
});
