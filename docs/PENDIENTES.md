# Pendientes de Jornada40

Lista viva de lo que falta hacer fuera del código (configuración, trámites) o que quedó en espera.
Cuando se pregunte por los pendientes, se responde desde aquí. Al completar algo, se marca con [x] y fecha.

## Antes de publicar en `main` (producción)

La publicación quedó en pausa el 2026-10-06 hasta completar estos puntos en el entorno **production** de Railway; se publicó en `main` el 2026-10-07 con los que están marcados:

- [ ] **Respaldo de la base de datos de producción** — *pospuesto: se publicó el 2026-10-07 sin respaldo, por decisión del titular, hasta tener el plan Pro de Railway (pestaña Backups del servicio Postgres). Mientras tanto se puede hacer gratis con `pg_dump`.* (Railway → Postgres → Backups, o `pg_dump` con `DATABASE_PUBLIC_URL`). Guardarlo fuera de Railway (bucket privado de B2 solo para respaldos + copia local). Al publicar se aplican las migraciones 0064 a 0098 (incluye separar direcciones y normalizar bancos).
- [x] (2026-10-07) **`KARIN_CLAVES_CIFRADO`** con una clave Fernet nueva (distinta a la de staging), guardada en un gestor de contraseñas. Si se pierde, se pierden las denuncias Ley Karin.
- [x] (2026-10-07) **`DEFAULT_FROM_EMAIL`** con una dirección @jornada40.cl (dominio verificado en Resend).
- [x] (2026-10-07) **`SITIO_URL=https://jornada40.cl`**.
- [x] (2026-10-07, configurado en production; revisar en los logs del servicio de cron que la primera ejecución diaria termine sin error) **Cron de Railway para los resúmenes por correo**: segundo servicio desde el mismo repo/Dockerfile, *Custom Start Command* `python manage.py enviar_resumenes`, *Cron Schedule* `0 12 * * *` (UTC = 08:00/09:00 en Chile), con las mismas variables que el servicio web (`DATABASE_URL`, `RESEND_API_KEY`, `SITIO_URL`, `DEFAULT_FROM_EMAIL`, `KARIN_CLAVES_CIFRADO`…). Sin él no salen los resúmenes del empleador, del equipo ni los avisos de plazos al encargado Ley Karin. Conviene crearlo también en staging para probarlo.

- [x] (2026-10-07) Publicado en `main` (commit `ed4f120`, CI en verde): migraciones 0064–0098 aplicadas, API y frontend nuevos verificados en producción.

## Después de publicar

- [ ] Respaldo automático diario fuera de Railway (cron `pg_dump` → B2 cifrado, retención 30 diarios / 12 mensuales, aviso por correo si falla). Pendiente de autorización.
- [x] (2026-10-07, producción) Cargar en el admin las **vacaciones escolares** (`PeriodoVacacionesEscolares`, calendario Mineduc). **Se repite cada año** cuando el Mineduc publique el calendario siguiente.
- [x] (2026-10-07) Revisar en el admin los **precios de los planes**. Si difieren de los iniciales ($16.990 / $39.990 / $89.990), actualizar la tabla del briefing comercial (`docs/briefing-comercial-jornada40.md`).
- [ ] **Al publicar la rama en `main`**: la API deja de aceptar el origen `jornada40-saas.vercel.app` y las cookies de sesión pasan a `SameSite=Lax`, así que el panel se usa solo desde jornada40.cl (o www). Después de publicar, probar en producción el ingreso, una firma y el portal.
  - Con las correcciones del 2026-10-14 se aplican además la migración 0106 (no cambia tablas) y las de la lista negra de tokens de simplejwt (dos tablas nuevas), y el contenedor crea la tabla de caché `cache_jornada40` al arrancar (`createcachetable`). Respaldar la base antes (`pg_dump`).
  - Backend y frontend deben publicarse juntos: con la lista negra, el panel renueva la sesión desde una pestaña a la vez (`renovarSesion`); una versión vieja del panel abierta en varias pestañas podría cerrar la sesión.
  - Después: probar abrir el panel en dos pestañas por más de 5 minutos, enviar a firma y descargar un documento firmado, y revisar en los logs del cron que la tarea diaria termine sin error (ahora también borra los tokens vencidos).
