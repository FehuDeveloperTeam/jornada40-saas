# Requerimientos {#sec-requerimientos}

Este capítulo especifica qué debe hacer el sistema (requerimientos funcionales), con qué reglas legales calcula y decide (reglas de negocio) y con qué atributos de calidad opera (requerimientos no funcionales).

**Origen.** Jornada40 se construyó sin una especificación formal previa. Por eso los requerimientos se reconstruyeron a partir del código y de las pruebas automáticas a la fecha de corte: describen lo que el sistema hace hoy, no lo que se planea. Lo que todavía no está en producción se marca **[Solo en staging]**.

**Formato.** Siguiendo ISO/IEC/IEEE 29148, cada requerimiento tiene:

- un **código** estable (sección 1.5.1);
- un **enunciado** con "debe", que expresa una obligación verificable;
- su **origen**, que es la norma legal cuando la hay; si no, es una decisión de diseño;
- su **verificación**: el archivo de pruebas que lo comprueba. Las pruebas del servidor están en `backend/core/tests/`; las de la interfaz, junto al código en `frontend/src/` y `frontend/extension/src/`; las de navegador, en `frontend/e2e/`. Los requerimientos que se revisan manualmente lo indican.

## Requerimientos funcionales {#sec-rf}

Los requerimientos se agrupan por módulo, en el orden de la sección 2.3.

- **Norma y verificación:** esta columna indica la norma que cita el código, si la hay, y los archivos de prueba que comprueban el requerimiento. "Sin prueba directa" señala lo que hoy no tiene una prueba automática específica. El capítulo 11 detalla la trazabilidad completa.
- **Plan mínimo:** cuando una funcionalidad no está en todos los planes, el enunciado lo indica.

### Cuentas y empresas (CTA)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-CTA-01 | El sistema debe registrar la cuenta del titular con RUT, contraseña y correo. El servidor valida: <br>• el dígito verificador del RUT y que sea de una persona natural; <br>• que el RUT no esté ya registrado; <br>• el correo y la fortaleza de la contraseña. <br>El RUT se guarda formateado. | `test_cuentas` |
| RF-CTA-02 | El sistema debe crear en una sola operación el usuario, su perfil (persona natural o empresa), el plan gratuito de nivel 1 y la suscripción. | `test_cuentas`, `test_pagos` |
| RF-CTA-03 | El sistema debe permitir al titular ingresar solo con su RUT (con o sin formato) y su contraseña, nunca con el correo. Debe rechazar en esa entrada a los usuarios del equipo y a los encargados de la Ley Karin, y registrar en la bitácora los ingresos y los intentos fallidos con su IP. | `test_cuentas`, `test_bitacora` |
| RF-CTA-04 | El sistema debe recuperar la contraseña solo por RUT. Responde lo mismo exista o no la cuenta, sin mostrar el correo, y envía un único enlace válido por 24 horas al correo registrado. La recuperación por correo está cerrada (410). | `test_cuentas` |
| RF-CTA-05 | El sistema debe permitir cambiar la contraseña solo ingresando la actual. Un usuario del equipo cambia la suya, nunca la del titular. | `test_cuentas`, `test_permisos_equipo` |
| RF-CTA-06 | El sistema debe permitir al titular ver y editar su perfil (nombres o razón social, correo, teléfono y dirección), sin cambiar el RUT. | `test_cuentas` |
| RF-CTA-07 | El sistema debe crear una empresa solo dentro del máximo de empresas del plan, con un RUT válido y no registrado antes. El RUT del representante legal también se valida. El RUT de una empresa no cambia después de creada. | `test_cuentas` |
| RF-CTA-08 | El sistema debe desactivar, sin borrar, una empresa que se elimina, y reactivarla solo si queda cupo en el plan. | `test_revision_panel` |
| RF-CTA-09 | El sistema debe guardar la firma dibujada del representante legal con su nombre, cargo y fecha. La API indica si la firma está configurada, pero no devuelve la imagen. | Sin prueba directa |
| RF-CTA-10 | El sistema debe registrar los datos de seguridad social de la empresa: mutual o ISL, caja de compensación, sucursal y tasa de accidentes (entre 0 % y 10 %). | Tablas del formato Previred<br>`test_previred` |
| RF-CTA-11 | El sistema debe guardar las direcciones por partes y armar el texto completo: calle, número o «sin número» con altura o kilómetro, y departamento. Una dirección antigua sin partes se conserva y se separa cuando se puede. | `test_direcciones` |
| RF-CTA-12 | El sistema debe guiar la puesta en marcha mientras la cuenta no tenga empresas: <br>• crear la empresa; <br>• registrar el representante y la firma; <br>• agregar o importar los trabajadores. | Sin prueba directa |
| RF-CTA-13 | El sistema debe reservar al titular los datos y la firma de la empresa, y la creación, desactivación y reactivación de empresas. Los usuarios del equipo solo leen las empresas que tienen asignadas. | `test_permisos_equipo`, `test_equipo` |

: Requerimientos funcionales de cuentas y empresas

### Trabajadores (TRA)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-TRA-01 | El sistema debe crear y editar las fichas solo en empresas de la cuenta, con un RUT válido y no repetido en la empresa. Asigna un número de ficha correlativo por empresa, que se puede editar sin repetirse; dos altas simultáneas no reciben el mismo número [Solo en staging]. | `test_seguridad`, `test_trabajadores` |
| RF-TRA-02 | El sistema debe listar los trabajadores de la cuenta. A los usuarios del equipo les muestra solo los de sus empresas: los ven con cualquier módulo, pero los modifican solo con el módulo de trabajadores en "ver y gestionar". | `test_permisos_equipo` |
| RF-TRA-03 | El sistema debe impedir agregar un trabajador cuando se ocupan todos los cupos del plan (RN-PAG-01), e informar cuándo se libera el cupo de un desvinculado. | `test_pagos` |
| RF-TRA-04 | El sistema debe desvincular a un trabajador sin borrarlo: lo deja inactivo con la fecha de desvinculación de ese día. Para reactivar a quien se desvinculó en un mes anterior, exige un cupo libre. | `test_seguridad`, `test_pagos` |
| RF-TRA-05 | El sistema debe ofrecer un alta rápida que pide lo mínimo y crea la ficha y el contrato: <br>• identidad, cargo y correo; <br>• tipo de contrato y de jornada (con horario o Art. 22); <br>• horas y sueldo. <br>En el Art. 22 guarda la jornada máxima vigente. | Art. 22 CT<br>`panel.spec.ts` |
| RF-TRA-06 | El sistema debe mostrar en la ficha lo que falta para un contrato completo, sin impedir guardar ni emitir. Por ejemplo: nacimiento, nacionalidad, estado civil, dirección, correo, AFP, salud y horario. | `test_trabajadores` |
| RF-TRA-07 | El sistema debe importar trabajadores desde Excel (plan Pyme o superior), con hasta 500 filas y 5 MB: <br>• cada fila se revisa con las mismas reglas en la vista previa y al importar; <br>• informa si la fila se crea, se actualiza, tiene error o excede el cupo; <br>• al actualizar, solo cambian las columnas que traen dato. | `test_trabajadores` |
| RF-TRA-08 | El sistema debe aceptar el banco solo de una lista cerrada y normalizar las formas escritas conocidas. Un banco desconocido se rechaza; un valor antiguo se conserva mientras no cambie. | `test_trabajadores` |
| RF-TRA-09 | El sistema debe entregar desde el servidor las listas de bancos, cuidados y fueros. | `test_trabajadores` |
| RF-TRA-10 | El sistema debe registrar el fuero de una lista cerrada, con su fecha de término (RN-TRA-02), y advertir sin bloquear mientras esté vigente. | Arts. 174, 195 y 201 CT<br>`test_proteccion` |
| RF-TRA-11 | El sistema debe registrar a quién cuida el trabajador y si tiene un hijo con enfermedad grave, y avisar los derechos que eso le da: <br>• teletrabajo preferente; <br>• si cuida a menores, preferencia en el feriado y cambio de jornada en vacaciones escolares, con los próximos períodos; <br>• licencias del seguro SANNA. | Ley 21.645; Ley 21.063; Art. 199 bis CT<br>`test_proteccion` |
| RF-TRA-12 | El sistema debe registrar las solicitudes de conciliación con sus plazos y avisos (RN-TRA-01), y permitir responderlas una sola vez. Las respuestas negativas exigen un motivo de la lista y un fundamento escrito. | Arts. 152 quáter O bis y 207 ter CT<br>`test_proteccion`, `test_peticiones_portal` |
| RF-TRA-13 | El sistema debe advertir cuando el correo del trabajador parece corporativo y permitir confirmar que es personal. La confirmación se anula si el correo cambia. | ORD N° 2965 de la DT<br>`test_trabajadores` |

: Requerimientos funcionales de trabajadores

### Contratos y anexos (CON)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-CON-01 | El sistema debe crear un solo contrato por trabajador, y solo para trabajadores de la cuenta. Los contratos a plazo fijo y por obra o faena exigen una fecha de término posterior al inicio. Se rechaza un plazo fijo de más de un año, o de más de dos si el trabajador es gerente o profesional titulado. | Art. 159 N° 4 CT<br>`test_trabajadores`, `test_seguridad` |
| RF-CON-02 | El sistema debe proponer como jornada por defecto la máxima vigente a la fecha (RN-CON-01). | Ley 21.561<br>`test_jornada` |
| RF-CON-03 | El sistema debe evaluar la jornada y el sueldo al editar el contrato, sin guardarlo, y al leerlo, con los avisos de la regla RN-CON-02. También avisa cuando la próxima reducción dejará el contrato sobre el máximo. | Arts. 22, 28, 40 bis, 42 y 44 CT; Ley 21.561<br>`test_jornada` |
| RF-CON-04 | El sistema debe guardar el horario de cada día (entrada, salida y colación). La colación no cuenta como jornada. | Arts. 28 y 34 CT<br>`test_jornada` |
| RF-CON-05 | El sistema debe rechazar (400) la edición de un contrato con una firma pendiente o en proceso, o ya firmado; los cambios deben hacerse con un anexo. Al editarlo, descarta los PDF guardados. | Art. 11 CT<br>`test_revision_panel`, `test_finiquito` |
| RF-CON-06 | El sistema debe generar el PDF del contrato con: <br>• el horario; <br>• la cláusula de consentimiento para la documentación electrónica; <br>• en el Art. 22, la exclusión del límite de jornada. <br>Si existe una versión firmada, entrega esa. | Art. 22 CT; Ley 19.799; Dictamen DT N° 0789/15<br>`test_finiquito`, `test_direccion_trabajo` |
| RF-CON-07 | El sistema debe generar el anexo de la Ley de 40 horas, que propone el menor valor entre las horas pactadas y la jornada máxima vigente. Desde el plan Pyme permite descargar en un ZIP los anexos de hasta 50 trabajadores. | Ley 21.561<br>`test_jornada`, `test_seguridad` |
| RF-CON-08 | El sistema debe crear anexos de contrato que redactan sus cláusulas a partir de los cambios ("se modifica de X a Y"), con su vigencia. Los cambios se aplican al contrato una sola vez, cuando firma el trabajador. Desde ese momento el anexo no se edita. Tampoco se edita mientras su firma está pendiente o en proceso (400), ni se elimina si alguna vez se envió a firma (403) [Solo en staging]. | Art. 11 CT<br>`gestion.spec.ts`, `test_firmas` |
| RF-CON-09 | El sistema debe crear el pacto de teletrabajo con opciones cerradas y actualizar la modalidad del trabajador según sus pactos firmados (RF-DOC-13). | Ley 21.220<br>`test_documentos_laborales` |
| RF-CON-10 | El sistema debe crear y enviar a firma el anexo de consentimiento para la documentación electrónica a los trabajadores vigentes que no lo dieron, sin duplicarlo. Al firmarse, se registra la fecha y la vía. | Dictamen DT N° 0789/15; Ley 19.799<br>`test_direccion_trabajo` |
| RF-CON-11 | El sistema debe leer con IA un contrato escaneado (PDF, JPG o PNG, hasta 20 MB) y devolver sus datos sin guardar nada, para prellenar el editor. Descarta un RUT con dígito verificador inválido. Si el servicio falla, responde con un mensaje no técnico. | `test_revision_panel` |
| RF-CON-12 | El sistema debe agregar al pie de los contratos y anexos del plan Semilla la marca de Jornada40. | Sin prueba directa |

: Requerimientos funcionales de contratos y anexos

### Remuneraciones (REM)

