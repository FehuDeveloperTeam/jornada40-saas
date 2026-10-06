# Jornada40 — Briefing comercial y mapa de funcionalidades

> **Para qué sirve este documento.** Es la referencia completa de lo que hace Jornada40, escrita para el equipo comercial antes de visitar a un cliente. También sirve como base para generar los manuales de usuario: cada flujo indica quién lo hace, dónde está en el sistema y qué pasos tiene.
>
> **Versión:** octubre de 2026. Describe la versión en pruebas (staging). Antes de prometer una función a un cliente, confirma con el equipo técnico que ya está publicada en producción (jornada40.cl); el portal del trabajador, Ley Karin, usuarios del equipo y las peticiones desde el portal se publican junto con la revisión pendiente.

---

## 1. Jornada40 en 30 segundos

Jornada40 es una plataforma chilena, 100 % web, para que las pymes tengan **sus trabajadores, contratos, sueldos y obligaciones laborales en regla**, en especial con la **Ley 40 horas (Ley 21.561)**, que baja la jornada máxima por etapas.

- **Una carpeta por trabajador**: contrato, jornada, liquidaciones, vacaciones, documentos y firmas en un solo lugar.
- **Firma electrónica incluida**: el trabajador firma desde su correo o celular con un código.
- **Cálculos legales hechos por el sistema**: liquidaciones, finiquitos, vacaciones, horas extra y permisos se calculan en el servidor con los parámetros vigentes de cada mes. El usuario no tiene que saber las fórmulas.
- **Avisa, nunca bloquea**: si algo no cumple la ley (jornada sobre el máximo, horas extra sin pacto, fuero vigente), el sistema avisa con la norma y deja que el empleador decida.
- **Pensado para dueños de pymes**: letra grande, pasos numerados, listas cerradas en vez de texto libre y lenguaje simple. Muchos usuarios son personas mayores.

**Frase de venta:** *"Jornada40 te dice qué tienes que hacer, cuándo vence y te deja el documento listo para firmar."*

---

## 2. A quién se lo vendemos

| Perfil | Dolor principal | Qué le mostramos primero |
|---|---|---|
| Dueño de pyme sin área de RR.HH. (1–20 trabajadores) | Miedo a multas de la DT; hace todo en Excel o con el contador | Carpeta del trabajador, contrato y anexo Ley 40 horas, firma electrónica, resumen por correo |
| Pyme con administración (20–75 trabajadores) | Mucho trámite repetitivo, papeles que se pierden | Liquidaciones masivas, Previred, Libro electrónico (LRE), portal del trabajador, usuarios del equipo |
| Contador o asesor que lleva varias empresas | Muchas empresas, plazos distintos | Multiempresa, usuarios con permisos, consolidado, resumen por correo, bitácora |
| Empresa con riesgo laboral alto (construcción, gastronomía, agrícola, transporte) | Reglamento interno, EPP, Ley Karin | Reglamento por rubro, información de riesgos, entrega de EPP, encargado Ley Karin |

---

## 3. Planes

Precios y límites **referenciales** (se administran en el sistema y pueden cambiar; confirma en jornada40.cl → Precios). Hay pago **mensual** y **anual** (el anual equivale a 10 meses, "2 meses gratis").

| | **Semilla** | **Starter** | **Pyme** (más elegido) | **Corporativo** |
|---|---|---|---|---|
| Precio mensual (ref.) | Gratis | $16.990 | $39.990 | $89.990 |
| Empresas | 1 | 1 | 3 | 10 |
| Trabajadores | 3 | 10 | 75 | 250 |
| Usuarios del equipo | — | 2 | 6 | 20 |
| Encargado Ley Karin | — | — | 1 | 1 |

**Qué incluye cada nivel** (cada plan incluye todo lo del anterior):

- **Semilla (gratis):** contratos y anexos Ley 40 horas; liquidaciones de sueldo; firma electrónica con código; Certificado N°6 del SII; entrega de EPP; resumen por correo. Los documentos llevan marca Jornada40.
- **Starter:** sin marca; vacaciones y permisos; pactos de horas extra y constancias (descuentos, permisos legales, indemnización a todo evento, teletrabajo); cartas de término y finiquitos; usuarios del equipo con permisos y bitácora.
- **Pyme:** portal del trabajador (certificados, solicitudes, peticiones); archivo Previred y Libro de Remuneraciones Electrónico; reglamento interno e información de riesgos; Ley Karin con encargado de denuncias; horas extra compensadas con días libres; carga masiva desde Excel; descarga masiva en ZIP; consolidado multiempresa.
- **Corporativo:** más empresas, trabajadores y usuarios en una sola cuenta.