- [ ] Reveniu en **sandbox para staging** (secreto del webhook, enlaces `REVENIU_LINK_*`, `REVENIU_API_URL`).
- [ ] Eliminar el entorno duplicado de Railway ("stagging").
- [ ] **Pricing** (*en pausa desde el 2026-10-10; se retoma cuando el titular avise*): estudiar cómo cobran los modelos comparables (plataformas de remuneraciones y cumplimiento laboral en Chile) y proponer precios competitivos que reflejen todas las prestaciones de Jornada40. Al cambiar precios: admin, briefing comercial (`docs/briefing-comercial-jornada40.md`) y dossier (`docs/dossier-jornada40.md`).
- [x] (2026-10-11, en la rama y staging) **Mejoras rápidas de QA**:
  - cobertura en CI (servidor 83,1 %, mínimo 80 %);
  - auditoría de dependencias y Dependabot;
  - ruff y bandit (análisis de seguridad);
  - suite sin internet (mindicador.cl simulado);
  - causa del recorrido intermitente (choques de escritura en SQLite, corregido);
  - accesibilidad con axe (0 problemas en 21 pantallas, contraste corregido);
  - alertas de errores por correo sin datos personales.

  Detalle en `docs/qa-pruebas-jornada40.md`.
- [ ] **Publicar en `main` las correcciones de seguridad de dependencias** (requiere autorización):
  - pdf.js permitía ejecutar JavaScript con un PDF malicioso, y la firma del trabajador muestra el reglamento que sube el empleador;
  - también Django 5.2.17, pypdf, Pillow, PyJWT, cryptography, axios y otros;
  - producción sigue con las versiones vulnerables hasta entonces;
  - van junto con las alertas de errores.
- [ ] Con el archivo ya en `main`, activar en GitHub *Settings → Code security → Dependabot security updates*.
- [ ] (Opcional) `ALERTAS_ERRORES_EMAIL` en Railway, si las alertas de errores deben ir a otro correo que el de contacto.
- [ ] **Mejoras de QA siguientes** (por decidir; secciones 6 y 7 de `docs/qa-pruebas-jornada40.md`):
  - operacionales: simulacro de restauración de respaldos, encabezado CSP, recorridos en Firefox y WebKit, línea base de rendimiento;
  - antes de escalar: pentest externo, revisión legal externa, auditoría manual de accesibilidad, panel de errores.
- [ ] **Documento técnico del sistema** (`docs/tecnico/`, se compila a Word y PDF con `python3 docs/tecnico/herramientas/construir.py`), en cinco entregas:
  - [x] (2026-10-11) Entrega 1: parte preliminar, resumen ejecutivo, capítulo 1 (Introducción) y capítulo 2 (Descripción general).
  - [x] (2026-10-12) Entrega 2: capítulo 3, con 199 requerimientos funcionales, 44 reglas de negocio y 41 no funcionales. Los ejemplos numéricos los comprueba `backend/core/tests/test_ejemplos_documento.py`.
  - [x] (2026-10-12) Entrega 3: capítulos 4 a 7 (arquitectura, diseño detallado, modelo de datos e interfaces). Los diagramas entidad-relación los genera `docs/tecnico/herramientas/modelo_datos.py` y las capturas, `CAPTURAS_DOC=1 npx playwright test capturas` (en `frontend/`).
  - [x] (2026-10-12) Entrega 4: capítulos 8 a 10 (seguridad, datos personales y cumplimiento normativo).
  - [x] (2026-10-12) Entrega 5: capítulos 11 a 13, anexos A a J y revisión final. Los anexos B, C, F, H y J los genera `docs/tecnico/herramientas/anexos.py`.
  - [x] (2026-10-12) Versión 0.9: las cinco entregas consolidadas en un solo Word y PDF, para revisión.
  - [x] (2026-10-14) Versión 0.9.1: describe las correcciones del 2026-10-14 (hallazgos de la sección 8.10, borradores legales, anexos y cifras de pruebas).
  - [ ] Revisar la versión 0.9.1 y enviar las correcciones; con ellas se publica la 1.0.
  - [ ] Completar en la ficha de control quién elabora, revisa y aprueba (lo define el titular).
