# Cumplimiento normativo {#sec-cumplimiento}

Este capítulo describe cómo aplica Jornada40 la legislación laboral, previsional y tributaria chilena:

- las normas que implementa;
- cómo se trazan hasta el código y las pruebas;
- qué exige la Dirección del Trabajo para la documentación laboral electrónica y cómo se cumple;
- qué criterios de interpretación adoptó el sistema;
- dónde están sus límites.

Las reglas de cálculo y los plazos están especificados en el capítulo 3; aquí se citan por su código. El capítulo describe el sistema y no reemplaza la asesoría legal de cada empleador.

## Marco normativo {#sec-cum-marco}

La tabla reúne las normas que el código cita expresamente, agrupadas por materia. La sección 1.4.2 lista las referencias completas.

| Materia | Normas | Dónde se aplica |
|---|---|---|
| Relación laboral, jornada, remuneraciones, feriado, permisos, término, fueros y reglamento interno | Código del Trabajo (DFL N° 1 de 2002), en especial Arts. 10–11, 22, 30–32, 41–45, 50, 54, 58, 62 bis, 66–73, 153–157, 159–177, 195–207 bis | Contratos, liquidaciones, vacaciones, documentos, finiquitos y reglamento (RF-CON, RF-REM, RF-VAC, RF-DOC, RF-FIN, RF-REG; RN-REM, RN-VAC, RN-FIN) |
| Reducción de la jornada a 40 horas y horas extra compensadas con descanso | Ley 21.561 | Máximo legal por fecha (RN-CON-01), avisos de jornada (RN-CON-02), anexos de 40 horas, compensación con días libres (RN-REM-15) |
| Acoso y violencia en el trabajo | Ley 21.643 (Ley Karin), DS 21 de 2024, Dictamen 497/21 | Canal de denuncias, aviso semestral, procedimiento, plazos y reserva (RF-KAR, RN-KAR-01) |
| Conciliación de la vida laboral y familiar | Ley 21.645 | Protecciones por cuidado y solicitudes de teletrabajo o cambio de jornada (RN-TRA-01) |
| Teletrabajo | Ley 21.220 | Pacto de teletrabajo como anexo y modalidad del trabajador |
| Registro electrónico laboral | Ley 21.327, DS N° 14 de 2023 | Plazos y fichas para Mi DT, extensión (RF-DT, RN-DT-01) |
| Seguridad y salud en el trabajo | Ley 16.744, DS 44 de 2024, Ley 20.949 (carga manual) | Reglamento interno de higiene y seguridad, información de riesgos, entrega de EPP |
| Cotizaciones previsionales | DL 3.500 (AFP), Ley 19.728 (seguro de cesantía), Ley 21.735 (reforma de pensiones), Ley 18.156 (técnicos extranjeros) | Descuentos y aportes de la liquidación (RN-REM-10), Previred, Libro de Remuneraciones Electrónico |
| Ingreso mínimo y asignación familiar | Leyes 21.578 y 21.751 (ingreso mínimo); Ley 18.987 y Ley 21.830 (asignación familiar) | Parámetros por período (sección 6.3), asignación familiar (RN-REM-13) |
| Protecciones especiales | Ley 21.063 (SANNA), Ley 21.015 y Ley 20.422 (discapacidad), Ley 19.631 (despido con cotizaciones impagas) | Avisos de la ficha, declaraciones para Mi DT, carta de despido |
| Impuesto y certificados tributarios | Ley sobre Impuesto a la Renta (impuesto único de segunda categoría; certificado de sueldos del Art. 101), Res. Ex. SII N° 6.509, DL 889 | Impuesto único (RN-REM-11), Certificado N°6 y ayuda para la DJ 1887 |
| Documentación laboral electrónica y firma | Ley 19.799, Dictamen 0789/15, ORD N° 2257 de 2022, N° 82, N° 136 y N° 79 de 2025, ORD N° 2965 | Firma electrónica, consentimiento, portal de fiscalización (sección 10.3) |
| Datos personales | Ley 19.628 y Ley 21.719 | Capítulo 9 |

: Normas que implementa el sistema

## Trazabilidad {#sec-cum-trazabilidad}

**Cadena de trazabilidad.** Cada regla legal se puede seguir desde la norma hasta la prueba automática que la comprueba:

