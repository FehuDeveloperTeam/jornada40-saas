# Solicitud de pronunciamiento a la Dirección del Trabajo

**Borrador para revisión legal.** Solicitud para que la Dirección del Trabajo se pronuncie sobre el sistema de generación, gestión y firma de documentación laboral electrónica Jornada40 (Etapa D del plan de cumplimiento). Sigue los requisitos que la Dirección recordó en el ORD. N° 136, de 14-03-2025 (sistema Nubox), que cita textualmente los del Dictamen N° 0789/015, de 16-02-2015.

**Recomendaciones para presentarla.**

- Adjuntar todos los antecedentes directamente, sin exigir crear una cuenta ni registrarse para verlos: la Dirección no se pronunció sobre una plataforma cuyos antecedentes estaban detrás de un registro.
- Ofrecer una demostración y un acceso de prueba con datos ficticios.
- Presentarla después de publicar en producción la versión del 14-10-2026: el punto V describe que un documento firmado no puede modificarse ni eliminarse, y hoy eso rige solo en el ambiente de pruebas.
- Presentarla por [COMPLETAR: Oficina de Partes de la Dirección Nacional del Trabajo o el canal electrónico que corresponda].

---

**MAT.:** Solicita pronunciamiento sobre el sistema de generación, gestión y firma de documentación laboral electrónica «Jornada40».

**ANT.:** Dictamen N° 0789/015, de 16-02-2015; ORD. N° 2257, de 2022; ORD. N° 82, N° 79 y N° 136, de 2025.

**A:** Sr(a). Director(a) Nacional del Trabajo · Departamento Jurídico

**DE:** [COMPLETAR: razón social], RUT [COMPLETAR], representada por [COMPLETAR: nombre y RUT del representante legal], domiciliada en [COMPLETAR], correo [COMPLETAR].

## I. Antecedentes

[COMPLETAR: razón social] desarrolla y presta Jornada40, una plataforma web por suscripción para que los empleadores, en especial las pequeñas y medianas empresas, gestionen la relación laboral y cumplan la legislación: contratos y anexos adaptados a la Ley N° 21.561, remuneraciones, vacaciones y permisos, pactos y constancias, cartas de término, finiquitos, reglamento interno y el procedimiento de la Ley N° 21.643. Los documentos se firman electrónicamente por el trabajador y quedan disponibles para él y para la fiscalización.

Por la presente solicitamos que esa Dirección se pronuncie sobre si el sistema se ajusta a los requisitos de operación de los sistemas de documentación laboral electrónica, para que los empleadores puedan utilizarlo.

## II. Cumplimiento de los requisitos del Dictamen N° 0789/015

Esa Dirección ha señalado que los requisitos son copulativos. A continuación, cada uno y la forma en que el sistema lo cumple.

**a) «Permitir al fiscalizador una consulta directa de la información vía internet [...] desde cualquier computador de la Dirección del Trabajo conectado a Internet, a partir del RUT del empleador.»**

El portal de fiscalización está en `https://jornada40.cl/inspeccion` y se enlaza desde la portada del sitio («Fiscalización DT»). El fiscalizador ingresa el RUT del empleador, su nombre, su RUT y su correo institucional, y recibe en ese correo un código de un solo uso para entrar. No necesita una cuenta previa ni intervención del empleador.

**b) «Contemplar una medida de seguridad a establecer en conjunto con el respectivo empleador, con el objeto de garantizar que las labores de fiscalización [...] se puedan realizar sin impedimento o restricción, ya sea en razón de fecha, volumen, tipo de documento, o cualquier otra causa».**

Medida de seguridad propuesta:

- el acceso se concede solo a correos del dominio institucional de la Dirección (`dt.gob.cl`); el código vence a los 10 minutos y admite 3 intentos;
- la sesión del fiscalizador es independiente de la del empleador y se cierra tras 15 minutos sin uso o a las 8 horas;
- **sin restricciones de contenido:** el fiscalizador ve a todos los trabajadores, vigentes y desvinculados, y todos los documentos (contratos, anexos, liquidaciones, cartas, vacaciones, finiquitos, pactos y constancias) con su estado de firma; los filtros por trabajador, tipo o fecha solo ayudan a buscar;
- cada ingreso, descarga, ratificación y salida queda registrado, y el empleador lo ve en su panel («Accesos de fiscalización»).

La medida rige igual para todos los empleadores que usan el sistema, que la aceptan al contratarlo. [REVISAR: si la Dirección exige que la medida se acuerde con cada empleador en particular.] Ofrecemos ajustarla a lo que esa Dirección determine, por ejemplo agregar dominios institucionales o habilitar otro medio de identificación del fiscalizador.

**c) «El sistema debe permitir igual consulta y forma de acceso [...] desde computadores del empleador fiscalizado, en el lugar de trabajo.»**

