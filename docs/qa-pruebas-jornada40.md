# Jornada40 — Pruebas y control de calidad (QA)

> **Qué es este documento.** Inventario de **todos los tipos de prueba** que se aplican a Jornada40: qué cubre cada uno, con qué herramienta, cuándo corre y qué falta todavía. Las cifras se midieron en el código y en ejecuciones reales el **11 de octubre de 2026**, después de aplicar las mejoras rápidas de QA de ese día.
>
> **Dos versiones del sistema:**
> - **`main`:** lo que está en producción en jornada40.cl.
> - **Rama de desarrollo:** lo de `main` más la extensión para Mi DT y las mejoras de QA de esta revisión, que hoy están en pruebas (staging). Entre esas mejoras están las **dependencias corregidas por seguridad**, que llegan a producción con la próxima publicación en `main`.
>
> Complementa la sección 7 del dossier (`docs/dossier-jornada40.md`).

---

## 1. Resumen

**Cómo se hace QA hoy.** No hay un equipo de QA separado.
- Cada cambio se escribe junto con sus pruebas automáticas, que corren en cada envío al repositorio (integración continua).
- Antes de publicar en producción, se revisa en un entorno de pruebas (staging) con base de datos propia y pagos en sandbox.
- Al publicar, se hace una verificación en producción.

| Tipo de prueba | Herramienta | En `main` | En la rama | Corre |
|---|---|---|---|---|
| Servidor: API, cálculos legales, seguridad, formatos oficiales | Django `APITestCase` | **512 pruebas** (38 archivos) | **530 pruebas** (40 archivos) | Cada envío (CI) |
| Cobertura del servidor | coverage.py | No se medía | **83,1 %** de las líneas (CI exige ≥ 80 %) | Cada envío (CI) |
| Unitarias de la interfaz | Vitest + Testing Library | **32 casos** (9 archivos) | **61 casos** (14 archivos), con cobertura y mínimos | Cada envío (CI) |
| De extremo a extremo (navegador) | Playwright (Chromium) | **54 recorridos** (11 áreas) | **59 recorridos** (13 áreas) | Cada envío (CI), tras las anteriores |
| Accesibilidad | axe (WCAG 2.1 A y AA) | — | **21 pantallas, 0 problemas** | Con los recorridos |
| Análisis estático | TypeScript estricto + ESLint; **ruff** y **bandit** (seguridad, Python) | TypeScript y ESLint | Más ruff, bandit y la extensión | Cada envío (CI) |
| Avisos de seguridad en dependencias | pip-audit, npm audit, **Dependabot** | — | **0 avisos conocidos** | Cada envío y cada lunes |
| Compilación de producción | `tsc -b && vite build` | Sí | Más los ZIP de la extensión | Cada envío (CI) |
| Migraciones de base de datos al día | `makemigrations --check` | Sí | Sí | Cada envío (CI) |
| Alertas de errores en producción | Correo sin datos personales | — | Listo (se activa al publicar) | Permanente |
| Aceptación en staging | Manual (titular) | Antes de publicar | Piloto de la extensión con Mi DT real | Por versión |
| Pagos en sandbox | Manual (Reveniu sandbox) | Hecho | — | Por cambio en pagos |
| Verificación en producción | Manual y por comandos | Tras cada publicación | — | Por publicación |
| Revisión interna de seguridad | Manual | Hecha (oct. 2026) | — | Periódica |

**Estado al 11-10-2026 (rama de desarrollo):**
- Servidor: 530/530, con 83,1 % de cobertura. Ruff y bandit sin hallazgos y migraciones al día.
- Unitarias: 61/61, con sus mínimos de cobertura. Lint y compilación sin errores.
- Dependencias de producción: sin avisos conocidos (pip-audit y npm audit).
- Recorridos de navegador: 59/59, incluidos los 2 de accesibilidad.
- `main` (producción): 512/512 del servidor.

---

## 2. Pruebas automáticas