Cálculo, emisión y edición de las liquidaciones, junto con los conceptos, los parámetros y los avisos. Las fórmulas están en la sección 3.2.2.

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-REM-01 | El sistema debe calcular la liquidación solo en el servidor, con la misma función para la vista previa, que no guarda nada, y para la emisión. Al emitir debe rechazar: <br>• un trabajador de otra cuenta (404); <br>• un trabajador sin contrato (400); <br>• una segunda liquidación del mismo trabajador para el mismo mes (409). | `test_liquidaciones` |
| RF-REM-02 | El sistema debe calcular las horas extra, las comisiones y la semana corrida con los datos del contrato, sin aceptar los valores que envíe el navegador. | Arts. 30 a 32 y 45 CT<br>`test_liquidaciones` |
| RF-REM-03 | El sistema debe rechazar (400) una hora extra con recargo menor a 50 % o no numérico, y aplicar 50 % cuando no se informa. Reconoce la hora extra por la naturaleza del concepto del catálogo, no por la que envía el navegador [Solo en staging]. | Art. 32 CT<br>`test_liquidaciones` |
| RF-REM-04 | El sistema debe descontar los días anteriores al inicio de la relación y los posteriores al término de un desvinculado, aunque se informen 30 días. Debe rechazar (400) un período anterior al inicio. | `test_revision_panel` |
| RF-REM-05 | El sistema debe permitir emitir de una vez las liquidaciones pendientes del período, con 30 días y sin otros ítems. Omite a los desvinculados y los contratos posteriores, e informa el resultado de cada trabajador. La interfaz lo hace emitiendo trabajador por trabajador. | Sin prueba directa |
| RF-REM-06 | El sistema debe impedir modificar (403) una liquidación con firma pendiente, en proceso o completada. Al editar una que no tiene firma, debe recalcularla con las condiciones con que se emitió y descartar su PDF guardado. | `test_liquidaciones` |
| RF-REM-07 | El sistema debe ofrecer el catálogo de conceptos del sistema más los propios de cada empresa. Los del sistema no se modifican (403); los propios se desactivan en vez de borrarse. | `test_liquidaciones` |
| RF-REM-08 | El sistema debe fijar la naturaleza previsional de cada concepto según su tipo, sin aceptarla del cliente: si es imponible, tributable, gratificable o variable. Debe rechazar (400) un concepto de otra cuenta o usado con una naturaleza distinta. | Art. 32 CT, inciso final<br>`test_liquidaciones` |
| RF-REM-09 | El sistema debe ofrecer para cada tipo de concepto solo los códigos del LRE compatibles, y rechazar (400) uno que no corresponda. | `test_lre` |
| RF-REM-10 | El sistema debe mostrar en solo lectura los parámetros previsionales vigentes y advertir cuando no están confirmados o tienen más de 14 meses (RN-REM-01). | `test_parametros`, `test_cuentas` |
| RF-REM-11 | El sistema debe mostrar la UF, la UTM y la jornada máxima del día, y advertir en el panel cuando usa valores de respaldo (RN-REM-02). | `test_parametros` |
| RF-REM-12 | El sistema debe calcular la asignación familiar con la tabla de tramos del período y reemplazar el monto ingresado a mano (RN-REM-13). | DFL 150 de 1981; Ley 18.987<br>`test_asignacion_familiar` |
| RF-REM-13 | El sistema debe advertir, sin bloquear, en la vista previa y para todas las liquidaciones de un período, de los casos de la regla RN-DOC-05 y de las horas extra que se pagan por exceder el tope de compensación. | Arts. 32 y 58 CT<br>`test_documentos_laborales` |
| RF-REM-14 | El sistema debe entregar el PDF de la liquidación en su versión firmada cuando existe. En el plan Semilla, el PDF lleva la marca de Jornada40. | `test_liquidaciones`, `test_firmas` |
| RF-REM-15 | El sistema debe aplicar los pactos firmados de horas extra compensadas con descanso (plan Pyme o superior) y de indemnización a todo evento (RN-REM-14 y RN-REM-15). | Arts. 32 y 164 CT<br>`test_horas_compensatorias`, `test_indemnizacion_todo_evento` |
| RF-REM-16 | El sistema debe ofrecer dos comandos de administración. El primero propone parámetros leídos de Previred, que no rigen hasta confirmarlos y no se escriben si la lectura es incompleta. El segundo revisa y recalcula las liquidaciones emitidas sin el tope imponible. | `test_parametros` |

: Requerimientos funcionales de remuneraciones

### Archivos legales (ARC)

Archivos y certificados que el empleador presenta a Previred, a la Dirección del Trabajo y al Servicio de Impuestos Internos.

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-ARC-01 | El sistema debe generar el archivo Previred del período: una línea de 105 campos separados por «;» por liquidación, en Latin-1 y con fin de línea CRLF. Requiere plan Pyme o superior. | Formato Previred, versión 100<br>`test_previred` |
| RF-ARC-02 | El sistema no debe generar el archivo Previred si falta un dato que Previred rechaza. En ese caso responde (400) con la lista por trabajador: sexo, nombres, AFP, Isapre, tramo y cargas de la asignación familiar, o días sin movimiento de personal. | `test_previred` |
| RF-ARC-03 | Cada línea Previred debe informar: <br>• la renta con tope y las cotizaciones del trabajador; <br>• los aportes del empleador: seguro de invalidez y sobrevivencia, expectativa de vida, rentabilidad protegida y 0,1 %; <br>• la salud y la caja de compensación; <br>• la mutual o el ISL; <br>• la asignación familiar; <br>• los movimientos de personal; <br>• el aporte a la indemnización a todo evento (campos 31 a 36). | Ley 21.735; Art. 164 CT<br>`test_previred` |
| RF-ARC-04 | El sistema debe revisar el Libro de Remuneraciones Electrónico antes de exportarlo. <br>• Bloquean la exportación: RUT inválido, fecha de inicio ausente, finiquito sin causal, comuna sin código, AFP o Isapre faltante, o un trabajador con contrato sin liquidación del mes. <br>• Solo generan aviso: conceptos sin código del LRE, jornada no estándar y totales que no cuadran. | `test_lre` |
| RF-ARC-05 | El sistema debe exportar el LRE con las 147 columnas de la plantilla oficial de Mi DT, separado por «;», en cp1252 y con una fila por liquidación (plan Pyme o superior). Los aportes del empleador se calculan como en Previred (códigos 4151, 4152, 4155, 4157 y 4131), y los totales se suman desde las mismas columnas. | Manual de usuario del LRE v8.0; Ley 21.735<br>`test_lre` |
| RF-ARC-06 | El sistema debe generar el libro de remuneraciones del período en Excel o PDF, con una fila de totales que cuadra con las columnas. | Art. 62 CT<br>`test_liquidaciones` |
| RF-ARC-07 | El sistema debe entregar un consolidado de todas las empresas de la cuenta, por año o por mes, con masa salarial, trabajadores, costo del empleador, líquido y su evolución mensual (plan Pyme o superior). | Ley 21.735<br>`test_pagos` |
| RF-ARC-08 | El sistema debe entregar en un ZIP los PDF de todas las liquidaciones de una empresa y período, con la versión firmada cuando existe (plan Pyme o superior). | `test_liquidaciones` |
| RF-ARC-09 | El sistema debe emitir el Certificado N° 6 en todos los planes, solo para un año cerrado y con los 12 factores de actualización del SII cargados. Emite uno por trabajador con las columnas de la resolución del SII. | Art. 101 LIR; Res. Ex. SII N° 6.509<br>`test_certificado_sueldos` |
| RF-ARC-10 | El sistema debe numerar los certificados en forma correlativa por empresa. Al volver a emitirlos: <br>• se conserva el certificado de un trabajador cuyos datos no cambiaron; <br>• si cambiaron, se crea uno nuevo que reemplaza al anterior, que queda como historial. <br>Muestra los plazos legales: 14 de marzo para los certificados y 27 de marzo para la DJ 1887. | `test_certificado_sueldos` |
| RF-ARC-11 | El sistema debe entregar cada certificado en PDF, todos los del año en un ZIP y una planilla de apoyo para la declaración jurada 1887. La planilla no es el archivo de carga del SII. | DJ 1887<br>`test_certificado_sueldos` |

: Requerimientos funcionales de archivos legales

### Vacaciones y feriado (VAC)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-VAC-01 | El sistema debe calcular en el servidor los días hábiles de un período de vacaciones, con los feriados legales de Chile, ignorar el valor que envíe el navegador y ofrecer ese cálculo como vista previa. Rechaza (400) un término anterior al inicio. | Art. 69 CT<br>`test_feriado`, `test_finiquito` |
| RF-VAC-02 | El sistema debe entregar el saldo de feriado de cada trabajador con sus días básicos y progresivos (RN-VAC-02 a RN-VAC-04). Requiere plan Starter o superior. | Arts. 67 y 68 CT<br>`test_feriado` |
| RF-VAC-03 | El sistema debe advertir cuando el saldo acumula dos o más períodos, con la fecha antes de la cual corresponde otorgar el primero. El aviso no descuenta días. | Art. 70 CT<br>`test_feriado` |
| RF-VAC-04 | El sistema debe registrar vacaciones legales y progresivas, permisos sin goce y días libres por horas extra, solo para trabajadores de la cuenta. Requiere plan Starter o superior. | Arts. 32, 67 y 68 CT<br>`test_seguridad` |
| RF-VAC-05 | El sistema debe registrar un día libre por horas extra (plan Pyme o superior) así: <br>• descuenta de la bolsa las horas de la jornada de ese día; <br>• exige saldo suficiente a la fecha; <br>• con menos de 48 horas de anticipación, solo avisa. | Art. 32 inc. 4° CT<br>`test_horas_compensatorias` |
| RF-VAC-06 | El sistema debe permitir al empleador aprobar o rechazar, con un motivo de la lista, las vacaciones que el trabajador pidió desde el portal. La respuesta se avisa por correo. | `test_peticiones_portal` |
| RF-VAC-07 | El sistema debe generar el comprobante de vacaciones en PDF con su fecha de registro, y entregar la versión firmada cuando existe. El comprobante de un día libre por horas extra lo nombra así e indica las horas de descanso [Solo en staging]. Un comprobante con firma pendiente, en proceso o completada no se modifica (400) [Solo en staging]. | Arts. 32, 67 y 68 CT; Ley 19.799<br>`test_horas_compensatorias`, `test_firmas` |

: Requerimientos funcionales de vacaciones y feriado

### Documentos legales y laborales (DOC)

Cartas, pactos, autorizaciones y constancias. Se crean desde listas cerradas y el sistema redacta sus cláusulas.

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-DOC-01 | El sistema debe emitir amonestaciones, cartas de despido, renuncias o mutuos acuerdos y constancias solo para trabajadores de la cuenta. A los usuarios del equipo les muestra solo los tipos de sus módulos. Una carta con firma pendiente, en proceso o completada no se modifica (400) [Solo en staging]. La renuncia o el mutuo acuerdo se puede enviar a firma, con su causal y el aviso del Art. 177: el empleador solo puede invocarlo si se ratifica ante un ministro de fe o lo firma el presidente del sindicato o el delegado [Solo en staging]. | Art. 177 CT<br>`test_seguridad`, `test_pagos`, `test_firmas` |
| RF-DOC-02 | El sistema debe exigir plan Starter o superior para crear, modificar o descargar una carta de despido (403 en el plan Semilla). | `test_pagos` |
| RF-DOC-03 | La carta de despido debe tomar la causal de una lista cerrada de 22 causales, con su texto legal. Incluye: <br>• los hechos y el aviso previo; <br>• el estado de las cotizaciones, advirtiendo que con deuda el despido no produce efecto; <br>• la modalidad del finiquito. | Arts. 159, 160, 161, 162 y 163 bis CT; Ley 19.631<br>`test_firmas` |
| RF-DOC-04 | El sistema debe calcular las indemnizaciones que informa la carta con el mismo cálculo del finiquito (RN-FIN-01 a RN-FIN-03), ignorando los montos que envíe el navegador. | Arts. 162 y 163 CT<br>`test_finiquito` |
| RF-DOC-05 | El sistema debe advertir, sin bloquear, que el trabajador tiene fuero vigente y no puede ser despedido sin autorización judicial. | Art. 174 CT<br>`test_proteccion` |
| RF-DOC-06 | El sistema debe crear pactos, autorizaciones y constancias solo con valores de las listas cerradas que entrega al formulario, y rechazar (400) cualquier otro. Requiere plan Starter o superior, salvo la entrega de elementos de protección personal. | `test_documentos_laborales` |
| RF-DOC-07 | El sistema debe generar el pacto de horas extra según la regla RN-DOC-02. La compensación con días libres exige plan Pyme o superior. | Arts. 31 y 32 CT<br>`test_documentos_laborales`, `test_horas_compensatorias` |
| RF-DOC-08 | El sistema debe generar la autorización de descuento voluntario y registrar su revocación (RN-DOC-03). | Art. 58 inc. 2° CT<br>`test_documentos_laborales` |
| RF-DOC-09 | El sistema debe calcular los días de cada permiso legal con goce de sueldo (RN-DOC-01) y validar la fecha de inicio según el tipo de permiso. | Arts. 66, 195 y 207 bis CT<br>`test_documentos_laborales` |
| RF-DOC-10 | El sistema debe permitir un solo pacto activo de indemnización a todo evento por trabajador, desde los seis años de servicio cumplidos. | Art. 164 CT<br>`test_documentos_laborales` |
| RF-DOC-11 | El sistema debe registrar la entrega de elementos de protección personal en todos los planes y la información de riesgos desde el plan Pyme, con sus avisos (RN-DOC-06). | Ley 16.744 art. 68; DS 44 de 2023, arts. 13 y 15<br>`test_seguridad_laboral` |
| RF-DOC-12 | El sistema debe dar efecto a un documento laboral solo una vez firmado. Solo permite anular (400 en otro caso) un documento sin firma pendiente, en proceso ni completada. | `test_documentos_laborales` |
| RF-DOC-13 | El sistema debe crear el pacto de teletrabajo como un anexo de contrato, con desconexión de 12 horas, equipos y reversibilidad. Debe: <br>• avisar si el trabajador figura a distancia sin pacto o si el pacto vence en 30 días; <br>• devolverlo a modalidad presencial cuando vencen todos sus pactos; <br>• no cambiar la modalidad que se registró a mano. | Ley 21.220; Arts. 152 quáter G y siguientes CT<br>`test_documentos_laborales` |