**Reglas que conviene saber:**
- Se puede subir o bajar de plan en cualquier momento desde *Plan y facturación*. Al subir, el nuevo plan rige desde el pago. Al bajar, se mantiene el plan actual hasta el próximo cobro. No hay prorrateo.
- **Cupo de trabajadores:** cuentan los activos más los desvinculados durante el mes en curso. Un trabajador desvinculado libera su cupo el mes siguiente.
- Se paga con tarjeta vía Reveniu (Webpay / Transbank). No hay cobros sorpresa: el plan anual nunca se cobra como mensual.

---

## 4. Las tres (cuatro) puertas de entrada

Cada tipo de persona entra por su propia puerta, con su propia sesión. Esto es un argumento de seguridad.

| Quién | Dónde entra | Cómo | Qué ve |
|---|---|---|---|
| **Titular** (dueño de la cuenta) | jornada40.cl → *Iniciar sesión* | RUT y clave | Todo, excepto el contenido de las denuncias Ley Karin (solo un contador de casos y plazos) |
| **Usuario del equipo** (contador, jefatura, administrativo) | *Iniciar sesión* → *Ingreso del equipo* | RUT y su propia clave | Solo los módulos y empresas que el titular le asignó, con permiso de *ver* o *ver y gestionar* |
| **Encargado Ley Karin** | *Iniciar sesión* → *Encargado Ley Karin* | RUT y clave propia | Solo las denuncias de sus empresas. Nada más del sistema |
| **Trabajador** | Botón *Soy trabajador* | RUT y un código que llega a su correo (o clave si la creó) | Sus documentos, certificados y solicitudes |
| **Fiscalizador de la DT** | Pie de página → *Fiscalización DT* | RUT del empleador + correo institucional @dt.gob.cl + código | Todos los documentos de esa empresa, solo lectura |

**Cierre por inactividad:** el panel y Ley Karin se cierran tras 5 minutos sin uso; el portal del trabajador y el de fiscalización, tras 15. Un minuto antes aparece "¿Sigues ahí?". Lo que se estaba escribiendo en un contrato o una liquidación queda guardado como borrador y se ofrece recuperarlo al volver.

---

## 5. Mapa de funcionalidades por módulo

### 5.1 Inicio (panel del titular)
- Lista de **tareas pendientes** ordenada por urgencia: firmas por vencer, contratos sobre la jornada máxima, registros en Mi DT por vencer, solicitudes de trabajadores, direcciones por completar, plazos Ley Karin vencidos, etc.
- Cada tarea lleva un botón que va directo a resolverla.

### 5.2 Trabajadores y carpeta
- **Alta rápida** ("Agregar trabajador"): identidad, correo personal, cargo, tipo de contrato y fechas, **jornada con horario o Art. 22** (sin control de horario), horas y sueldo. Crea la ficha y el contrato de una vez.
- **Ficha incompleta:** el sistema muestra qué falta para que el contrato salga completo (fecha de nacimiento, nacionalidad, estado civil, dirección, comuna, AFP, salud, horario), con enlaces para completarlo. Avisa; no impide.
- **Carpeta del trabajador** con pestañas: Resumen, Datos (personales, contacto, previsión y pago), Contrato, Remuneraciones, Vacaciones, Documentos.
- **Dirección por partes:** calle, número, depto, y la opción **"S/N"** para direcciones rurales sin número (por ejemplo, "San Pedro de Lilahue S/N, km 2").
- **Banco desde una lista cerrada** (bancos, Coopeuch, Tenpo, Mercado Pago, MACH, Prepago Los Héroes, otra institución).
- **Protecciones especiales** (solo avisos):
  - fuero maternal, calculado desde la fecha de parto (parto + 12 semanas + 1 año);
  - fuero postnatal parental, sindical, delegado, comité paritario y negociación colectiva;
  - **cuidado de personas (Ley 21.645)**: menor de 14, adolescente con discapacidad, persona con discapacidad o dependencia;
  - hijo con enfermedad grave (**Ley SANNA**).

  Estos avisos aparecen al redactar una carta de término, al calcular un finiquito y al otorgar vacaciones.
- **Carga masiva desde Excel** (Pyme+): se descarga la planilla, se completa y se sube. El sistema valida cada RUT y muestra las filas con error antes de guardar.
- **Digitalizar un contrato en papel:** se sube una foto o PDF del contrato y el sistema propone los datos para completar el editor.
- **Desvincular** nunca borra: el trabajador queda inactivo con todo su historial.

