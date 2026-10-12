# Seguridad {#sec-seguridad}

Este capítulo describe cómo se protege Jornada40: qué activos resguarda, de qué amenazas, con qué controles y qué falta. Sigue los riesgos de OWASP Top 10 (2021) como lista de comprobación. Lo que se describe se verificó en el código; no se ha hecho todavía una auditoría ni una prueba de penetración externas (sección 8.10).

La sección 4.7 resume los mecanismos de sesión de cada acceso, el capítulo 6 cómo se guardan los datos sensibles y el capítulo 9 el tratamiento de los datos personales.

## Activos y amenazas {#sec-seg-amenazas}

| Activo | Por qué importa | Amenazas principales |
|---|---|---|
| Credenciales y sesiones | Abren los datos de una cuenta, de un trabajador o de una denuncia | Robo o adivinación de claves, robo de cookies, uso de la sesión desde otro sitio |
| Datos personales y laborales de los trabajadores | Identidad, remuneraciones, previsión, salud y familia (capítulo 9) | Acceso de otra cuenta, de un usuario del equipo sin permiso, o de alguien con la base de datos |
| Documentos firmados | Son la evidencia ante el trabajador y ante la Dirección del Trabajo | Alteración, borrado o firma sin la persona |
| Denuncias de la Ley Karin | Exigen reserva legal (Art. 211-C del Código del Trabajo) | Lectura por el empleador o por terceros, filtración desde la base |
| Bitácoras | Prueban quién hizo qué | Alteración o borrado de registros |
| Secretos de configuración | Firman sesiones y códigos, cifran denuncias, dan acceso a B2, Reveniu y el correo | Filtración desde el repositorio o desde la configuración |
| Suscripciones y pagos | Definen qué puede usar cada cuenta | Avisos de pago falsos, cambios de plan sin pagar |
| Disponibilidad del servicio | Los plazos laborales no esperan | Saturación de rutas públicas, caída de un proveedor |

: Activos que protege el sistema

| Actor de amenaza | Qué podría intentar | Controles principales | Sección |
|---|---|---|---|
| Atacante anónimo en internet | Adivinar claves y códigos, enumerar cuentas, saturar el servicio | Límites de intentos, respuestas que no revelan si una cuenta existe, códigos de un solo uso con pocos intentos | 8.2, 8.4 |
| Sitio web malicioso que visita una persona con sesión abierta | Crear o cambiar datos con la sesión de esa persona (CSRF), mostrar Jornada40 en un marco | Revisión del origen de las escrituras, cookies `SameSite`, `X-Frame-Options: DENY` | 8.4 |
| Usuario de otra cuenta | Leer o cambiar datos ajenos cambiando un identificador | Filtro por dueño en cada consulta | 8.3 |
| Usuario del equipo | Usar módulos o empresas que no le asignaron | Cerco del equipo y filtro por empresa en los gestores de datos | 8.3 |
| Empleador malicioso | Crear una ficha con el RUT de otra persona para ver sus datos en el portal | El portal muestra solo las fichas cuyo correo verificó la cuenta | 8.3 |
| Trabajador | Ver documentos de otros trabajadores o de otras empresas | Sesión propia del portal y visibilidad por correo verificado, comprobada otra vez en cada descarga | 8.3 |
| Persona que se hace pasar por fiscalizador | Ver la documentación de una empresa | Código enviado a un correo institucional (`dt.gob.cl`) | 8.2 |
| Persona con acceso a la base de datos o a una copia | Leer denuncias, alterar la bitácora o un documento | Cifrado de la Ley Karin, cadena de huellas, huellas de los PDF firmados | 8.5, 8.6, 8.9 |
| Proveedor comprometido o dependencia vulnerable | Ejecutar código o leer datos | Dependencias fijadas y auditadas, mínimos privilegios de la extensión | 8.8 |

: Actores de amenaza y controles

## Autenticación y sesiones {#sec-seg-autenticacion}

**Credenciales por acceso.**

