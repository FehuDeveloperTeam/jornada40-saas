# Plan: extensión "Jornada40 para Mi DT"

Estado: **propuesta para aprobar** (2026-10-08). No hay código escrito.

## 1. Objetivo

Que el empleador registre en Mi DT sus contratos, anexos y términos, y cargue el Libro de Remuneraciones Electrónico (LRE), **sin copiar dato por dato**. Los datos salen de Jornada40.

Hoy Jornada40 calcula qué hay que registrar y cuándo vence, y muestra la "ficha" con botones para copiar. La extensión da el paso que falta: **llena el formulario de Mi DT por la persona**.

### Principios (no negociables)

1. **Nunca tocamos la Clave Única.** La persona entra a Mi DT como siempre, en su navegador. La extensión no la ve, no la guarda y no automatiza el ingreso.
   - La Res. Ex. 733/2025 de Hacienda prohíbe pedir o almacenar credenciales de ClaveÚnica y crear mecanismos automáticos de acceso a ella.
   - Por eso **no** copiamos el modelo de Buk, Talana y Defontana, que piden la Clave Única del representante y entran a Mi DT por él.
2. **La persona aprieta el botón final.** La extensión llena cada etapa; la persona revisa y presiona "Siguiente" y "Registrar". Así el registro lo hace el empleador, como exige la ley; la extensión es un asistente, como el autocompletar del navegador.
3. **No llamamos a la API interna de la DT.** Solo usamos el formulario visible, igual que una persona. No dependemos de servicios no publicados ni los forzamos.
4. **Si algo no calza, no se llena.** Si Mi DT cambia o un dato no corresponde, la extensión se detiene y ofrece la ficha con botones para copiar (lo que existe hoy).
5. **Mínimo de datos.** La extensión solo lee el formulario que está llenando y el comprobante final. No guarda datos de trabajadores: los pide a Jornada40 en el momento y los olvida al terminar.

## 2. Lo que ya existe en Jornada40 y se reutiliza

| Pieza | Dónde | Uso en la extensión |
|---|---|---|
| Qué registrar, con plazo y estado | `GET /api/registro-dt/?empresa=` (`items_registro`) | Lista "Por registrar" en la extensión |
| Ficha ordenada por las 4 etapas del formulario individual | `GET /api/registro-dt/ficha/?empresa=&clave=` (`ficha_contrato`, `ficha_anexo`, `ficha_anexo_40h`, `ficha_termino`) | Datos para llenar cada campo |
| Marcar como registrado | `POST /api/registro-dt/marcar/` (`RegistroDT`) | Al ver el comprobante de Mi DT |
| Archivo LRE en formato oficial | `GET /api/liquidaciones/revisar_lre/`, `…/exportar_lre/` (Pyme+) | Carga del LRE |
| Datos del finiquito para Mi DT | `GET /api/finiquitos/<id>/ficha_mi_dt/` | Fase posterior (finiquito electrónico) |

## 3. Lo que muestra el código público de Mi DT (revisado el 2026-10-08)

Revisé el sitio público `midt.dirtrab.cl`, sin iniciar sesión.

- **Tecnología:** es una aplicación React (Create React App, Bootstrap). Para que Mi DT acepte un valor, hay que llenarlo como lo haría una persona: escribir y luego disparar los eventos de cambio. Si solo se asigna el valor, React no lo ve.
- **Rutas de cada trámite** (en la sesión del empleador):
  - contrato individual: `/empleador/registro-electronico-laboral/registroContratoTrabajo`;
  - anexo: `/empleador/registro-electronico-laboral/anexo`;
  - historial: `…/historialContratos`;
  - término: `/empleador/registro-electronico-laboral-termino/registroTerminoTabla`;
  - registro masivo: `/empleador/registroContratoMasivo`;
  - LRE: `/empleador/lre`;
  - finiquito: `/empleador/finiquitos/IngresoIndividualPasos`;
  - teletrabajo: `/empleador/teletrabajo/ingreso`.
- **Campos con identificadores estables** (`id` y `name`), por ejemplo `rut`, `rutRepresentanteLegal`, `correoElectronico`, `comuna`, `numeroDomicilio` y `jornadaId`. Así se puede ubicar cada campo sin depender del diseño. El mapeo completo se hace en la Fase 0, con una sesión real.
- **Hallazgos para revisar en la Fase 0:**
  - Existe un **módulo propio de teletrabajo**. Hoy Jornada40 trata el pacto de teletrabajo como un anexo; si se registra en ese módulo, corregimos el aviso, la ficha y el plazo.
  - Existe el **registro masivo de contratos**. Con la plantilla real podríamos por fin validar nuestro CSV, que hoy está oculto.