### 5.3 Contratos y anexos (Ley 40 horas)
- **Editor de contrato** con distribución de jornada día a día (horario de entrada, salida y colación).
- Tipos: indefinido, plazo fijo y obra o faena. Jornada ordinaria, parcial, Art. 22 u otra.
- El sistema **compara cada contrato con la jornada máxima vigente** y avisa si la supera.
- **Anexo Ley 40 horas:** propone el nuevo horario y deja el anexo listo para firmar.
- Calendario de la ley: 45 → 44 h (abril 2024) → **42 h (abril 2026, vigente)** → 40 h (abril 2028).
- **Anexos de contrato** (cambios de sueldo, cargo, jornada, etc.) y **anexo de teletrabajo** (Ley 21.220). Al firmar el anexo de teletrabajo, la modalidad del trabajador cambia sola; al vencer, vuelve a presencial.
- Incluye la **cláusula de consentimiento para documentos electrónicos** (exigida por la DT). A los trabajadores antiguos se les puede enviar un anexo de consentimiento en lote.
- Un contrato firmado ya no se edita: los cambios se hacen por anexo (lo exige la ley).

### 5.4 Remuneraciones
- **Liquidación de sueldo:** sueldo base, gratificación con tope, horas extra, bonos, comisiones, asignación familiar (calculada por tramo), AFP, salud, cesantía (AFC), impuesto único, anticipos y descuentos.
- **Parámetros previsionales** (UF, UTM, topes, tasas AFP) mantenidos por Jornada40 y congelados en cada liquidación: recalcular un mes antiguo usa los valores de ese mes.
- **Vista previa** antes de guardar, con **avisos**: horas extra sin pacto firmado, descuentos sin autorización, descuentos voluntarios sobre el 15 %, ausencias en un mes con permiso legal.
- **Emisión masiva** del período y **envío masivo a firma** ("Enviar N a firma").
- **Conceptos de remuneración** propios de la empresa (bonos, descuentos), con su código del Libro electrónico.
- **Archivo Previred** (Pyme+): formato oficial de 105 campos. Si falta un dato que Previred rechazaría, el sistema dice qué falta y de quién.
- **Libro de Remuneraciones Electrónico (LRE)** para Mi DT (Pyme+): revisión previa con lo que falta y descarga del archivo con el formato oficial. Vence dentro de los primeros 15 días del mes siguiente.
- **Certificado N°6 del SII** (todos los planes) y planilla de apoyo para la **DJ 1887**. Plazos mostrados: certificados al 14 de marzo y DJ al 27 de marzo.
- **Consolidado multiempresa** y **descarga masiva en ZIP** (Pyme+).

### 5.5 Vacaciones y permisos (Starter+)
- Saldo de **feriado legal y progresivo** al día, con días hábiles calculados con el calendario de feriados de Chile.
- Tipos: vacaciones legales, progresivas, permiso sin goce y día libre por horas extra.
- **Comprobante** listo para firmar.
- **Permisos legales con goce** (constancia firmada), con los días calculados según la ley: fallecimiento de hijo, cónyuge o conviviente, hijo en gestación, padre, madre o hermano; nacimiento de un hijo; matrimonio o acuerdo de unión civil. Si el fallecimiento cae en día inhábil, el permiso parte el día hábil siguiente.
- **Horas extra compensadas con días libres** (Pyme+, Ley 21.561): el pacto de horas extra puede decir "pago", "días libres" o "mitad y mitad". El sistema lleva la bolsa de horas, el tope legal, el vencimiento a los 6 meses (las no usadas se pagan solas en la liquidación) y las pendientes al término van al finiquito.

### 5.6 Pactos, autorizaciones y constancias (Starter+)
Todo desde **listas cerradas**: el sistema valida la ley, calcula fechas y redacta las cláusulas.
- **Pacto de horas extraordinarias** (1 a 3 meses, máximo 2 h diarias, motivo de una lista).
- **Autorización de descuento voluntario** (Art. 58), con su **revocación** registrada.
- **Constancia de permiso legal.**
- **Pacto de indemnización a todo evento** (Art. 164, desde el séptimo año): el aporte se calcula solo en cada liquidación y se informa en Previred y el LRE.
- **Amonestaciones y constancias.**
- Los documentos solo rigen una vez firmados. Los que no se firmaron se pueden anular.

### 5.7 Término de la relación laboral (Starter+)
- **Cartas de término** con la causal del Código del Trabajo y aviso de fuero si corresponde.
- **Finiquito** calculado por el sistema: años de servicio, aviso previo, feriado proporcional, horas compensatorias pendientes y pacto a todo evento.
- Dos modalidades: **electrónico en Mi DT** (el sistema entrega los datos para copiar) o **presencial ante ministro de fe**. Se registra la ratificación y el finiquito queda cerrado.
- Firmarlo en Jornada40 es solo una **firma de recepción**; el poder liberatorio lo da la ratificación (el documento lo dice).