: Requerimientos funcionales de documentos legales y laborales

### Finiquitos (FIN)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-FIN-01 | El sistema debe simular el finiquito sin guardarlo, con el mismo cálculo de la emisión, y advertir sin bloquear del fuero vigente a la fecha de término. Requiere plan Starter o superior. | Art. 174 CT<br>`test_proteccion` |
| RF-FIN-02 | El sistema debe validar los datos de entrada del finiquito: <br>• que el trabajador sea de la cuenta; <br>• que la fecha de término no sea anterior al ingreso; <br>• que la causal sea de la lista; <br>• que los montos voluntarios no sean negativos. <br>Los montos legales siempre los calcula el servidor (RN-FIN-01 a RN-FIN-07). | `test_finiquito` |
| RF-FIN-03 | El sistema debe registrar la modalidad del finiquito: electrónica, otorgada en Mi DT, o presencial ante un ministro de fe. Para la electrónica entrega una ficha con los datos y los pasos de Mi DT. | Art. 177 CT<br>`test_finiquito` |
| RF-FIN-04 | El sistema debe registrar una sola vez la ratificación, por la vía que corresponde a la modalidad y con fecha entre la emisión y hoy. Desde entonces el finiquito no se modifica (403). | Art. 177 CT<br>`test_finiquito` |
| RF-FIN-05 | El sistema debe impedir modificar (403) un finiquito con firma pendiente, en proceso o completada. Al editar uno abierto, recalcula los montos y descarta el PDF guardado. | `test_finiquito` |
| RF-FIN-06 | El PDF del finiquito debe advertir que solo tiene poder liberatorio si se ratifica ante un ministro de fe o se firma en el sitio de la DT. La firma en Jornada40 es solo de recepción. | Arts. 177 y siguientes CT<br>`test_finiquito` |

: Requerimientos funcionales de finiquitos

### Firma electrónica (FIR)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-FIR-01 | El sistema debe exigir que quien envía un documento a firma confirme su propia clave; sin ella responde 428. La confirmación dura 10 minutos. Cada solicitud registra al emisor, su IP, la hora de la confirmación y el origen (panel o portal). | ORD N° 82 de 2025<br>`test_firmas` |
| RF-FIR-02 | El sistema debe crear la solicitud solo para tipos de documento de la lista, con la firma del empleador configurada y el correo del trabajador registrado. El PDF se guarda en el almacenamiento externo y se fija un plazo de firma de 7 días. | Ley 19.799<br>`test_firmas` |
| RF-FIR-03 | El sistema debe buscar el documento siempre dentro del trabajador indicado y rechazar uno de otro trabajador o de otra cuenta. A los usuarios del equipo les permite solo los tipos de documento de sus módulos. | `test_revision_panel`, `test_permisos_equipo` |
| RF-FIR-04 | El sistema debe impedir (400) que un documento tenga dos solicitudes vivas, es decir, pendiente, en proceso o firmada. Permite volver a enviarlo si la anterior venció, se rechazó o se canceló. | `test_revision_panel` |
| RF-FIR-05 | El sistema debe informar cuando el correo de firma no salió, dejando la solicitud pendiente para reenviarla. Solo reenvía solicitudes pendientes. | `test_firmas` |
| RF-FIR-06 | El sistema debe enviar a firma en un solo paso las liquidaciones de un período que no tengan solicitud viva, e informar las omitidas con su motivo. | `test_firmas` |
| RF-FIR-07 | El sistema debe manejar los estados pendiente, en proceso, firmado, rechazado, expirado y cancelado. <br>• Las solicitudes pendientes vencidas pasan a expiradas. <br>• Las que llevan más de 10 minutos en proceso se liberan. <br>• Solo se cancela una solicitud pendiente. | `test_revision_panel` |
| RF-FIR-08 | El sistema debe entregar siempre la versión firmada de un documento firmado: en las descargas del panel, los ZIP, el portal del trabajador y la fiscalización. La descarga lo indica en su encabezado y en el nombre del archivo. | `test_firmas` |
| RF-FIR-09 | El sistema debe enviar el código de verificación solo si el RUT ingresado es el del trabajador y la solicitud está vigente. El código: <br>• tiene 6 dígitos, dura 10 minutos y admite 3 intentos; <br>• se puede pedir uno por minuto y cinco por hora; <br>• se guarda solo como huella HMAC-SHA256. | Ord. DT N° 136 y N° 79 de 2025<br>`test_firmas` |
| RF-FIR-10 | El sistema debe permitir verificar la identidad con la clave del portal del trabajador, solo de la cuenta que verificó el correo de esa solicitud. Tras 5 intentos fallidos, la clave queda bloqueada por una hora. Registra el método de verificación usado. | Ord. DT N° 136 y N° 79 de 2025<br>`test_firmas` |
| RF-FIR-11 | El sistema debe mostrar el documento al trabajador solo con la sesión obtenida al verificar su identidad (403 sin ella). Después de firmar, debe conservar esa sesión para que el trabajador descargue la versión firmada. | `test_revision_panel` |
| RF-FIR-12 | Para firmar, el sistema debe exigir la sesión, la aceptación expresa y el trazo dibujado. Debe impedir firmas dobles y devolver la solicitud a pendiente si la firma falla a medio camino. | Ord. DT N° 136 y N° 79 de 2025<br>`test_firmas` |
| RF-FIR-13 | El sistema debe agregar al PDF original, sin alterarlo, una página de certificado con: <br>• las firmas y un folio correlativo por empresa; <br>• la fecha, la hora, la IP y el correo del firmante; <br>• el método de verificación y el acto de firma; <br>• los datos del emisor y la huella SHA-256 del original. <br>Guarda también la huella del PDF firmado. | Ley 19.799; Ord. DT N° 136 y N° 79 de 2025<br>`test_firmas` |
| RF-FIR-14 | Al completar una firma, el sistema debe aplicar sus efectos y enviar el PDF firmado por correo al trabajador y al empleador. Los efectos son: aplicar el anexo al contrato, cambiar la modalidad si es un pacto de teletrabajo y registrar el consentimiento electrónico. Una falla del correo no revierte la firma. | Dictamen DT N° 0789/15<br>`test_documentos_laborales`, `test_direccion_trabajo` |
| RF-FIR-15 | El sistema debe permitir que el trabajador rechace una solicitud vigente indicando un motivo, y avisar al empleador por correo. | `test_firmas` |
| RF-FIR-16 | El sistema debe limitar los intentos de la firma pública por enlace y con un tope amplio por IP, para que varios trabajadores de un mismo lugar puedan firmar desde la misma red. | `test_revision_panel` |

: Requerimientos funcionales de firma electrónica

### Portal del trabajador (POR)

Acceso propio del trabajador, independiente del panel del empleador. Requiere que la empresa tenga plan Pyme o superior.

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-POR-01 | El sistema debe habilitar el portal solo para las fichas de empresas activas cuyo titular tenga plan Pyme o superior. Un desvinculado conserva el acceso según la regla RN-POR-01. | `test_portal_trabajador` |
| RF-POR-02 | El sistema debe pedir primero el RUT y ofrecer el ingreso con clave si la persona tiene una; si no, envía un código. La respuesta es la misma haya o no fichas con ese RUT, y los correos de destino se muestran enmascarados. | `test_portal_trabajador` |
| RF-POR-03 | El sistema debe enviar un código distinto a cada correo de las fichas habilitadas, en mensajes separados. Cada código: <br>• tiene 6 dígitos, dura 10 minutos y se guarda solo como huella; <br>• verifica solo su propio correo y se anula tras 3 intentos fallidos; <br>• se puede pedir hasta cinco veces por hora y una vez por minuto. | `test_portal_trabajador` |
| RF-POR-04 | El sistema debe manejar una cuenta por persona, no por RUT: <br>• un código entra a la cuenta que ya verificó ese correo, o crea una nueva; <br>• verificar un correo de otra cuenta del mismo RUT lo traslada; <br>• si una clave sirve en varias cuentas del mismo RUT, las une. | `test_portal_trabajador` |
| RF-POR-05 | El sistema debe mostrar solo las fichas cuyo correo verificó la cuenta. Las demás fichas del RUT aparecen "por vincular", con el correo enmascarado y sin el nombre de la empresa, y se agregan con un código enviado a ese correo. | `test_portal_trabajador` |
| RF-POR-06 | El sistema debe permitir una clave opcional, de 8 caracteres o más, que no sea solo números ni el RUT. Crearla o cambiarla cierra las otras sesiones. Quien entró con un código puede cambiarla sin conocer la anterior. | `test_portal_trabajador` |
| RF-POR-07 | El sistema debe usar una sesión propia del portal, independiente de la del empleador. Acepta solo solicitudes JSON y limita los intentos por IP y por cuenta. | `test_portal_trabajador` |
| RF-POR-08 | El sistema debe mostrar y entregar solo: <br>• las liquidaciones firmadas, en su versión firmada; <br>• el contrato; <br>• los documentos con firma completada; <br>• el reglamento interno vigente. <br>Cada descarga se vuelve a validar en el servidor. | Art. 156 CT<br>`test_portal_trabajador` |
| RF-POR-09 | El sistema debe listar en el Inicio del portal las firmas pendientes y las liquidaciones de meses cerrados que aún no se envían a firma. El trabajador puede iniciar su firma sin esperar al empleador. | `test_portal_trabajador` |
| RF-POR-10 | El sistema debe permitir pedir documentos solo de una lista cerrada, sin texto libre. La lista incluye solo lo que aún no existe o no está en firma: <br>• la liquidación de un mes cerrado; <br>• el contrato; <br>• el anexo de 40 horas, si la jornada supera el máximo; <br>• el comprobante de unas vacaciones aprobadas; <br>• el finiquito. <br>No admite solicitudes repetidas, y una solicitud se resuelve sola cuando el documento se envía a firma. | `test_solicitudes_documento` |
| RF-POR-11 | El sistema debe permitir al empleador descartar una solicitud de documento indicando un motivo de la lista, que el trabajador ve. | `test_solicitudes_documento` |
| RF-POR-12 | El sistema debe emitir al instante certificados de antigüedad, renta, cotizaciones, vacaciones, jornada y término (este último sin causal), con los requisitos de la regla RN-POR-02. | Arts. 22 y 67 CT<br>`test_certificados` |
| RF-POR-13 | Cada certificado debe llevar folio, código y QR de verificación, y conservar lo que afirma. La verificación pública muestra el RUT parcialmente oculto. El empleador puede anularlo indicando un motivo, sin borrarlo: la verificación informa que fue anulado y el trabajador puede emitir otro. | `test_certificados` |
| RF-POR-14 | El sistema debe permitir pedir vacaciones, permisos legales y ajustes de conciliación, con los límites de la regla RN-POR-03 y avisos que no bloquean. Además, se rechazan el cambio de jornada a quien no cuida a un menor y el permiso cuyo hecho está a más de 60 días de la fecha. | Ley 21.645<br>`test_peticiones_portal` |
| RF-POR-15 | El sistema debe avisar por correo al empleador cada petición y al trabajador cada respuesta. Aprobar un permiso crea su constancia para enviarla a firma. | `test_peticiones_portal` |
| RF-POR-16 | El sistema debe mostrar en la ficha el estado del portal de ese trabajador y permitir invitarlo por correo, como máximo una vez cada 24 horas. Los estados posibles son: sin plan, sin acceso, sin correo, no ingresa y activo. | `test_estado_portal` |

: Requerimientos funcionales del portal del trabajador