## 4. Cómo se verá para el empleador

1. **Instala** "Jornada40 para Mi DT" desde la tienda de Chrome (o de Edge).
2. **Conecta su cuenta:** en Jornada40 → Dirección del Trabajo aprieta "Conectar extensión" y obtiene un código de 8 caracteres (vale 10 minutos). Lo escribe en la extensión. Se hace una vez por computador.
3. **Entra a Mi DT** con su Clave Única, como siempre.
4. Se abre el **panel lateral de Jornada40**, con letra grande:
   - reconoce el **RUT del empleador** que está en Mi DT y elige esa empresa;
   - si la empresa no está en la cuenta, avisa y no hace nada;
   - muestra **"Por registrar"**, con plazos y vencidos primero.
5. Elige un trabajador → **"Abrir formulario"** lleva a la pantalla correcta de Mi DT.
6. **"Llenar esta etapa":**
   - completa los campos y los marca en verde;
   - marca en amarillo lo que Jornada40 no sabe (por ejemplo, "¿hubo cambio de domicilio?");
   - después de que Mi DT trae el nombre del Registro Civil, compara ese nombre con el de la ficha y avisa si no coincide.
7. La persona revisa y presiona **"Siguiente"** en Mi DT, y así en las 4 etapas. Al final presiona **"Registrar"**.
8. La extensión **detecta el comprobante**, guarda su número y la fecha en Jornada40 ("Registrado vía extensión") y vuelve a la lista. Queda en la bitácora con el nombre de quien lo hizo.

Con el LRE es igual: en `/empleador/lre`, "Cargar LRE de septiembre" descarga el archivo desde Jornada40 y lo deja puesto en el campo de carga. La persona presiona "Cargar" y "Enviar declaración". La DT valida en hasta 48 horas, y la extensión puede leer el estado en el historial la próxima vez que se abra.

## 5. Diseño técnico

### Extensión (Chrome y Edge; Manifest V3)

- Carpeta nueva `extension/`, en TypeScript y compilada con Vite. El panel usa React y los colores y tipografía de `j40`.
  - `background` (service worker): guarda el token y habla con la API de Jornada40.
  - `contenido`: script que corre solo en `https://midt.dirtrab.cl/*`. Detecta la pantalla y la etapa, llena los campos y lee el comprobante.
  - `panel`: panel lateral (`chrome.sidePanel`) con la lista, los avisos y los botones.
- **Permisos mínimos:** `storage` y `sidePanel`, más los sitios `https://midt.dirtrab.cl/*` y `https://api.jornada40.cl/*` (y staging). No pide acceso a otros sitios.
- **Mapeos como datos:**
  - Un JSON versionado dice qué campo de la ficha va en qué campo de Mi DT, en qué etapa y cómo se llena (texto, fecha `aaaa-mm-dd`, selección, radio).
  - Lo entrega la API de Jornada40, así un cambio de Mi DT se corrige sin publicar otra versión de la extensión. Las tiendas revisan cada versión y demoran días.
  - Es solo un archivo de datos, no código descargado: Manifest V3 prohíbe ejecutar código remoto.
- **Llenado como una persona:** foco, escribir el valor con el método nativo, eventos `input`, `change` y `blur`, y esperar a que Mi DT reaccione (por ejemplo, cuando trae el nombre desde el RUT).
- **Verificaciones antes de llenar:**
  - el RUT del empleador en Mi DT es el de la empresa elegida;
  - la etapa y la estructura coinciden con la versión del mapeo;
  - si algo falla, no llena nada y ofrece la ficha para copiar.

### Backend de Jornada40

- **Vinculación de la extensión** (nuevo, `views/extension.py`):
  - `POST /api/extension/codigo/`: lo pide el titular o un usuario del equipo con el módulo Dirección del Trabajo en "gestionar". Devuelve un código de un solo uso de 10 minutos.
  - `POST /api/extension/vincular/ {codigo, nombre_equipo}`: público y con límite de intentos. Entrega un **token propio de la extensión**.
  - En la base solo se guarda su huella (modelo `DispositivoExtension`):
    - cuenta, persona, empresas, nombre del equipo;
    - fecha de creación, último uso, vencimiento a los 90 días sin uso, y revocación.
  - En `/app/dt` se ven los equipos conectados y se pueden desconectar.
- **Autenticación por token**, con encabezado `Authorization: Extension <token>`:
  - Abre **solo** las rutas que necesita: lista y ficha del registro, marcar, revisar y exportar el LRE, y empresas (lectura).
  - Respeta los módulos y empresas de la persona, como el cerco de los usuarios del equipo.
  - Cualquier otra ruta responde 403.