### 5.8 Firma electrónica
- El trabajador recibe un correo con un enlace personal, verifica su identidad con su **RUT y un código de un solo uso** (3 intentos, 10 minutos), revisa el PDF y firma.
- El empleador **confirma su clave** antes de enviar a firma (vale 10 minutos). Queda registro de quién envió, desde qué IP y cuándo.
- Cada documento firmado guarda fecha, hora e IP, y **siempre se descarga en su versión firmada**.
- Si el correo no sale, el sistema lo dice ("listo para firmar, pero el correo no se envió") y se puede reenviar desde *Firma electrónica*.
- Es **firma electrónica simple**, aceptada por la DT cuando el documento queda vinculado a su autor (ORD 2257/2022 y ORD 82/2025). No es firma electrónica avanzada (FEA).

### 5.9 Portal del trabajador (Pyme+)
- El trabajador entra con su **RUT y un código en su correo**; no instala nada. Puede crear una clave si quiere.
- Ve su contrato, sus **liquidaciones firmadas**, sus documentos firmados y sus vacaciones con saldo.
- **Firma** lo pendiente desde su Inicio.
- **Certificados al instante**, con la firma del empleador y un **código QR verificable** en jornada40.cl/verificar: antigüedad, renta, cotizaciones declaradas, vacaciones, jornada y horario, y término.
- **Solicitudes de documentos** (de una lista cerrada): liquidación faltante, contrato, anexo Ley 40 horas, comprobante de vacaciones, finiquito.
- **Peticiones:**
  - vacaciones, con vista previa de días y saldo;
  - permisos legales;
  - **conciliación familiar (Ley 21.645)**: teletrabajo o cambio de jornada en vacaciones escolares, con los plazos legales de respuesta del empleador (15 y 10 días).
- **Denuncias Ley Karin** desde el portal.
- Los desvinculados mantienen el acceso 3 meses desde el finiquito.
- El empleador ve en la carpeta si el trabajador ya entra al portal y puede **invitarlo** por correo.

### 5.10 Reglamento y seguridad (Pyme+, salvo EPP)
- **Plantilla guía de reglamento interno por rubro**, en Word o PDF: administración, comercio, manufactura, tecnología, construcción, gastronomía, transporte y bodega, agrícola, aseo y mantención, salud.
  - Con 10 o más trabajadores sale como **RIOHS** (orden, higiene y seguridad); con menos, como **RIHS**.
  - Incluye el protocolo Ley Karin, los riesgos del rubro y los EPP.
  - Las partes por completar quedan marcadas en amarillo.
- **Versiones del reglamento:** al subir el PDF publicado, calcula la vigencia (30 días) y el plazo de envío a la DT y a la Seremi de Salud.
- **Entrega firmada** a cada trabajador, con el reglamento completo adjunto a la constancia. Se envía sola junto con cada contrato nuevo.
- **Información de riesgos** por cargo, con capacitación presencial. Se puede hacer en lote para todos los que falten.
- **Entrega de EPP** (todos los planes): elementos, cantidad, motivo y capacitación de uso. Avisa si la capacitación tiene más de 12 meses.
- **Aviso semestral de canales de denuncia** (Ley Karin) a todos los trabajadores.

### 5.11 Ley Karin (Pyme+)
- El titular designa un **encargado de denuncias** con un acceso **separado y reservado**.
- **Denuncias:**
  - se registran desde el acceso del encargado o desde el portal del trabajador;
  - no son anónimas, como exige la ley;
  - si la denuncia es contra el empleador o la dirección, el sistema indica derivarla a la DT.
- **Plazos del DS 21** calculados por el sistema:
  - medidas de resguardo inmediatas;
  - 3 días para decidir;
  - 30 días de investigación;
  - 2 días para enviar el informe;
  - 30 días de la DT;
  - 15 días para aplicar medidas.
- **Expediente completo** con documentos listos: recepción, citaciones, actas, informe, notificación y medidas. Permite subir archivos escaneados.
- **La plataforma nunca decide si hubo acoso ni propone sanciones**: el investigador elige de listas legales.
- **Reserva:**
  - los datos y archivos se guardan **cifrados**;
  - el titular solo ve cuántos casos hay abiertos o vencidos, nunca su contenido;
  - el encargado recibe avisos de **posibles represalias** contra quienes participan.

### 5.12 Dirección del Trabajo
- **Registro en Mi DT:** el sistema calcula qué contratos, anexos y términos hay que registrar y su **plazo en días hábiles**. Para cada uno muestra la **ficha con los datos en el orden del formulario** de Mi DT, con botones para copiar. Se marca como registrado.
- **Portal de fiscalización:** el fiscalizador entra con su correo institucional, revisa y descarga todo (con su estado de firma) e incluso **ratifica en terreno** con firma en pantalla. El empleador ve cada acceso y cada descarga.
- **Correo personal del trabajador:** el sistema avisa si el correo parece corporativo, porque la DT exige el personal.

