/**
 * Compila la extensión "Jornada40 para Mi DT" para un entorno y la empaqueta.
 *
 *   npm run extension:staging      (o :produccion, :desarrollo)
 *
 * Deja dos cosas en extension/dist/:
 *   - <entorno>/: la carpeta para "Cargar descomprimida" en chrome://extensions;
 *   - jornada40-midt-<entorno>-<versión>.zip: para enviarla o subirla a las tiendas
 *     (manifest.json en la raíz del ZIP, como piden Chrome Web Store y Edge Add-ons).
 *
 * J40_API=https://… cambia la API (p. ej. para probar contra otro backend).
 */
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ENTORNOS = {
  produccion: { api: 'https://api.jornada40.cl/api', sufijo: '' },
  staging: { api: 'https://api-staging.jornada40.cl/api', sufijo: ' (pruebas)' },
  desarrollo: { api: 'http://127.0.0.1:8000/api', sufijo: ' (desarrollo)' },
};

const entorno = process.argv[2] ?? 'staging';
if (!ENTORNOS[entorno]) {
  console.error(`Entorno desconocido: ${entorno}. Usa: ${Object.keys(ENTORNOS).join(', ')}.`);
  process.exit(1);
}
const api = (process.env.J40_API || ENTORNOS[entorno].api).replace(/\/+$/, '');
const base = JSON.parse(await readFile(path.join(AQUI, 'manifest.base.json'), 'utf8'));
const salida = path.join(AQUI, 'dist', entorno);
const define = {
  __API__: JSON.stringify(api),
  __ENTORNO__: JSON.stringify(entorno),
  __VERSION__: JSON.stringify(base.version),
};

await rm(salida, { recursive: true, force: true });
await mkdir(salida, { recursive: true });

// 1. Panel lateral: React con los componentes y colores j40 del panel de Jornada40.
await build({
  configFile: false,
  root: path.join(AQUI, 'src', 'panel'),
  base: './',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  define,
  logLevel: 'warn',
  build: {
    outDir: path.join(salida, 'panel'),
    emptyOutDir: true,
    target: 'chrome116',
    modulePreload: { polyfill: false },
    rollupOptions: { input: path.join(AQUI, 'src', 'panel', 'panel.html') },
  },
});

// 2. Script dentro de Mi DT y service worker: un archivo clásico cada uno (los
//    content scripts no pueden ser módulos). Nada se descarga ni se evalúa en
//    tiempo de ejecución: Manifest V3 prohíbe el código remoto.
for (const nombre of ['contenido', 'fondo']) {
  await build({
    configFile: false,
    // Sin la carpeta public/ del sitio (video, íconos del sitio): la extensión lleva solo lo suyo.
    publicDir: false,
    define,
    logLevel: 'warn',
    build: {
      outDir: salida,
      emptyOutDir: false,
      target: 'chrome116',
      lib: { entry: path.join(AQUI, 'src', `${nombre}.ts`), formats: ['iife'], name: `jornada40_${nombre}`, fileName: () => `${nombre}.js` },
    },
  });
}

// 3. Manifiesto del entorno (nombre y permiso para su API) e íconos.
const manifest = {
  ...base,
  name: `${base.name}${ENTORNOS[entorno].sufijo}`,
  host_permissions: [...base.host_permissions, `${new URL(api).origin}/*`],
};
await writeFile(path.join(salida, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
await cp(path.join(AQUI, 'iconos'), path.join(salida, 'iconos'), { recursive: true });

// 4. ZIP con manifest.json en la raíz.
const archivos = [];
for (const entrada of await readdir(salida, { recursive: true, withFileTypes: true })) {
  if (!entrada.isFile()) continue;
  const completo = path.join(entrada.parentPath ?? entrada.path, entrada.name);
  archivos.push({ nombre: path.relative(salida, completo).split(path.sep).join('/'), datos: await readFile(completo) });
}
archivos.sort((a, b) => a.nombre.localeCompare(b.nombre));
const zipRuta = path.join(AQUI, 'dist', `jornada40-midt-${entorno}-${base.version}.zip`);
await writeFile(zipRuta, crearZip(archivos));

console.log(`Extensión ${manifest.name} ${base.version} → API ${api}`);
console.log(`  carpeta: ${path.relative(process.cwd(), salida)}`);
console.log(`  zip:     ${path.relative(process.cwd(), zipRuta)} (${archivos.length} archivos)`);

/** ZIP mínimo (deflate), sin dependencias. Fecha fija: el mismo código da el mismo archivo. */
function crearZip(lista) {
  const partes = [];
  const central = [];
  let posicion = 0;
  for (const { nombre, datos } of lista) {
    const nombreBytes = Buffer.from(nombre, 'utf8');
    const comprimido = zlib.deflateRawSync(datos, { level: 9 });
    const crc = crc32(datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);        // nombres en UTF-8
    local.writeUInt16LE(8, 8);             // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x21, 12);         // 01-01-1980
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombreBytes.length, 26);
    local.writeUInt16LE(0, 28);
    partes.push(local, nombreBytes, comprimido);

    const cabecera = Buffer.alloc(46);
    cabecera.writeUInt32LE(0x02014b50, 0);
    cabecera.writeUInt16LE(20, 4);
    cabecera.writeUInt16LE(20, 6);
    cabecera.writeUInt16LE(0x0800, 8);
    cabecera.writeUInt16LE(8, 10);
    cabecera.writeUInt16LE(0, 12);
    cabecera.writeUInt16LE(0x21, 14);
    cabecera.writeUInt32LE(crc, 16);
    cabecera.writeUInt32LE(comprimido.length, 20);
    cabecera.writeUInt32LE(datos.length, 24);
    cabecera.writeUInt16LE(nombreBytes.length, 28);
    cabecera.writeUInt32LE(posicion, 42);
    central.push(cabecera, nombreBytes);
    posicion += local.length + nombreBytes.length + comprimido.length;
  }
  const directorio = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(lista.length, 8);
  fin.writeUInt16LE(lista.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(posicion, 16);
  return Buffer.concat([...partes, directorio, fin]);
}

function crc32(datos) {
  if (typeof zlib.crc32 === 'function') return zlib.crc32(datos) >>> 0;
  let crc = 0xffffffff;
  for (const byte of datos) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