- [x] (2026-10-10) **Dossier del producto** para preparar la propuesta a inversionistas con otro agente: `docs/dossier-jornada40.md` (describe lo que está en `main`). Actualizarlo con cada publicación en `main` y completar con el titular los datos de su sección 12 (equipo, tracción, finanzas, ronda).

## Hallazgos al documentar el código (2026-10-12)

Aparecieron al reconstruir los requerimientos del capítulo 3 del documento técnico. Se corrigieron el 2026-10-14, con autorización del titular; lo que sigue a cada uno es el diagnóstico original.

- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) **Prioridad alta: borrado físico por la API.** Corregido: esos seis recursos responden 405 a `DELETE` (`METODOS_SIN_BORRADO`); un anexo solo se descarta si nunca se envió a firma; las nueve relaciones de `SolicitudFirma` pasan a `PROTECT` (migración 0106), así que ni el administrador puede borrar evidencia de firma.
  - Qué pasa: `DELETE` borra la fila en fichas de trabajadores, contratos, liquidaciones, documentos legales, finiquitos y vacaciones. Al borrar una ficha también se borran en cascada sus solicitudes de firma (folio, IP, huellas) y sus documentos.
  - Quién puede hacerlo: la interfaz no ofrece esa opción, pero la API lo permite al titular y a los usuarios del equipo con "ver y gestionar".
  - Propuesta: responder 405 en esos recursos (o borrado lógico) y proteger las relaciones de los documentos firmados.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) **Prioridad alta: límite del webhook de Reveniu.** Corregido: límite propio `webhook_reveniu` de 600 avisos por hora por IP. No tiene límite propio, así que rige el anónimo de 100 avisos al día por IP. Con más clientes, avisos de pago legítimos podrían recibir 429. Propuesta: un límite propio para el webhook.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: la naturaleza se toma del concepto del catálogo. El recargo de horas extra menor al 50 % solo se validaba si el ítem declaraba su naturaleza. Por la API, un ítem que trae solo el concepto se calcula sin validar.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido, y también para comprobantes de vacaciones y anexos en firma o firmados (`exigir_sin_firma`, 400). Un documento legal firmado (carta o amonestación) se podía editar. La descarga sigue entregando la versión firmada, pero el registro cambia.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: recibe un usuario interno nuevo y el anterior conserva su historial. Volver a invitar al equipo a una persona eliminada (mismo RUT, misma cuenta) daba un error 500, porque se repetía el usuario interno.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: tipo de firma `MUTUO_ACUERDO`; el PDF indica la causal (159 N°1, o N°2 si es renuncia) y que, según el Art. 177, el empleador solo puede invocarlo si el trabajador lo ratifica ante un ministro de fe o lo firma el presidente del sindicato o el delegado; la firma en Jornada40 acredita la recepción. La carta de renuncia o mutuo acuerdo no se podía enviar a firma electrónica.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: dice «Día libre por horas extra compensadas» con sus horas. El comprobante de vacaciones rotulaba el día libre por horas extra como "Permiso sin goce de sueldo".
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: las marca «EN FIRMA» y no las toca. `revisar_topes_imponibles --aplicar` podía recalcular una liquidación con firma pendiente o en proceso.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: las lee, junto con la expectativa de vida y el SIS, y lo que no lee lo copia de lo vigente. Al probarlo con la página real se vio que Previred cambió su formato (topes y renta mínima), y el comando ahora lee también el nuevo. `sincronizar_previred` no proponía tres tasas de la reforma de pensiones: rentabilidad protegida, 0,1 % del empleador y AFC del empleador desde el año 11.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido, también al emitir y al editar. Ante un dato mal formado, la vista previa de la liquidación devolvía el texto técnico del error en vez de un mensaje genérico.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: bajar de plan exige que el equipo quepa en el nuevo cupo, el paso a Semilla avisa que el equipo pierde el acceso, y si el plan baja por otra vía los usuarios más recientes que sobran quedan suspendidos (sin eliminarlos). Bajar de plan no revisaba el cupo de usuarios del equipo: los usuarios ya activos seguían entrando.
- [x] (2026-10-14) Actualizado `CLAUDE.md` donde no coincidía con el código:
  - Stripe no se usa: el pago es con Reveniu y Transbank;
  - el estado PAST_DUE nunca se asigna;
  - el borrado lógico solo existe en empresas;
  - "avisos, no bloqueos" tiene excepciones legales.