### 5.13 Usuarios del equipo y bitácora (Starter+)
- El titular **invita** por correo a contador, jefaturas o administrativos.
  - Para cada persona elige los **módulos** (sin acceso, solo ver, o ver y gestionar) y las **empresas**.
  - Cada persona tiene su propia clave y su propio resumen por correo.
- **Bitácora:** registra **quién hizo qué y cuándo**: cada creación, cambio, descarga e ingreso, con IP. Nunca guarda los datos enviados.
  - No se puede borrar ni editar: cada registro queda encadenado con una huella criptográfica.
  - Se puede **verificar su integridad** y descargar una **copia en PDF o Excel con código QR verificable**.
- Eliminar un usuario corta su acceso al tiro y libera el cupo; su historial queda.

### 5.14 Resumen por correo (todos los planes)
- Cada día o cada lunes, a elección (o nunca): solicitudes de trabajadores, firmas por vencer o rechazadas, registros en Mi DT por vencer, horas de descanso por vencer, seguridad, reglamento y Ley Karin.
- Letra grande y un botón por tema. **Si no hay nada pendiente, no llega correo.**

### 5.15 Empresas, cuenta y plan
- **Datos de la empresa:** RUT, razón social, dirección, representante legal, rubro, **seguridad social** (mutual, tasa de accidentes, caja de compensación) y **firma del empleador** (imagen que va en certificados y documentos).
- **Multiempresa** según el plan, con un selector de empresa arriba.
- **Mi cuenta:** datos personales, clave y frecuencia del resumen.
- **Plan y facturación:** cambio de plan o ciclo, historial de pagos, cambios programados y reanudar la renovación.

---

## 6. Flujos de gestión

Formato: **Quién** · **Dónde** · **Pasos** · **Resultado**. Útil para demos y para los manuales.

### 6.1 Flujos básicos (todo cliente, primer día)

**B1. Crear la cuenta y la empresa**
- **Quién:** titular · **Dónde:** jornada40.cl → *Comenzar gratis*
- **Pasos:**
  1. RUT, nombre, correo y clave.
  2. Bienvenida: datos de la empresa (RUT, razón social, dirección por partes, comuna, representante legal).
  3. Llega a Inicio.
- **Resultado:** cuenta Semilla lista. Se puede subir de plan cuando se quiera.

**B2. Agregar un trabajador con su contrato**
- **Quién:** titular o equipo (Trabajadores, gestionar) · **Dónde:** *Trabajadores* → *Agregar trabajador*
- **Pasos:**
  1. RUT, nombre y correo personal.
  2. Cargo, tipo de contrato y fechas.
  3. Jornada **con horario** o **Art. 22**.
  4. Horas y sueldo → Guardar.
  5. En la carpeta, completar lo que el aviso "Falta para el contrato" pida.
- **Resultado:** ficha y contrato creados. El sistema avisa si la jornada supera el máximo.

**B3. Revisar y enviar el contrato a firma**
- **Dónde:** carpeta → pestaña *Contrato*
- **Pasos:**
  1. Abrir el editor y revisar el horario día a día.
  2. Guardar → *Enviar a firma*.
  3. Confirmar la clave del empleador.
- **Resultado:** el trabajador recibe el correo, firma con RUT y código, y el PDF firmado queda en la carpeta. Si hay reglamento vigente, se envía junto. El contrato aparece en *Dirección del Trabajo* con su plazo de registro.

**B4. Emitir la liquidación del mes**
- **Dónde:** *Remuneraciones* → elegir mes
- **Pasos:**
  1. Abrir la liquidación del trabajador.
  2. Agregar horas extra, bonos o descuentos.
  3. Revisar la vista previa y los avisos → Guardar.
  4. *Enviar a firma*, individual o *Enviar N a firma*.
- **Resultado:** liquidación emitida, en PDF y firmada por el trabajador.

**B5. Revisar las tareas del día**
- **Dónde:** *Inicio*
- **Pasos:** seguir la lista de pendientes y resolver cada uno con su botón.
- **Resultado:** nada se vence sin aviso. Complemento: el resumen por correo.

### 6.2 Flujos intermedios (Starter / Pyme, operación mensual)

**I1. Anexo Ley 40 horas**
- **Dónde:** carpeta → *Contrato* (aviso "supera la jornada máxima"), o `?accion=anexo`
- **Pasos:**
  1. Abrir el anexo propuesto y ajustar el nuevo horario.
  2. Guardar → *Enviar a firma*.
