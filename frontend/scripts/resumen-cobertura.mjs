// Resumen de cobertura de las pruebas unitarias en Markdown (para el resumen de CI).
// Uso: npm run test:cobertura && node scripts/resumen-cobertura.mjs >> "$GITHUB_STEP_SUMMARY"
import { readFileSync } from 'node:fs';

const resumen = JSON.parse(readFileSync(new URL('../coverage/coverage-summary.json', import.meta.url), 'utf8'));
const grupos = [
  ['Utilidades (`src/utils`)', /\/src\/utils\//],
  ['Cliente de la API (`src/api`)', /\/src\/api\//],
  ['Lógica de la extensión (`extension/src/*.ts`)', /\/extension\/src\/[^/]+\.tsx?$/],
  ['Pantallas y componentes (cubiertos sobre todo por Playwright)', /\/src\/(pages|components)\//],
];
const pct = (c, t) => (t ? `${((100 * c) / t).toFixed(1).replace('.', ',')} %` : '—');
const filas = grupos.map(([nombre, re]) => {
  let total = 0;
  let cubiertas = 0;
  for (const [archivo, datos] of Object.entries(resumen)) {
    if (archivo !== 'total' && re.test(archivo)) {
      total += datos.lines.total;
      cubiertas += datos.lines.covered;
    }
  }
  return `| ${nombre} | ${pct(cubiertas, total)} | ${cubiertas}/${total} |`;
});
const t = resumen.total.lines;
console.log(['### Cobertura de las pruebas unitarias (frontend)', '', '| Grupo | Líneas | Cubiertas |', '|---|---|---|',
  ...filas, `| **Total** | **${pct(t.covered, t.total)}** | ${t.covered}/${t.total} |`].join('\n'));
