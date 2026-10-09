# Extensión "Jornada40 para Mi DT"

Extensión de Chrome y Edge (Manifest V3) que llena los formularios del Registro Electrónico Laboral de Mi DT con los datos de Jornada40. Plan y principios: `docs/PLAN_EXTENSION_MIDT.md`. Publicación en tiendas: `tienda/FICHA_TIENDA.md`.

**Principios:** nunca toca la Clave Única, nunca presiona los botones de avance o envío de Mi DT, no usa la API interna de la DT, y si algo no calza no llena nada (queda la ficha con botones "Copiar").

## Piezas

| Archivo | Qué hace |
|---|---|
| `src/contenido.ts` | Script dentro de `midt.dirtrab.cl`. Responde al panel: estado de la pantalla, levantamiento, llenar una etapa, leer lo que el mapeo pide verificar y reconocer el mensaje de éxito. |
| `src/levantar.ts` | Estructura de la pantalla (etiquetas, tipos, opciones), sin leer lo escrito; RUT y correos tapados. |
| `src/llenar.ts` | Llenado "como una persona" (setter nativo + eventos `input`/`change`/`blur`, para que React lo vea), marcas verde/amarillo, éxito. |
| `src/mapeo.ts` | Tipos de los mapeos, etapa actual, instrucciones de llenado, formatos (fechas, RUT) y comparación de nombres. |
| `src/fondo.ts` | Service worker: el ícono abre el panel lateral. |
| `src/panel/` | Panel lateral (React + componentes `j40`): conectar con código, lista "Por registrar", ficha, marcar registrado, modo levantamiento. |
| `manifest.base.json` | Manifiesto común; `construir.mjs` le agrega el nombre y el permiso de la API de cada entorno. |

Backend: `backend/core/views/extension.py` (token propio `Authorization: Extension <token>`, rutas `/api/extension/v1/…`) y los mapeos en `backend/core/datos/mapeos_midt.json`.

## Compilar

En `frontend/`:

```bash
npm run extension:staging      # API https://api-staging.jornada40.cl/api
npm run extension:produccion   # API https://api.jornada40.cl/api
npm run extension:desarrollo   # API http://127.0.0.1:8000/api
```

Cada uno deja `extension/dist/<entorno>/` (carpeta para cargar) y `extension/dist/jornada40-midt-<entorno>-<versión>.zip` (para enviar o subir a las tiendas). Con `J40_API=https://…` se cambia la API.

## Instalar sin la tienda (pruebas)

1. Descomprimir el ZIP en una carpeta que no se vaya a borrar.
2. Abrir `chrome://extensions` (o `edge://extensions`) y activar **Modo de desarrollador**.
3. **Cargar descomprimida** → elegir la carpeta (la que tiene `manifest.json`).
4. Fijar el ícono de Jornada40 (pieza de rompecabezas → chincheta) y hacer clic en él para abrir el panel.

Para actualizar: reemplazar los archivos de la carpeta y presionar ↻ en la tarjeta de la extensión. Si Mi DT ya estaba abierto, recargar su pestaña (F5).

## Mapeos

`mapeos_midt.json` dice, para cada formulario (`CONTRATO`, `ANEXO`, `TERMINO`), su `ruta` en Mi DT, sus `etapas` (cómo reconocerlas por un título y qué campo de la ficha va en qué selector) y el mensaje de `exito`. Las claves de la ficha son `slugify(etiqueta)` de `core/views/direccion_trabajo.py` (p. ej. `rut-del-trabajador`). Es un archivo de datos: cambiarlo no requiere publicar otra versión de la extensión.

Se arman con el **modo levantamiento**: en el panel, "Modo levantamiento" → abrir cada pantalla de Mi DT → "Registrar esta pantalla" → "Enviar a Jornada40" (o "Guardar archivo"). Lo enviado queda en el admin (`Levantamientos de pantallas de Mi DT`, acción "Descargar en JSON (para armar los mapeos)").

Mientras una pantalla no tiene etapas mapeadas, el panel muestra la ficha con botones "Copiar" y lo dice.

## Pruebas

- Unitarias (Vitest, jsdom): `npm test` incluye `extension/src/**/*.test.ts(x)` — levantamiento sin valores, llenado sobre un formulario controlado por React, mapeos, textos.
- De navegador (Playwright): `e2e/extension.spec.ts` compila la versión de desarrollo, la carga en Chromium y la prueba contra el backend e2e y una copia local de Mi DT (`backend/e2e/mapeos_midt_e2e.json`).