- **Resultado:** anexo firmado y listado para registrar en Mi DT.

**I2. Vacaciones**
- **Dónde:** carpeta → *Vacaciones* → *Registrar vacaciones*
- **Pasos:** tipo, fechas (el sistema cuenta días hábiles y saldo, y avisa si es feriado anticipado o cuidador con vacaciones escolares) → Guardar → enviar el comprobante a firma.

**I3. Responder peticiones del portal**
- **Dónde:** *Solicitudes* (insignia en el menú)
- **Pasos:**
  1. Ver la petición (vacaciones, permiso o documento).
  2. *Aprobar* o *Rechazar* con un motivo de la lista.
  3. Si es un permiso legal aprobado, se crea la constancia y se ofrece enviarla a firma.
- **Resultado:** el trabajador recibe un correo con la respuesta. Las solicitudes de documentos se resuelven solas cuando el documento se envía a firma.

**I4. Conciliación familiar (Ley 21.645)**
- **Dónde:** carpeta → *Datos* → *Solicitudes de conciliación* (o la petición desde el portal)
- **Pasos:**
  1. Registrar o abrir la solicitud.
  2. Responder: acepta, propone alternativa o rechaza. Las dos últimas requieren motivo y fundamento.
- **Resultado:** queda registrada con los plazos legales y avisos si se respondió tarde.

**I5. Pacto de horas extra**
- **Dónde:** carpeta → *Documentos* → *Nuevo documento* → Pacto de horas extra
- **Pasos:**
  1. Período (1 a 3 meses), horas diarias y motivo.
  2. Compensación: pago, días libres o mixto (días libres desde Pyme).
  3. Enviar a firma.
- **Resultado:** las liquidaciones del período ya no avisan "horas extra sin pacto"; si hay días libres, se lleva la bolsa de horas.

**I6. Previred y Libro electrónico**
- **Dónde:** *Remuneraciones* → *Archivo Previred* / *Libro electrónico DT*
- **Pasos:**
  1. Revisar lo que falta (el sistema lo lista por trabajador).
  2. Completar los datos y descargar.
  3. Subir a Previred y a Mi DT.
- **Resultado:** archivos en formato oficial. El LRE vence el día 15 del mes siguiente.

**I7. Registro en Mi DT**
- **Dónde:** *Dirección del Trabajo*
- **Pasos:**
  1. Ver la lista con plazos y abrir *Ver ficha*.
  2. Copiar los datos al formulario de Mi DT.
  3. Marcar como registrado.

**I8. Término y finiquito**
- **Dónde:** carpeta → *Documentos* → Carta de término, y luego *Finiquito*
- **Pasos:**
  1. Carta con la causal; el sistema avisa si hay fuero.
  2. Finiquito con la vista previa del cálculo.
  3. Elegir modalidad (Mi DT o ministro de fe).
  4. Registrar la ratificación.
- **Resultado:** finiquito cerrado y término listado para registrar en Mi DT.

**I9. Invitar a los trabajadores al portal** (Pyme+)
- **Dónde:** carpeta → panel lateral *Portal del trabajador* → *Invitar*
- **Resultado:** el trabajador recibe los pasos para entrar. El estado cambia a *Activo* cuando verifica su correo.

**I10. Carga masiva desde Excel** (Pyme+)
- **Dónde:** *Trabajadores* → *Importar*
- **Pasos:**
  1. Descargar la planilla y completarla.
  2. Subirla y revisar la vista previa con errores por fila.
  3. Confirmar.

### 6.3 Flujos avanzados (Pyme / Corporativo, cumplimiento)

**A1. Reglamento interno completo**
- **Dónde:** *Reglamento y seguridad*
- **Pasos:**
  1. **Paso 1:** descargar la guía del rubro (Word), completar las partes amarillas y publicarla.
  2. **Paso 2:** subir el PDF publicado; el sistema calcula la vigencia y los plazos de envío.
  3. **Paso 3:** *Entregar a todos* (con firma).
  4. Marcar los envíos a la DT y a la Seremi.
- **Resultado:** cada trabajador firma la recepción con el reglamento adjunto; los nuevos lo reciben con su contrato.

**A2. Información de riesgos y EPP**
- **Dónde:** *Reglamento y seguridad* → *Información de riesgos* (en lote), y carpeta → *Documentos* → *Entrega de EPP*
- **Pasos:** elegir el rubro, los riesgos y la fecha de capacitación, y enviar a firma. Para EPP: elementos, cantidad, motivo y capacitación.