### Dirección del Trabajo (DT)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-DT-01 | El sistema debe calcular lo que cada empresa debe registrar en Mi DT: contratos, anexos firmados o aplicados, anexos de 40 horas firmados y términos. Cada registro muestra su estado (registrado, vencido o pendiente) y su plazo (RN-DT-01). Los vencidos aparecen primero. | Ley 21.327<br>`test_direccion_trabajo` |
| RF-DT-02 | El sistema debe entregar una ficha con los datos en el orden del formulario de Mi DT: el contrato en sus cuatro etapas, con las cláusulas extraídas del contrato de Jornada40, y las fichas de anexo y de término. En la etapa 3 incluye el total imponible y no imponible [Solo en staging]. | DS N° 14 de 2023<br>`test_direccion_trabajo` |
| RF-DT-03 | El sistema debe dejar constancia de lo registrado en Mi DT, con una fecha que no sea futura, y permitir desmarcarlo. La vía, el comprobante y la persona que lo marcó se registran [Solo en staging]. | `test_direccion_trabajo` |
| RF-DT-04 | El sistema debe avisar cuántos anexos aún no se firman, porque no entran a la lista de registro hasta firmarse [Solo en staging]. | `test_direccion_trabajo` |
| RF-DT-05 | El sistema debe generar, desde el plan Pyme, un archivo de carga masiva de contratos con el formato del instructivo de la DT. La interfaz no lo ofrece mientras no se verifique con la plantilla vigente de Mi DT. | Instructivo de registro masivo v21.04.22<br>`test_direccion_trabajo` |
| RF-DT-06 | El sistema debe mostrar cuántos trabajadores dieron su consentimiento para la documentación electrónica, y enviar a firma el anexo a los que faltan (RF-CON-10). También debe registrar un consentimiento dado en papel o su revocación. | Dictamen DT N° 0789/15<br>`test_direccion_trabajo` |
| RF-DT-07 | El sistema debe permitir que un fiscalizador pida acceso indicando el RUT del empleador, su nombre, su RUT y un correo institucional (`dt.gob.cl`). El código de un solo uso dura 10 minutos y se puede pedir uno por minuto. La respuesta es la misma exista o no la empresa en Jornada40, también en la espera de un minuto y ante una falla del correo [Solo en staging]. | Dictamen DT N° 0789/15<br>`test_inspeccion` |
| RF-DT-08 | El sistema debe abrir una sesión propia de fiscalización tras validar el código, con 3 intentos. La sesión del empleador no da acceso a esta área. | `test_inspeccion` |
| RF-DT-09 | El sistema debe mostrar al fiscalizador, solo en lectura y sin restricciones: <br>• todos los trabajadores, activos y desvinculados; <br>• todos sus documentos, con su estado de firma y sus ratificaciones. | Dictamen DT N° 0789/15<br>`test_inspeccion` |
| RF-DT-10 | El sistema debe entregar al fiscalizador la versión firmada de cada documento, más una página por cada ratificación hecha en terreno con su firma dibujada. | `test_inspeccion` |
| RF-DT-11 | El sistema debe registrar cada ingreso, descarga, ratificación y salida del fiscalizador, y mostrar ese registro al empleador. | `test_inspeccion` |

: Requerimientos funcionales de la Dirección del Trabajo

### Reglamento interno y seguridad laboral (REG)

Requiere plan Pyme o superior, salvo la entrega de elementos de protección personal (RF-DOC-11).

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-REG-01 | El sistema debe generar una plantilla guía del reglamento, en Word o PDF, para el rubro de la empresa (lista cerrada de 10 rubros), con: <br>• los riesgos de ese rubro y sus medidas; <br>• los elementos de protección personal; <br>• las obligaciones y prohibiciones; <br>• el protocolo de la Ley Karin. <br>Las partes por completar se destacan en amarillo, y la plantilla advierte que es solo una guía. | Art. 154 CT; Ley 16.744 art. 67; DS 44 de 2023; Ley 21.643<br>`test_reglamento` |
| RF-REG-02 | El sistema debe proponer el tipo de reglamento según la dotación: reglamento de orden, higiene y seguridad (RIOHS) con 10 o más trabajadores activos, o de higiene y seguridad (RIHS) con menos. Avisa cuando falta el reglamento exigible. | Art. 153 CT; Ley 16.744 art. 67<br>`test_reglamento` |
| RF-REG-03 | El sistema debe registrar cada versión del reglamento como un PDF legible de hasta 20 MB, con su tipo y una fecha de publicación que no sea futura. Al crear una versión, las anteriores quedan inactivas. | `test_reglamento` |
| RF-REG-04 | El sistema debe calcular la vigencia y el plazo de remisión de cada versión, y avisar (RN-REG-01) cuando la remisión vence o cuando la versión cumple un año. Debe registrar la remisión a la DT y a la Seremi de Salud, o deshacerla. | Arts. 153 y 156 CT<br>`test_reglamento`, `test_resumen` |
| RF-REG-05 | El sistema debe enviar a firma una constancia de recepción de la versión vigente a cada trabajador que no la tenga, previa confirmación de identidad. Al PDF de la constancia se le adjunta el reglamento completo, como prueba de qué versión recibió el trabajador. | Arts. 153 y 156 CT; DS 44 de 2023, art. 56<br>`test_reglamento` |
| RF-REG-06 | El sistema debe enviar también la constancia del reglamento cada vez que envía un contrato a firma, si el trabajador no la tiene. Una falla en ese envío no impide el del contrato. | Art. 154 bis CT<br>`test_reglamento` |
| RF-REG-07 | El sistema debe mostrar el reglamento vigente en el portal del trabajador. | Art. 156 CT<br>`test_reglamento` |
| RF-REG-08 | El sistema debe enviar a firma, en una sola acción y previa confirmación de identidad, la información de riesgos a todos los trabajadores que no la tienen. Muestra el avance como firmados sobre el total. | DS 44 de 2023, art. 15<br>`test_seguridad_laboral` |
| RF-REG-09 | El sistema debe avisar, en la ficha y en el resumen por correo, cuando un trabajador: <br>• no tiene firmada la información de riesgos; <br>• cambió de cargo desde que la firmó; <br>• tiene su capacitación en elementos de protección personal con más de 12 meses. | DS 44 de 2023, arts. 13 y 15<br>`test_seguridad_laboral` |

: Requerimientos funcionales del reglamento interno y la seguridad laboral

### Ley Karin (KAR)

Procedimiento de prevención, investigación y sanción del acoso y la violencia en el trabajo. El encargado de denuncias tiene un acceso aislado del resto del sistema. Designarlo requiere plan Pyme o superior.

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-KAR-01 | El sistema debe registrar el canal interno de denuncias de cada empresa y enviar a firma, cada semestre, el aviso de canales a los trabajadores. El aviso informa el canal interno, la DT, la mutual y la SUSESO. | Art. 211-A inc. 4° CT; DS 21 de 2024, art. 6 c); Circular SUSESO 3813<br>`test_ley_karin` |
| RF-KAR-02 | El sistema debe permitir solo al titular designar encargados de denuncias, dentro de su cupo, y editarlos, invitarlos y eliminarlos. Eliminar a un encargado cierra sus sesiones y libera el cupo. | `test_acceso_karin` |
| RF-KAR-03 | El sistema debe permitir que el encargado cree su clave con un enlace de un solo uso e ingrese con su RUT y su clave, con una sesión propia: <br>• se cierra tras 5 minutos sin uso y a las 4 horas en total; <br>• se invalida al cambiar la clave o al eliminar al encargado. | `test_acceso_karin`, `test_sesion_inactividad` |
| RF-KAR-04 | El sistema debe aislar el acceso de la Ley Karin del resto del sistema: <br>• la sesión del panel no abre sus rutas; <br>• la sesión del encargado no abre el panel; <br>• el usuario del encargado no puede ingresar por la puerta del titular. | Art. 211-C CT<br>`test_acceso_karin`, `test_denuncias_karin` |
| RF-KAR-05 | El sistema debe llevar un registro reservado de solo agregar, encadenado con SHA-256 y con descripciones cifradas, de toda la actividad del acceso y de cada expediente. En la bitácora del titular deja solo una marca diaria, sin detalle. | Art. 211-C CT<br>`test_acceso_karin` |
| RF-KAR-06 | El sistema debe guardar cifrados los datos de las denuncias, sus etapas y sus archivos, y permitir rotar las claves de cifrado. | Art. 211-C CT<br>`test_acceso_karin` |
| RF-KAR-07 | El sistema debe registrar denuncias solo en las empresas a cargo del encargado: <br>• no acepta denuncias anónimas: la persona afectada se identifica con su RUT; <br>• exige al menos una persona denunciada, con su vínculo, y el relato de los hechos; <br>• asigna un folio correlativo por empresa. | DS 21 de 2024, arts. 11, 12 y 15; Dictamen DT N° 497/21<br>`test_denuncias_karin` |
| RF-KAR-08 | El sistema debe exigir que la denuncia se derive a la DT cuando la persona denunciada es el empleador o un directivo, o cuando quien denuncia lo pide. En esos casos rechaza la decisión de investigar en la empresa. | Art. 4° CT; DS 21 de 2024, art. 12<br>`test_denuncias_karin` |
| RF-KAR-09 | El sistema debe calcular los plazos de cada paso (RN-KAR-01) y su estado: cumplido, vencido, por vencer, pendiente o en espera. También debe llevar el estado del expediente, que no admite cambios una vez cerrado. | DS 21 de 2024<br>`test_denuncias_karin` |
| RF-KAR-10 | El sistema debe registrar las medidas de resguardo, la decisión, las fechas de cada paso, quién investiga, los participantes con su citación y su declaración, y los antecedentes revisados. Usa listas cerradas siempre que la norma lo permite. | DS 21 de 2024, arts. 12, 13, 14 y 15<br>`test_denuncias_karin` |
| RF-KAR-11 | El sistema debe registrar el informe, el pronunciamiento de la DT, las medidas y el cierre. La conclusión, las medidas correctivas y las sanciones se eligen de listas cerradas: la plataforma no decide si hubo acoso ni propone sanciones. | DS 21 de 2024, arts. 16 a 22; Art. 160 CT<br>`test_denuncias_karin` |
| RF-KAR-12 | El sistema debe advertir, sin bloquear, cuando: <br>• falta una derivación obligatoria; <br>• una medida de resguardo afecta a la persona afectada; <br>• el encargado o quien investiga es parte del caso; <br>• hay partes sin declarar. | DS 21 de 2024, arts. 14, 15 y 20<br>`test_denuncias_karin` |
| RF-KAR-13 | El sistema debe aceptar archivos del expediente en PDF, JPG o PNG de hasta 15 MB, y cifrarlos antes de guardarlos en el almacenamiento externo, junto con su huella SHA-256. | `test_denuncias_karin` |
| RF-KAR-14 | El sistema debe generar al momento, sin guardarlos, los diez documentos del expediente. Entre ellos están la recepción, las actas, la citación y el informe, este último con los testigos anonimizados. Cada descarga queda en el registro reservado solo con el folio. | Art. 211-C CT; DS 21 de 2024, art. 15<br>`test_denuncias_karin` |
| RF-KAR-15 | El sistema debe mostrar al titular solo cifras por empresa: denuncias abiertas, vencidas, por vencer y el próximo vencimiento. Al encargado le envía, como máximo una vez al día, un correo solo con cifras cuando hay plazos vencidos o por vencer. | Art. 211-C CT<br>`test_denuncias_karin` |
| RF-KAR-16 | El sistema debe mostrar en el portal a cada trabajador los casos en que participa, según su rol: <br>• la persona afectada o denunciante ve la materia, el estado y las medidas ya notificadas; <br>• la persona denunciada ve el caso solo desde que la citan; <br>• el testigo ve solo su citación. <br>Nadie descarga el informe desde el portal. | `test_denuncias_karin` |
| RF-KAR-17 | El sistema debe permitir denunciar desde el portal, con los datos de la ficha del trabajador, solo si la empresa tiene un encargado activo. Admite hasta 3 denuncias en 24 horas por empresa. Envía un comprobante con folio, fecha y hora, y a los encargados un aviso sin contenido. | DS 21 de 2024, art. 11<br>`test_denuncias_karin` |
| RF-KAR-18 | El sistema debe advertir solo al encargado de posibles represalias contra la persona afectada, quien denunció o los testigos, desde la denuncia hasta 90 días después del cierre. Considera amonestaciones, despidos, finiquitos, anexos y desvinculaciones. | `test_denuncias_karin` |

: Requerimientos funcionales de la Ley Karin

### Usuarios del equipo y bitácora (EQU)