1. **Norma.** El capítulo 3 asigna a cada requerimiento la norma que cita el código.
2. **Requerimiento.** Los 199 requerimientos funcionales y las 44 reglas de negocio tienen un código estable.
3. **Código.** Los módulos que implementan cada regla están en los capítulos 4 y 5.
4. **Prueba.** La columna «Norma y verificación» del capítulo 3 nombra los archivos de prueba.

**Estado de la trazabilidad.**

- 67 requerimientos funcionales citan una norma expresa; los demás son funciones de apoyo, como cuentas, pagos o pantallas.
- 192 de los 199 tienen al menos una prueba automática. Los 7 restantes dicen «Sin prueba directa».
- Las 44 reglas de negocio tienen pruebas.
- Los ejemplos numéricos de la sección 3.2.8 los comprueba `test_ejemplos_documento`: si un cálculo cambia, esa prueba falla y el ejemplo se actualiza junto con el código.

El anexo J reúne la matriz completa: requerimiento, norma y pruebas.

## Documentación laboral electrónica ante la DT {#sec-cum-dt}

El Dictamen 0789/15 de la Dirección del Trabajo y sus pronunciamientos posteriores fijan las condiciones para que un empleador lleve su documentación laboral en forma electrónica. La tabla muestra cada exigencia y cómo la cubre Jornada40.

| Exigencia | Fuente | Cómo se cumple | Estado |
|---|---|---|---|
| Consentimiento del trabajador para recibir y firmar documentos electrónicos | Dictamen 0789/15 | El contrato incluye la cláusula de consentimiento y los trabajadores actuales firman un anexo. La firma registra la fecha y la vía; el consentimiento en papel o su revocación también se registran | Implementado |
| Firma vinculada a su autor | Ley 19.799; ORD N° 2257 de 2022 y N° 82 de 2025 | Firma electrónica simple con identidad verificada, aceptación expresa, firma dibujada, huellas y página de certificado (sección 8.9) | Implementado |
| El código verifica la identidad; firmar es aceptar y firmar | ORD N° 136 y N° 79 de 2025 | La página de firma y el certificado separan la verificación de la identidad del acto de firmar | Implementado |
| Firma del empleador por documento | ORD N° 2257 de 2022 | El empleador confirma su clave antes de enviar a firma; queda registrado quién emitió el documento, cuándo y desde qué IP | Implementado |
| Envío del documento al trabajador y uso de su correo personal | ORD N° 2965 | El PDF firmado se envía por correo al trabajador y queda en su portal; la ficha advierte si el correo parece corporativo | Implementado |
| Acceso irrestricto de la fiscalización | Dictamen 0789/15 | Portal de fiscalización de solo lectura, con todos los trabajadores y documentos, descarga de la versión firmada, ratificación en terreno y registro de cada acceso | Implementado |
| Finiquito con poder liberatorio | Código del Trabajo, Art. 177 | La firma en Jornada40 es solo de recepción. Se registran la modalidad (ministro de fe o Mi DT) y la ratificación. **[Solo en staging]** La renuncia y el mutuo acuerdo firmados en Jornada40 advierten que el empleador solo puede invocarlos ratificados ante un ministro de fe o firmados por el presidente del sindicato o el delegado | Implementado |
| Registro de contratos, anexos y términos | Ley 21.327 | Plazos en días hábiles, fichas para copiar en Mi DT y extensión de llenado (**[Solo en staging]**); Mi DT no tiene interfaz de programación | Implementado; la extensión, en piloto |
| Libro de Remuneraciones Electrónico | Código del Trabajo, Art. 62 bis | Archivo mensual con las 147 columnas de la plantilla oficial | Implementado |
| Reconocimiento de la plataforma por la DT | Práctica de la DT: precedentes de otras plataformas (por ejemplo, ORD N° 136 de 2025) | Falta acordar las medidas de seguridad y presentar la solicitud (Etapa D). El borrador de la solicitud está en `docs/legal/07-solicitud-dt.md` | Pendiente |

: Exigencias de la documentación laboral electrónica

**Reconocimiento (Etapa D).** Para presentar la solicitud conviene adjuntar directamente:

- la descripción de los controles de este documento (capítulo 8);
- el flujo de firma (sección 4.5.3);
- el portal de fiscalización.

La DT dejó de pronunciarse sobre una plataforma cuyos antecedentes estaban detrás de un registro (`docs/PENDIENTES.md`).