### 2.1 Pruebas del servidor (API, integración y reglas de negocio)

Cada prueba llama a la API como lo haría la aplicación y verifica la respuesta, los datos guardados y los efectos (correos, PDF, bitácora). Corren sobre una base de datos de prueba que se crea y se destruye en cada ejecución, en paralelo.

**Cobertura por área** (métodos de prueba en `main`; la rama suma los de la extensión y los de las alertas):

| Área | Archivos (métodos) | Qué verifican |
|---|---|---|
| **Cálculos de remuneraciones** | liquidaciones (53), parámetros (35), asignación familiar (6), horas compensatorias (5), indemnización a todo evento (2) | Gratificación con tope, horas extra, AFP, salud, cesantía e impuesto único; parámetros congelados por período; tramos de asignación familiar; bolsa de horas, tope y vencimiento; aporte del Art. 164 |
| **Jornada, feriado y término** | jornada (22), feriado (9), finiquito (20) | Jornada máxima de la Ley 40 horas por fecha; días hábiles y feriados de Chile; finiquito con años de servicio, aviso, feriado proporcional y fueros |
| **Documentos y firma** | documentos laborales (20), firmas (19), certificados (15), reglamento (7), seguridad laboral (5) | Pactos, permisos y constancias desde listas cerradas; ciclo de firma (envío, código, aceptación, rechazo, vencimiento, versión firmada); certificados con código verificable y anulación; reglamento, EPP y riesgos |
| **Ley Karin** | denuncias Karin (18), acceso Karin (9), Ley Karin (4) | Plazos del DS 21, derivación a la DT, expediente y documentos, reserva por rol en el portal, avisos de represalias, cifrado, acceso aislado |
| **Archivos oficiales** | Previred (6), LRE (6), certificado N°6 SII (6), Dirección del Trabajo (15) | Formato y contenido del archivo Previred (105 campos) y del LRE (plantilla oficial de 147 columnas); certificados y resumen DJ 1887; plazos y ficha de registro en Mi DT |
| **Pagos y suscripciones** | pagos (37) | Avisos de pago de Reveniu, cambios y bajas de plan, ciclo anual y mensual, renovaciones, reanudar, cupos de trabajadores |
| **Portales** | portal del trabajador (20), peticiones (10), solicitudes de documentos (13), estado del portal (3), fiscalización DT (10) | Ingreso con código o clave; qué ve cada cuenta; solicitudes y peticiones con sus reglas; acceso del fiscalizador con correo institucional |
| **Seguridad y accesos** | seguridad (24), cuentas (32), permisos del equipo (7), equipo (5), permisos (2), sesión por inactividad (5), bitácora (6) | Detalle en la sección 3 |
| **Gestión y panel** | trabajadores (19), revisión del panel (12), protecciones especiales (8), direcciones (4), resumen por correo (7) | Alta y edición de trabajadores; avisos de fuero y cuidado de personas; direcciones por partes; contenido del resumen por correo |
| **Extensión para Mi DT** (solo rama) | extensión (12) | Código de un solo uso, token acotado, permisos del equipo, marcar registrado, levantamiento sin datos, mapeos coherentes con las fichas |
| **Alertas de errores** (solo rama) | alertas (5) | El correo trae la ruta y el recorrido del código, pero nunca RUT, montos, correos ni parámetros; un aviso por error y por hora; un error no controlado también avisa |

**Cobertura (rama, 11-10-2026): 83,1 % de las líneas del servidor.** CI falla si baja del 80 %.
- Los cálculos legales están entre 88 % y 98 %: liquidación, parámetros, feriado, horas compensatorias, Previred, LRE y finiquitos.
- Los permisos del equipo están al 100 %.
- Lo menos cubierto son algunos comandos de administración y las vistas de contratos y de trabajadores (40–48 %), que se prueban sobre todo con los recorridos de navegador.