Usuarios del equipo desde el plan Starter; bitácora en todos los planes.

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-EQU-01 | El sistema debe permitir al titular invitar usuarios del equipo dentro de su cupo (sección 2.4.1). Cada invitación exige: <br>• un RUT válido y no repetido en la cuenta; <br>• nombre y correo; <br>• al menos un módulo con su nivel ("ver" o "ver y gestionar"); <br>• al menos una empresa propia. <br>Se puede volver a invitar a quien fue eliminado; recibe un usuario nuevo y el anterior conserva su historial [Solo en staging]. | `test_equipo`, `test_permisos` |
| RF-EQU-02 | El sistema debe enviar al invitado un enlace para crear su clave, de un solo uso y válido por 24 horas. Si el correo falla, igual crea al usuario y avisa que se puede reenviar la invitación. | `test_equipo` |
| RF-EQU-03 | El sistema debe permitir al titular editar los datos, módulos y empresas de un usuario, sin cambiar su RUT, y reenviar la invitación a quien aún no crea su clave. | Sin prueba directa |
| RF-EQU-04 | El sistema debe permitir eliminar a un usuario del equipo. Su sesión abierta deja de valer de inmediato, se libera el cupo y se conserva su historial. Si el plan baja y el equipo queda sobre el cupo, los usuarios más recientes que sobran quedan suspendidos, sin eliminarse, hasta que el titular ajuste su equipo o su plan [Solo en staging]. | `test_equipo` |
| RF-EQU-05 | El sistema debe permitir que los usuarios del equipo ingresen por su propia puerta con su RUT y su clave. Si la clave sirve en varias cuentas, la persona elige con cuál entrar. La recuperación de la clave responde lo mismo exista o no el RUT. | `test_equipo` |
| RF-EQU-06 | El sistema debe autorizar cada solicitud de un usuario del equipo según el módulo de la ruta o del tipo de documento: "ver" para leer y "ver y gestionar" para modificar. Las rutas de identidad (su sesión, su clave, su resumen) actúan como la persona, y las comunes son solo de lectura. | `test_permisos_equipo` |
| RF-EQU-07 | El sistema debe responder 403 a un usuario del equipo en toda ruta que no pertenece a un módulo: <br>• la empresa y su firma; <br>• el plan, los pagos, el equipo y la bitácora; <br>• el perfil del titular. <br>Una ruta nueva queda cerrada hasta asignarla a un módulo. | `test_permisos_equipo` (recorre todas las rutas) |
| RF-EQU-08 | El sistema debe ejecutar las acciones de un usuario del equipo sobre los datos de la cuenta, limitadas a sus empresas, y registrarlas a su nombre: en la bitácora y como emisor de las firmas. | `test_permisos_equipo` |
| RF-EQU-09 | El sistema debe filtrar las listas de firmas y de documentos de un usuario del equipo según los tipos de documento de sus módulos. | Sin prueba directa |
| RF-EQU-10 | El sistema debe registrar en la bitácora cada escritura y cada descarga del panel, además de los ingresos, los intentos fallidos y las salidas. Cada registro guarda la persona, la empresa, la ruta, el resultado y la IP, nunca los datos enviados. Quedan fuera las lecturas, las vistas previas, los portales y la Ley Karin. | `test_bitacora` |
| RF-EQU-11 | El sistema debe impedir modificar o borrar registros de la bitácora, incluso desde el admin, y encadenarlos con huellas SHA-256. Solo el titular la consulta, con filtros, y puede verificar su integridad. | `test_bitacora` |
| RF-EQU-12 | El sistema debe entregar al titular una copia de la bitácora en PDF (hasta 3.000 registros) o Excel (hasta 100.000), con folio, código, QR y la huella de los registros incluidos. La verificación pública da la copia por válida solo mientras esos registros sigan iguales. | `test_bitacora` |

: Requerimientos funcionales de usuarios del equipo y bitácora

### Suscripciones y pagos (PAG)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-PAG-01 | El sistema debe listar los planes activos y entregar el estado de la suscripción de la cuenta: <br>• el plan efectivo, con su nivel y sus límites; <br>• los cupos usados, el ciclo y el próximo cobro; <br>• los cambios programados y los últimos 24 pagos. | `test_pagos` |
| RF-PAG-02 | El sistema debe iniciar el pago de un plan, mensual o anual, creando la suscripción en la API de Reveniu y llevando a Transbank a pagar. Si la API falla, usa el enlace de pago del plan. | `test_pagos` |
| RF-PAG-03 | El sistema debe negarse a cobrar si el plan está mal configurado en Reveniu para el ciclo elegido, y avisar al equipo por correo. Así se evita cobrar un precio anual cada mes. | `test_pagos` |
| RF-PAG-04 | El sistema debe aceptar los avisos de pago de Reveniu solo con la clave secreta compartida, comparada en tiempo constante. Guarda cada aviso tal como llegó y descarta los reintentos repetidos. | `test_pagos` |
| RF-PAG-05 | El sistema debe asociar cada aviso a su cuenta: por el intento de pago, por la referencia o por la suscripción ya conocida. Un aviso que no se puede asociar se guarda, se avisa por correo y se asocia a mano desde el admin. | `test_pagos` |
| RF-PAG-06 | Ante un pago o una activación, el sistema debe activar el plan con su ciclo y actualizar el próximo cobro. Si el aviso viene de una suscripción nueva (cambio de plan o de ciclo), la adopta y quita la renovación a la anterior para evitar un doble cobro. | `test_pagos` |
| RF-PAG-07 | Una renovación de la misma suscripción no debe cambiar el plan, salvo una bajada de plan programada, que rige desde ese cobro. | `test_pagos` |
| RF-PAG-08 | Ante la cancelación de la renovación, el sistema debe conservar el plan hasta el fin del período pagado. Ante la desactivación de la suscripción, debe volver al plan gratuito sin borrar datos. | `test_pagos` |
| RF-PAG-09 | El sistema debe permitir bajar a un plan de menor nivel: <br>• solo si la cuenta no excede sus trabajadores, empresas ni usuarios del equipo [Solo en staging los usuarios]; <br>• el cambio rige desde el próximo cobro y se puede deshacer; <br>• bajar al plan gratuito quita la renovación y conserva el plan pagado hasta el fin del período, y avisa que el equipo quedará sin acceso [Solo en staging]. | `test_pagos` |
| RF-PAG-10 | El sistema debe permitir reanudar una renovación cancelada sobre la misma suscripción, sin un cobro nuevo, y comprobar en Reveniu que quedó activa. Si no se confirma, avisa al equipo por correo. | `test_pagos` |

: Requerimientos funcionales de suscripciones y pagos

### Inicio y resumen por correo (RES)

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-RES-01 | El sistema debe permitir que cada persona, titular o usuario del equipo, elija la frecuencia de su resumen por correo: diaria, semanal (los lunes, opción por defecto) o nunca. | `test_resumen` |
| RF-RES-02 | El sistema debe armar el resumen por empresa con los temas pendientes: <br>• documentos y peticiones del portal; <br>• firmas por vencer, rechazadas o vencidas; <br>• registros en Mi DT; <br>• horas de descanso por vencer; <br>• reglamento, Ley Karin y seguridad. <br>Si un tema falla, se omite y se registra. | Art. 32 inc. 4° y Art. 153 CT; Ley 16.744 art. 67<br>`test_resumen` |
| RF-RES-03 | El sistema no debe enviar correo cuando no hay nada que contar, ni más de un resumen al día a la misma persona. | `test_resumen` |
| RF-RES-04 | El sistema debe enviar a cada usuario del equipo un resumen solo con sus empresas y los temas de sus módulos, nunca con las cifras de denuncias. | `test_resumen` |
| RF-RES-05 | El sistema debe tener un comando diario que envíe los resúmenes y los avisos de plazos a los encargados de la Ley Karin. Un error con una persona no detiene a las demás, y correrlo dos veces el mismo día no duplica envíos. | `test_resumen`, `test_denuncias_karin` |
| RF-RES-06 | El sistema debe mostrar en el Inicio del panel las tareas pendientes de la empresa, solo de los módulos que la persona puede ver. Entre ellas: <br>• trabajadores sin contrato y avisos graves de jornada; <br>• contratos a plazo por vencer; <br>• firmas rechazadas o por vencer y liquidaciones sin firma; <br>• registros en Mi DT y consentimientos faltantes; <br>• peticiones del portal y direcciones por completar. | `panel.spec.ts` |
| RF-RES-07 | El sistema debe mostrar al titular, desde el plan Pyme, la cifra de denuncias de la Ley Karin en curso o con plazos vencidos, sin su contenido. | Art. 211-C CT<br>`test_denuncias_karin` |

: Requerimientos funcionales de Inicio y resumen por correo

### Extensión para Mi DT (EXT) [Solo en staging]

| Código | Requerimiento | Norma y verificación |
|---|---|---|
| RF-EXT-01 | El sistema debe generar en el panel un código de conexión de un solo uso: 8 caracteres, válido 10 minutos y guardado como HMAC. La extensión lo canjea por un token propio, que se guarda como SHA-256. La conexión queda en la bitácora. | `test_extension` |
| RF-EXT-02 | El sistema debe aceptar el token de la extensión solo en las rutas de la extensión. El token deja de valer al desconectar el navegador, al quitar a la persona del equipo o tras 90 días sin uso. | `test_extension` |
| RF-EXT-03 | El sistema debe exigir a los usuarios del equipo el módulo de Dirección del Trabajo ("ver" para leer, "ver y gestionar" para marcar), y limitarlos a sus empresas. | `test_extension` |
| RF-EXT-04 | El sistema debe entregar a la extensión la misma lista de registros y las mismas fichas del panel, y permitir marcar un registro como hecho, con el comprobante de Mi DT. | `test_extension` |
| RF-EXT-05 | El sistema debe servir como datos los mapeos de los formularios de Mi DT (campo, etapa y mensaje de éxito), para corregirlos sin publicar una versión nueva de la extensión. | `test_extension`, `mapeo.test.ts` |
| RF-EXT-06 | La extensión debe llenar solo la etapa visible del formulario, como lo haría una persona. Nunca presiona los botones de avance ni de registro, y no llena nada si falta un campo del mapeo. | Art. 210 del Código Penal (aviso de declaración jurada)<br>`llenar.test.tsx` |
| RF-EXT-07 | La extensión debe identificar la empresa por el RUT que muestra Mi DT, o pedir a la persona que la confirme. Después de llenar, compara el nombre que Mi DT trae del Registro Civil con el de la ficha. | `mapeo.test.ts`, `llenar.test.tsx` |
| RF-EXT-08 | La extensión debe detectar el mensaje de registro exitoso solo en el texto visible y proponer marcar el registro con su comprobante. Ignora un mensaje que ya estaba en pantalla al abrir la ficha. | `llenar.test.tsx` |
| RF-EXT-09 | La extensión debe levantar solo la estructura de las pantallas de Mi DT: campos, etiquetas, opciones y botones. Nunca lee lo escrito, tapa los RUT y los correos, y el servidor vuelve a sanear lo recibido. | `levantar.test.ts`, `textos.test.ts`, `test_extension` |

: Requerimientos funcionales de la extensión para Mi DT


## Reglas de negocio y cálculos legales {#sec-reglas}

Las reglas de esta sección se aplican **solo en el servidor**: la interfaz muestra los resultados, pero no los calcula ni los envía (sección 2.1.3). La notación ⌊x⌋ indica que el valor se trunca al peso, es decir, se eliminan los decimales. Los ejemplos de la sección 3.2.8 se calculan con el código real y los comprueba una prueba automática.

### Parámetros, indicadores y jornada

| Código | Regla | Norma y verificación |
|---|---|---|
| RN-REM-01 | Los cálculos usan los parámetros previsionales vigentes el primer día del período liquidado: ingreso mínimo, topes imponibles en UF, factor de gratificación (4,75), cotización de salud (7 %), tasas del seguro de cesantía, seguro de invalidez y sobrevivencia, y aportes de la reforma de pensiones. Una propuesta leída desde Previred no rige hasta que una persona la confirma en el admin. Si los parámetros tienen más de 14 meses o no están confirmados, se muestra un aviso. | Parámetros que publica Previred<br>`test_parametros` |
| RN-REM-02 | La UF y la UTM se obtienen de mindicador.cl y se guardan en caché por 6 horas. Si el servicio falla, se usa un valor de respaldo del código y se avisa en el panel; el servicio se reintenta cada 10 minutos. La UF queda guardada en la liquidación al emitirla. El impuesto se calcula con la UTM vigente al momento del cálculo. | Decisión de diseño<br>`test_parametros`, `test_ejemplos_documento` |
| RN-REM-03 | Los topes imponibles se convierten a pesos con aritmética decimal exacta, y el resultado se trunca. Así, 90 UF × $41.057,20 da $3.695.148, el mismo valor que publica Previred. | Decisión de diseño<br>`test_parametros` |
| RN-CON-01 | La jornada ordinaria máxima semanal depende de la fecha: 45 horas, luego 44 horas desde el 26-04-2024, 42 horas desde el 26-04-2026 y 40 horas desde el 26-04-2028 (tabla 10). La próxima reducción se avisa con 180 días de anticipación. | Ley 21.561<br>`test_jornada` |
| RN-CON-02 | Se advierte cuando la jornada supera el máximo vigente, más de 10 horas en un día, o se distribuye en menos de 5 o más de 6 días. Se aceptan 4 días solo si la jornada es de 40 horas o menos. La jornada parcial no puede superar dos tercios del máximo. El sueldo no puede ser menor que el ingreso mínimo, que es proporcional en la jornada parcial. Un contrato del Art. 22 inc. 2° queda fuera del límite de jornada. | Arts. 22, 28, 40 bis, 42 y 44 CT; Ley 21.561 art. 8° transitorio<br>`test_jornada` |