- **`RegistroDT`** suma `via` (MANUAL o EXTENSION), `comprobante` (número que entrega Mi DT, si lo hay) y `registrado_por`.
- **LRE:** cada envío se guarda como `RegistroDT` con clave `LRE:<aaaamm>`. Así Inicio y el resumen por correo también recuerdan el día 15.
- **Bitácora:** cada escritura de la extensión queda con su actor y la marca "vía extensión".

### Seguridad

- **Token:**
  - acotado a esas rutas y a las empresas de la persona;
  - revocable en cualquier momento;
  - se guarda solo en el navegador (`chrome.storage.local`) y en la base como huella.
- **Datos del trabajador:** la extensión los pide al llenar y no los guarda.
- **Sin acceso al resto:** no lee el resto de Mi DT, no toca la Clave Única y no presiona botones finales.
- **Tiendas:** publicamos una política de privacidad propia (obligatoria en ambas tiendas), con lo que se lee y se envía.

## 6. Fases

| Fase | Contenido | Resultado esperado |
|---|---|---|
| **0. Levantamiento** (contigo) | Modo "levantamiento" de la extensión: en tu sesión de Mi DT registra **la estructura** de cada formulario (etiquetas, ids, tipos y opciones; **ningún valor**) y la guarda en un archivo que me envías. Formularios: contrato (4 etapas), anexo, término, LRE y teletrabajo. | Mapeos completos. Confirmar teletrabajo y registro masivo. |
| **1. Backend** | Vinculación, token, rutas permitidas, campos nuevos de `RegistroDT`, clave LRE, bitácora y pruebas. | Pruebas en verde; la extensión ya puede conectarse. |
| **2. Extensión: contratos** | Panel, detección de empresa y etapa, llenado de las 4 etapas, comparación de nombre, comprobante y marcar registrado. Persona natural y empresa. | Piloto con tu empresa: registrar contratos reales pendientes. |
| **3. Anexos y términos** | Mismo flujo (y teletrabajo si tiene módulo propio). | Piloto con anexos y términos reales. |
| **4. LRE** | Descarga y carga del archivo, lectura del estado en el historial y recordatorio del día 15. | Primer LRE cargado con la extensión. |
| **5. Publicación** | Chrome Web Store y Edge Add-ons, primero **sin listar** (solo con enlace) para el piloto y después pública. Manual, landing y briefing. | Disponible para clientes. |
| Después | Finiquito electrónico en Mi DT (ya existe su ficha) y registro masivo, si se valida la plantilla. | — |

## 7. Pruebas

- **Copias locales de las pantallas de Mi DT**, hechas con la Fase 0 (sin datos personales). La extensión se prueba contra ellas con Playwright, que carga la extensión en Chromium, junto al backend e2e de siempre.
- Pruebas unitarias del mapeo y del llenado (fechas, selecciones, radios, eventos de React).
- **Piloto real con tu empresa:** Mi DT no tiene ambiente de pruebas, así que las primeras pruebas finales serán registros reales que igual había que hacer.
- CI: un trabajo nuevo de lint, pruebas y compilación de la extensión.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Mi DT cambia sus formularios | Mapeo como datos (se corrige sin publicar), verificación previa y respaldo con la ficha para copiar |
| La DT objeta la automatización | La persona entra y presiona el botón final; no se usa la Clave Única ni la API interna. Lo explicamos en la solicitud de reconocimiento (Etapa D) y nos detenemos si lo pide |
| Las tiendas rechazan o demoran la revisión | Un solo propósito, permisos mínimos justificados, política de privacidad y piloto sin listar |
| Solo funciona en computador (Chrome/Edge) | La ficha con botones para copiar sigue disponible en cualquier equipo |
| Llenar en la empresa equivocada | Verificación del RUT del empleador antes de llenar y comparación del nombre del trabajador |

## 9. Lo que necesito de ti

1. **Aprobar** el plan, el orden de las fases y el principio de que la persona presiona el botón final.
2. **Una sesión de levantamiento:** con tu Clave Única (yo no la veo) instalas la versión de desarrollo, recorres cada formulario sin enviar nada y me mandas el archivo de estructura.
3. **Cuenta de desarrollador de Chrome Web Store** (US$5, pago único) a nombre de Fehu; Edge Add-ons es gratis.
4. **Definir el plan comercial.** Recomendación: contratos, anexos y términos en todos los planes (es cumplimiento básico y nos distingue), y el LRE desde Pyme, como hoy.
5. **Contratos reales pendientes de registro** en tu empresa para el piloto.
