# Manual de usuario de Jornada40

Fuente del manual de usuario para los clientes: el titular de la cuenta y su equipo, con guías breves en los anexos para el trabajador, el encargado de denuncias de la Ley Karin y el fiscalizador de la Dirección del Trabajo. Se escribe en Markdown, con las mismas convenciones y herramientas que el documento técnico (`docs/tecnico/README.md`), y se entrega en Word y PDF.

## Archivos

- `documento.json`: versión, fecha, nombre del archivo de salida y orden de los capítulos.
- `00-preliminares.md`: portada, historial de versiones, índice y "Cómo usar este manual".
- `01-bienvenida.md` … `16-empresas-plan.md`: un archivo por capítulo.
- `anexo-a-trabajador.md` … `anexo-e-glosario.md`: un archivo por anexo.
- `figuras/`: las capturas de pantalla, que se versionan.
- `salida/`: Word y PDF generados. No se versiona.

## Compilar

Desde la raíz del repositorio, con pandoc 3 y LibreOffice con Python UNO:

```bash
python3 docs/tecnico/herramientas/construir.py --doc docs/manual
```

## Capturas de pantalla

Las toma `frontend/e2e/capturas-manual.spec.ts` con la base de prueba (Comercial Los Andes SpA y sus trabajadores ficticios). Solo corre a pedido y necesita el entorno de Python del backend:

```bash
cd frontend && CAPTURAS_MANUAL=1 npx playwright test capturas-manual   # PYTHON=<python con Django> si no es el del sistema
```

Las pantallas con precios se toman sin ellos: el registro en su primer paso y Plan y facturación con los montos tapados.

## Cómo escribir

- Se trata al lector de "tú", con pasos cortos. Los botones, menús, pestañas y campos van en negrita, escritos tal como aparecen en la pantalla.
- Una función de un plan pagado lleva al comienzo de su sección "*Disponible desde el plan Starter.*" (o Pyme), y lo que solo usa el titular, "*Solo el titular.*".
- No se indican precios: se remite a Plan y facturación.
- No se da asesoría legal ni se afirma un reconocimiento o certificación de la Dirección del Trabajo.
- Solo se describe lo que un cliente ve y puede usar. Quedan fuera la extensión de Mi DT, el archivo masivo de la DT, el administrador interno y lo que esté solo en staging.
- Cada dato se comprueba en el código, no en `CLAUDE.md` ni en la memoria. Si una función visible cambia, se actualiza su sección y se vuelve a tomar su captura.