- **Titular y equipo:** RUT y clave. El titular entra solo con su RUT, nunca con el correo; los usuarios del equipo tienen su propia puerta y una clave por cuenta.
- **Encargado Ley Karin:** RUT y clave, por un acceso separado.
- **Trabajador:** RUT y un código enviado a cada correo de sus fichas, o una clave opcional.
- **Firmante:** RUT y código de un solo uso, o la clave del portal de la cuenta que verificó ese correo.
- **Fiscalizador:** RUT del empleador, su identificación y un código enviado a un correo institucional.
- **Extensión:** un código de 8 caracteres que se canjea por un token revocable.

**Claves.**

- **Validación:** las del panel pasan por los validadores de Django: largo mínimo de 8 caracteres, no parecerse a los datos del usuario, no ser una clave común ni solo números. La del portal exige además que no sea el RUT.
- **Almacenamiento:** se guardan con PBKDF2 y SHA-256, con 1.000.000 de iteraciones (sección 8.5).
- **Cambio:** cambiar la clave del panel exige la actual. En el portal y en la Ley Karin, cambiarla invalida las sesiones anteriores (`version_sesion`).
- **Recuperación:** la del titular es solo por RUT; responde lo mismo exista o no la cuenta y envía un enlace de un solo uso al correo registrado. La recuperación por correo está cerrada (410).

**Códigos de un solo uso.** Son de 6 dígitos (8 caracteres en la extensión) y se generan con el módulo `secrets`. Se guarda solo su huella. Vencen en 10 minutos y, al pedir uno nuevo, se anulan los anteriores. Los de 6 dígitos admiten 3 intentos cada uno (sección 5.5.5).

**Respuestas que no revelan datos.**

- El ingreso al portal responde igual exista o no un trabajador con ese RUT; solo indica si la persona creó una clave.
- La recuperación del titular, la del equipo y la del encargado responden siempre lo mismo.

Hay una excepción: el portal de fiscalización responde distinto, solo si la empresa existe, a un segundo pedido antes de un minuto o a una falla del correo (sección 8.10).

**Sesiones.** Los tiempos de cada acceso están en la sección 4.7.

- **Panel:** el token de acceso dura 5 minutos y el de renovación, 15; este rota en cada uso.
- **Cookies firmadas:** las del portal, la Ley Karin y la fiscalización vencen por inactividad y tienen además un tope absoluto.
- **Cierre por inactividad:** la aplicación web cierra la sesión del panel tras 5 minutos sin uso y avisa antes.
- **Cookies:** todas son HttpOnly, de modo que un script de la página no las puede leer, y llevan Secure en los ambientes desplegados.

**Límites.** La tabla de la sección 7.2.4 lista los límites de intentos de cada ingreso.

**Falta:**

- **Segundo factor:** ningún acceso tiene un segundo factor de autenticación, tampoco el administrador de Django.
- **Revocación al rotar:** sin la aplicación `token_blacklist` de simplejwt, el token de renovación ya usado, o el de una sesión cerrada, sigue sirviendo hasta que vence (15 minutos).

Ambos puntos están en la sección 8.10.

## Autorización y aislamiento {#sec-seg-autorizacion}

**Entre cuentas.** Cada vista del panel filtra sus consultas por el titular de la cuenta (`empresa__owner=request.user` o equivalente). Un recurso de otra cuenta responde 404, igual que uno que no existe. Las funciones pagadas se habilitan en el servidor según el nivel del plan (`_plan_permite`), nunca en la interfaz.

**Dentro de una cuenta: el cerco del equipo.** La autenticación del panel (`core/autenticacion.py`) aplica a cada petición de un usuario del equipo estas reglas:

1. Si el usuario fue eliminado o no está activo, responde 401 aunque su token siga vigente.
2. Las rutas de identidad (su clave, su sesión, su confirmación de identidad, su resumen por correo) actúan como la persona.
3. Las demás rutas se asignan a uno de los diez módulos del panel. Leer exige el permiso de ver y escribir, el de gestionar. Los documentos toman su módulo del tipo de documento.
4. Lo que no pertenece a ningún módulo es del titular: datos y firma de la empresa, plan, pagos, equipo, bitácora y perfil. Para el equipo responde 403.
5. Si la petición pasa, actúa sobre los datos de la cuenta y solo en las empresas asignadas. Los gestores `EnEmpresas` de 18 modelos filtran por esas empresas en toda consulta (sección 4.7).