**A3. Ley Karin de punta a punta**
- **Pasos:**
  1. **Titular:** en *Reglamento y seguridad*, configurar el canal interno, enviar el **aviso semestral** de canales y **designar al encargado** (le llega una invitación).
  2. **Encargado:** entra por *Encargado Ley Karin*, registra o recibe denuncias, aplica resguardo y decide (investigar o derivar a la DT).
  3. **Encargado:** designa investigador, cita a las partes, levanta actas, emite y envía el informe, registra el pronunciamiento de la DT, aplica medidas y cierra.
  4. **Trabajador:** sigue el estado de su caso en el portal, según su rol.
- **Resultado:** expediente completo con plazos del DS 21. El titular solo ve el contador.

**A4. Equipo con permisos y auditoría**
- **Dónde:** *Usuarios y bitácora*
- **Pasos:**
  1. *Invitar usuario*: RUT, correo, módulos con nivel de acceso y empresas.
  2. La persona crea su clave desde el correo.
  3. Revisar la pestaña *Bitácora*, *Verificar integridad* y descargar la copia verificable.

**A5. Horas extra compensadas con días libres**
- **Pasos:**
  1. Pacto con compensación por días libres.
  2. La liquidación guarda las horas en la bolsa (con su tope anual).
  3. El trabajador pide un "día libre por horas extra" desde el portal o se registra en Vacaciones.
  4. Las horas no usadas a los 6 meses se pagan solas; las pendientes al término van al finiquito.

**A6. Indemnización a todo evento**
- **Pasos:** desde el séptimo año, crear el pacto y firmarlo. Cada liquidación calcula el aporte del empleador (sin tocar el líquido) y lo informa en Previred y LRE. El finiquito descuenta esos años.

**A7. Fiscalización de la DT**
- **Pasos:** el empleador comparte el enlace *Fiscalización DT*. El fiscalizador entra con su correo @dt.gob.cl, revisa, descarga y ratifica en terreno.
- **Resultado:** el empleador ve cada acceso en *Dirección del Trabajo* → *Accesos de fiscalización*.

**A8. Certificado N°6 y DJ 1887**
- **Dónde:** *Remuneraciones* → *Certificado N°6 (SII)*, con el año cerrado
- **Pasos:**
  1. Emitir los certificados.
  2. Descargar el ZIP y el resumen de apoyo para la DJ 1887.
- **Resultado:** los trabajadores lo descargan en su portal.

---

## 7. Configuración del cliente por niveles

### 7.1 Configuración básica (día 1, ~15 minutos)
1. Datos de la empresa: RUT, razón social, dirección por partes, comuna, representante legal.
2. **Firma del empleador** (imagen) en *Empresa*: necesaria para certificados y documentos.
3. Trabajadores: uno a uno, o con Excel desde Pyme.
4. Correo **personal** de cada trabajador, necesario para firmar y para el portal.
5. Frecuencia del **resumen por correo** en *Mi cuenta*.

### 7.2 Configuración intermedia (primera semana)
1. **Seguridad social** de la empresa: mutual, tasa de accidentes, sucursal y caja de compensación (para Previred y LRE).
2. Previsión de cada trabajador: AFP, salud (Isapre y FUN), tramo de asignación familiar y cargas.
3. **Conceptos de remuneración** propios, con su código LRE.
4. Horario día a día en cada contrato con jornada ordinaria o parcial.
5. **Anexo de consentimiento electrónico** en lote para los trabajadores antiguos.
6. Protecciones especiales: fueros, cuidado de personas, Ley SANNA.
7. Invitar a los trabajadores al portal (Pyme+).

### 7.3 Configuración avanzada (primer mes)
1. **Usuarios del equipo** con módulos y empresas.
2. **Reglamento interno**: guía por rubro, publicación, entrega y remisión.
3. **Información de riesgos** por cargo y **EPP**.
4. **Ley Karin**: canal interno, aviso semestral y designación del encargado.
5. Pactos de horas extra con compensación por días libres.
6. Multiempresa (Pyme / Corporativo): cada empresa con sus datos y su firma.
7. Plan anual, si conviene.

---

## 8. Argumentos de venta y respuestas a objeciones