**Borrador de la solicitud.** El borrador del 14-10-2026 (`docs/legal/07-solicitud-dt.md`) recorre los requisitos copulativos a) a e) del Dictamen 0789/15, tal como los cita el ORD N° 136 de 2025, y los dos que ese ordinario agrega: el consentimiento expreso del trabajador y el envío automático del documento a su correo personal. Responde también la observación del ORD N° 136 sobre los códigos que reemplazan la firma dibujada: en Jornada40, el código solo verifica la identidad. Lista los anexos que conviene acompañar y marca con [COMPLETAR] los datos de la empresa solicitante. Antes de presentarlo, deben publicarse en producción las correcciones de la rama, porque el borrador las describe.

## Criterios adoptados {#sec-cum-criterios}

Donde la norma admite más de una lectura, el sistema adoptó un criterio y lo documentó. Los principales:

| Tema | Criterio adoptado | Razón |
|---|---|---|
| Plazos de registro en Mi DT y de la Ley Karin | Días hábiles de lunes a viernes, sin feriados (RN-DT-01, RN-KAR-01) | Es la lectura más estricta; evita que un plazo venza un sábado sin aviso |
| Feriado | Días hábiles de lunes a viernes; el sábado es inhábil (RN-VAC-01) | Art. 69 del Código del Trabajo |
| Permisos legales en días hábiles | Lunes a sábado, sin feriados (RN-DOC-01) | Criterio de la DT para los permisos del Art. 66 |
| Jornada máxima | 45, 44, 42 y 40 horas según la fecha (RN-CON-01); el Art. 22 guarda el máximo vigente | Calendario de la Ley 21.561 |
| Normas que se advierten y normas que se impiden | Lo que contraviene una norma se advierte. Se impide lo que la ley prohíbe, como un recargo de horas extra menor al 50 %, o lo que invalidaría un documento o un archivo oficial | Principio de diseño (sección 2.1.3) |
| Denuncias de la Ley Karin | Sin denuncias anónimas. Derivación obligatoria a la DT cuando se denuncia al empleador o a la dirección. La plataforma no concluye ni propone sanciones | Dictamen 497/21, Art. 4° del Código del Trabajo, DS 21 de 2024 |
| Asignación familiar | Las cargas inválidas cuentan doble; se paga completa con 25 días o más de remuneración en el mes (RN-REM-13) | Tablas e instrucciones de la SUSESO |
| Aportes de la reforma de pensiones en el Libro de Remuneraciones Electrónico | Código 4155 para el SIS con los nuevos aportes, y 4157 para el 0,1 % del empleador | La DT no publicó códigos propios; se sigue la convención del mercado |
| Horas extra compensadas con descanso | Tope de 5 días por año de contrato; el exceso se paga y se advierte (RN-REM-15) | Dictamen 199/5 |

: Criterios de interpretación adoptados

## Límites del cumplimiento {#sec-cum-limites}

**Previred.** El archivo no cubre:

- el régimen del IPS ni a los pensionados;
- el ahorro previsional voluntario;
- las licencias médicas con fechas ni las líneas adicionales.

Esos casos se informan directamente en Previred.

**Formatos sin verificar con cargas reales.**

- Los campos de la indemnización a todo evento en Previred.
- El registro masivo de contratos en Mi DT, que está oculto en la interfaz.
- Los códigos del Libro de Remuneraciones Electrónico para las horas extra compensadas con descanso, a la espera de que la DT los publique.

**Supuestos del registro masivo.** Trabajadores con RUT chileno, sin subcontratación ni servicios transitorios, y con el lugar de trabajo en la comuna de la empresa (SU-03).

**Actualización de parámetros.** Los reajustes de topes, tasas, ingreso mínimo, asignación familiar y factores del SII se cargan a mano en el administrador. Un reajuste tardío afecta los cálculos de ese período, aunque el sistema lo advierte (sección 6.3). **[Solo en staging]** Desde el 14-10-2026, `sincronizar_previred` también propone las tasas de la reforma de pensiones (rentabilidad protegida, expectativa de vida y el aporte del empleador a la AFP), el SIS y el seguro de cesantía desde el año 11; lo que no puede leer lo copia de lo vigente y lo informa. En producción, esas tasas todavía se ingresan a mano.

**Plantillas.** La plantilla del reglamento interno es una guía con partes por completar; no reemplaza el reglamento de cada empresa.

**Verificación de los datos.** El sistema valida formatos y advierte inconsistencias, pero no comprueba ante terceros los datos que ingresa el empleador (SU-01).