Una ruta nueva queda cerrada para el equipo hasta que se asigna a un módulo. La prueba `test_permisos_equipo` recorre todas las rutas de la API con un usuario de solo lectura y comprueba que nada más se abra y que nada se pueda escribir.

**Ley Karin.** El encargado no es un módulo del panel:

- tiene una tabla, un usuario y una cookie propios;
- el JWT del panel no abre sus rutas, y su cookie no abre el panel;
- el titular solo ve un contador de casos y plazos, sin contenido;
- los avisos de posibles represalias son solo para el encargado, porque revelarían quién participa en una denuncia.

**Portal del trabajador.** Una cuenta ve solo las fichas cuyo correo verificó con un código. Así, un empleador que crea una ficha con el RUT de otra persona y un correo propio no obtiene nada de otras empresas. Cada descarga vuelve a comprobar que el documento es visible para esa cuenta.

**Fiscalización y extensión.**

- La fiscalización es de solo lectura y abarca una sola empresa.
- El token de la extensión actúa sobre la cuenta que lo generó. Si lo generó un usuario del equipo, aplica sus permisos: ver para leer y gestionar para marcar.

**Hallazgo pendiente.** La API todavía acepta el borrado físico (`DELETE`) de trabajadores, contratos, liquidaciones, cartas, finiquitos y vacaciones al titular y a usuarios con permiso de gestionar (sección 6.4.2).

## Protección de la aplicación web {#sec-seg-web}

| Riesgo | Control | Estado |
|---|---|---|
| Peticiones desde otros sitios (CSRF) | Revisión del origen de toda escritura en la API y cookies `SameSite=Lax` en producción (sección 4.7). Las vistas de los portales solo aceptan JSON | Corregido el 12-10-2026 **[Solo en staging]**; producción sigue expuesta hasta publicar |
| Orígenes cruzados | CORS solo para los orígenes de la aplicación, con credenciales | Vigente |
| Inyección de código en la página (XSS) | React escapa todo texto; no se usa `dangerouslySetInnerHTML`. Las plantillas de Django escapan por omisión; el único `safe` (vista previa del reglamento) recibe texto ya escapado | Vigente. No hay política de contenido (CSP) |
| Inyección SQL | Solo el ORM de Django. La única consulta escrita a mano (`rotar_cifrado`) usa nombres de tabla tomados de los modelos, no datos de usuarios | Vigente; bandit la revisa |
| Mostrar la aplicación dentro de otra página | `X-Frame-Options: DENY` en la API y en Vercel | Vigente |
| Transporte | HTTPS en Vercel y Cloudflare; HSTS de un año en la API de producción y en Vercel; cookies Secure | Vigente |
| Archivos subidos | Tipo y tamaño limitados (tabla siguiente); los archivos de la Ley Karin se cifran antes de guardarse | Vigente |
| Redirección abierta | Tras el ingreso, `volver` solo acepta rutas internas de `/app` o `/bienvenida` | Vigente |
| Saturación | Límites de intentos por IP, por cuenta y por enlace; máximo de 60 s por petición; tamaños máximos; páginas de 200 registros | Vigente, con la salvedad de la caché por proceso (sección 8.10) |
| Errores con información interna | `DEBUG` apagado en los ambientes desplegados; respuestas genéricas ante errores inesperados (`error_interno`) | Vigente |
| Permisos del navegador | `Permissions-Policy` sin cámara, micrófono ni ubicación; `Referrer-Policy: strict-origin-when-cross-origin`; `nosniff` | Vigente |

: Controles de la aplicación web