: Reglas de parámetros, indicadores y jornada

### Liquidación de sueldo

| Código | Regla | Norma y verificación |
|---|---|---|
| RN-REM-04 | **Días a pagar** = 30 − días de ausencia − días de licencia − días fuera de contrato. Los días fuera de contrato son los anteriores al inicio y, si el trabajador fue desvinculado, los posteriores al término. Un período anterior al inicio del contrato se rechaza. **Sueldo del mes** = ⌊sueldo base ÷ 30 × días a pagar⌋. | Decisión de diseño (mes comercial de 30 días)<br>`test_liquidaciones`, `test_trabajadores` |
| RN-REM-05 | **Valor de la hora ordinaria** = sueldo base del contrato ÷ 30 × 7 ÷ horas semanales pactadas. **Horas extra** = valor hora × (1 + recargo) × horas, redondeado al peso. El recargo mínimo es 50 %: si no se informa, se usa 50 %, y uno menor se rechaza. | Arts. 30 a 32 CT<br>`test_liquidaciones`, `test_ejemplos_documento` |
| RN-REM-06 | **Comisiones** = ⌊monto vendido × porcentaje del contrato⌋. El porcentaje lo aporta el servidor (el del contrato vigente o el que se guardó en la liquidación), nunca el navegador. | Art. 45 CT<br>`test_liquidaciones` |
| RN-REM-07 | **Semana corrida** = ⌊(haberes variables del mes ÷ días a pagar) × domingos y festivos del mes⌋. Las horas extra no forman parte de la base. | Arts. 32 y 45 CT<br>`test_liquidaciones` |
| RN-REM-08 | **Gratificación mensual** (solo si el contrato la pacta) = mínimo entre ⌊25 % × (sueldo del mes + haberes que afectan la gratificación + semana corrida)⌋ y su tope, ⌊4,75 × ingreso mínimo ÷ 12⌋. | Art. 50 CT<br>`test_parametros`, `test_ejemplos_documento` |
| RN-REM-09 | **Total imponible** = sueldo del mes + haberes imponibles + semana corrida + gratificación. **Total de haberes** = total imponible + haberes no imponibles. Si un haber es imponible, gratificable o variable lo define su concepto del catálogo, no quien lo ingresa. | DL 3.500; Art. 41 CT<br>`test_liquidaciones` |
| RN-REM-10 | **Cotizaciones del trabajador**, todas truncadas al peso: <br>• AFP = renta topada (el menor entre el imponible y el tope en UF) × tasa de la AFP en el período (10 % más la comisión). <br>• Salud: Fonasa = 7 % de la misma renta topada; Isapre = el mayor entre el plan en UF × UF y ese 7 %. <br>• Seguro de cesantía = 0,6 % del imponible con su propio tope. Paga 0 % el contrato a plazo fijo y desde el año 11 de servicio. | DL 3.500; Ley 19.728<br>`test_parametros`, `test_liquidaciones` |
| RN-REM-11 | **Impuesto único** = base × tasa − rebaja × UTM, redondeado. Base = total imponible − AFP − salud − seguro de cesantía. Tramos en UTM: hasta 13,5 exento; 4 % hasta 30; 8 % hasta 50; 13,5 % hasta 70; 23 % hasta 90; 30,4 % hasta 120; 35 % hasta 310 y 40 % sobre 310, con sus rebajas. | Ley sobre Impuesto a la Renta, arts. 42 N°1 y 43<br>`test_liquidaciones` |
| RN-REM-12 | **Líquido** = total de haberes − (AFP + salud + seguro de cesantía + impuesto + anticipo de quincena + otros descuentos). | Decisión de diseño<br>`test_liquidaciones`, `test_ejemplos_documento` |
| RN-REM-13 | **Asignación familiar** = monto por carga del tramo (A, B o C) × (cargas simples + maternales + 2 × cargas por invalidez). Se paga completa con 25 días o más con remuneración en el mes; si no, en proporción sobre 30. Los días de licencia cuentan y las ausencias no. Sin tabla para el período, se conserva el monto ingresado. | DFL 150 de 1981; Ley 18.987<br>`test_asignacion_familiar` |
| RN-REM-14 | **Aporte a la indemnización a todo evento.** Con un pacto firmado, rige desde su mes hasta el fin del año 11 de servicio. Aporte = ⌊mínimo entre el imponible y 90 UF × tasa pactada⌋. Es un costo del empleador y no cambia el líquido. | Art. 164 CT<br>`test_indemnizacion_todo_evento` |
| RN-REM-15 | **Horas extra compensadas con descanso** (plan Pyme). Con un pacto firmado y vigente: <br>• según lo pactado, una parte de las horas extra (todas en "feriado", la mitad en "mixto") pasa a una bolsa de descanso en vez de pagarse; <br>• el tope es de 5 días por año de contrato, medidos en horas diarias promedio; el exceso se paga y se avisa; <br>• lo no usado vence al final del sexto mes siguiente y se paga en esa liquidación; al término del contrato, se suma al feriado del finiquito. | Art. 32 inc. 4° CT (Ley 21.561); Dictamen 199/5<br>`test_horas_compensatorias` |
| RN-REM-16 | Al editar una liquidación ya emitida se recalcula con las condiciones con que se emitió: sueldo, horas, gratificación, tipo de contrato, quincena, UF y porcentajes de comisión. | Decisión de diseño<br>`test_liquidaciones`, `test_parametros` |

: Reglas de cálculo de la liquidación de sueldo

### Feriado y permisos

| Código | Regla | Norma y verificación |
|---|---|---|
| RN-VAC-01 | Para el feriado son hábiles los días de lunes a viernes que no son feriados. El sábado es siempre inhábil. Los feriados de Chile, incluidos los móviles y los que la ley traslada, se obtienen de la biblioteca `holidays`. | Art. 69 CT<br>`test_feriado`, `test_ejemplos_documento` |
| RN-VAC-02 | El feriado básico es de 15 días hábiles por cada año de servicio cumplido. | Art. 67 CT<br>`test_feriado` |
| RN-VAC-03 | **Feriado progresivo:** los años de trabajo son los acreditados con empleadores anteriores (hasta 10) más los cumplidos en la empresa. Desde los 10 años se suma un día por cada 3 años nuevos, y cada período anual acumula los días que le correspondían. | Art. 68 CT<br>`test_feriado`, `test_ejemplos_documento` |
| RN-VAC-04 | **Saldo** = días devengados − días aprobados de vacaciones legales y progresivas. Con dos o más períodos acumulados se avisa al empleador; los días pendientes nunca se pierden ni se descuentan. | Art. 70 CT<br>`test_feriado` |
| RN-DOC-01 | **Permisos legales:** <br>• 10 días corridos por la muerte de un hijo; <br>• 7 días corridos por la del cónyuge o conviviente civil; <br>• 7 días hábiles por la de un hijo en gestación; <br>• 4 días hábiles por la del padre, la madre o un hermano; <br>• 5 días corridos por nacimiento o adopción; <br>• 5 días hábiles por matrimonio o acuerdo de unión civil. <br>Para los permisos son hábiles los días de lunes a sábado que no son feriados (criterio de la DT). Los permisos por fallecimiento, salvo el del hijo en gestación, se cuentan desde el día del hecho. | Arts. 66, 195 y 207 bis CT<br>`test_documentos_laborales` |

: Reglas de feriado y permisos

### Término de la relación laboral

| Código | Regla | Norma y verificación |
|---|---|---|
| RN-FIN-01 | **Años indemnizables** = años completos de servicio, más uno si la fracción supera los seis meses. Exige al menos un año y tiene un tope de 11. Los contratos vigentes desde antes del 14-08-1981 no tienen tope de años. | Art. 163 CT; art. 7° transitorio CT<br>`test_finiquito` |
| RN-FIN-02 | Dan derecho a indemnización por años de servicio las causales del Art. 161 (incisos 1° y 2°) y del Art. 163 bis. Con esas causales, si no se dio el aviso previo, se suma la indemnización sustitutiva: una base mensual. | Arts. 161, 162 y 163 bis CT<br>`test_finiquito` |
| RN-FIN-03 | **Base de las indemnizaciones** (última remuneración mensual): <br>• sueldo base; <br>• haberes regulares de las últimas tres liquidaciones: los fijos que se repiten y el promedio de los variables; <br>• gratificación mensual, con su tope. <br>Quedan fuera las horas extra, la asignación familiar, el aguinaldo, los viáticos, la pérdida de caja, el desgaste de herramientas y la sala cuna. Tope de la base: 90 UF. | Art. 172 CT; Art. 41 inc. 2° CT<br>`test_finiquito`, `test_ejemplos_documento` |
| RN-FIN-04 | **Feriado en el finiquito:** <br>• días hábiles = saldo pendiente + proporcional del año en curso, es decir (meses + días ÷ 30) × días anuales ÷ 12, con los días progresivos; <br>• para pagarlos se convierten a días corridos desde el día siguiente al término, sumando los sábados, domingos y feriados del período (criterio de la DT); <br>• monto = ⌊sueldo base ÷ 30 × días corridos⌋, más las horas de descanso pendientes. | Arts. 32 inc. 4° y 73 CT<br>`test_finiquito`, `test_ejemplos_documento` |
| RN-FIN-05 | **Gratificación del último mes:** <br>• si es mensual, 25 % del sueldo del mes con su tope; <br>• si es anual, 25 % de lo devengado en el año con tope de 4,75 ingresos mínimos proporcional a los meses trabajados, y cotiza y tributa repartida en los meses en que se devengó. | Arts. 50 y 52 CT; DL 3.500 art. 28; LIR art. 46<br>`test_finiquito` |
| RN-FIN-06 | Con un pacto de indemnización a todo evento firmado, los años indemnizables se cuentan solo hasta el día anterior al inicio del aporte. | Art. 164 CT<br>`test_indemnizacion_todo_evento` |
| RN-FIN-07 | **Total** = sueldo del mes + gratificación + feriado + indemnizaciones + otros haberes − otros descuentos − cotizaciones e impuesto del último mes. Nunca es negativo. El usuario aporta solo hechos (causal, fechas, días trabajados, aviso previo) y montos voluntarios, nunca los montos que fija la ley. | Decisión de diseño<br>`test_finiquito` |

: Reglas del finiquito

### Pactos y documentos laborales

| Código | Regla | Norma y verificación |
|---|---|---|
| RN-DOC-02 | **Pacto de horas extra:** <br>• dura de 1 a 3 meses, con 1 o 2 horas diarias y un motivo elegido de una lista; <br>• no puede superponerse con otro pacto; <br>• en un contrato del Art. 22 genera un aviso; <br>• rige solo una vez firmado. | Arts. 31 y 32 CT<br>`test_documentos_laborales` |
| RN-DOC-03 | **Descuento voluntario:** no se admite para anticipos, cuotas sindicales, retenciones judiciales ni caja de compensación, que no requieren autorización. Se avisa si supera el 15 % del sueldo base. Se puede revocar con fecha: queda una constancia, pero la deuda no se extingue. | Art. 58 inc. 2° CT<br>`test_documentos_laborales` |
| RN-DOC-04 | **Pacto de indemnización a todo evento:** desde el séptimo año de servicio (seis años cumplidos), uno por trabajador, con un aporte elegido de la lista: 4,11 %, 5 %, 6 %, 7 % u 8,33 %. | Art. 164 CT<br>`test_documentos_laborales` |
| RN-DOC-05 | **Avisos de la liquidación:** <br>• horas extra sin un pacto firmado y vigente; <br>• descuentos voluntarios sin autorización firmada o sobre la cuota; <br>• descuentos voluntarios que en total superan el 15 % de los haberes; <br>• ausencias en un mes con permiso legal firmado. <br>Son avisos: no impiden emitir. | Arts. 32 y 58 CT<br>`test_documentos_laborales` |
| RN-DOC-06 | **Elementos de protección personal:** se entregan gratis y se avisa si la última capacitación en su uso tiene más de 12 meses. | Ley 16.744 art. 68; DS 44 de 2023<br>`test_seguridad_laboral` |

: Reglas de pactos y documentos laborales

### Plazos legales