## Hallazgos de la entrega 3 del documento técnico (2026-10-12)

Aparecieron al documentar la arquitectura y el modelo de datos (capítulos 4 a 7). Los marcados se corrigieron (el 2026-10-12 o el 2026-10-14); lo que sigue a cada corrección es el diagnóstico original. El primero se comprobó con una prueba local.

- [x] (2026-10-12, en la rama y staging; falta publicarlo en `main`) **Prioridad alta: la API del panel no se protege contra CSRF.** Corregido: `core.middleware.OrigenPermitidoMiddleware` rechaza (403) toda escritura en la API que venga de otro origen, y en producción las cookies de sesión pasan a `SameSite=Lax` (`COOKIES_SAMESITE`); se quitó `jornada40-saas.vercel.app` de los orígenes de producción. Pruebas en `test_csrf`. Lo que sigue es el diagnóstico original.
  - Qué pasa: la autenticación del panel (`CookieConCerco`, sobre `JWTCookieAuthentication` de dj-rest-auth) no verifica un token anti-CSRF (`JWT_AUTH_COOKIE_USE_CSRF` en falso). Las vistas del panel aceptan formularios (`application/x-www-form-urlencoded` y `multipart`), y en los ambientes desplegados las cookies van con `SameSite=None`.
  - Efecto: un sitio ajeno puede enviar un formulario a la API mientras el titular tiene la sesión abierta, y la API lo procesa. En una prueba local, un `POST` de formulario a `/api/empleados/` sin token creó una ficha (201). El envío a firma sí está protegido por la confirmación de identidad (428). El portal, la Ley Karin, la fiscalización y la extensión solo aceptan JSON y no están expuestos.
  - Propuesta: cookies `SameSite=Lax` en producción (`jornada40.cl` y `api.jornada40.cl` son el mismo sitio; quitar `jornada40-saas.vercel.app` de los orígenes), un middleware que rechace métodos de escritura con un `Origin` ajeno, y aceptar solo JSON salvo en las rutas que suben archivos.
