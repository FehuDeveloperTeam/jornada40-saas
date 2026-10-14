# Procedimiento ante vulneraciones de seguridad

**Borrador para revisión legal.** Procedimiento interno para detectar, contener, evaluar, comunicar y registrar las vulneraciones de seguridad que afecten datos personales, conforme a los artículos 14 quinquies, 14 sexies y 15 bis de la Ley N° 19.628, modificada por la Ley N° 21.719.

**Qué es una vulneración.** Todo incidente que cause la destrucción, filtración, pérdida o alteración accidental o ilícita de datos personales, o su comunicación o acceso no autorizados (artículo 14 sexies). Por ejemplo: acceso indebido a una cuenta, un error que muestre datos de un cliente a otro, la pérdida de un respaldo, la filtración de una clave del servidor o un envío de correo a un destinatario equivocado.

## 1. Roles

| Rol | Quién | Qué hace |
|---|---|---|
| Responsable del incidente | [COMPLETAR: titular de Jornada40 o quien designe] | Dirige la respuesta, decide las comunicaciones y firma el registro |
| Responsable técnico | [COMPLETAR] | Contiene, investiga y corrige; prepara los datos para las comunicaciones |
| Asesor legal | [COMPLETAR] | Evalúa el riesgo para los titulares y revisa las comunicaciones |
| Contacto con clientes | [COMPLETAR] | Envía los avisos a los clientes afectados |

Si una persona no está disponible, la reemplaza [COMPLETAR].

## 2. Etapas y plazos

| Etapa | Qué se hace | Plazo objetivo |
|---|---|---|
| 1. Detección | Llega una alerta de error, un aviso de un cliente o trabajador, un aviso de un proveedor o una anomalía en la bitácora. Se abre una ficha en el registro de incidentes | Inmediato |
| 2. Contención | Se corta el acceso indebido y se evita que siga el daño (sección 3) | Dentro de [COMPLETAR: 4] horas desde la detección |
| 3. Evaluación | Qué pasó, qué datos y de cuántas personas, de qué clientes, desde cuándo, y si hay riesgo razonable para los derechos de los titulares | Dentro de [COMPLETAR: 24] horas |
| 4. Comunicación | A los clientes afectados, a la Agencia y a los titulares, según la sección 4 | Sin dilaciones indebidas |
| 5. Corrección | Se elimina la causa, se agrega una prueba que la reproduzca y se publica la corrección | Según la gravedad |
| 6. Cierre | Se completa el registro con las lecciones y las medidas para prevenir otro incidente | Dentro de [COMPLETAR: 30] días |

## 3. Medidas técnicas de contención

Las operaciones están en el documento técnico, sección 12.7.

| Situación | Medida |
|---|---|
| Se sospecha que se filtró la clave del servidor (`SECRET_KEY`) | Cambiarla en Railway y desplegar: se cierran todas las sesiones y quedan sin efecto los códigos y enlaces pendientes |
| Cuenta comprometida de un usuario del equipo | El titular lo elimina; su sesión deja de valer al instante |
| Cuenta comprometida del titular | Cambiar su clave y cerrar sus sesiones [REVISAR: hoy no hay un botón para cerrar todas las sesiones de una persona; el cambio de `SECRET_KEY` las cierra todas] |
| Clave de un proveedor filtrada (B2, Resend, Reveniu, Gemini) | Revocarla en el proveedor, crear otra y actualizar la variable en Railway |
| Se sospecha que se filtró la clave de cifrado de la Ley N° 21.643 | Rotarla con `rotar_cifrado` (agregar la nueva primero, desplegar, ejecutar, quitar la antigua) |
| Datos alterados | Verificar la cadena de la bitácora («Verificar integridad») y restaurar desde un respaldo [REVISAR: hoy no hay respaldos automáticos] |

## 4. Comunicaciones

### 4.1 Cuando Jornada40 es encargado (datos de los trabajadores del Cliente)

- **A quién:** a cada Cliente afectado (artículo 15 bis, inciso cuarto).
- **Cuándo:** sin dilaciones indebidas y a más tardar dentro de [COMPLETAR: 48] horas desde que se confirme la vulneración, aunque la información esté incompleta; se complementa después.
- **Qué:** lo de la sección 5, para que el Cliente pueda reportar a la Agencia y, si corresponde, a sus trabajadores.
- **Quién reporta a la Agencia y a los titulares:** el Cliente, como responsable. Jornada40 lo ayuda con los datos y, si el Cliente lo pide, con el texto. [REVISAR: si conviene ofrecer que Jornada40 avise a los trabajadores por el Cliente.]

### 4.2 Cuando Jornada40 es responsable (cuentas, usuarios, fiscalizadores, registros técnicos)

- **A la Agencia:** por los medios más expeditos posibles y sin dilaciones indebidas, cuando exista un riesgo razonable para los derechos y libertades de los titulares (artículo 14 sexies).
- **A los titulares:** además, cuando la vulneración afecte datos sensibles, datos de niñas y niños menores de 14 años o datos de obligaciones económicas, financieras, bancarias o comerciales. En lenguaje claro: qué datos, qué consecuencias posibles y qué medidas se tomaron. Se avisa a cada titular y, si no es posible, con un aviso en un medio de comunicación masivo de alcance nacional.

### 4.3 Otras comunicaciones

- **Proveedor involucrado:** si el incidente nace en un proveedor, se le exige su informe.
- **Ley N° 21.663 (marco de ciberseguridad):** [REVISAR: si Jornada40 o alguno de sus clientes queda sujeto a reportar incidentes al CSIRT Nacional.]

## 5. Contenido del aviso y del registro

El registro de cada incidente debe incluir lo que pide el artículo 14 sexies:

| Campo | Contenido |
|---|---|
| Identificación | Número correlativo, fecha y hora de detección, quién lo detectó y cómo |
| Naturaleza | Qué pasó: acceso indebido, filtración, pérdida, alteración, envío erróneo |
| Efectos | Consecuencias posibles para las personas |
| Datos | Categorías de datos afectados; si hay datos sensibles, de menores o financieros |
| Titulares | Número aproximado de personas y de clientes afectados |
| Medidas | Contención, corrección y medidas para prevenir otro incidente |
| Comunicaciones | A quién se comunicó (clientes, Agencia, titulares), cuándo y por qué medio; copia de cada comunicación |
| Evaluación | Si hubo riesgo razonable y por qué; si no se comunicó a la Agencia, la razón |
| Cierre | Fecha, responsable y lecciones |

[COMPLETAR: dónde se guarda el registro (documento con acceso restringido) y por cuánto tiempo.]

## 6. Ensayo

Una vez al año, o tras un cambio importante, se ensaya el procedimiento con un caso simulado, por ejemplo una clave filtrada, y se ajusta lo que no funcionó.
