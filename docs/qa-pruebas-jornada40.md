# Jornada40 — Pruebas y control de calidad (QA)

> **Qué es este documento.** Inventario de **todos los tipos de prueba** que se aplican a Jornada40: qué cubre cada uno, con qué herramienta, cuándo corre y qué falta todavía. Las cifras se midieron en el código y en ejecuciones reales el **11 de octubre de 2026**.
>
> **Dos versiones del sistema:**
> - **`main`:** lo que está en producción en jornada40.cl.
> - **Rama de desarrollo:** lo de `main` más la extensión para Mi DT y otras mejoras que hoy están en pruebas (staging).
>
> Complementa la sección 7 del dossier (`docs/dossier-jornada40.md`).

---

## 1. Resumen

**Cómo se hace QA hoy.** No hay un equipo de QA separado.
- Cada cambio se escribe junto con sus pruebas automáticas, que corren en cada envío al repositorio (integración continua).
- Antes de publicar en producción, se revisa en un entorno de pruebas (staging) con base de datos propia y pagos en sandbox.
- Al publicar, se hace una verificación en producción.

| Tipo de prueba | Herramienta | Cantidad en `main` | Cantidad en la rama | Corre |
|---|---|---|---|---|
| Servidor: API, cálculos legales, seguridad, formatos oficiales | Django `APITestCase` | **512 pruebas** (506 métodos, 38 archivos) | **525 pruebas** (519 métodos, 39 archivos) | Cada envío (CI) |
| Unitarias de la interfaz | Vitest + Testing Library | **32 casos** (9 archivos) | **61 casos** (14 archivos; 29 de la extensión) | Cada envío (CI) |
| De extremo a extremo (navegador) | Playwright (Chromium) | **54 recorridos** (11 áreas) | **57 recorridos** (12 áreas) | Cada envío (CI), tras las anteriores |
| Análisis estático | TypeScript estricto + ESLint | Todo el frontend | Más la extensión | Cada envío (CI) |
| Compilación de producción | `tsc -b && vite build` | Sí | Más los ZIP de la extensión | Cada envío (CI) |
| Migraciones de base de datos al día | `makemigrations --check` | Sí | Sí | Cada envío (CI) |
| Aceptación en staging | Manual (titular) | Antes de publicar | Piloto de la extensión con Mi DT real | Por versión |
| Pagos en sandbox | Manual (Reveniu sandbox) | Hecho | — | Por cambio en pagos |
| Verificación en producción | Manual y por comandos | Tras cada publicación | — | Por publicación |
| Revisión interna de seguridad | Manual | Hecha (oct. 2026) | — | Periódica |

**Estado al 11-10-2026:** todas las suites automáticas en verde.
- Rama de desarrollo: 525/525 del servidor y 61/61 unitarias; lint y compilación sin errores. Los 57 recorridos de navegador se estaban ejecutando al cerrar este documento.
- `main` (producción): 512/512 del servidor.

---

## 2. Pruebas automáticas

### 2.1 Pruebas del servidor (API, integración y reglas de negocio)

Cada prueba llama a la API como lo haría la aplicación y verifica la respuesta, los datos guardados y los efectos (correos, PDF, bitácora). Corren sobre una base de datos de prueba que se crea y se destruye en cada ejecución.

**Cobertura por área** (métodos de prueba en `main`; la rama suma los de la extensión):

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

**Cómo se aíslan de servicios externos** (simulación con `unittest.mock`):

| Servicio | Qué se simula |
|---|---|
| Backblaze B2 | Subir, descargar y eliminar documentos |
| Reveniu | API de suscripciones, cambio de monto, renovación y configuración |
| Correo | Django guarda los correos en memoria; 55 verificaciones en 12 archivos revisan destinatario y contenido |
| Google Gemini | Lectura de contratos (digitalización) |
| Indicadores UF y UTM | Valores fijos (`@indicadores_fijos`) |
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

### 2.3 Pruebas de extremo a extremo (navegador)

Con Playwright, en Chromium, contra el **sistema completo**: backend real con su propia base SQLite y frontend real.

- **Datos:** cada área parte de una base semilla (1 titular, 2 empresas, 4 trabajadores, liquidaciones y firmas) que se restaura antes de empezar.
- **Entorno:** zona horaria America/Santiago e idioma es-CL. Las fechas son relativas al día de la ejecución.
- **Pantallas:** escritorio 1440×1000 y móvil 375×812 y 390×844, para comprobar que no haya desborde horizontal.
- **Servicios externos simulados:** almacenamiento e indicadores. Los códigos que se enviarían por correo se escriben en un archivo que lee la prueba.
- **Si una prueba falla:** se guardan la traza, las capturas de pantalla y un informe HTML (artefacto de CI). En CI se reintenta una vez.