- [x] (2026-10-12, en la rama y staging; falta publicarlo en `main`) **Si la migración falla, el servidor arranca igual.** Corregido en el Dockerfile: el `|| true` quedó solo para `createsuperuser`. La orden del Dockerfile (`migrate && createsuperuser … || true && gunicorn …`) hace que Gunicorn arranque aunque `migrate` falle, con el esquema a medio aplicar. Propuesta: separar el `|| true` solo para `createsuperuser`.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) **Límites de intentos por proceso.** Corregido: caché compartida en la base de datos (`DatabaseCache`, tabla `cache_jornada40`, creada al arrancar). No hay caché compartida (`CACHES` sin configurar: caché en memoria de cada proceso). Con 2 procesos de Gunicorn, cada límite se cuenta por separado y el efectivo puede ser el doble. Propuesta: caché en la base de datos o Redis.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) **La rotación del token de renovación no invalida el anterior.** Corregido: aplicación `token_blacklist` instalada; el panel renueva desde una pestaña a la vez para no cerrar la sesión de las otras, y la tarea diaria borra los tokens vencidos. `BLACKLIST_AFTER_ROTATION` está activo, pero sin la aplicación `rest_framework_simplejwt.token_blacklist` no tiene efecto: un token de renovación ya usado, o el de una sesión cerrada, sigue sirviendo hasta que vence (15 min). Propuesta: instalar esa aplicación y su migración.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) **El portal de fiscalización revela si una empresa usa Jornada40.** Corregido: la espera de un minuto rige para todo correo y RUT, y una falla del correo recibe la misma respuesta. Queda una diferencia de tiempo (nuevo hallazgo, abajo). Pedir un segundo código antes de un minuto responde 429 solo si la empresa existe, y un correo fallido responde 503 solo entonces. Basta escribir un correo con dominio `dt.gob.cl`, sin recibirlo. Propuesta: aplicar la espera también cuando la empresa no existe y responder igual aunque falle el envío.
- [ ] Datos que se acumulan sin limpieza: códigos vencidos (firma, portal, fiscalización y extensión), levantamientos de la extensión y PDF en `pendientes/` de B2 de solicitudes rechazadas, vencidas o canceladas. Definirlo con la política de conservación (capítulo 9). El borrador `docs/legal/05-politica-conservacion.md` propone plazos (30 días, 90 días y 12 meses); los tokens vencidos ya se borran cada día (2026-10-14).
- [x] (2026-10-12, con la revisión del origen) La salida de los portales (`salir`) no exige sesión ni JSON: un sitio ajeno podría cerrar la sesión de un trabajador, encargado o fiscalizador. Menor.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: se asigna con la fila de la empresa bloqueada, en el alta y en la carga masiva. Falta la restricción de unicidad en la base: antes hay que revisar que producción no tenga números repetidos. El número de ficha se asignaba como el máximo más uno, sin bloqueo ni unicidad: dos altas simultáneas en la misma empresa podían repetirlo. Menor.
- [ ] La cadena de la bitácora usa SHA-256 sin clave: quien tenga escritura directa en la base podría recalcularla. Es una limitación de diseño; las copias exportadas la acotan. Evaluar una clave (HMAC) o un sello externo periódico.

## Hallazgos de las entregas 4 y 5 del documento técnico (2026-10-12)

Aparecieron al escribir los capítulos 8 a 13 y los anexos. Los marcados se corrigieron; lo que sigue a cada corrección es el diagnóstico original.

- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido: ruta quitada. La ruta `api/auth/password/reset/confirm/<uidb64>/<token>/` (una `TemplateView` sin plantilla, en `core/urls.py`) responde 500 a un `GET` de cualquiera y genera una alerta de error. Nada la usa: la recuperación por RUT arma su enlace con `SITIO_URL`. Propuesta: quitarla o responder 404. Menor.
- [x] (2026-10-14, en la rama y staging; falta publicarlo en `main`) Corregido. El correo de recuperación de la clave del titular usaba la plantilla HTML también como texto plano (`views/cuentas.py → recuperar_password_por_rut`): un lector que muestra solo texto ve las etiquetas. Propuesta: usar `registration/password_reset_email.txt` para el texto. Menor.
- [x] (2026-10-12) `docs/STAGING.md` decía que sin B2 "los PDF firmados no se guardan": en realidad el envío a firma responde 503. Corregido el texto.

## Hallazgos del 2026-10-14 (por decidir)

Aparecieron al corregir los hallazgos anteriores y al redactar los borradores legales. No se corrigieron: cada uno espera decisión.

- [ ] **Google Fonts recibe la IP de cada visitante.** La aplicación web carga Poppins e IBM Plex Mono desde Google (`frontend/index.html`), incluidos los trabajadores que firman: es una transferencia internacional más. Propuesta: alojar las fuentes en el propio sitio (mismo diseño). Menor.
- [ ] **Diferencia de tiempo en las respuestas que no revelan datos.** El ingreso al portal, las recuperaciones de clave y el portal de fiscalización responden lo mismo exista o no la cuenta o la empresa, pero cuando existe envían el correo antes de responder y tardan más. Medirlo exige muchas peticiones, que los límites frenan. Propuesta: enviar esos correos en segundo plano o igualar el tiempo de respuesta. Menor.
- [ ] **La dependencia `stripe` está instalada y no se usa** (`requirements.txt`). Propuesta: quitarla junto con las dependencias que solo ella usa. Menor.
- [ ] **Unicidad del número de ficha en la base de datos.** Revisar en producción que no haya números repetidos por empresa y, si no los hay, agregar la restricción (migración). Menor.