| Archivo | Ruta | Tipos | Tamaño máximo |
|---|---|---|---|
| Contrato escaneado para digitalizar | `POST /api/empleados/{id}/digitalizar_contrato/` | PDF, JPG o PNG | 20 MB |
| Reglamento interno | `POST /api/reglamentos/` | PDF que se pueda leer | 20 MB |
| Archivo de un expediente Ley Karin | `POST /api/karin/denuncias/{id}/archivos/` | PDF, JPG o PNG | 15 MB |
| Carga masiva de trabajadores | `POST /api/empleados/carga_masiva/` | Excel (`.xlsx`, `.xls`) | 5 MB y 500 filas |
| Firma dibujada (trabajador o fiscalizador) | Firma pública y ratificación | Imagen en base64 | 500.000 caracteres |

: Límites de los archivos subidos

## Criptografía {#sec-seg-criptografia}

| Uso | Algoritmo | Clave | Dónde |
|---|---|---|---|
| Contraseñas del panel y del portal | PBKDF2 con SHA-256, 1.000.000 de iteraciones y sal por clave | No aplica | `User.password`, `CuentaTrabajador.password` |
| Tokens de sesión del panel (JWT) | HMAC-SHA256 (HS256) | `SECRET_KEY` | Cookies del panel |
| Cookies firmadas (portal, Ley Karin, fiscalización, confirmación) | Firma de Django con HMAC-SHA256 y una sal por acceso | `SECRET_KEY` | `core/sesion_inactividad.py`, `core/views/firmas.py` |
| Códigos de firma y de la extensión | HMAC-SHA256 | `SECRET_KEY` | `OTPFirma`, `CodigoExtension` |
| Códigos del portal y de fiscalización | SHA-256 del código junto con la clave secreta | `SECRET_KEY` | `CodigoTrabajador`, `CodigoInspeccion` |
| Token de la extensión | SHA-256 (el token es aleatorio y largo) | No aplica | `DispositivoExtension` |
| Datos y archivos de la Ley Karin | Fernet: AES-128 en modo CBC con autenticación HMAC-SHA256 | `KARIN_CLAVES_CIFRADO`, rotable | `core/cifrado.py` |
| Integridad de documentos y registros | SHA-256 | No aplica | Bitácoras, PDF firmados, archivos de la Ley Karin |
| Transporte | TLS, administrado por Vercel, Cloudflare y Railway | Certificados de los proveedores | Todas las conexiones |

: Uso de criptografía

**Una sola clave para varias firmas.** `SECRET_KEY` firma las sesiones, las cookies y las huellas de los códigos. Cambiarla cierra todas las sesiones e invalida los códigos vigentes, pero no afecta las contraseñas ni los datos cifrados de la Ley Karin, que en los ambientes desplegados usan sus propias claves. El capítulo 12 describe el procedimiento para rotarla y su efecto.

## Auditoría y monitoreo {#sec-seg-auditoria}

| Registro | Qué anota | Qué no anota | Protección |
|---|---|---|---|
| Bitácora del panel | Toda escritura y descarga del panel, ingresos e intentos fallidos: quién, cuándo, empresa, ruta, IP y resultado | Los datos enviados; los rechazos del cerco del equipo y de la revisión del origen, que quedan solo en el registro de ejecución | Solo agregar, cadena SHA-256, copias verificables; se conserva al menos 5 años |
| Registro reservado Ley Karin | Ingresos, cambios de clave, cada consulta y acción sobre un expediente, consultas desde el portal | El contenido de las denuncias (solo el folio) | Solo agregar, cadena SHA-256, descripción cifrada |
| Registro de fiscalización | Ingresos, descargas, ratificaciones y salidas de los fiscalizadores | — | Solo lectura en el administrador; el empleador lo ve |
| Registro de ejecución | Advertencias y errores del servidor, en la salida del contenedor (Railway) | Texto de las excepciones en las alertas por correo | Depende de la retención de Railway |
| Alertas por correo | Cada error del servidor con su excepción: ruta, tipo y traza del código | Datos personales y texto de la excepción | Agrupadas y con máximo por hora |