**Recorridos por área** (54 en `main`; la rama suma los 3 de la extensión):

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

### 2.4 Análisis estático y compilación

- **TypeScript en modo estricto,** con opciones adicionales: variables y parámetros sin uso, `switch` sin caídas y solo sintaxis borrable. Cubre el frontend y, en la rama, la extensión.
- **ESLint:** reglas recomendadas de JavaScript y TypeScript, reglas de los hooks de React (incluidas las del compilador de React) y React Refresh.
- **Compilación de producción** en cada envío. En la rama también se compilan los ZIP de la extensión para staging y producción.
- **Migraciones:** CI falla si un cambio en los modelos no trae su migración.

### 2.5 Integración continua (GitHub Actions)

En cada envío y pull request corren tres trabajos:
1. **Backend:** instala dependencias, verifica migraciones y ejecuta la suite del servidor.
2. **Frontend:** lint, pruebas unitarias y compilación (y en la rama, los ZIP de la extensión como artefacto).
3. **Recorridos de navegador:** solo si los dos anteriores pasan.

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

**Manuales:** revisión interna de seguridad en octubre de 2026. Detectó que las cuentas del portal se compartían por RUT; se corrigió en producción al día siguiente de publicarse, con migración de datos y pruebas.

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
- **Cálculos solo en el servidor:** como la interfaz nunca calcula montos legales, las pruebas del servidor cubren todos los cálculos que ve el usuario.
- **Avisos, nunca bloqueos:** las pruebas verifican tanto que el aviso aparece como que la operación igual se permite cuando la ley no lo prohíbe.
- **Datos de prueba sembrados y restaurados** en cada área de los recorridos; fechas relativas para que las pruebas sigan válidas con el paso del tiempo.

---

## 6. Brechas: lo que todavía no se hace

| Brecha | Comentario |
|---|---|
| **Medición de cobertura de código** | No se mide qué porcentaje del código ejecutan las pruebas. |
| **Pruebas de carga y rendimiento** | No hay mediciones bajo carga (por ejemplo, emisión masiva de liquidaciones o PDF). |
| **Pentest o auditoría externa de seguridad** | Solo hay revisión interna y pruebas automáticas. |
| **Escaneo de vulnerabilidades en dependencias** | No hay Dependabot, pip-audit ni npm audit en CI. |
| **Análisis estático de seguridad (SAST) y linter de Python** | No están en CI. |
| **Navegadores y dispositivos** | Los recorridos corren solo en Chromium (no en Firefox ni Safari), y el móvil se prueba por tamaño de pantalla, no en dispositivos reales. |
| **Accesibilidad** | Las pruebas usan roles y etiquetas accesibles, pero no hay auditoría formal (WCAG). |
| **Monitoreo de errores en producción** | No hay un servicio de alertas de errores (tipo Sentry); los errores quedan en los registros del servidor. |
| **Respaldos y su restauración** | Los respaldos automáticos están pendientes; por lo tanto, tampoco se ha probado restaurar. |
| **Dependencia externa en la suite** | Durante la suite del servidor hay 4 consultas reales al servicio público de indicadores (mindicador.cl). Si ese servicio falla, CI podría fallar sin que el código tenga un error. |
| **Revisión legal externa** | Pendiente para plantillas (reglamento, Ley Karin, pactos). |
| **Verificación con cargas reales** | Pendientes dos formatos: los campos de indemnización a todo evento en Previred y el registro masivo de contratos en Mi DT. |

---

## 7. Próximos pasos recomendados (por costo y beneficio)

1. **Rápidos (días):**
   - medir cobertura en CI;
   - Dependabot y auditoría de dependencias;
   - linter de Python;
   - simular las 4 consultas a mindicador.cl;
   - axe (accesibilidad) dentro de los recorridos de Playwright;
   - monitoreo de errores en producción.
2. **Operacionales (semanas):**
   - respaldos automáticos con un **simulacro de restauración** periódico;
   - recorridos también en Firefox y WebKit;
   - una línea base de rendimiento de los endpoints pesados (emisión masiva, ZIP, PDF).
3. **Antes de escalar (con financiamiento):**
   - pentest externo;
   - revisión legal externa de plantillas;
   - auditoría de accesibilidad;
   - formalizar QA (plan de pruebas por versión y responsable de aceptación).