**Sin internet.** Ninguna prueba del servidor sale a internet:
- mindicador.cl (UF y UTM) se simula para toda la suite con valores fijos;
- B2, Reveniu y Gemini se simulan en cada prueba;
- si una prueba intenta otra conexión real, falla con un mensaje que dice qué simular.

Antes de esta revisión, 45 pruebas dependían sin saberlo del valor real de la UF del día.

**Cómo se aíslan de servicios externos** (simulación con `unittest.mock`):

| Servicio | Qué se simula |
|---|---|
| Backblaze B2 | Subir, descargar y eliminar documentos |
| Reveniu | API de suscripciones, cambio de monto, renovación y configuración |
| Correo | Django guarda los correos en memoria; más de 55 verificaciones revisan destinatario y contenido |
| Google Gemini | Lectura de contratos (digitalización) |
| Indicadores UF y UTM | mindicador.cl simulado para toda la suite, con los mismos valores que `@indicadores_fijos` |
| Reloj | Vencimientos de sesiones, códigos y cookies firmadas |

**Otras características:**
- **PDF:** las pruebas de 14 archivos generan PDF y verifican que sean válidos. En 3 de ellos se lee el texto para comprobar el contenido: la página de certificado de la firma, el reglamento adjunto a la constancia y la ratificación en terreno.
- **Migraciones de datos:** se prueban las que transforman datos de clientes:
  - consolidación de planes (0052);
  - separación de cuentas mezcladas del portal (0100).
- **Fechas:** la lógica de calendario se prueba con fechas fijas, por ejemplo un permiso por fallecimiento en día inhábil.
- **Independencia entre pruebas:** las que usan endpoints con límite de intentos limpian los contadores al empezar, para que el resultado no dependa del orden.

### 2.2 Pruebas unitarias de la interfaz

Con Vitest y Testing Library sobre un DOM simulado (jsdom).

| Archivo | Casos | Qué verifica |
|---|---|---|
| `api/client.test.ts` | 7 | Al vencer la sesión renueva una sola vez y reintenta; si no puede, vuelve al login; ante 428 pide confirmar identidad y repite |
| `components/j40/CierreInactividad.test.tsx` | 4 | Aviso un minuto antes y cierre a los 5 minutos; "Seguir trabajando" reinicia el plazo; la actividad renueva la sesión; al volver después del plazo, cierra de inmediato |
| `utils/rutUtils`, `formato`, `ley40`, `contrasena`, `codigos`, `borradores`, `cargaDiferida` | 21 | RUT chileno (dígito verificador), formatos de fecha y moneda, etapas de la Ley 40 horas, reglas de contraseña, códigos de verificación, borradores locales, recarga tras una publicación |
| **Extensión** (solo rama): `levantar`, `llenar`, `mapeo`, `textos`, `panel/util` | 29 | El levantamiento nunca incluye lo escrito ni RUT o correos; el llenado funciona sobre un formulario React real; si falta un campo no llena nada; reconoce el éxito sin leer el código de la página; mapeos, fechas y nombres |

**Cobertura** (`npm run test:cobertura`, rama):
- utilidades 83,1 % y lógica de la extensión 86,4 %; CI exige al menos 75 % y 80 %;
- 5,1 % del total del frontend, porque las pantallas se prueban con los recorridos de navegador y no con estas pruebas.

CI publica el desglose en la página de cada ejecución.

### 2.3 Pruebas de extremo a extremo (navegador)

Con Playwright, en Chromium, contra el **sistema completo**: backend real con su propia base SQLite y frontend real.

- **Datos:** cada área parte de una base semilla (1 titular, 2 empresas, 4 trabajadores, liquidaciones y firmas) que se restaura antes de empezar.
- **Base de datos:** SQLite configurada para varias solicitudes a la vez (WAL, transacciones IMMEDIATE y espera de 30 s). Ver sección 5.
- **Entorno:** zona horaria America/Santiago e idioma es-CL. Las fechas son relativas al día de la ejecución.
- **Pantallas:** escritorio 1440×1000 y móvil 375×812 y 390×844, para comprobar que no haya desborde horizontal.
- **Servicios externos simulados:** almacenamiento e indicadores. Los códigos que se enviarían por correo se escriben en un archivo que lee la prueba.
- **Si una prueba falla:** se guardan la traza, las capturas de pantalla y un informe HTML (artefacto de CI). En CI se reintenta una vez.