: Registros de auditoría y monitoreo

**Límite de la cadena.** La cadena de huellas no usa una clave secreta: quien tuviera escritura directa en la base podría alterar un registro y recalcular la cadena. Las copias exportadas fijan la huella fuera del sistema y acotan ese riesgo (sección 6.4.4).

**Falta.** No hay métricas, panel de errores, ni alertas de disponibilidad (capítulo 12).

## Secretos y configuración {#sec-seg-secretos}

- **Dónde viven.** Los secretos están en las variables de entorno de Railway y nunca en el repositorio; `.env` está excluido de Git. La aplicación web no tiene secretos: sus variables `VITE_*` son públicas por diseño.
- **Obligatorios.** En los ambientes desplegados la API no arranca sin `SECRET_KEY` ni sin `KARIN_CLAVES_CIFRADO`. El aviso de pago rechaza todo si falta `REVENIU_WEBHOOK_SECRET`.
- **Separación por ambiente.** Producción y pruebas tienen claves distintas: la clave de cifrado de la Ley Karin de staging no es la de producción, y Reveniu usa su ambiente de pruebas en staging.
- **Rotación.** Las claves de la Ley Karin se rotan con `rotar_cifrado` sin perder datos (sección 6.5). Rotar `SECRET_KEY` cierra todas las sesiones e invalida los códigos vigentes (capítulo 12).
- **Acceso.** Quién puede ver y cambiar la configuración depende de los permisos de los proyectos en Railway, Vercel, Cloudflare, Backblaze, Resend y Reveniu. No está documentado quién los tiene; queda como tarea organizacional (sección 8.10).

El anexo G lista todas las variables y cuáles son secretas.

## Seguridad en el desarrollo {#sec-seg-desarrollo}

**Revisión automática en cada cambio.** La integración continua revisa (capítulo 11):

- el código Python con ruff;
- la seguridad con bandit, en gravedad media o alta;
- las dependencias con pip-audit y npm audit (gravedad alta).

Dependabot propone cada semana las actualizaciones agrupadas.

**Dependencias fijadas.** Las dependencias del servidor están fijadas con versión exacta, incluidas las indirectas. La biblioteca `xlsx` se toma de la distribución de SheetJS, porque la de npm no tiene mantención y tiene avisos de seguridad.

**Pruebas de seguridad.** Hay pruebas automáticas para los controles de seguridad:

- `test_seguridad`;
- `test_permisos_equipo`, que recorre todas las rutas;
- `test_acceso_karin`, de aislamiento y cifrado;
- `test_csrf`, para la revisión del origen;
- `test_sesion_inactividad`;
- `test_portal_trabajador`, de visibilidad por correo verificado.

**Extensión.** La extensión pide permisos mínimos, no carga código remoto y no guarda datos de trabajadores en el navegador (sección 5.3).

La sección 13.1 describe el desarrollo asistido por IA y la revisión humana de cada cambio.

## Firma electrónica {#sec-seg-firma}

**Tipo de firma.** Jornada40 ofrece una firma electrónica simple (Ley 19.799). La Dirección del Trabajo la acepta para la documentación laboral cuando el documento queda vinculado a su autor (ORD N° 2257 de 2022 y N° 82 de 2025). El código o la clave solo verifican la identidad. El acto de firmar es la aceptación expresa del contenido y la firma dibujada (ORD N° 136 y N° 79 de 2025). La sección 10.3 trata el valor legal ante la DT.

| Evidencia | Cómo se obtiene | Dónde queda |
|---|---|---|
| Quién emitió el documento | El empleador confirma su clave en los 10 minutos previos al envío (428 si no) | `emisor`, `emisor_ip`, `emisor_confirmado_en` de la solicitud y página de certificado |
| A quién se envió | Correo de la ficha del trabajador; aviso si parece corporativo (ORD N° 2965) | `email_firmante` |
| Identidad del firmante | RUT y código enviado a ese correo (huella HMAC, 3 intentos, 10 min), o la clave del portal de la cuenta que verificó ese correo (5 intentos por hora) | `verificacion` y página de certificado |
| Voluntad de firmar | Aceptación expresa (`acepto: true`) y firma dibujada | Imagen de la firma, fecha y hora, IP |
| Integridad | Huella SHA-256 del PDF original y del firmado, y folio correlativo por empresa | `hash_original`, `hash_firmado`, `folio`, página de certificado |
| Conservación | PDF firmado en un depósito privado de B2, sin reemplazo de archivos | `b2_key_firmado` |

