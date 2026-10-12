# Protección de datos personales {#sec-datos-personales}

Este capítulo describe qué datos personales trata Jornada40, con qué finalidad, dónde los guarda, quién los ve, cuánto tiempo los conserva y cómo se atienden los derechos de sus titulares. Al final identifica lo que falta frente a la nueva ley.

**Marco legal.**

- **Ley 19.628 (vigente).** Regula hoy la protección de la vida privada y es la que citan los términos de servicio de Jornada40.
- **Ley 21.719.** Se publicó el 13-12-2024, reemplaza íntegramente ese régimen y entra en vigencia el 01-12-2026: siete semanas después de la fecha de este documento. Exige, entre otras cosas:
  - principios de licitud, finalidad, proporcionalidad, calidad, seguridad, transparencia y confidencialidad;
  - los derechos de acceso, rectificación, supresión, oposición, portabilidad y bloqueo;
  - un contrato que regule el tratamiento por encargo;
  - medidas de seguridad y el reporte de las vulneraciones;
  - garantías para las transferencias internacionales.

  Crea además la Agencia de Protección de Datos Personales, con facultades para fiscalizar y sancionar. A la fecha se discute postergar su vigencia, lo que exigiría otra ley.

Este capítulo describe el sistema; no es una opinión legal. Las brechas de la sección 9.8 deben validarse con asesoría jurídica.

## Roles en el tratamiento {#sec-dp-roles}

| Datos | Responsable | Rol de Jornada40 |
|---|---|---|
| Trabajadores: fichas, contratos, remuneraciones, documentos, firmas, portal | El empleador (el cliente) | Encargado del tratamiento: trata los datos por cuenta del empleador y según sus instrucciones. Los términos de servicio lo dicen así: «Jornada40 actúa únicamente como procesador de dichos datos» |
| Denuncias de la Ley Karin | El empleador, por medio de su encargado de denuncias | Encargado del tratamiento, con reserva reforzada: ni el titular de la cuenta ve el contenido |
| Titular de la cuenta, usuarios del equipo y encargados Ley Karin: identificación, credenciales y actividad | Jornada40 | Responsable: los necesita para prestar el servicio, cobrarlo y auditarlo |
| Fiscalizadores: identificación, correo e IP | Jornada40 | Responsable, para dejar registro de cada acceso a la documentación |
| Pagos: identificadores de suscripción, montos y fechas | Jornada40 | Responsable. Los datos de la tarjeta los trata Transbank y Jornada40 no los ve |

: Roles en el tratamiento de datos personales

## Inventario de datos personales {#sec-dp-inventario}

| Titulares | Datos | Finalidad | Origen |
|---|---|---|---|
| Trabajadores | Identificación: RUT, nombres, sexo, fecha de nacimiento, nacionalidad y estado civil. Contacto: dirección, teléfono y correo. Datos del cargo, del contrato, de la jornada y de la modalidad | Contratos, documentos laborales y registro en Mi DT | El empleador; la carga masiva; la lectura de un contrato escaneado |
| Trabajadores | Sueldo, liquidaciones, horas extra, comisiones, descuentos, finiquitos, AFP, salud (Fonasa o Isapre, plan y número FUN), cargas familiares y su tramo, banco y cuenta | Remuneraciones, Previred, Libro de Remuneraciones Electrónico, Certificado N°6 y finiquitos | El empleador; los cálculos del sistema |
| Trabajadores | Discapacidad, pensión de invalidez, hijo con enfermedad grave, cuidado de otras personas, fuero (maternal, sindical o de negociación), fecha de parto, días de licencia médica | Avisos de protecciones legales, cálculo de la liquidación y declaraciones ante la DT | El empleador; las peticiones del portal |
| Trabajadores | Firma dibujada, IP y fecha de cada firma; cuenta del portal: correos verificados, clave (en huella) y último ingreso | Evidencia de la firma y acceso al portal | El propio trabajador |
| Personas en una denuncia Ley Karin (afectada, denunciante, denunciados, testigos e investigador) | Nombres, RUT, cargo, vínculo, relato, declaraciones, medidas y archivos del expediente | Procedimiento de la Ley 21.643 | El encargado de denuncias o el propio trabajador desde el portal |
| Titular de la cuenta | RUT, nombres, razón social, correo, teléfono, dirección; clave (en huella); pagos y suscripción | Cuenta, cobro y soporte | El titular; Reveniu |
| Usuarios del equipo y encargados Ley Karin | RUT, nombres, correo, permisos, empresas asignadas, clave (en huella) | Acceso y auditoría | El titular |
| Representante legal y firmante del empleador | Nombre, RUT, cargo e imagen de la firma | Firma de los documentos de la empresa | El titular |
| Fiscalizadores de la DT | Nombre, RUT, correo institucional, IP y firma de las ratificaciones | Acceso y registro de la fiscalización | El propio fiscalizador |
| Cualquier persona que usa el sistema | IP, ruta y hora de cada acción del panel; registros de ejecución del servidor | Seguridad y auditoría | El sistema |

