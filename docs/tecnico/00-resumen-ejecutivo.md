# Resumen ejecutivo {.unnumbered #sec-resumen}

**Qué es.** Jornada40 es una plataforma web, ofrecida como servicio por suscripción, para que los empleadores chilenos, en especial las pymes, gestionen a sus trabajadores y cumplan la legislación laboral y previsional. Cubre el ciclo completo de la relación laboral:

- contratación: contratos y anexos adaptados a la reducción gradual de la jornada a 40 horas (Ley 21.561);
- remuneraciones: liquidaciones de sueldo, y los archivos para Previred, el Libro de Remuneraciones Electrónico de la Dirección del Trabajo (DT) y el Servicio de Impuestos Internos (SII);
- documentos de la relación laboral: vacaciones, pactos, permisos y constancias, cartas de término y finiquitos, firmados electrónicamente por el trabajador;
- obligaciones ante la DT: plazos y fichas para el registro electrónico de contratos, anexos y términos en Mi DT;
- prevención: reglamento interno, seguridad laboral y el procedimiento de denuncias de la Ley Karin (Ley 21.643).

Además del panel del empleador, el sistema ofrece:

- un portal para los trabajadores;
- un acceso aislado para quien recibe las denuncias de la Ley Karin;
- un portal de solo lectura para los fiscalizadores de la DT;
- una extensión de navegador que asiste el registro en Mi DT (en pruebas).

**Cómo está construido.** Es una aplicación cliente-servidor de tres capas.

- La interfaz es una aplicación web de una sola página (React 19 y TypeScript), publicada en Vercel.
- El servidor es una API REST (Django 5.2 y Django REST Framework) que corre en Railway sobre PostgreSQL.
- Se apoya en servicios externos para guardar documentos (Backblaze B2), enviar correos (Resend), cobrar suscripciones (Reveniu y Transbank), leer contratos escaneados (Google Gemini) y obtener la UF y la UTM (mindicador.cl).

Dos principios ordenan el diseño:

- todo cálculo legal o previsional se hace en el servidor, y la interfaz solo lo muestra;
- lo que contraviene una norma laboral se advierte al empleador, pero no se le impide continuar.

**Seguridad.**

- **Accesos separados:** siete formas de ingreso (titular, equipo, encargado Ley Karin, trabajador, firma por enlace, fiscalizador y extensión). Cada una tiene su propia sesión, límite de intentos y cierre por inactividad.
- **Aislamiento:** cada consulta se limita a los datos de la cuenta. Para los usuarios del equipo, además, a las empresas y los módulos que el titular les asignó.
- **Auditoría:** una bitácora encadenada con huellas SHA-256 hace evidente cualquier alteración y permite emitir copias verificables con un código.
- **Ley Karin:** la información de las denuncias se guarda cifrada y separada del resto del sistema.
- **Firma:** es una firma electrónica simple. Antes de firmar se verifica la identidad del trabajador con un código o su clave, y queda evidencia de quién emitió el documento y desde dónde.

**Calidad.** Al {{fecha}}, el código descrito tiene:

- 577 pruebas automáticas del servidor, con 84,1 % de las líneas cubiertas según la última medición (14-10-2026);
- 64 pruebas unitarias de la interfaz;
- 59 recorridos de extremo a extremo en navegador;
- una revisión automática de accesibilidad (WCAG 2.1, niveles A y AA) en 21 pantallas, sin problemas detectados.

La integración continua ejecuta estas pruebas, el análisis estático y la auditoría de dependencias en cada cambio. 193 de los 199 requerimientos funcionales y todas las reglas de negocio tienen al menos una prueba automática.

**Requerimientos.** El capítulo 3 especifica 285 requerimientos: 199 funcionales, 44 reglas de negocio y cálculos legales, y 42 no funcionales. De los no funcionales, 28 se cumplen, 9 se cumplen en parte y 5 están pendientes: respaldos, disponibilidad comprometida, pruebas de carga, auditoría de seguridad externa y revisión legal externa de las plantillas.

**Datos personales.** Jornada40 trata los datos de los trabajadores por cuenta de cada empleador (es encargado del tratamiento) y los de sus clientes como responsable. La Ley 21.719 rige desde el 01-12-2026 y exige, entre otras cosas, un contrato de encargo, una política de privacidad, un registro de proveedores y un procedimiento ante vulneraciones. Hay borradores para revisión legal desde el 14-10-2026, pero ninguno rige todavía (capítulo 9).

**Estado.** El sitio de producción (jornada40.cl) ejecuta la rama `main`. Este documento describe una versión más reciente, publicada en el ambiente de pruebas, que agrega:

- la extensión para Mi DT;
- las alertas de errores por correo;
- la actualización de las dependencias que tenían avisos de seguridad conocidos;
- la protección de la API contra peticiones enviadas desde otros sitios (CSRF);
- las correcciones del 14-10-2026: la API ya no borra trabajadores ni sus documentos, los documentos en firma no se editan, los tokens de sesión usados dejan de servir y los límites de intentos se cuentan entre todos los procesos, entre otras (sección 1.2.3).

**Principales limitaciones y riesgos.**

- Producción mantiene dependencias con avisos de seguridad conocidos. Ya están corregidas en la versión de pruebas y falta publicarlas.
- No hay respaldos automáticos propios de la base de datos ni pruebas de restauración.
- Los documentos y procedimientos que exige la Ley 21.719 están en borrador y deben revisarse, completarse y publicarse antes de su vigencia (capítulo 9).
- No se han hecho pruebas de carga ni una auditoría de seguridad externa.
- La firma es simple, no avanzada. Para que un finiquito tenga poder liberatorio debe ratificarse ante un ministro de fe o firmarse en Mi DT.
- Mi DT no tiene una interfaz de programación (API). El registro se apoya en fichas para copiar y en una extensión que aún está en piloto.
- Dos formatos de archivo esperan verificación con cargas reales: la indemnización a todo evento en Previred y el registro masivo de contratos en Mi DT.
- Al documentar la arquitectura se detectaron puntos de seguridad por corregir. El principal, que la API del panel aceptaba formularios enviados desde otros sitios (CSRF), ya está corregido en la versión de pruebas y falta publicarlo en producción. Los demás están registrados como pendientes y se analizan en el capítulo 8.

**Este documento.** Sigue la estructura de los estándares ISO/IEC/IEEE 29148 (requerimientos), ISO/IEC/IEEE 42010 e IEEE 1016 (arquitectura y diseño) e ISO/IEC 25010 (calidad). Tiene trece capítulos y diez anexos. Esta versión {{version}} es la primera completa y se entrega para revisión; la versión 1.0 incorporará las correcciones (sección 1.3).