## Extensión "Jornada40 para Mi DT" (plan en `docs/PLAN_EXTENSION_MIDT.md`)

- [x] (2026-10-08) Aprobar el plan (fases, y que la persona presiona siempre el botón final en Mi DT). Primero en staging.
- [x] (2026-10-09, en staging) Construida la extensión (panel lateral, conexión con código, lista y ficha con "Copiar", llenado por etapas, comprobante, modo levantamiento) y su parte en Jornada40 (tarjeta en `/app/dt`, solo en staging). Se instala con el ZIP, sin la tienda.
- [ ] **Instalar la versión de prueba** (ZIP de staging, "Cargar descomprimida") y conectarla con un código desde staging.jornada40.cl → Dirección del Trabajo.
- [ ] **Sesión de levantamiento** de los formularios de Mi DT con la Clave Única del titular (solo estructura, ningún dato): contrato (4 etapas), anexo, término, LRE, teletrabajo, finiquito, registro masivo. Ideal con un contrato real pendiente, registrándolo al final; registrar también la pantalla de confirmación. Con eso se escriben los mapeos (`backend/core/datos/mapeos_midt.json`).
- [ ] Crear la cuenta de desarrollador de Chrome Web Store (US$5, pago único) a nombre de Fehu. La de Edge Add-ons es gratis y puede abrirse antes. Todo lo que piden está en `frontend/extension/tienda/FICHA_TIENDA.md`.
- [ ] Antes de enviar a revisión: cuenta demo en producción para los revisores de las tiendas y capturas tomadas en el piloto (sin datos reales).
- [ ] Publicar la página de privacidad en producción (`/privacidad/extension`, va con el próximo paso a `main`): la piden las dos tiendas.
- [ ] Definir el plan comercial de la extensión (propuesta: contratos, anexos y términos en todos los planes; LRE desde Pyme).
- [ ] Verificar en Mi DT si el pacto de teletrabajo se registra en su módulo propio (`/empleador/teletrabajo/ingreso`) y no como anexo; si es así, corregir el aviso, la ficha y el plazo en Jornada40.

## Trámites y temas legales

- [ ] Reconocimiento de la plataforma ante la DT (Etapa D): acordar medidas de seguridad y presentar la solicitud.
  - Precedentes (revisados 2026-10-08): la DT aprobó en 2025–2026 a Nubox (Ord. 136, 14-03-2025, presentado el 24-09-2024: ~6 meses), Certifika "FirmaWeb" (Ord. 79), SIGNER (Ord. 741), GDEDIGITAL (Ord. 724), HPDIGITAL (Ord. 512), Visión FirmaDoc (Ord. 508), LeanGlobal (Ord. 428), SAFMAG1 (Ord. 426), entre otros; rechazó Albiorix (Ord. 131) y eProc (Ord. 509) por no cumplir el Dictamen 0789/15, y no se pronunció sobre "Workin Docs" (Ord. 48) porque los antecedentes estaban tras un registro: **adjuntar todo directo, sin exigir cuenta**.
  - Observación que la DT hizo a Nubox y a Certifika (Ord. 136 y 79): la seguridad no puede hacer que el trabajador pierda el control de su firma; objeta "claves dinámicas u OTP generadas por el mismo sistema" que se superpongan a la rúbrica del trabajador. **Hecho (2026-10-08)**: el flujo, el correo del código y el certificado dicen que el código o la clave solo verifican identidad y que firma la aceptación expresa más el trazo; firmar exige `acepto`; el código se guarda con hash; el trabajador puede usar su clave del portal. Falta explicarlo en la solicitud a la DT.
  - Al revisar esto apareció y se corrigió (2026-10-08) una falla del portal: la cuenta era una por RUT y quien verificaba cualquier correo de ese RUT (p. ej. un empleador con una ficha de RUT ajeno) veía las fichas del trabajador real y podía cambiarle la clave. Ahora la cuenta es por persona; la migración 0100 separó las cuentas mezcladas y les borró la clave. Publicado en producción el 2026-10-08 (commit `96ca177`, migraciones 0099–0104 aplicadas).
  - Aprovechar la solicitud para preguntar a la DT por el canal de servicios web (API) para el LRE y el Registro Electrónico Laboral, que la DT anunció como "próxima evolución" (consulta 120083, actualizada 31-05-2023).
  - [x] (2026-10-14) Borrador de la solicitud: `docs/legal/07-solicitud-dt.md` (requisitos a) a e) del Dictamen 0789/15 según el ORD 136, consentimiento, envío al correo personal, la observación sobre los códigos, firma del empleador e integridad, y la consulta por la API).
  - [ ] Para presentarla: revisión legal; completar los datos de la empresa y el acceso de demostración; decidir qué extracto del documento técnico se adjunta; publicar antes en `main` las correcciones del 2026-10-14 (el borrador dice que un documento firmado no se modifica ni se elimina).
  - [ ] Decidir dos puntos que el borrador marca [REVISAR]: si enviar a firma a quien no ha dado su consentimiento electrónico debe advertirse o impedirse (hoy solo se registra), y si los documentos que no pasan por firma deben enviarse automáticamente al correo personal (ORD 2965).
