# Documento técnico de Jornada40

Fuente del documento técnico oficial del sistema. Se escribe en Markdown y se entrega en Word y PDF, con portada, ficha de control, control de versiones, índices automáticos, secciones numeradas y figuras y tablas con número y título.

Sigue la estructura de los estándares ISO/IEC/IEEE 29148 (requerimientos), ISO/IEC/IEEE 42010 e IEEE 1016 (arquitectura y diseño) e ISO/IEC 25010 (calidad). Es **confidencial**: describe controles de seguridad y tratamiento de datos.

## Estado

| Entrega | Contenido                                                        | Estado               |
|---------|------------------------------------------------------------------|----------------------|
| 1       | Parte preliminar, resumen ejecutivo, capítulos 1 y 2             | Lista (v0.1, 11-10-2026) |
| 2       | Capítulo 3: requerimientos y reglas de negocio                   | Lista (v0.2, 12-10-2026) |
| 3       | Capítulos 4 a 7: arquitectura, diseño, datos e interfaces        | Lista (v0.3.1, 12-10-2026) |
| 4       | Capítulos 8 a 10: seguridad, datos personales y cumplimiento     | Pendiente            |
| 5       | Capítulos 11 a 13, anexos A a J y revisión final                 | Pendiente            |

## Archivos

- `documento.json`: versión, fecha, estado, clasificación, commits descritos y orden de los capítulos.
- `00-preliminares.md`: portada, ficha de control, control de versiones e índices.
- `00-resumen-ejecutivo.md`, `01-introduccion.md`, `02-descripcion-general.md`…: un archivo por capítulo.
- `figuras/`: cada diagrama en Mermaid (`.mmd`) junto a su imagen (`.png`), y las capturas de pantalla (`07-*.png`). Las imágenes se versionan, así que compilar no requiere Node.
  - `06-er-*.mmd` no se editan a mano: los genera `herramientas/modelo_datos.py` desde los modelos de Django.
  - `07-*.png` las toma `frontend/e2e/capturas.spec.ts` con los datos de prueba.
- `herramientas/`:
  - `construir.py`: compila el documento;
  - `referencia.py`: plantilla de estilos de Word;
  - `documento.lua`: filtro de pandoc (numeración, anchos de tabla, índices, valores de `documento.json`);
  - `mermaid.json`: colores, tipografía y espaciado de los diagramas;
  - `modelo_datos.py`: diagramas entidad-relación del capítulo 6 y, con `--json`, el resumen de todos los modelos (base del anexo B).
- `salida/`: Word y PDF generados. No se versiona.

## Compilar

Desde la raíz del repositorio:

```bash
python3 docs/tecnico/herramientas/construir.py            # Word y PDF
python3 docs/tecnico/herramientas/construir.py --figuras  # además, redibuja los diagramas
python3 docs/tecnico/herramientas/construir.py --sin-pdf  # solo el Word de pandoc (sin índices calculados)
```

Para regenerar las figuras que salen del código:

```bash
python3 docs/tecnico/herramientas/modelo_datos.py   # con el entorno del backend (Django instalado)
cd frontend && CAPTURAS_DOC=1 npx playwright test capturas   # capturas del capítulo 7
```

Requisitos:

- pandoc 3;
- LibreOffice 7.6 o superior, con Python UNO (paquete `python3-uno`; se usa el `python3` del sistema). LibreOffice calcula los índices con sus números de página y exporta el PDF y el Word final.
- Para `--figuras`: Node y Chromium. Se usa `@mermaid-js/mermaid-cli` (versión fija en `construir.py`). `MMDC` apunta a un `mmdc` ya instalado y `CHROMIUM` al navegador; por defecto se usa `/opt/pw-browsers/chromium`.

## Cómo escribir

- **Datos del documento:** `{{version}}`, `{{fecha}}`, `{{rama}}` y las demás claves de `documento.json` se reemplazan al compilar, también dentro de `código`.
- **Tablas:** tablas de Markdown con leyenda `: Título` debajo. Se numeran solas y el ancho de cada columna se calcula según su contenido, así que los guiones del Markdown no importan. Las tablas cortas no se parten entre páginas; en las largas se repite el encabezado.
- **Saltos de línea en una celda:** `<br>` (por ejemplo, para enumerar con `•` dentro de una celda).
- **Fuente de una tabla:** un bloque `::: {custom-style="Nota de tabla"}` justo después de la tabla.
- **Figuras:** `![Título breve](figuras/nombre.png){width=100%}`. El título va al índice de figuras, así que conviene que sea corto; la explicación va en el texto. El ancho se elige para que la letra impresa del diagrama quede entre 7 y 9 puntos y la figura no pase de 20,5 cm de alto. Si un diagrama queda muy ancho o muy alto, cambia su orientación (`direction`) o divídelo; en los entidad-relación, `INVERTIR` de `modelo_datos.py` dobla las cadenas largas.
- **Bloques especiales:**
  - `::: {custom-style="Título de página"}` para un título preliminar que empieza página;
  - `::: indice`, `::: indice-figuras` y `::: indice-tablas` para los índices;
  - `::: salto-pagina` para un salto de página.
- **Capítulos:** cada capítulo empieza con `# Título {#sec-…}` y queda numerado automáticamente; `{.unnumbered}` lo deja sin número.
- **Funciones no publicadas:** la marca **[Solo en staging]** señala lo que aún no está en `main`.
- **Exactitud:** cada dato se comprueba en el código, no en `CLAUDE.md` ni en la memoria. Las rutas se escriben relativas a la raíz del repositorio.
- **Ejemplos numéricos:** los de la sección 3.2.8 los comprueba `backend/core/tests/test_ejemplos_documento.py`. Si un cálculo cambia, esa prueba falla: actualiza el ejemplo del capítulo en el mismo commit.

## Publicar una versión nueva

1. Actualizar en `documento.json` la versión, la fecha, el estado, los commits y la lista de capítulos.
2. Agregar la fila correspondiente en el control de versiones de `00-preliminares.md` y el estado de los capítulos en la sección 1.3.2.
3. Compilar, revisar el PDF página por página y entregar el Word y el PDF de `salida/`.