: Inventario de datos personales

La aplicación web no usa analítica, publicidad ni rastreo de terceros. La sección 6.5 describe cómo se guarda cada categoría y el anexo B lista los campos.

## Datos sensibles {#sec-dp-sensibles}

Algunos datos revelan la salud, la vida sexual o la afiliación sindical de una persona, y la ley les da una protección especial:

- **Salud:** discapacidad, pensión de invalidez, hijo con enfermedad grave, cuidado de personas con discapacidad o dependencia, días de licencia médica, y fuero maternal con fecha de parto.
- **Afiliación sindical:** el fuero sindical, de delegado o de negociación colectiva revela que la persona es dirigente o participa de un sindicato.
- **Denuncias de la Ley Karin:** pueden contener hechos de acoso sexual o laboral y datos de salud.

**Tratamiento.** Las denuncias de la Ley Karin se guardan cifradas. Los demás datos sensibles se guardan en claro y se protegen con el control de acceso (capítulo 8).

**Justificación.** Cada uno tiene una finalidad legal concreta: avisar al empleador de una protección que la ley impone, calcular la remuneración o declarar ante la DT. Aun así, la necesidad de cada campo y su base de licitud deben revisarse frente a la nueva ley (sección 9.8).

## Proveedores y transferencias internacionales {#sec-dp-proveedores}

| Proveedor | Servicio | Datos personales que trata | Ubicación |
|---|---|---|---|
| Railway | API, base de datos y tarea programada | Todos los datos del sistema | Empresa de Estados Unidos; región según la configuración del proyecto |
| Backblaze B2 | Almacenamiento de archivos | PDF por firmar y firmados, archivos subidos, archivos cifrados de la Ley Karin | Empresa de Estados Unidos; región según `B2_ENDPOINT_URL` |
| Resend | Envío de correos | Direcciones y contenido de los correos (códigos, enlaces, avisos, PDF firmados adjuntos) | Empresa de Estados Unidos |
| Google (Gemini) | Lectura de contratos escaneados | El contrato completo que sube el empleador | Empresa de Estados Unidos |
| Cloudflare | DNS y proxy de la API | Todo el tráfico de la API, en tránsito | Red global |
| Vercel | Publicación de la aplicación web | Direcciones IP de los visitantes en sus registros | Empresa de Estados Unidos |
| Reveniu y Transbank | Suscripciones y cobro | Nombre y correo del titular, montos; la tarjeta solo en Transbank | Chile |
| mindicador.cl | UF y UTM | Ninguno | Chile |

: Proveedores que tratan datos personales

**Transferencias internacionales.** Casi todos los proveedores están fuera de Chile, así que guardar y procesar los datos implica transferencias internacionales. Con la nueva ley, esas transferencias requieren garantías adecuadas, como cláusulas contractuales. Hoy no hay un registro de subencargados ni de sus contratos (sección 9.8).

**Gemini.** La lectura con Gemini envía a Google el documento completo, con los datos personales del trabajador. Las condiciones de Google distinguen entre el uso pagado de su API, en que no usa los datos para mejorar sus productos, y el gratuito, en que puede hacerlo. Debe verificarse en qué condición está la clave configurada. También conviene informarlo a los clientes, porque la lectura es una opción y no un paso obligatorio.

## Conservación y eliminación {#sec-dp-conservacion}

**Qué se conserva.**

- **Sin borrado:** los datos se desactivan o se anulan en vez de borrarse (sección 6.8).
- **Bitácora:** se conserva al menos cinco años.
- **Fin del servicio:** cuando una suscripción termina, la cuenta pasa al plan base y no se borra nada.

**Lo que falta.**