**Recorridos por área** (54 en `main`; la rama suma los 3 de la extensión y los 2 de accesibilidad):

| Área | Recorridos |
|---|---|
| Panel (9) | Inicio con lo que requiere atención; lista de trabajadores y carpeta; descargas; edición de datos; navegación y buscador; direcciones antiguas; móvil sin desborde; renovación automática de la sesión; alta Art. 22 con aviso de lo que falta |
| Gestión (9) | Editor de contrato con avisos de jornada; anexos y documentos legales; vacaciones con días hábiles del servidor; finiquito calculado; desvincular y reactivar; importación desde Excel con revisión; expedientes ZIP y reportes; empresa, plan y cuenta; segunda empresa |
| Remuneraciones (7) | Liquidación con vista previa del servidor; recargo bajo el mínimo legal rechazado; emisión masiva y archivos del período; LRE que exige todas las liquidaciones; liquidación firmada no modificable; conceptos; Certificado N°6, ZIP y DJ 1887 |
| Firma (5) | Firma del empleador y envío; firma desde el teléfono; identidad con la clave del portal; rechazo con motivo; el panel refleja firmas y rechazos |
| Portal del trabajador (7) | Ingreso con código y luego con clave; teléfono sin desborde; firma de una liquidación desde Inicio; solicitud de documentos atendida; certificado verificado por un tercero; estado del portal e invitación; peticiones de vacaciones y teletrabajo respondidas |
| Ley Karin (6) | Designación del encargado y su acceso reservado; registro y avance del expediente; el titular solo ve cifras; la afectada ve su caso en el portal; denuncia desde el portal; actividad sin detalle para el titular |
| Pactos (3) | Horas extra y permiso legal; teletrabajo y Art. 164; revocación de un descuento firmado |
| Reglamento (3) | Plantilla por rubro, versión, remisión y entrega; canal Ley Karin y aviso semestral; EPP e información de riesgos |
| Dirección del Trabajo (2) | Plazos, ficha y constancia de registro; consentimiento para documentos electrónicos |
| Equipo (2) | Invitación y acceso solo a su sección; bitácora y copia verificable |
| Fiscalización (1) | El inspector entra, descarga y ratifica; el empleador ve la bitácora |
| **Extensión para Mi DT** (3, solo rama) | Compila la extensión, la carga en Chromium y la prueba contra una copia local de Mi DT: conectar, llenar una etapa, verificar el nombre y marcar registrado; levantamiento sin datos escritos; desconexión desde Jornada40 |
| **Accesibilidad** (2, solo rama) | axe (WCAG 2.1 A y AA) en 21 pantallas: 9 públicas, la firma del trabajador y 11 del panel. Falla ante cualquier problema nuevo |