El portal funciona en cualquier navegador conectado a internet, incluidos los computadores del empleador, con el mismo ingreso.

**d) «Permitir la impresión de la documentación laboral, y su certificación a través de firma electrónica simple o avanzada, si corresponde».**

Cada documento se descarga en PDF para imprimirlo. Si está firmado, se entrega la versión firmada, que incluye una página de certificado de la firma con el folio, la fecha y hora, la IP, la forma en que se verificó la identidad del trabajador, quién emitió el documento y las huellas SHA-256 del documento original y del firmado. La firma es simple; el finiquito firmado en el sistema es solo de recepción, porque su poder liberatorio requiere ratificación ante un ministro de fe o su otorgamiento en Mi DT (artículo 177 del Código del Trabajo).

**e) «Permitir directamente ante el empleador fiscalizado y con la sola identificación del fiscalizador, la ratificación de los antecedentes laborales mediante firma electrónica.»**

Dentro del portal, el fiscalizador puede ratificar en terreno cualquier documento con su firma dibujada. La ratificación queda registrada con su nombre, RUT, correo, fecha, hora e IP, y se agrega como una página al documento cuando se descarga.

## III. Exigencias respecto de los trabajadores

**I. Consentimiento expreso.** El contrato de trabajo que genera el sistema incluye una cláusula de consentimiento para que la documentación se confeccione, procese, firme y remita en forma electrónica. Para los trabajadores con contrato anterior, el sistema genera un anexo de consentimiento que el trabajador firma. El consentimiento en papel y su revocación también se registran. Sin consentimiento, el empleador mantiene la documentación en papel. [REVISAR: hoy el sistema registra el consentimiento, pero no impide enviar a firma a quien no lo ha dado; evaluar si debe advertirlo o impedirlo.]

**II. Envío automático al correo personal.** Al enviar un documento a firma, el trabajador recibe un correo con el enlace para revisarlo y firmarlo; al firmarlo, recibe automáticamente el PDF firmado como adjunto, y el documento queda disponible en su portal del trabajador. El sistema advierte al empleador cuando el correo registrado parece corporativo y le pide confirmar que es el correo personal del trabajador. [REVISAR: los documentos que no se envían a firma, como algunas constancias, no se remiten automáticamente al correo; evaluar si deben enviarse al emitirse.]

## IV. Control de la firma por el trabajador

Atendida la observación de los ORD. N° 136 y N° 79 de 2025, el sistema separa la verificación de identidad del acto de firmar:

- el código enviado al correo del trabajador, o su clave del portal del trabajador, **solo verifica su identidad**;
- el acto de firma es la **aceptación expresa** del documento, que el trabajador marca, y su **firma dibujada**; sin ambas, el documento no se firma;
- la página de firma lo explica en cada paso, y el certificado de la firma distingue «Identidad verificada con» y «Acto de firma»;
- el código se guarda solo como una huella criptográfica, de modo que nadie con acceso a la base de datos puede firmar por el trabajador.

El trabajador puede además rechazar el documento indicando el motivo.

## V. Firma del empleador e integridad

- Para enviar documentos a firma, el empleador confirma su clave; cada solicitud registra quién la emitió, cuándo y desde qué IP (ORD. N° 2257 de 2022 y N° 82 de 2025).
- Un documento firmado no puede modificarse ni eliminarse en el sistema: los cambios a un contrato firmado se hacen por anexo.
- Una bitácora encadenada registra cada acción del panel y permite verificar que no fue alterada.

## VI. Antecedentes que se acompañan

1. Descripción técnica del sistema (extracto del documento técnico): seguridad, firma electrónica y documentación electrónica ante la Dirección del Trabajo. [COMPLETAR: decidir el extracto, por ser confidencial.]
2. Capturas del portal de fiscalización, de la página de firma y de un documento firmado con su certificado.
3. Ejemplo de contrato con la cláusula de consentimiento y ejemplo del anexo de consentimiento.
4. Acceso de demostración con datos ficticios: [COMPLETAR: URL, RUT de empleador de prueba y correo institucional habilitado, o propuesta de demostración presencial].
5. Términos y Condiciones, Anexo de tratamiento de datos por encargo y Política de privacidad.

## VII. Consulta adicional

Aprovechamos de consultar si existe o se proyecta un canal de servicios web para el Libro de Remuneraciones Electrónico y el Registro Electrónico Laboral, que permita a los sistemas de los empleadores informar directamente, en lugar de cargar archivos o completar formularios.

## VIII. Petición

Por lo expuesto, solicitamos a esa Dirección pronunciarse en el sentido de que no existe inconveniente para que los empleadores utilicen el sistema de generación, gestión y firma de documentación laboral electrónica «Jornada40», en los términos descritos, o bien indicar las observaciones que deban corregirse.

[COMPLETAR: nombre, firma y cargo del representante legal]

[COMPLETAR: lugar y fecha]