- **Política de conservación:** no hay plazos por categoría de dato ni un proceso que elimine o anonimice al vencer.
- **Fin del contrato con el cliente:** no hay una función para que el titular descargue todos sus datos y luego los elimine.
- **Datos acumulados:** códigos vencidos, levantamientos de la extensión y PDF de solicitudes no firmadas.

**Obligaciones del empleador.** Varias obligaciones de conservación son del empleador: documentos laborales, previsionales y tributarios, con plazos de prescripción. Por eso la política debe distinguir lo que Jornada40 guarda por cuenta del cliente, mientras dure el contrato y lo que este instruya, de lo que guarda como responsable.

## Derechos de los titulares {#sec-dp-derechos}

| Titular | Cómo ejerce hoy sus derechos | Lo que falta |
|---|---|---|
| Trabajador | **Acceso:** ve en el portal sus documentos firmados, sus liquidaciones firmadas, sus vacaciones y sus certificados, y descarga los PDF. **Rectificación y otros derechos:** los pide al empleador, que es el responsable y corrige la ficha | Un procedimiento para que Jornada40, como encargado, ayude al empleador a responder en plazo, por ejemplo exportando todos los datos de una persona |
| Titular de la cuenta | **Rectificación:** edita su perfil. **Otros derechos:** los pide por correo a Jornada40 | Exportación y eliminación de la cuenta; un canal y plazos definidos |
| Usuarios del equipo y encargados | Los atiende el titular que los invitó, y Jornada40 a pedido | Igual que el anterior |
| Personas en una denuncia Ley Karin | Ven en el portal lo que la ley permite según su rol; el resto lo resuelve el encargado | Reglas propias de la reserva del procedimiento |

: Ejercicio de los derechos de los titulares

El canal publicado hoy es `contacto.jornada40@gmail.com`; lo informa la política de privacidad de la extensión. No hay una política de privacidad general de la plataforma.

## Seguridad y vulneraciones {#sec-dp-vulneraciones}

**Medidas.** Las medidas de seguridad están en el capítulo 8. Entre ellas:

- control de acceso por cuenta, módulo y empresa;
- cifrado de la Ley Karin;
- huellas de las claves y los códigos;
- bitácoras inalterables;
- alertas de errores sin datos personales.

**Lo que falta.** No hay un procedimiento escrito de respuesta a incidentes ni de notificación de vulneraciones. Con la nueva ley, las vulneraciones de seguridad deben reportarse a la Agencia y, en ciertos casos, a los titulares afectados. Como encargado, Jornada40 debe además avisar al empleador.

## Brechas frente a la Ley 21.719 {#sec-dp-brechas}

| Brecha | Prioridad | Propuesta |
|---|---|---|
| No hay contrato de encargo con los clientes: finalidad, instrucciones, confidencialidad, subencargados, seguridad, asistencia en derechos y vulneraciones, devolución o eliminación al terminar | Alta | Agregar a los términos de servicio un anexo de tratamiento por encargo, aceptado al registrarse y por los clientes actuales |
| No hay política de privacidad de la plataforma; los términos citan solo la Ley 19.628 | Alta | Publicar una política para titulares de cuenta, trabajadores, fiscalizadores y visitantes, y enlazarla en el registro, el portal y la firma |
| Transferencias internacionales y subencargados sin registro ni garantías documentadas | Alta | Inventariar proveedores, regiones y contratos (cláusulas de protección de datos de cada uno) e informarlos a los clientes |
| Sin procedimiento de respuesta a vulneraciones | Alta | Procedimiento con roles, plazos, evaluación del riesgo, reporte a la Agencia, aviso al empleador y a los afectados, y un registro de incidentes |
| Sin política de conservación ni eliminación | Media | Plazos por categoría, limpieza de los datos acumulados (sección 6.8), y exportación y eliminación al término del contrato |
| Sin procedimiento para los derechos de los titulares | Media | Canal, plazos y herramientas: exportar o corregir los datos de una persona a pedido del responsable |
| Datos sensibles en claro (salud, afiliación sindical) | Media | Revisar la necesidad de cada campo y su base de licitud; evaluar cifrarlos o restringir quién los ve |
| Lectura de contratos con Gemini | Media | Verificar las condiciones de uso de datos de la clave, informarlo al cliente y mantener la lectura como una opción |
| Sin registro de las actividades de tratamiento ni designación de un responsable interno | Media | Registro de actividades a partir de este capítulo; evaluar un delegado de protección de datos y un modelo de prevención de infracciones |

: Brechas frente a la Ley 21.719