**Accesibilidad.** La primera revisión con axe (11-10-2026) encontró un solo tipo de problema: contraste de color insuficiente, en 90 elementos. 84 eran el gris del texto terciario sobre fondos grises (4,0–4,4:1, cuando se exige 4,5:1). Se corrigió en el token de diseño (`--j40-text-3`, ahora #5f6a7a) y en el calendario de la Ley 40 horas del sitio. El logotipo queda fuera del contraste, porque WCAG exime a los logotipos. Hoy: 0 problemas en las 21 pantallas.

### 2.4 Análisis estático y compilación

- **TypeScript en modo estricto,** con opciones adicionales: variables y parámetros sin uso, `switch` sin caídas y solo sintaxis borrable. Cubre el frontend y, en la rama, la extensión.
- **ESLint:** reglas recomendadas de JavaScript y TypeScript, reglas de los hooks de React (incluidas las del compilador de React) y React Refresh.
- **Ruff (Python, rama):** detecta nombres indefinidos o sin uso, importaciones mal puestas, errores de sintaxis y errores comunes (bugbear); respeta el estilo propio del código (`backend/ruff.toml`). La primera pasada corrigió:
  - 10 variables sin uso;
  - un `except` sin tipo;
  - importaciones fuera de lugar;
  - 4 funciones que tomaban la variable del ciclo y hoy se fijan explícitamente.
- **Bandit (seguridad, rama):** análisis estático de seguridad del código Python. CI falla ante un hallazgo de gravedad y confianza media o alta. La primera pasada dio dos falsos positivos: SQL armado con nombres de tablas que salen de los modelos, no de un usuario. Quedaron marcados con su justificación.
- **Compilación de producción** en cada envío. En la rama también se compilan los ZIP de la extensión para staging y producción.
- **Migraciones:** CI falla si un cambio en los modelos no trae su migración.

### 2.5 Integración continua (GitHub Actions)

En cada envío y pull request (rama de desarrollo) corren cuatro trabajos:
1. **Backend:** ruff, bandit, migraciones al día y la suite del servidor en paralelo con cobertura. El resumen de cobertura sale en la página de la ejecución.
2. **Frontend:** lint, pruebas unitarias con cobertura y mínimos, compilación y los ZIP de la extensión.
3. **Dependencias:** pip-audit y npm audit de las dependencias de producción. No frena los recorridos.
4. **Recorridos de navegador**, incluida la accesibilidad: solo si backend y frontend pasan.

Además, CI corre solo cada lunes en la rama principal, para que un aviso de seguridad nuevo en una dependencia aparezca aunque no haya cambios. **Dependabot** propone cada semana las actualizaciones agrupadas (Python, JavaScript y acciones de GitHub).

El despliegue no depende técnicamente de CI: Railway publica `main` y Vercel el frontend al recibir el envío. La práctica es publicar en `main` solo con las suites en verde; así se hizo en las publicaciones de octubre de 2026.

---

## 3. Pruebas de seguridad

**Automáticas** (en la suite del servidor):
- **Aislamiento entre clientes:** un usuario no puede ver, editar ni borrar trabajadores ni empresas de otro. Tampoco puede crear trabajadores, contratos, vacaciones ni documentos en empresas ajenas.
- **Autenticación obligatoria** en todos los endpoints privados.
- **Límite de intentos:**
  - login, registro y recuperación responden 429 al exceder el límite;
  - la IP real del visitante no se puede falsear con encabezados.
- **Campos protegidos:** el dueño de una empresa y la fecha de creación no se pueden modificar.
- **Permisos del equipo:**
  - una prueba recorre **todas las rutas de la API** con un usuario de solo lectura y comprueba que nada más se abre y nada se escribe;
  - las rutas exclusivas del titular siguen cerradas aunque el usuario tenga todos los módulos.
- **Aislamiento de accesos:** las sesiones del panel, de Ley Karin, del portal del trabajador y de fiscalización no se abren entre sí.
- **Sesiones:** vencen por inactividad, se renuevan sin pasar el tope absoluto y las cookies antiguas no sirven.
- **Cifrado de Ley Karin:** cifrado, descifrado y rotación de claves, incluido el comando de rotación.
- **Bitácora:** la verificación detecta un registro alterado o borrado.
- **Firma:**
  - el código se guarda solo como huella;
  - hay un tope de códigos por hora y de intentos con la clave del portal;
  - la clave de otra persona con el mismo RUT no sirve;
  - firmar exige la aceptación expresa;
  - el empleador debe confirmar su clave antes de enviar, y queda registrado como emisor.
- **Concurrencia:** una segunda petición simultánea no puede duplicar una firma (la solicitud se reserva antes de procesarla).
- **Portal:** cada cuenta ve solo las fichas cuyo correo verificó (corrección del 8-10-2026, con su prueba de regresión).
- **Extensión** (solo rama):
  - el token solo abre las rutas de la extensión;
  - la sesión del panel no las abre;
  - el levantamiento descarta valores y tapa RUT y correos.

**Dependencias (revisión del 11-10-2026).** La primera auditoría encontró avisos de seguridad conocidos en 12 paquetes de Python y 4 de JavaScript usados en producción. Todos se actualizaron en la rama, sin cambiar de serie (Django sigue en la 5.2, de soporte extendido), y las suites pasan completas.
- **Python:** Django 5.2.17, Django REST Framework 3.17.2, pypdf 6.19.0, Pillow 12.3.0, PyJWT 2.15.0 y cryptography 50.0.0, entre otros.
- **JavaScript:** axios 1.20.0, react-router 7.18.4, pdf.js 6.4.299 y SheetJS 0.20.3. SheetJS se instala desde su CDN oficial, porque ya no publica en npm.
- **Los recorridos detectaron un cambio de SheetJS 0.20:** en Node ya no carga el sistema de archivos por su cuenta. Afectaba solo a la prueba que arma el Excel de importación, y se ajustó. La aplicación lo usa en el navegador, donde no cambia nada.
- **El más importante, pdf.js:** la versión anterior permitía ejecutar JavaScript al abrir un PDF malicioso. La página de firma del trabajador muestra con pdf.js documentos que pueden incluir un PDF subido por el empleador (el reglamento interno), así que era un riesgo real. **Producción sigue con las versiones vulnerables hasta que estas actualizaciones lleguen a `main`.**

**Manuales:** revisión interna de seguridad en octubre de 2026. Detectó que las cuentas del portal se compartían por RUT; se corrigió en producción al día siguiente de publicarse, con migración de datos y pruebas.

**Alertas de errores** (rama, se activan al publicar en `main`):
- cada error del servidor (no controlado o capturado) manda un correo al equipo (`ALERTAS_ERRORES_EMAIL`; en producción, por defecto el correo de contacto);
- el correo trae la hora, la ruta sin parámetros, el tipo de error y el recorrido del código, **nunca** el texto de la excepción ni datos de personas;
- un mismo error se avisa una vez por hora, con un máximo de 20 avisos por hora.

---

## 4. Pruebas manuales y de aceptación

- **Entorno de pruebas (staging):** réplica del sistema con base de datos propia, pagos en sandbox y dominio propio. El titular prueba ahí cada versión antes de publicarla. Ejemplo: la extensión para Mi DT se probó con una sesión real de Mi DT. Así se detectaron datos que faltaban en la etapa 3 del contrato y se corrigieron el mismo día.
- **Pagos en sandbox de Reveniu:** se verificaron la paginación de planes, el cambio de monto en una baja de plan y el comportamiento de "reanudar". La inscripción de la tarjeta solo se puede probar a mano, porque Transbank bloquea los navegadores automatizados.
- **Verificación en producción tras publicar** (7 y 8 de octubre de 2026): migraciones aplicadas, endpoints nuevos respondiendo como corresponde y frontend nuevo publicado.
- **Contraste con fuentes y cuentas reales:**
  - plantilla del LRE descargada de Mi DT;
  - formulario individual de Mi DT revisado con una cuenta real;
  - formato Previred según el documento oficial (versión 100);
  - textos legales (DS 21, dictámenes y ordinarios de la DT).
- **Revisión visual y responsiva:** en cambios de diseño se toman capturas automáticas a varios anchos (por ejemplo, de 320 a 1440 px para la cabecera del sitio y a 380 px para el panel de la extensión), además de las pruebas automáticas de desborde en móvil.

---

## 5. Prácticas de calidad

- **Cada error corregido deja una prueba que lo reproduce** (regresión). Ejemplos:
  - el permiso por fallecimiento en día inhábil;
  - las cuentas del portal;
  - en la extensión, un aviso de éxito que aparecía antes de tiempo.
- **Los fallos intermitentes se investigan hasta la causa.** La descarga de la bitácora que falló una vez (11-10-2026) se debía a dos solicitudes que escribían a la vez en SQLite: una fallaba al instante con "database is locked". Al reproducirlo aparecieron también registros de bitácora que se perdían en el entorno de pruebas, por la misma causa (16 bloqueos en 12 recorridos). Se configuró SQLite para varias solicitudes a la vez, también en desarrollo local, y el resultado fue 0 bloqueos. Producción usa PostgreSQL y no tiene este problema.
- **Ninguna prueba sale a internet** (sección 2.1): el resultado no depende de servicios de terceros.
- **Cálculos solo en el servidor:** como la interfaz nunca calcula montos legales, las pruebas del servidor cubren todos los cálculos que ve el usuario.
- **Avisos, nunca bloqueos:** las pruebas verifican tanto que el aviso aparece como que la operación igual se permite cuando la ley no lo prohíbe.
- **Datos de prueba sembrados y restaurados** en cada área de los recorridos; fechas relativas para que las pruebas sigan válidas con el paso del tiempo.

---

## 6. Brechas: lo que todavía no se hace

Resuelto en esta revisión (en la rama): medición de cobertura, auditoría de dependencias y Dependabot, linter de Python, análisis estático de seguridad (bandit), dependencia de mindicador.cl, recorrido intermitente, accesibilidad automática con axe y alertas de errores.

| Brecha | Comentario |
|---|---|
| **Publicar las correcciones en producción** | Las dependencias corregidas, las alertas y lo demás están en la rama y en staging. Producción tiene las versiones con avisos (entre ellas pdf.js) hasta la próxima publicación en `main`. |
| **Activar Dependabot** | Funciona cuando `.github/dependabot.yml` llega a la rama principal. Las actualizaciones de seguridad inmediatas se activan en GitHub (Settings → Code security → Dependabot security updates). |
| **Pruebas de carga y rendimiento** | No hay mediciones bajo carga (por ejemplo, emisión masiva de liquidaciones o PDF). |
| **Pentest o auditoría externa de seguridad** | Solo hay revisión interna y pruebas automáticas. |
| **Política de seguridad de contenido (CSP)** | El sitio no envía el encabezado `Content-Security-Policy`, que limitaría qué scripts pueden ejecutarse. |
| **Navegadores y dispositivos** | Los recorridos corren solo en Chromium (no en Firefox ni Safari), y el móvil se prueba por tamaño de pantalla, no en dispositivos reales. |
| **Auditoría formal de accesibilidad** | axe revisa automáticamente WCAG 2.1 A y AA. Una auditoría manual (lector de pantalla, teclado) no se ha hecho. |
| **Monitoreo completo** | Las alertas por correo cubren los errores del servidor. No hay panel de errores ni registro de errores del navegador (tipo Sentry). |
| **Respaldos y su restauración** | Los respaldos automáticos están pendientes; por lo tanto, tampoco se ha probado restaurar. |
| **Revisión legal externa** | Pendiente para plantillas (reglamento, Ley Karin, pactos). |
| **Verificación con cargas reales** | Pendientes dos formatos: los campos de indemnización a todo evento en Previred y el registro masivo de contratos en Mi DT. |

---

## 7. Próximos pasos recomendados (por costo y beneficio)

1. **Ya (con autorización del titular):**
   - publicar en `main` las dependencias corregidas y las alertas de errores (seguridad);
   - activar las actualizaciones de seguridad de Dependabot en GitHub.
2. **Operacionales (semanas):**
   - respaldos automáticos con un **simulacro de restauración** periódico;
   - encabezado CSP;
   - recorridos también en Firefox y WebKit;
   - una línea base de rendimiento de los endpoints pesados (emisión masiva, ZIP, PDF).
3. **Antes de escalar (con financiamiento):**
   - pentest externo;
   - revisión legal externa de plantillas;
   - auditoría manual de accesibilidad;
   - panel de errores con registro del navegador;
   - formalizar QA (plan de pruebas por versión y responsable de aceptación).