| Código | Regla | Norma y verificación |
|---|---|---|
| RN-DT-01 | **Registro en Mi DT**, en días hábiles de lunes a viernes sin feriados (la lectura más estricta): <br>• contrato: 15 días desde su celebración (la fecha de firma electrónica o, sin ella, el inicio del contrato); <br>• anexo: 15 días desde su firma; <br>• término: 10 días (Art. 159 N°1 a 3); 3 días (Art. 159 N°4 y 5, y Art. 160); 6 días (Art. 159 N°6 y Art. 163 bis); con el Art. 161, la fecha de la carta de aviso; <br>• término sin causal conocida: 3 días. | Ley 21.327 (registro electrónico laboral)<br>`test_direccion_trabajo`, `test_ejemplos_documento` |
| RN-KAR-01 | **Denuncias de la Ley Karin**, en días hábiles de lunes a viernes: <br>• decidir si se investiga en la empresa o se deriva a la DT, e informarlo a quien denunció: 3 días; <br>• investigación: 30 días desde la denuncia; <br>• envío del informe a la DT: 2 días; <br>• pronunciamiento de la DT: 30 días; <br>• medidas: 15 días corridos desde la notificación o desde que vence el plazo de la DT. <br>Las medidas de resguardo son inmediatas. | DS N° 21 de 2024, arts. 12, 13, 17, 18 y 19<br>`test_denuncias_karin`, `test_ejemplos_documento` |
| RN-REG-01 | **Reglamento interno:** rige 30 días después de su publicación y debe remitirse a la DT y a la Seremi de Salud dentro de los 5 días siguientes. Una versión nueva reemplaza a la anterior, y se avisa revisarlo al cumplir un año. | Arts. 153 y 156 CT<br>`test_reglamento` |
| RN-TRA-01 | **Solicitudes de conciliación**, en días corridos: <br>• teletrabajo: el empleador responde en 15 días; <br>• cambio de jornada en vacaciones escolares: se propone con 30 días de anticipación y se responde en 10. <br>Una propuesta tardía, una respuesta vencida o una respuesta tardía generan avisos. | Ley 21.645; Arts. 152 quáter O bis y 207 ter CT<br>`test_proteccion` |
| RN-TRA-02 | **Fuero maternal:** sin una fecha ingresada, termina un año después del fin del postnatal (fecha de parto + 12 semanas + 1 año). | Arts. 195 y 201 CT<br>`test_proteccion` |

: Reglas de plazos legales

### Planes y accesos

| Código | Regla | Norma y verificación |
|---|---|---|
| RN-PAG-01 | Ocupan cupo de trabajadores los vigentes y los desvinculados durante el mes en curso (sección 2.4.1). | Decisión comercial<br>`test_pagos`, `test_trabajadores` |
| RN-POR-01 | Un trabajador desvinculado conserva el acceso al portal durante 3 meses. Se cuentan desde la ratificación del finiquito; si no la hay, desde su firma de recepción en Jornada40; y si tampoco la hay, desde la desvinculación. | Decisión de diseño<br>`test_portal_trabajador` |
| RN-POR-02 | Los certificados de renta y de cotizaciones (3, 6 o 12 meses) exigen que todas las liquidaciones de ese período estén firmadas y sean consecutivas. Sin la firma del empleador configurada no se emite ningún certificado. | Decisión de diseño<br>`test_certificados` |
| RN-POR-03 | Un trabajador puede tener a lo más 10 solicitudes de documentos pendientes, y pedir liquidaciones de los últimos 24 meses. En cuanto a peticiones de vacaciones, permisos y conciliación, puede tener a lo más 5 pendientes por ficha, para fechas hasta 12 meses adelante. | Decisión de diseño<br>`test_solicitudes_documento`, `test_peticiones_portal` |

: Reglas de planes y accesos

### Ejemplos verificados {#sec-ejemplos}

Los ejemplos siguientes se calculan con el código del sistema y los comprueba la prueba `backend/core/tests/test_ejemplos_documento.py`. Si una regla cambia, esa prueba falla y el ejemplo debe actualizarse junto con el código. Todos usan los parámetros de octubre de 2026 que cargan las migraciones (ingreso mínimo $553.553, tope AFP 90 UF y AFP Habitat 11,27 %), con UF de $41.057,20 y UTM de $71.721.

**Ejemplo 1. Liquidación mensual.** Contrato indefinido desde el 01-01-2024, con sueldo base de $1.500.000, 42 horas semanales, gratificación mensual, AFP Habitat y Fonasa. En octubre de 2026 trabaja 30 días, hace 10 horas extra al 50 % y recibe una asignación de colación de $50.000.

| Concepto                       | Cálculo                                                                  | Monto        |
|--------------------------------|--------------------------------------------------------------------------|--------------|
| Sueldo del mes                 | ⌊1.500.000 ÷ 30 × 30⌋                                                    | 1.500.000    |
| Horas extra                    | 1.500.000 ÷ 30 × 7 ÷ 42 = 8.333,33 por hora; × 1,5 × 10 horas             | 125.000      |
| Gratificación                  | 25 % de 1.625.000 = 406.250, pero con tope ⌊4,75 × 553.553 ÷ 12⌋         | 219.114      |
| Total imponible                | 1.500.000 + 125.000 + 219.114                                            | 1.844.114    |
| Colación (no imponible)        | Monto ingresado                                                          | 50.000       |
| Total de haberes               | 1.844.114 + 50.000                                                       | 1.894.114    |
| AFP Habitat                    | ⌊1.844.114 × 11,27 %⌋ (bajo el tope de 3.695.148)                        | 207.831      |
| Salud (Fonasa)                 | ⌊1.844.114 × 7 %⌋                                                        | 129.087      |
| Seguro de cesantía             | ⌊1.844.114 × 0,6 %⌋                                                      | 11.064       |
| Impuesto único                 | Base 1.496.132 = 20,86 UTM: 4 % − 0,54 UTM = 59.845,28 − 38.729,34       | 21.116       |
| Total de descuentos            | 207.831 + 129.087 + 11.064 + 21.116                                      | 369.098      |
| **Líquido a pagar**            | 1.894.114 − 369.098                                                      | **1.525.016** |

: Ejemplo 1: liquidación mensual de octubre de 2026

**Ejemplo 2. Finiquito.** El mismo trabajador termina el 30-10-2026 por necesidades de la empresa (Art. 161 inc. 1°), sin aviso previo, después de trabajar 30 días ese mes. No tiene liquidaciones emitidas ni vacaciones registradas.

| Concepto                            | Cálculo                                                                                     | Monto          |
|-------------------------------------|---------------------------------------------------------------------------------------------|----------------|
| Años indemnizables                  | 2 años, 9 meses y 29 días: la fracción supera los 6 meses, así que son 3 años               | 3 años         |
| Base de las indemnizaciones         | Sueldo base 1.500.000 + gratificación con tope 219.114, bajo el tope de 90 UF (3.695.148)   | 1.719.114      |
| Indemnización por años de servicio  | 3 × 1.719.114                                                                               | 5.157.342      |
| Indemnización sustitutiva del aviso | Una base                                                                                    | 1.719.114      |
| Feriado                             | Saldo de 30 días hábiles + 12,46 proporcionales = 42,46 hábiles, que equivalen a 62,46 corridos desde el 31-10-2026; ⌊1.500.000 ÷ 30 × 62,46⌋ | 3.123.000      |
| Sueldo y gratificación del mes      | 1.500.000 + 219.114                                                                         | 1.719.114      |
| Cotizaciones e impuesto del mes     | AFP 193.744 + salud 120.337 + seguro de cesantía 10.314 + impuesto 17.059                   | −341.454       |
| **Total a pagar**                   | 1.719.114 + 3.123.000 + 5.157.342 + 1.719.114 − 341.454                                     | **11.377.116** |

: Ejemplo 2: finiquito por necesidades de la empresa

Como el trabajador no tiene liquidaciones emitidas, el sistema avisa que la base considera solo el sueldo y la gratificación (RN-FIN-03).

**Ejemplo 3. Feriado y plazos.**

| Caso                                                                                                   | Resultado                                                                                              |
|--------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Feriado progresivo de quien acredita 10 años con empleadores anteriores, ingresó el 01-03-2023 y se consulta al 31-10-2026 | 3 años cumplidos: 45 días básicos + 1 progresivo = 46 días. Con más de dos períodos acumulados, se avisa (Art. 70). |
| Vacaciones del lunes 14 al viernes 25 de septiembre de 2026                                            | 9 días hábiles: el viernes 18 es feriado.                                                               |
| Registro en Mi DT de un contrato celebrado el 01-09-2026                                               | Vence el 23-09-2026: 15 días hábiles, sin contar el 18 de septiembre.                                  |
| Denuncia de la Ley Karin recibida el lunes 05-10-2026                                                   | Decisión y aviso a quien denunció: 08-10-2026. Investigación: 17-11-2026, sin contar el 12-10, el 31-10 y el 01-11. |
| Asignación familiar, tramo A ($22.601 por carga), dos cargas simples, octubre de 2026                   | Mes completo: 45.202. Con 20 días con remuneración: ⌊45.202 × 20 ÷ 30⌋ = 30.134.                      |
| Jornada máxima el 25-04-2026, el 26-04-2026, el 25-04-2028 y el 26-04-2028                              | 44, 42, 42 y 40 horas.                                                                                  |

: Ejemplo 3: feriado, plazos, asignación familiar y jornada

## Requerimientos no funcionales {#sec-rnf}

Los atributos siguen el modelo de calidad de ISO/IEC 25010. Para cada requerimiento se indica cómo lo cumple el sistema, cómo se verifica y su estado:

- **Cumple:** implementado y verificado.
- **Parcial:** implementado solo en parte, o sin verificación completa.
- **Pendiente:** no implementado todavía. El capítulo 13 lo recoge como limitación o riesgo.

### Seguridad