: Evidencia que guarda cada firma

**Controles del proceso.**

- **Una firma viva por documento.** Un documento no puede tener dos solicitudes vivas, y un contrato, una liquidación o un finiquito con firma viva no se editan.
- **Firma concurrente.** La firma bloquea la solicitud mientras se procesa. Si algo falla, la solicitud vuelve a quedar pendiente y nunca queda firmada a medias.
- **Versión entregada.** Lo firmado se entrega siempre en su versión firmada.

**Límites.**

- **Identidad.** Descansa en el control del correo del trabajador, que registra el empleador.
- **Conservación.** El depósito de B2 no tiene bloqueo de objetos: quien tuviera las claves de B2 podría borrar un PDF firmado.
- **Verificación pública.** No existe para los documentos firmados. La página `/verificar` cubre certificados y copias de la bitácora; la integridad de un documento firmado se comprueba comparando su huella con la registrada en el sistema.
- **Finiquito.** No es una firma avanzada, así que el finiquito necesita ratificación ante un ministro de fe o en Mi DT (Art. 177 del Código del Trabajo).

## Hallazgos y controles pendientes {#sec-seg-hallazgos}

Los hallazgos se registraron en `docs/PENDIENTES.md` al documentar el código.

| Hallazgo | Riesgo | Estado |
|---|---|---|
| La API del panel aceptaba formularios de otros sitios con la sesión abierta (CSRF) | Alto | Corregido el 12-10-2026 en la rama y en staging; falta publicarlo en producción |
| La salida de los portales se podía forzar desde otro sitio | Bajo | Corregido con la revisión del origen; falta publicarlo |
| Borrado físico por la API de fichas y documentos, que arrastra la evidencia de firma (sección 6.4.2) | Alto | Pendiente: responder 405 o borrar lógicamente |
| No hay respaldos automáticos propios de la base ni pruebas de restauración | Alto | Pendiente (capítulo 12) |
| Sin auditoría de seguridad ni prueba de penetración externas | Medio | Pendiente antes de escalar |
| El aviso de pago de Reveniu solo tiene el límite anónimo (100 por día por IP) | Medio | Pendiente: límite propio |
| Límites de intentos contados por cada proceso del servidor (caché local) | Medio | Pendiente: caché compartida |
| Una carta firmada se puede editar por la API (la descarga sigue entregando la firmada) | Medio | Pendiente |
| Sin segundo factor de autenticación, tampoco en el administrador de Django | Medio | Pendiente: evaluar segundo factor para el titular y el administrador |
| Sin política de contenido (CSP) en la aplicación web | Medio | Pendiente |
| El token de renovación usado o de una sesión cerrada sirve hasta vencer (15 min) | Bajo | Pendiente: instalar `token_blacklist` |
| El portal de fiscalización revela, en dos casos, si una empresa usa Jornada40 | Bajo | Pendiente: responder siempre igual |
| La cadena de la bitácora no usa clave | Bajo | Limitación de diseño: evaluar HMAC o un sello externo periódico |
| El depósito de B2 no tiene bloqueo de objetos ni versiones | Bajo | Pendiente: evaluar bloqueo de objetos para `firmados/` |
| No está documentado quién tiene acceso a la configuración de cada proveedor | Medio | Pendiente: inventario de accesos y revisión periódica |
| Una ruta auxiliar de recuperación de clave responde 500 a cualquiera y genera una alerta (anexo C) | Bajo | Pendiente: quitarla |

: Hallazgos de seguridad y su estado