- [ ] Revisión legal de plantillas (reglamento por rubro, documentos Ley Karin, pactos).
- [ ] **Ley 21.719 de protección de datos (rige desde el 01-12-2026)**: contrato de tratamiento por encargo con los clientes, política de privacidad, registro de proveedores y transferencias internacionales, procedimiento ante vulneraciones, política de conservación y eliminación, y procedimiento para los derechos de los titulares. Detalle y prioridades en la sección 9.8 del documento técnico; validarlo con asesoría legal.
  - [x] (2026-10-14) Borradores en `docs/legal/` (01 a 06), según el texto de la ley (BCN, idNorma 1209272); `python3 docs/legal/construir.py` los genera en Word. El proyecto que la posterga al 01-12-2027 (Boletín 18.623-07) seguía en primer trámite a fines de septiembre de 2026.
  - [ ] Revisión de un abogado: completar los [COMPLETAR] (razón social, contactos, plazos, responsables) y resolver los [REVISAR].
  - [ ] Completar el registro de proveedores con el contrato de tratamiento de datos, la garantía de transferencia y la región de cada proveedor, y con quién tiene acceso a cada cuenta.
  - [ ] Publicar la política de privacidad en el sitio y enlazarla desde el registro, el ingreso, el portal, la firma y la fiscalización.
  - [ ] Agregar el anexo de tratamiento por encargo a los términos de servicio, con aceptación al registrarse y aceptación expresa de los clientes actuales en el panel antes del 01-12-2026 (requiere desarrollo).
  - [ ] Aprobar los procedimientos de vulneraciones y de derechos, y nombrar a sus responsables.
  - [ ] Desarrollo que piden los borradores: exportación completa de la cuenta y de los datos de una persona en formato estructurado; eliminación o anonimización al término del contrato; limpieza automática de los datos acumulados; cerrar todas las sesiones de una persona (hoy solo se puede cambiando `SECRET_KEY`); respaldos automáticos (ya pendiente arriba).
  - [ ] Correo de contacto propio del dominio (por ejemplo, privacidad@jornada40.cl) en vez de `contacto.jornada40@gmail.com`, para soporte, privacidad y alertas.
- [ ] Verificar contra una carga real: aporte de indemnización a todo evento en Previred (campos 31–36) y CSV de registro masivo de Mi DT (oculto hasta confirmar la plantilla).

## En espera de terceros

- [ ] Códigos LRE para horas extra compensadas con feriado (Ley 21.561): la DT no los ha publicado (provisorios 2102 / 2313).