| Código | Requerimiento | Cómo se cumple | Estado y verificación |
|---|---|---|---|
| RNF-SEG-01 | Cada tipo de acceso debe tener su propia identificación y una sesión que expire por inactividad y por tiempo total. | Sesión del panel con JWT en cookies HttpOnly: acceso de 5 minutos y renovación de 15 minutos, con rotación; el token usado y el de una sesión cerrada dejan de servir [Solo en staging]. Cookies firmadas propias para la Ley Karin (5 minutos de inactividad, 4 horas en total), el portal del trabajador y la fiscalización (15 minutos y 8 horas). La interfaz avisa un minuto antes de cerrar la sesión. | **Cumple**<br>`test_sesion_inactividad`, `test_seguridad`, `CierreInactividad.test.tsx` |
| RNF-SEG-02 | Los ingresos y las operaciones públicas deben limitar los intentos. | Límites por IP y por RUT: <br>• ingreso y registro: 3 por minuto; <br>• recuperación de clave: 2 por hora; <br>• portal del trabajador: 60 por hora; <br>• firma pública: 120 por hora por enlace y 1.500 al día por IP; <br>• fiscalización y Ley Karin: 30 por hora; <br>• confirmación de identidad: 30 por hora; <br>• vinculación de la extensión: 20 por hora; <br>• avisos de pago de Reveniu: 600 por hora [Solo en staging]; <br>• anónimos en general: 100 al día. <br>Los contadores se comparten entre los procesos del servidor [Solo en staging]; en producción, cada proceso cuenta por separado. | **Cumple**<br>`test_seguridad`, `test_portal_trabajador`, `test_inspeccion` |
| RNF-SEG-03 | Ningún usuario debe ver ni modificar datos de otra cuenta, ni de empresas o módulos que no tiene asignados. | Cada consulta se filtra por la cuenta. Para los usuarios del equipo, además, se filtra por sus empresas y módulos (sección 8.3). Las rutas que no pertenecen a un módulo quedan cerradas para ellos. | **Cumple**<br>`test_seguridad`, `test_permisos_equipo` (recorre todas las rutas) |
| RNF-SEG-04 | Las comunicaciones deben ir cifradas y con cabeceras de seguridad. | HTTPS con HSTS de un año en el sitio y la API; cookies `Secure`; `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Falta una política de seguridad de contenidos (CSP). | **Parcial**<br>Revisión de la configuración (`settings.py`, `vercel.json`) |
| RNF-SEG-05 | Las credenciales nunca deben guardarse de forma legible. | Las claves se guardan con hash, con validación de largo mínimo, claves comunes, solo números y parecido con los datos de la persona. Los códigos de firma se guardan con HMAC-SHA256 y los tokens de la extensión con SHA-256. Los secretos del sistema viven solo en variables de entorno. | **Cumple**<br>`test_firmas`, `test_extension`, `test_cuentas` |
| RNF-SEG-06 | Las acciones relevantes deben quedar registradas de forma que una alteración sea detectable. | Bitácora de solo agregar, encadenada con SHA-256 y verificable, con copia verificable por código. Registro reservado de la Ley Karin y registro de fiscalización. | **Cumple**<br>`test_bitacora`, `test_acceso_karin`, `test_inspeccion` |
| RNF-SEG-07 | La información reservada de la Ley Karin debe guardarse cifrada. | Campos y archivos cifrados con Fernet antes de guardarse, con rotación de claves (`rotar_cifrado`). | **Cumple**<br>`test_acceso_karin`, `test_denuncias_karin` |
| RNF-SEG-08 | Las dependencias no deben tener vulnerabilidades conocidas. | `pip-audit` y `npm audit` en la integración continua y Dependabot cada semana [Solo en staging]. La versión de pruebas tiene 0 avisos; producción mantiene versiones con avisos hasta publicarla. | **Parcial**<br>Trabajo `dependencias` de la integración continua |
| RNF-SEG-09 | El código debe revisarse con análisis estático de seguridad. | `bandit` en cada cambio, para riesgos de severidad media y alta [Solo en staging]. | **Cumple**<br>Integración continua |
| RNF-SEG-10 | Los errores no deben revelar detalles internos al usuario. | Las excepciones se registran y el usuario recibe un mensaje genérico (`error_interno`); las alertas al equipo no llevan datos personales [Solo en staging]. Un dato con formato inválido en la liquidación recibe un mensaje para la persona, sin el texto técnico del error [Solo en staging]; en producción, la vista previa todavía lo devuelve. | **Cumple**<br>`test_alertas`, `test_liquidaciones` |
| RNF-SEG-11 | La seguridad debe validarse con una prueba de intrusión externa. | Hasta ahora solo hay revisión interna y pruebas automáticas. | **Pendiente** |
| RNF-SEG-12 | Las operaciones que cambian datos solo deben aceptarse desde la propia aplicación, no desde páginas de otros sitios (CSRF). | Revisión del origen de toda escritura en la API (`OrigenPermitidoMiddleware`) y cookies `SameSite=Lax` en producción [Solo en staging]. Las vistas de los portales, además, solo aceptan JSON. | **Cumple**<br>`test_csrf` |

: Requerimientos no funcionales de seguridad

### Confiabilidad y disponibilidad

| Código | Requerimiento | Cómo se cumple | Estado y verificación |
|---|---|---|---|
| RNF-DIS-01 | Una falla de un servicio externo no debe detener el trabajo ni perder información. | Ante la falla de cada servicio: <br>• mindicador.cl: se usa un valor de respaldo con aviso; <br>• API de Reveniu: se usa el enlace de pago; <br>• Gemini: el usuario recibe un mensaje y completa a mano; <br>• correo: la solicitud de firma queda pendiente y se puede reenviar; <br>• Backblaze B2: el error se informa sin perder la solicitud. | **Cumple**<br>`test_parametros`, `test_pagos`, `test_firmas` |
| RNF-DIS-02 | Un proceso interrumpido no debe dejar documentos en un estado inválido. | Una firma que quedó "procesando" por más de 10 minutos vuelve a "pendiente" y se puede firmar de nuevo; las solicitudes vencidas pasan a "expirada". | **Cumple**<br>`test_firmas` |
| RNF-DIS-03 | Los datos deben respaldarse y poder restaurarse. | No hay respaldo automático propio de la base de datos ni pruebas de restauración. Está planificado un respaldo diario cifrado fuera de Railway. | **Pendiente** |
| RNF-DIS-04 | Los errores en producción deben detectarse sin esperar a que un usuario los informe. | Alerta por correo de cada error del servidor, una vez por hora por error [Solo en staging]. No hay panel de errores ni registro de errores del navegador. | **Parcial**<br>`test_alertas` |
| RNF-DIS-05 | Debe existir un nivel de servicio comprometido y medido. | No está definido. La disponibilidad depende de Railway y Vercel. | **Pendiente** |

: Requerimientos no funcionales de confiabilidad y disponibilidad

### Rendimiento

| Código | Requerimiento | Cómo se cumple | Estado y verificación |
|---|---|---|---|
| RNF-REN-01 | Las solicitudes deben responder dentro de un tiempo acotado. | El servidor corre con 2 procesos de 4 hilos y corta toda solicitud a los 60 segundos. La lectura con IA tiene un tope de 45 segundos. La UF y la UTM se guardan en caché por 6 horas, y tras una falla se reintenta cada 10 minutos para no frenar las solicitudes. | **Parcial**<br>Sin medición sistemática |
| RNF-REN-02 | Las operaciones masivas deben tener límites que protejan el servicio. | Límites por operación: <br>• descargas masivas en ZIP: 50 trabajadores; <br>• copia de la bitácora: 3.000 filas en PDF y 100.000 en Excel; <br>• archivos subidos: 20 MB, salvo los de la Ley Karin, que llegan a 15 MB; <br>• levantamiento de la extensión: 400 KB. | **Cumple**<br>`test_seguridad`, `test_bitacora` |
| RNF-REN-03 | La capacidad debe medirse con pruebas de carga. | No se han hecho pruebas de carga, por ejemplo de la emisión masiva de liquidaciones o de la generación de PDF. | **Pendiente** |

: Requerimientos no funcionales de rendimiento

### Usabilidad y accesibilidad

| Código | Requerimiento | Cómo se cumple | Estado y verificación |
|---|---|---|---|
| RNF-USA-01 | La interfaz debe ser clara para usuarios con poca experiencia digital. | Todo en español de Chile, con letra grande, pasos numerados y un botón claro por acción. Los avisos explican la norma y qué hacer. | **Cumple**<br>Revisión manual |
| RNF-USA-02 | La interfaz debe cumplir las pautas WCAG 2.1, niveles A y AA. | Revisión automática con axe en 21 pantallas, sin problemas detectados [Solo en staging]. Falta una auditoría manual con lector de pantalla y teclado. | **Parcial**<br>`accesibilidad.spec.ts` |
| RNF-USA-03 | El sistema debe poder usarse desde un teléfono. | Las pantallas son adaptables y se prueban en tamaño de teléfono, sin desbordes. El documento a firmar se muestra con pdf.js, porque los visores de PDF de los teléfonos no muestran documentos dentro de una página. | **Cumple**<br>Recorridos del panel, del portal y de la firma (`frontend/e2e/`) |
| RNF-USA-04 | Un cierre de sesión por inactividad no debe hacer perder el trabajo en curso. | El editor de contratos y el de liquidaciones guardan un borrador local por 24 horas, que se ofrece recuperar al volver. Antes de cerrar la sesión aparece el aviso "¿Sigues ahí?". | **Cumple**<br>`borradores.test.ts`, `CierreInactividad.test.tsx` |

: Requerimientos no funcionales de usabilidad y accesibilidad

### Mantenibilidad

| Código | Requerimiento | Cómo se cumple | Estado y verificación |
|---|---|---|---|
| RNF-MAN-01 | Cada cambio debe pasar pruebas automáticas antes de publicarse. | La integración continua corre 577 pruebas del servidor, 64 unitarias de la interfaz y 59 recorridos de navegador. Los recorridos solo se ejecutan si las demás pruebas pasan. | **Cumple**<br>Integración continua |
| RNF-MAN-02 | El servidor debe mantener una cobertura de pruebas mínima. | La integración continua exige 80 % de las líneas del servidor; la última medición, del 14-10-2026, es 84,1 %. La interfaz tiene mínimos para sus utilidades y para la extensión [Solo en staging]. | **Cumple**<br>Integración continua |
| RNF-MAN-03 | El código debe pasar análisis estático y tener sus migraciones al día. | TypeScript estricto, ESLint, ruff [Solo en staging] y una verificación de que no faltan migraciones. | **Cumple**<br>Integración continua |
| RNF-MAN-04 | Los cambios legales y de catálogo deben poder hacerse sin modificar el código. | Se cambian sin desplegar código: <br>• parámetros previsionales, tasas de AFP, tramos de asignación familiar, factores del SII y vacaciones escolares: en el admin; <br>• mapeos de Mi DT y plantilla del LRE: archivos de datos. | **Cumple**<br>`test_parametros` |
| RNF-MAN-05 | La documentación técnica debe estar al día con el código. | Este documento vive en el repositorio junto al código y sus ejemplos numéricos los verifica una prueba automática. `CLAUDE.md` guía el trabajo diario. | **Cumple**<br>`test_ejemplos_documento` |

: Requerimientos no funcionales de mantenibilidad

### Compatibilidad y portabilidad

| Código | Requerimiento | Cómo se cumple | Estado y verificación |
|---|---|---|---|
| RNF-COM-01 | La aplicación web debe funcionar en los navegadores actuales. | Las pruebas de navegador corren solo en Chromium; Firefox y Safari no tienen pruebas automáticas. | **Parcial**<br>`frontend/e2e/` |
| RNF-COM-02 | La firma debe funcionar en teléfonos de algunos años de antigüedad. | Para mostrar el documento se usa la versión de pdf.js para navegadores antiguos. | **Cumple**<br>Recorridos de firma |
| RNF-COM-03 | El servidor debe poder desplegarse en otra infraestructura sin cambiar el código. | Imagen Docker con Python 3.11, configuración por variables de entorno, PostgreSQL estándar y almacenamiento compatible con S3. | **Cumple**<br>Despliegues en staging y producción |
| RNF-COM-04 | Los archivos de intercambio deben cumplir los formatos oficiales. | Previred: versión 100, Latin-1, separado por `;`. LRE: la plantilla oficial de 147 columnas, en cp1252. Falta verificar con cargas reales dos formatos: la indemnización a todo evento en Previred y el registro masivo de contratos. | **Parcial**<br>`test_previred`, `test_lre`, `test_direccion_trabajo` |
| RNF-COM-05 | La extensión debe funcionar en los navegadores que usan los empleadores con Mi DT. | Extensión MV3 para Chrome y Edge [Solo en staging]. | **Cumple**<br>`extension.spec.ts` |

: Requerimientos no funcionales de compatibilidad y portabilidad

### Privacidad

| Código | Requerimiento | Cómo se cumple | Estado y verificación |
|---|---|---|---|
| RNF-PRI-01 | Los registros y las alertas no deben contener datos personales innecesarios. | La bitácora guarda quién, cuándo y qué ruta, pero nunca los datos enviados. Las alertas omiten el texto de las excepciones [Solo en staging]. El levantamiento de Mi DT guarda solo la estructura, sin valores. | **Cumple**<br>`test_bitacora`, `test_alertas`, `levantar.test.ts` |
| RNF-PRI-02 | Las pantallas públicas no deben revelar si una persona o empresa existe en el sistema. | La recuperación de clave por RUT, el ingreso al portal y el de fiscalización responden igual exista o no el dato; en la fiscalización, también ante un segundo pedido antes de un minuto y ante una falla del correo [Solo en staging]. Queda una diferencia en el tiempo de respuesta, porque el correo se envía antes de responder (sección 8.10). | **Parcial**<br>`test_cuentas`, `test_portal_trabajador`, `test_inspeccion` |
| RNF-PRI-03 | Cada persona debe ver solo lo que le corresponde. | Cada perfil ve un alcance limitado: <br>• el trabajador, solo las fichas cuyo correo verificó; <br>• la verificación pública muestra el RUT parcialmente oculto; <br>• el titular ve solo cifras de las denuncias; <br>• en el portal, cada rol ve la denuncia según su papel. | **Cumple**<br>`test_portal_trabajador`, `test_certificados`, `test_denuncias_karin` |
| RNF-PRI-04 | El tratamiento de datos debe cumplir la Ley 19.628 y prepararse para la Ley 21.719. | La bitácora se conserva al menos 5 años y los datos se desactivan sin borrarse. Falta definir la política de retención y eliminación, y los derechos de los titulares (capítulo 9). | **Parcial** |

: Requerimientos no funcionales de privacidad

### Cumplimiento legal

| Código | Requerimiento | Cómo se cumple | Estado y verificación |
|---|---|---|---|
| RNF-LEG-01 | Cada cálculo debe usar la norma vigente en la fecha del hecho. | Los parámetros se aplican por período y la jornada por fecha. Una liquidación editada conserva sus condiciones de emisión. | **Cumple**<br>`test_parametros`, `test_jornada` |
| RNF-LEG-02 | Un posible incumplimiento debe advertirse sin impedir el trabajo, salvo prohibición legal expresa. | Todo posible incumplimiento genera un aviso con su norma y una recomendación. Solo se bloquea lo que la ley prohíbe o lo que invalidaría un documento. | **Cumple**<br>`test_jornada`, `test_documentos_laborales` |
| RNF-LEG-03 | La firma electrónica debe cumplir los criterios de la DT. | El código o la clave solo verifican la identidad; el acto de firma es la aceptación expresa más el trazo. Ambos quedan en el certificado de firma. | **Cumple**<br>`test_firmas` |
| RNF-LEG-04 | Las plantillas legales deben tener revisión jurídica externa. | Pendiente para el reglamento por rubro, los documentos de la Ley Karin y los pactos. | **Pendiente** |

: Requerimientos no funcionales de cumplimiento legal