| Objeción | Respuesta |
|---|---|
| "Ya tengo contador." | Jornada40 no reemplaza al contador: le da acceso con su propio usuario, solo a lo que necesita. Ambos trabajan sobre los mismos datos y la bitácora deja registro de quién hizo qué. |
| "Lo hago en Excel." | Excel no avisa cuando un contrato supera las 42 horas, no lleva plazos de Mi DT ni guarda firmas. Jornada40 calcula, avisa y deja el documento firmado. |
| "Es muy complicado para mí." | Letra grande, pasos numerados y listas para elegir; casi no hay que escribir. El resumen por correo dice qué hacer cada semana. Gratis hasta 3 trabajadores para probar. |
| "¿La firma es válida?" | Firma electrónica simple con verificación por código, vinculada al autor, como acepta hoy la DT (ORD 2257/2022 y ORD 82/2025). Cada firma guarda fecha, hora e IP. |
| "¿Y si me fiscalizan?" | El fiscalizador entra con su correo institucional y ve todo en línea, con su estado de firma. Tú ves cada acceso. |
| "Me preocupan los datos." | Sesiones protegidas que se cierran por inactividad, usuarios con permisos, bitácora inalterable y denuncias Ley Karin cifradas. |
| "Ley Karin me da miedo." | El sistema lleva los plazos del DS 21, genera los documentos y mantiene la reserva. No decide por ti: el investigador elige de listas legales. |
| "Mis trabajadores me piden certificados todo el tiempo." | Con el portal los sacan solos, al instante, con firma y QR verificable. |

---

## 9. Lo que Jornada40 NO hace (para no prometer de más)

- **No es firma electrónica avanzada (FEA).** Los finiquitos con poder liberatorio se ratifican en Mi DT o ante ministro de fe.
- **No sube archivos a Previred, Mi DT ni el SII por el cliente:** los deja listos para subir. Mi DT no tiene integración automática.
- **Previred no cubre:** régimen IPS (ex INP), pensionados, APV/APVC, licencias médicas con fechas ni líneas adicionales. Esos casos se informan directo en Previred.
- **La DJ 1887** se entrega como planilla de apoyo, no en el formato de carga del SII.
- **El reglamento** es una guía para completar, no un documento legal final.
- **Ley Karin:** no determina si hubo acoso ni propone sanciones.
- **Registro masivo de contratos en Mi DT por CSV:** no disponible por ahora; el registro es individual con la ficha.
- **Reconocimiento formal de la DT** para la plataforma: en trámite.
- **No hay prorrateo** al cambiar de plan.

---

## 10. Guion sugerido de demo (20 minutos)

1. **Landing (2 min):** calendario Ley 40 horas y jornada vigente.
2. **Inicio (2 min):** tareas pendientes.
3. **Agregar trabajador (4 min):** alta rápida, aviso de ficha incompleta y contrato con horario.
4. **Ley 40 horas (3 min):** contrato sobre el máximo, anexo propuesto y envío a firma.
5. **Firma desde el celular (2 min):** el correo, el código y el PDF firmado.
6. **Liquidación (3 min):** vista previa, avisos y envío masivo a firma.
7. **Portal del trabajador (2 min):** certificado con QR y petición de vacaciones.
8. **Cierre (2 min):** resumen por correo, fiscalización DT y planes.

---

## 11. Glosario rápido

- **Art. 22:** jornada sin límite de horas (gerentes, trabajo sin fiscalización superior inmediata). No lleva horario.
- **Anexo:** modificación firmada del contrato.
- **Días hábiles:** para permisos, de lunes a sábado sin feriados; para plazos DT y Ley Karin, de lunes a viernes sin feriados.
- **EPP:** elementos de protección personal.
- **Fuero:** protección contra el despido sin autorización judicial.
- **LRE:** Libro de Remuneraciones Electrónico, mensual, en Mi DT.
- **Mi DT:** portal de trámites de la Dirección del Trabajo.
- **RIOHS / RIHS:** reglamento interno de orden, higiene y seguridad (10+ trabajadores) / de higiene y seguridad (menos de 10).
- **Ley SANNA:** seguro para padres y madres de hijos con enfermedad grave.
- **Ley 21.645:** conciliación de la vida laboral y familiar para quienes cuidan.

---

## 12. Notas para generar manuales de usuario a partir de este documento

- **Audiencias:** titular (panel), usuario del equipo (panel con permisos), encargado Ley Karin, trabajador (portal) y fiscalizador DT. Conviene un manual por audiencia.
- **Estructura sugerida por tarea:** objetivo → quién puede hacerlo (plan y permiso) → dónde está (menú y pestaña) → pasos numerados → qué pasa después (correos, firmas, plazos) → avisos frecuentes.
- **Tono:** español de Chile, frases cortas, letra grande. Los usuarios suelen ser dueños de pymes, muchos personas mayores. Usar "tú".
- **Rutas del panel** (para capturas): `/app` Inicio · `/app/trabajadores` · `/app/trabajadores/<id>` carpeta · `/app/remuneraciones` · `/app/firmas` · `/app/solicitudes` · `/app/dt` · `/app/reglamento` · `/app/equipo` · `/app/empresa` · `/app/plan` · `/app/cuenta`. Portal: `/trabajador`. Ley Karin: `/karin`. Fiscalización: `/inspeccion`. Verificación: `/verificar`.
