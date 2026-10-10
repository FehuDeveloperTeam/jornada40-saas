# Jornada40 — Dossier del producto

> **Para qué es este documento.** Es la fuente de información para un agente que preparará una **propuesta de Jornada40 para inversionistas**. Describe el sistema que está **en producción** (rama `main`, publicado en jornada40.cl), su contexto regulatorio, su modelo de negocio, su tecnología, su hoja de ruta y sus límites.
>
> **Fecha y versión:** 10 de octubre de 2026. Sistema descrito: `main`, en producción desde el 7 de octubre de 2026, con correcciones publicadas el 8 de octubre de 2026.

---

## 0. Instrucciones para el agente

### 0.1 Reglas

1. **No inventes cifras.** Este documento no contiene datos de tracción (clientes, ingresos, crecimiento), financieros, del equipo ni de mercado. Si la propuesta los necesita, pídeselos al titular (lista en la sección 12) o márcalos como "por completar". Nunca los estimes como si fueran reales.
2. **Distingue el estado de cada cosa.** Usa siempre estas tres categorías:
   - **En producción:** funciona hoy en jornada40.cl. Es todo lo de las secciones 3 a 8, salvo que se indique otra cosa.
   - **En pruebas:** existe en el entorno de pruebas (staging), todavía no en producción. Se detalla en la sección 9.2.
   - **Plan:** todavía no está construido.
3. **No prometas lo que el sistema no hace.** La sección 11 lista los límites. En particular:
   - Jornada40 **no** está reconocida formalmente por la Dirección del Trabajo (el trámite está pendiente).
   - **No** ofrece firma electrónica avanzada (FEA).
   - **No** sube archivos a Previred, Mi DT ni el SII por el cliente.
4. **Precios:** los de la sección 5 son los vigentes, pero el pricing **está en revisión** (estudio en pausa, por retomar). Preséntalos como "precios actuales, en revisión".
5. **Datos de mercado:** si los usas, cita la fuente. La sección 2.3 sugiere fuentes.
6. **Idioma y tono:** español de Chile, claro y sobrio. Evita superlativos que no se puedan demostrar ("el único", "el mejor") salvo que se verifiquen.

### 0.2 Estructura sugerida para la propuesta

1. Problema y "por qué ahora" (secciones 2 y 8).
2. Solución y producto (secciones 3 y 4).
3. Mercado: datos a investigar (sección 2.3) más los segmentos de la sección 2.2.
4. Modelo de negocio (sección 5).
5. Competencia y posicionamiento (sección 6).
6. Tecnología, seguridad y calidad (sección 7).
7. Tracción y métricas: las aporta el titular (sección 12).
8. Hoja de ruta (sección 9).
9. Riesgos y mitigaciones (sección 10).
10. Equipo, ronda, monto y uso de los fondos: los aporta el titular (sección 12).

---

## 1. Resumen ejecutivo

**Jornada40** es una plataforma web chilena (SaaS) para que las **pymes** tengan sus trabajadores, contratos, sueldos y obligaciones laborales en regla. El foco está en la **Ley 40 horas (Ley 21.561)**, que baja la jornada máxima por etapas hasta 2028, y en la ola de obligaciones laborales digitales que la acompaña: registro de contratos en **Mi DT**, **Libro de Remuneraciones Electrónico**, **Ley Karin**, conciliación familiar y documentación electrónica.

**El problema.** El dueño de una pyme chilena tiene cada vez más obligaciones laborales con plazos legales y multas, normalmente sin un área de recursos humanos. A menudo las cumple con Excel, papel y su contador, y se entera de los incumplimientos cuando llega la fiscalización.

**La solución.** Jornada40 hace tres cosas:
- **Calcula** en el servidor, con los parámetros legales vigentes de cada mes: liquidaciones, finiquitos, vacaciones, horas extra, permisos y plazos.
- **Avisa** qué hay que hacer y cuándo vence. Avisa, nunca bloquea: el empleador decide.
- **Deja el documento listo para firmar** electrónicamente, con su respaldo.

La frase comercial es *"Jornada40 te dice qué tienes que hacer, cuándo vence y te deja el documento listo para firmar."*

**Qué la distingue** (detalle en la sección 4):
- Cubre en un solo sistema el ciclo laboral completo: contrato → jornada → sueldo → firma → registro DT → término.
- Incluye módulos de cumplimiento que muchas pymes no tienen: **Ley Karin** con encargado y reserva, reglamento interno por rubro, información de riesgos y EPP, protecciones especiales (fueros, cuidadores).
- Tiene un **portal del trabajador** (certificados con QR verificable, solicitudes, denuncias) y un **portal para el fiscalizador de la DT**.
- Diseñada para **dueños de pymes, muchos de ellos personas mayores**: letra grande, listas cerradas y pasos numerados.

**Modelo de negocio:** suscripción mensual o anual por niveles (Semilla gratis hasta 3 trabajadores, Starter, Pyme y Corporativo), con pago con tarjeta por Webpay a través de Reveniu.

**Estado:** en producción en jornada40.cl. Tiene más de 500 pruebas automáticas en el servidor, 54 recorridos de navegador automatizados, integración continua y un entorno de pruebas separado. En piloto: una extensión de navegador que llena los formularios de Mi DT.

**Por completar con el titular:** equipo, tracción, finanzas, ronda y uso de los fondos (sección 12).

---

## 2. El problema y el contexto

### 2.1 Por qué ahora: la ola regulatoria laboral en Chile

| Norma | Qué exige al empleador | Fechas clave |
|---|---|---|
| **Ley 21.561 ("Ley 40 horas")** | Bajar la jornada ordinaria máxima y adecuar contratos (anexos). Permite compensar horas extra con días libres (Art. 32 inc. 4°). | 44 h desde el 26-04-2024. **42 h desde el 26-04-2026 (vigente)**. 40 h desde el 26-04-2028. |
| **Ley 21.643 ("Ley Karin")** y **DS 21/2024** | Protocolo de prevención, canal de denuncias e investigación con plazos legales; reserva; informar los canales a los trabajadores. | Vigente desde agosto de 2024. |
| **Ley 21.327** (modernización de la DT) | Registrar en **Mi DT** cada contrato, anexo y término, con plazos en días hábiles. Llevar el **Libro de Remuneraciones Electrónico** (Art. 62 bis), que se carga cada mes. | Vigente. El LRE vence dentro de los primeros 15 días del mes siguiente. |
| **Ley 21.645** (conciliación de la vida laboral y familiar) | Responder por escrito y en plazo las solicitudes de teletrabajo o de cambio de jornada de quienes cuidan. Preferencias de feriado. | Vigente desde 2024. |
| **Ley 21.220** (teletrabajo) | Pacto escrito de trabajo a distancia o teletrabajo. | Vigente. |
| **Ley 16.744 y DS 44** | Reglamento interno de higiene y seguridad, información de riesgos de cada cargo y entrega de elementos de protección personal (EPP) con capacitación. | Vigente. |
| **Código del Trabajo** | Contratos, gratificación, horas extra con pacto, descuentos autorizados, feriado, permisos, fueros, término, finiquito. | Permanente. |
| **Dirección del Trabajo** (Dictamen 0789/15, ORD 2257/2022, ORD 82/2025) | Requisitos para que la documentación laboral electrónica y la firma simple sean válidas. | Vigente. |

Cada norma suma plazos y documentos. En una pyme, estas tareas suelen recaer en el dueño o en su contador.

### 2.2 A quién le vendemos

| Segmento | Dolor principal | Qué valora de Jornada40 |
|---|---|---|
| Dueño de pyme sin área de RR. HH. (1–20 trabajadores) | Miedo a multas de la DT; todo en Excel o con el contador | Contrato y anexo Ley 40 horas, firma electrónica, tareas pendientes y resumen por correo |
| Pyme con administración (20–75 trabajadores) | Trámites repetitivos, papeles que se pierden | Liquidaciones masivas, Previred, LRE, portal del trabajador, usuarios del equipo |
| Contador o asesor que lleva varias empresas | Muchas empresas con plazos distintos | Multiempresa, usuarios con permisos, consolidado, bitácora |
| Rubros de riesgo (construcción, gastronomía, agrícola, transporte) | Reglamento, EPP, Ley Karin | Reglamento por rubro, información de riesgos, EPP, encargado Ley Karin |

Los contadores y asesores son un **canal**: un mismo contador atiende a varias pymes.

### 2.3 Datos de mercado (por investigar)

Este documento no incluye cifras de mercado. Las que convenga usar hay que obtenerlas de fuentes oficiales, por ejemplo:

- **Número de empresas por tamaño** (micro, pequeña, mediana) y de empresas con trabajadores dependientes: estadísticas de empresas del **SII**; Encuesta Longitudinal de Empresas (**ELE**, Ministerio de Economía).
- **Trabajadores asalariados del sector privado:** **INE**, Encuesta Nacional de Empleo.
- **Fiscalizaciones, multas y denuncias Ley Karin:** anuarios y estadísticas de la **Dirección del Trabajo**.
- **Penetración de software de remuneraciones en pymes y precios de la competencia:** investigación propia (está en la sección 6 y en el estudio de pricing pendiente).

---

## 3. El producto en producción

### 3.1 Principios de diseño

- **Cálculo en el servidor ("backend-first"):** todo cálculo legal o previsional lo hace el sistema con los parámetros de cada período (UF, UTM, topes, tasas). El usuario no necesita saber fórmulas, y los montos legales nunca se aceptan desde el navegador.
- **Avisa, nunca bloquea:** si algo no cumple la ley (jornada sobre el máximo, horas extra sin pacto, fuero vigente), el sistema avisa con la norma y el empleador decide.
- **Listas cerradas en vez de texto libre:** pactos, permisos, motivos y causales se eligen de listas; el sistema redacta las cláusulas. Así baja el error y el riesgo legal.
- **Para dueños de pymes:** letra grande, pasos numerados, lenguaje simple. Muchos usuarios son personas mayores.
- **Nada se borra:** los registros quedan inactivos con su historial (trazabilidad ante una fiscalización).

### 3.2 Cinco puertas de entrada, cada una con su propia sesión

| Quién | Cómo entra | Qué ve |
|---|---|---|
| **Titular** (dueño de la cuenta) | RUT y clave | Todo, salvo el contenido de las denuncias Ley Karin: de eso solo ve un contador de casos y plazos |
| **Usuario del equipo** (contador, jefatura, administrativo) | RUT y clave propia | Solo los módulos y empresas que le asignó el titular, con permiso de *ver* o de *ver y gestionar* |
| **Encargado Ley Karin** | Acceso separado, RUT y clave propia | Solo las denuncias de sus empresas, nada más del sistema |
| **Trabajador** | Portal del trabajador, con RUT y un código en su correo (o clave) | Sus documentos, certificados, solicitudes y denuncias |
| **Fiscalizador de la DT** | Portal de fiscalización, con correo institucional @dt.gob.cl y un código de un solo uso | Todos los documentos de la empresa, solo lectura; el empleador ve cada acceso |

**Cierre por inactividad:** el panel y Ley Karin se cierran tras 5 minutos sin uso; los portales del trabajador y de fiscalización, tras 15. Un minuto antes aparece un aviso. Lo que se estaba escribiendo en un contrato o una liquidación queda como borrador.

### 3.3 Funcionalidades por módulo

**Inicio y avisos**
- Lista de tareas pendientes, ordenada por urgencia. Cada tarea tiene un botón que lleva a resolverla.
- Ejemplos: firmas por vencer, contratos sobre la jornada máxima, registros en Mi DT por vencer, solicitudes de trabajadores, plazos Ley Karin vencidos, direcciones incompletas.
- **Resumen por correo** diario o semanal (todos los planes), con letra grande y un botón por tema. Si no hay nada pendiente, no se envía.

**Trabajadores y carpeta**
- **Alta rápida** del trabajador con su contrato (jornada con horario o Art. 22). Aviso de lo que falta para que el contrato salga completo.
- **Carpeta por trabajador:** datos, contrato, remuneraciones, vacaciones y documentos firmados.
- **Carga masiva desde Excel** con validación de cada RUT (plan Pyme en adelante).
- **Digitalización de contratos en papel con IA:** se sube una foto o PDF y el sistema propone los datos.
- **Protecciones especiales,** que avisan antes de un término, un finiquito o unas vacaciones:
  - fuero maternal, calculado desde el parto;
  - fuero sindical y otros fueros;
  - cuidado de personas (Ley 21.645);
  - hijo con enfermedad grave (Ley SANNA).

**Contratos y anexos (Ley 40 horas)**
- Editor de contrato con distribución de jornada día a día: indefinido, plazo fijo u obra o faena; jornada ordinaria, parcial o Art. 22.
- **Compara cada contrato con la jornada máxima vigente** y genera el **anexo Ley 40 horas** con el horario propuesto.
- Anexos de modificación (sueldo, cargo, jornada) y **pacto de teletrabajo**. Los cambios se aplican al contrato solo cuando el trabajador firma.
- Cláusula de **consentimiento para documentos electrónicos** (exigida por la DT), y anexo en lote para los trabajadores antiguos.

**Remuneraciones**
- **Liquidación de sueldo completa:**
  - haberes: gratificación con tope, horas extra, bonos, comisiones y asignación familiar por tramo;
  - descuentos: AFP, salud, seguro de cesantía, impuesto único, anticipos y descuentos autorizados.
- Los parámetros previsionales los mantiene Jornada40 y quedan **congelados en cada liquidación**: recalcular un mes antiguo usa los valores de ese mes.
- **Vista previa con avisos legales:** horas extra sin pacto, descuentos sin autorización, descuentos sobre el 15 %.
- **Emisión masiva** del período y envío masivo a firma.
- **Archivo Previred** en formato oficial de 105 campos (Pyme en adelante). Si falta un dato que Previred rechazaría, dice cuál y de quién.
- **Libro de Remuneraciones Electrónico** para Mi DT, en el formato oficial de la DT, con revisión previa (Pyme en adelante).
- **Certificado N°6 del SII** (todos los planes) y planilla de apoyo para la DJ 1887.
- Consolidado multiempresa y descarga masiva en ZIP (Pyme en adelante).

**Vacaciones y permisos** (Starter en adelante)
- Saldo de feriado legal y progresivo con días hábiles según el calendario de feriados de Chile.
- **Permisos legales** con los días calculados por ley: fallecimientos, nacimiento, matrimonio o acuerdo de unión civil.
- **Horas extra compensadas con días libres** (Ley 21.561; Pyme en adelante). El sistema lleva:
  - la bolsa de horas y su tope anual;
  - el vencimiento a los 6 meses, cuando las horas no usadas se pagan solas;
  - las horas pendientes al término, que van al finiquito.

**Pactos, autorizaciones y constancias** (Starter en adelante)
- Pacto de horas extraordinarias.
- Autorización de descuento voluntario (Art. 58), con su revocación.
- Constancias de permiso legal.
- Pacto de indemnización a todo evento (Art. 164): el aporte se calcula en cada liquidación y se informa en Previred y el LRE.
- Amonestaciones.
- Todo sale de listas cerradas, y el sistema redacta las cláusulas.

**Término de la relación laboral** (Starter en adelante)
- Cartas de término con causal y aviso de fuero.
- **Finiquito calculado:** años de servicio, aviso previo, feriado proporcional, horas pendientes y pacto a todo evento.
- Dos modalidades: electrónico en Mi DT (con los datos listos para copiar) o ante ministro de fe. Se registra la ratificación.

**Firma electrónica** (todos los planes)
- El trabajador firma desde su correo o celular. Verifica su identidad con un **código de un solo uso** o con su clave del portal; luego acepta el contenido y dibuja su firma.
- Cumple el criterio de la DT de los Ord. 136 y 79 de 2025: el código solo verifica la identidad, y la firma la pone la persona.
- El empleador confirma su clave antes de enviar a firma; queda registro de quién envió, desde qué IP y cuándo.
- Cada documento firmado guarda fecha, hora e IP, incluye una página de certificado y se descarga siempre en su versión firmada.
- Es **firma electrónica simple**, aceptada por la DT cuando el documento queda vinculado a su autor (ORD 2257/2022 y ORD 82/2025).

**Portal del trabajador** (Pyme en adelante)
- El trabajador entra sin instalar nada.
- Ve su contrato, sus liquidaciones firmadas, sus documentos y su saldo de vacaciones, y firma lo pendiente.
- **Certificados al instante** con la firma del empleador y un **código QR verificable** públicamente en jornada40.cl/verificar. Tipos: antigüedad, renta, cotizaciones, vacaciones, jornada y término.
- **Solicitudes** de documentos, vacaciones y permisos legales.
- **Conciliación familiar** (Ley 21.645), con los plazos de respuesta del empleador a la vista.
- **Denuncias Ley Karin**.
- Los desvinculados mantienen el acceso por 3 meses.

**Reglamento, seguridad y Ley Karin** (Pyme en adelante, salvo EPP)
- **Guía de reglamento interno por rubro** en Word o PDF, para 10 rubros. Sale como RIOHS con 10 o más trabajadores y como RIHS con menos. Incluye el protocolo Ley Karin, los riesgos del rubro y los EPP.
- Versiones del reglamento con su vigencia y los plazos de envío a la DT y la Seremi.
- **Entrega firmada** a cada trabajador, con el reglamento adjunto. Se envía sola con cada contrato nuevo.
- **Información de riesgos** por cargo y **entrega de EPP** con capacitación (EPP en todos los planes).
- **Ley Karin:** el titular designa un **encargado de denuncias** con acceso separado.
  - El sistema calcula los plazos del DS 21 y arma el expediente: recepción, resguardo, decisión, citaciones, actas, informe, notificación y medidas.
  - Los datos y archivos se guardan **cifrados**. El titular solo ve contadores, nunca el contenido.
  - El encargado recibe avisos de **posibles represalias**.
  - La plataforma **nunca decide si hubo acoso ni propone sanciones**: el investigador elige de listas legales.

**Dirección del Trabajo**
- **Registro en Mi DT:** calcula qué contratos, anexos y términos hay que registrar y su plazo en días hábiles. Para cada uno muestra una ficha con los datos en el orden del formulario de Mi DT, con botones para copiar.
- **Portal de fiscalización:** el fiscalizador revisa y descarga en línea todos los documentos con su estado de firma, e incluso ratifica en terreno con firma en pantalla. El empleador ve cada acceso.
- Aviso cuando el correo del trabajador parece corporativo, porque la DT exige el correo personal.

**Usuarios del equipo y bitácora** (Starter en adelante)
- El titular invita a su contador, jefaturas o administrativos y les asigna módulos (sin acceso, solo ver, o ver y gestionar) y empresas. Cada persona tiene su clave y su propio resumen por correo.
- **Bitácora** de quién hizo qué y cuándo, con IP. Registra cada creación, cambio, descarga e ingreso, pero nunca los datos enviados.
- Cada registro queda **encadenado con una huella criptográfica**, así que no se puede editar ni borrar. Se puede verificar su integridad y descargar una copia en PDF o Excel con QR verificable.

**Empresa, cuenta y plan**
- Multiempresa según el plan.
- Datos de seguridad social de la empresa (mutual, tasa de accidentes, caja de compensación) y firma del empleador para los documentos.
- Plan y facturación: cambio de plan o de ciclo, historial de pagos, cambios programados y reanudar la renovación.

### 3.4 Integraciones y archivos oficiales

| Con quién | Cómo |
|---|---|
| **Previred** | Genera el archivo de carga en formato oficial (105 campos). El cliente lo sube. |
| **Mi DT** (Dirección del Trabajo) | Genera el LRE en formato oficial y la ficha de cada registro para copiar. El cliente lo sube o lo ingresa. Mi DT no tiene API pública. |
| **SII** | Emite el Certificado N°6 y una planilla de apoyo para la DJ 1887. |
| **Reveniu y Webpay (Transbank)** | Cobro recurrente con tarjeta, mensual o anual. |
| **Resend** | Correos: firmas, códigos, avisos y resúmenes. |
| **Backblaze B2** | Almacenamiento de los documentos firmados y de los archivos cifrados de Ley Karin. |
| **Google Gemini** | Lectura de contratos en papel para proponer los datos (digitalización). |

---

## 4. Diferenciadores

Esto es lo que destacaríamos frente a inversionistas. Las comparaciones directas con la competencia deben verificarse (sección 6).

1. **Enfoque en cumplimiento para pymes, no solo en remuneraciones.** Además de sueldos, Jornada40 cubre las obligaciones que generan fiscalizaciones y multas: Ley 40 horas, Ley Karin, registro en Mi DT, reglamento, riesgos y EPP, protecciones especiales y conciliación familiar.
2. **"Avisa, nunca bloquea" con base legal.** Cada aviso cita la norma. El sistema guía sin quitarle la decisión al empleador.
3. **Ley Karin con reserva real:**
   - acceso separado para el encargado;
   - datos cifrados y bitácora reservada;
   - plazos del DS 21 y expediente documental;
   - denuncias desde el portal del trabajador;
   - avisos de posibles represalias.
4. **Portal de fiscalización para la DT:** el fiscalizador revisa todo en línea con su correo institucional y el empleador ve cada acceso. Convierte una fiscalización en un trámite ordenado.
5. **Portal del trabajador con certificados verificables por QR.** Le saca carga administrativa al empleador y da transparencia al trabajador.
6. **Firma electrónica incluida desde el plan gratis,** alineada con los criterios recientes de la DT (Ord. 136 y 79 de 2025).
7. **Auditoría verificable:** una bitácora encadenada criptográficamente, con copia verificable.
8. **Usabilidad para personas mayores:** letra grande, listas cerradas y resumen por correo. Es una barrera de entrada real para competidores pensados para áreas de RR. HH.
9. **Registro en Mi DT sin usar la Clave Única del cliente.** Hoy se hace con una ficha para copiar; está en piloto la extensión de la sección 9.2. Algunos competidores automatizan Mi DT pidiendo la Clave Única del representante, y la Res. Ex. 733/2025 de Hacienda prohíbe pedir o almacenar credenciales de ClaveÚnica.

---

## 5. Modelo de negocio

### 5.1 Planes y precios actuales

**Pricing en revisión:** el estudio comparativo de precios está en pausa y se retomará. Estos son los valores vigentes al 10-10-2026, que se administran en el sistema y pueden cambiar.

| | **Semilla** | **Starter** | **Pyme** ("más elegido") | **Corporativo** |
|---|---|---|---|---|
| Precio mensual (CLP) | Gratis | $16.990 | $39.990 | $89.990 |
| Empresas | 1 | 1 | 3 | 10 |
| Trabajadores | 3 | 10 | 75 | 250 |
| Usuarios del equipo | — | 2 | 6 | 20 |
| Encargado Ley Karin | — | — | 1 | 1 |

**Qué incluye cada nivel** (cada uno incluye el anterior):

- **Semilla (gratis):**
  - contratos y anexos Ley 40 horas;
  - liquidaciones;
  - firma electrónica con código;
  - Certificado N°6 del SII;
  - entrega de EPP;
  - resumen por correo.

  Los documentos llevan la marca Jornada40.
- **Starter:**
  - sin marca;
  - vacaciones y permisos;
  - pactos y constancias;
  - cartas de término y finiquitos;
  - usuarios del equipo con permisos y bitácora.
- **Pyme:**
  - portal del trabajador;
  - Previred y LRE;
  - reglamento interno e información de riesgos;
  - Ley Karin con encargado;
  - horas extra compensadas con días libres;
  - carga masiva desde Excel, descarga en ZIP y consolidado multiempresa.
- **Corporativo:** más empresas, trabajadores y usuarios en una sola cuenta.

### 5.2 Reglas comerciales

- **Pago mensual o anual.** El anual equivale a 10 meses ("2 meses gratis"). Se paga con tarjeta vía Reveniu y Webpay.
- **Cambio de plan:**
  - al subir, el nuevo plan rige desde el pago;
  - al bajar, se mantiene el plan actual hasta el próximo cobro;
  - no hay prorrateo.
- **Cupo de trabajadores:** cuentan los activos más los desvinculados durante el mes en curso.
- **Adicionales:** el sistema ya permite más usuarios del equipo y más encargados Ley Karin por cuenta. Hoy se otorgan por solicitud. Es una palanca de ingresos aún no explotada.

### 5.3 Palancas de crecimiento

- **Freemium (Semilla):** un dueño puede probar con hasta 3 trabajadores. Al crecer o al necesitar el portal, Previred o Ley Karin, sube de plan.
- **Venta hacia arriba por cumplimiento:** las obligaciones con más riesgo (Ley Karin, reglamento, LRE) están en el plan Pyme.
- **Canal de contadores y asesores:** multiempresa, usuarios con permisos y consolidado.
- **Calendario regulatorio:** la etapa de 40 horas (abril de 2028) obliga a adecuar contratos de nuevo, y cada ley nueva agrega obligaciones que Jornada40 puede cubrir.
- **Extensión para Mi DT** (en piloto): un argumento de venta adicional. Su plan comercial está por definir; la propuesta interna es incluir contratos, anexos y términos en todos los planes, y el LRE desde Pyme.

---

## 6. Competencia y posicionamiento

**Actores conocidos en Chile** (comparación de precios pendiente; ver sección 0):

- **Buk, Talana, Defontana:** plataformas de RR. HH., remuneraciones o ERP. Según lo revisado en octubre de 2026, automatizan trámites en Mi DT pidiendo la Clave Única del representante legal, práctica que la Res. Ex. 733/2025 de Hacienda prohíbe. **Verificar con fuentes actuales antes de usarlo en un documento externo.**
- **Nubox:** contabilidad y remuneraciones para pymes. La DT aprobó su plataforma de documentación electrónica (Ord. 136, 14-03-2025, tras unos 6 meses de trámite) y ofrece integración con Mi DT.
- **Plataformas de firma y documentación electrónica aprobadas por la DT en 2025–2026:** Certifika "FirmaWeb" (Ord. 79), SIGNER (Ord. 741), GDEDIGITAL (Ord. 724), HPDIGITAL (Ord. 512), Visión FirmaDoc (Ord. 508), LeanGlobal (Ord. 428) y SAFMAG1 (Ord. 426), entre otras.

**Posicionamiento propuesto:** la plataforma de **cumplimiento laboral** para la pyme chilena, simple y completa. Las grandes plataformas de RR. HH. apuntan a empresas medianas y grandes con áreas de personas; Jornada40 apunta al dueño que hace todo él mismo o con su contador.

**Por investigar** para la propuesta (no inventar):
- precios y planes de cada competidor;
- qué módulos de cumplimiento ofrece cada uno (Ley Karin, portal de fiscalización, reglamento por rubro, conciliación);
- su segmento principal.

---

## 7. Tecnología, seguridad y calidad

### 7.1 Arquitectura e infraestructura

- **Frontend:** React 19 + TypeScript + Vite + Tailwind, en **Vercel** (jornada40.cl).
- **Backend:** Django 5 + Django REST Framework (Python), en **Railway**, con base de datos **PostgreSQL** (api.jornada40.cl, tras **Cloudflare**).
- **Servicios:** Backblaze B2 (documentos), Resend (correo), Reveniu y Webpay (pagos), Google Gemini (lectura de contratos).
- **Entornos:** producción (`main`) y pruebas (staging, con su propia base y pagos en sandbox).
- **Tamaño del sistema en `main`:**

  | Componente | Medida |
  |---|---|
  | Lógica del servidor | ~22.500 líneas de Python |
  | Interfaz | ~22.000 líneas de TypeScript en 140 archivos, 44 pantallas |
  | Datos | 42 modelos, 104 migraciones |
  | API | 21 recursos REST y 84 rutas propias |
  | Plantillas | 28 plantillas de documentos y correos |

### 7.2 Calidad

- **506 pruebas automáticas del servidor**, en 38 archivos por tema: cálculos de remuneraciones, Previred, LRE, finiquitos, firmas, permisos, Ley Karin, seguridad y portales.
- **54 recorridos de navegador automatizados** (Playwright) en 11 áreas: panel, remuneraciones, firma, gestión, Dirección del Trabajo, portal del trabajador, pactos, fiscalización, reglamento, equipo y Ley Karin.
- **32 pruebas unitarias** de la interfaz.
- **Integración continua** (GitHub Actions) en cada cambio: verificación de migraciones, pruebas del servidor, revisión de estilo, pruebas unitarias, compilación con revisión de tipos y recorridos de navegador.
- Una prueba automática recorre **todas las rutas de la API** con un usuario de solo lectura, para comprobar que no puede ver ni modificar nada fuera de sus permisos.

### 7.3 Seguridad y privacidad

- **Sesiones:**
  - credenciales en cookies seguras, inaccesibles para el código de la página, con renovación rotativa;
  - cierre por inactividad (5 o 15 minutos) y tope absoluto de duración en los portales.
- **Accesos separados:** titular, equipo, encargado Ley Karin, trabajador y fiscalizador, cada uno con su sesión. Ninguna sesión abre otra puerta.
- **Permisos por módulo y por empresa,** aplicados en el servidor, no solo en la pantalla.
- **Bitácora encadenada** con SHA-256: no se puede editar ni borrar, se conserva al menos 5 años y se puede verificar y exportar con QR.
- **Cifrado de la información de Ley Karin,** incluidos los archivos antes de subirlos, con rotación de claves.
- **Firma:**
  - los códigos se guardan solo como huella (HMAC), así que nadie que lea la base de datos puede firmar por el trabajador;
  - hay límites de intentos y una confirmación de identidad del empleador al enviar.
- **Cuentas del portal por persona:** cada trabajador ve solo las fichas cuyo correo verificó. Esta mejora se publicó el 8 de octubre de 2026, a raíz de una revisión interna de seguridad.
- **Límites de intentos** en logins y endpoints públicos, con la IP real del visitante detrás de Cloudflare.
- **Sin borrado:** desvincular o anular deja el historial (trazabilidad).
- **Errores internos** nunca exponen detalles técnicos al usuario.
- **Protección de datos:** Jornada40 trata los datos como encargado del empleador (Términos y Condiciones, Ley 19.628). Por verificar con asesoría legal: las obligaciones de la nueva ley de datos personales (Ley 21.719) y su fecha de entrada en vigencia.
- **Pendiente** (ver riesgos): los respaldos automáticos de la base de datos de producción.

---

## 8. Cumplimiento normativo cubierto

| Norma | Cómo la cubre Jornada40 |
|---|---|
| Ley 21.561 (40 horas) | Compara contratos con el máximo vigente, genera el anexo con el nuevo horario y calcula las horas extra compensadas con días libres (tope, vencimiento y finiquito). |
| Código del Trabajo: contrato y anexos (Arts. 9, 10 y 11), Art. 22 y jornada parcial | Editor de contrato y anexos; los cambios rigen al firmarse. |
| Gratificación (Arts. 47 y 50), horas extra (Arts. 31–32), descuentos (Art. 58) | Cálculo en la liquidación; pactos y autorizaciones con avisos. |
| Feriado (Arts. 67–70) y permisos (Arts. 66, 195, 207 bis) | Saldos, días hábiles y constancias con días calculados. |
| Término (Arts. 159–163 bis), finiquito (Art. 177), indemnización a todo evento (Art. 164) | Cartas de término, finiquito calculado y registro de la ratificación. |
| Art. 62 bis (LRE) y Ley 21.327 (registro en Mi DT) | Archivo LRE oficial; plazos y ficha de registro de contratos, anexos y términos. |
| Ley 21.643 (Ley Karin) y DS 21/2024 | Encargado, canal, plazos, expediente, reserva y cifrado, denuncias desde el portal y aviso semestral de canales. |
| Ley 21.645 (conciliación) | Solicitudes de teletrabajo y cambio de jornada con plazos de respuesta, y preferencias de feriado. |
| Ley 21.220 (teletrabajo) | Pacto de teletrabajo como anexo; la modalidad se actualiza al firmar y al vencer. |
| Ley 16.744 y DS 44 | Reglamento por rubro (RIOHS o RIHS), información de riesgos y entrega de EPP con capacitación. |
| Fueros (Art. 201 y otros), Ley SANNA | Avisos antes de término, finiquito o vacaciones; fuero maternal calculado desde el parto. |
| Documentación electrónica (Dictamen 0789/15, ORD 2257/2022, ORD 82/2025, ORD 2965) | Consentimiento electrónico, firma simple vinculada al autor y correo personal del trabajador. |
| Criterio de firma de la DT (Ord. 136 y 79 de 2025) | El código solo verifica la identidad; el trabajador acepta y firma personalmente. |
| SII: Certificado N°6 y DJ 1887 | Emisión de certificados y planilla de apoyo. |
| Previred | Archivo de carga oficial (formato de 105 campos). |

---

## 9. Estado actual y hoja de ruta

### 9.1 En producción

- Publicado en `main` y en producción el **7 de octubre de 2026**, con todos los módulos de la sección 3.
- **8 de octubre de 2026:** cuentas del portal del trabajador por persona y ajustes de firma según los Ord. 136 y 79 de 2025.

### 9.2 En pruebas (staging), todavía no en producción

- **Extensión "Jornada40 para Mi DT"** para Chrome y Edge. En un panel junto a Mi DT:
  - muestra lo que falta registrar y la ficha de cada uno;
  - llena los formularios por etapas;
  - reconoce el comprobante y lo marca como registrado en Jornada40.

  Su diseño respeta tres principios: **nunca toca la Clave Única**, la persona presiona el botón final y no usa servicios internos de la DT.

  **Estado:** construida y probada, en piloto. El levantamiento del formulario de contrato se hizo con una sesión real de Mi DT en octubre de 2026; faltan los de anexo y término. Se publicará en las tiendas de Chrome y Edge cuando exista la cuenta de desarrollador.
- **Ficha de Mi DT más completa** (total imponible y no imponible, previsión) y **aviso de anexos sin firmar** en la lista de registros.

### 9.3 Próximos pasos

- **Estudio de pricing** (en pausa, se retoma a pedido del titular).
- **Reconocimiento de la plataforma ante la DT** (Etapa D): presentar la solicitud con las medidas de seguridad. En los precedentes revisados, el trámite tomó unos 6 meses.
- **Respaldos automáticos** de la base de datos de producción, fuera de Railway.
- **Extensión para Mi DT:**
  - mapear los formularios de anexo y término;
  - definir su plan comercial;
  - publicarla en las tiendas, primero sin listar para el piloto.
- **Revisión legal** de las plantillas (reglamento por rubro, documentos Ley Karin, pactos).
- **Verificación con cargas reales** de dos formatos: el aporte de indemnización a todo evento en Previred y el registro masivo de contratos en Mi DT.

### 9.4 Más adelante (opciones, no compromisos)

- **Firma electrónica avanzada (FEA)** integrando un proveedor acreditado (por ejemplo E-Cert, Acepta, E-Sign o Thomas Signe), si el mercado lo exige. Ser proveedor acreditado propio se descartó por su costo.
- **Integración directa con la DT** si habilita servicios web para el LRE y el registro laboral; la DT lo ha anunciado como "próxima evolución".
- **Extensión para Mi DT:** carga del LRE, finiquito electrónico y registro masivo de contratos.
- **Adicionales pagados:** usuarios y encargados extra.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación actual o prevista |
|---|---|
| **Cambios en la ley o en parámetros** (tasas, topes, nuevas obligaciones) | Los parámetros son datos, mantenidos por Jornada40 y congelados por período. La arquitectura modular permite agregar obligaciones. Pruebas automáticas de los cálculos. |
| **Mi DT sin API pública**, y cambios en sus formularios | Ficha para copiar (funciona siempre). La extensión usa mapeos como datos, que se corrigen sin publicar otra versión, y se detiene si algo no calza. |
| **Reconocimiento DT aún no obtenido** | Diseño alineado con los criterios vigentes (Dictamen 0789/15, ORD 2257/2022, ORD 82/2025, Ord. 136 y 79 de 2025). La solicitud es el próximo paso. |
| **Respaldos de producción aún no automatizados** | Pendiente de implementar (plan Pro de Railway o `pg_dump` cifrado diario hacia almacenamiento externo). Conviene presentarlo como uso de fondos prioritario si no está resuelto al momento de la propuesta. |
| **Seguridad y datos sensibles** (sueldos, denuncias) | Ver sección 7.3. Hay revisiones internas de seguridad: una detectó una falla en las cuentas del portal del trabajador, que se corrigió en producción al día siguiente de publicarse (8-10-2026). El titular decide si mencionarlo en la propuesta. |
| **Competidores grandes con más recursos** | Foco en pyme y cumplimiento, usabilidad para dueños mayores, y módulos que no son el centro de las plataformas de RR. HH. (Ley Karin con reserva, fiscalización, reglamento por rubro). |
| **Dependencia de proveedores** (Railway, Vercel, Reveniu, B2, Resend, Gemini) | Proveedores estándar y reemplazables. La digitalización con IA es opcional para el flujo principal. |
| **Adopción por usuarios poco digitales** | Diseño simple, resumen por correo con un botón por tema, y plan gratis para probar. |
| **Equipo pequeño** | Por completar con el titular. Hoy hay documentación técnica completa, pruebas automáticas e integración continua. |
| **Responsabilidad legal** por documentos o cálculos | Los Términos aclaran que Jornada40 es una herramienta y no asesoría legal. El sistema avisa con la norma, el usuario decide, y el reglamento se entrega como guía. |

---

## 11. Lo que Jornada40 no hace (para no prometer de más)

- **No es firma electrónica avanzada (FEA).** Los finiquitos con poder liberatorio se ratifican en Mi DT o ante ministro de fe. Firmar el finiquito en Jornada40 es solo una firma de recepción.
- **No sube archivos a Previred, Mi DT ni el SII por el cliente:** los deja listos. Mi DT no tiene API pública; la extensión de ayuda está en pruebas.
- **Previred no cubre:**
  - el régimen IPS (ex INP) ni pensionados;
  - APV o APVC;
  - licencias médicas con fechas ni líneas adicionales.
- **La DJ 1887** se entrega como planilla de apoyo, no en el formato de carga del SII.
- **El reglamento interno** es una guía para completar, no un documento legal final.
- **Ley Karin:** no determina si hubo acoso ni propone sanciones.
- **Registro masivo de contratos en Mi DT por archivo:** no disponible (el formato oficial no está verificado). El registro es individual.
- **Reconocimiento formal de la DT:** pendiente.
- **No hay prorrateo** al cambiar de plan.
- **No hay aplicación móvil nativa:** es web adaptada a celulares, y el trabajador firma desde el celular sin instalar nada.
- **Códigos del LRE para horas extra compensadas con días libres:** la DT no los ha publicado. Se usan códigos provisorios.

---

## 12. Información que debe aportar el titular

El agente debe pedir estos datos antes de cerrar la propuesta. No hay que inventarlos.

**Empresa y equipo**
- Razón social y estructura (Jornada40 y Fehu Developers, propietaria del software según los Términos).
- Fundadores y equipo: roles, experiencia y dedicación.
- Asesores (legal laboral, contable, tecnológico).

**Tracción y uso**
- Fecha de lanzamiento comercial.
- Cuentas registradas, empresas, trabajadores gestionados y distribución por plan.
- Clientes pagadores, ingreso mensual recurrente (MRR), ticket promedio, crecimiento, churn, conversión de gratis a pago.
- Volumen de uso: liquidaciones emitidas, documentos firmados, certificados emitidos, denuncias gestionadas.
- Casos o testimonios de clientes.

**Comercial**
- Canales actuales (directo, contadores, alianzas), costo de adquisición y ciclo de venta.
- Resultado del estudio de pricing, cuando se retome.

**Finanzas**
- Ingresos y costos actuales (infraestructura y servicios), burn rate y runway.
- Proyecciones a 3–5 años y supuestos.

**Ronda**
- Monto, instrumento y valorización o condiciones.
- Uso de los fondos (por ejemplo: equipo comercial, reconocimiento DT, respaldos e infraestructura, extensión Mi DT, FEA).
- Hitos que financia la ronda.
- Cap table actual.

**Legal**
- Propiedad intelectual y marca.
- Contratos con proveedores.
- Política de privacidad y cumplimiento de la Ley 21.719.

---

## 13. Glosario

- **AFP / Fonasa / Isapre / AFC:** fondo de pensiones; seguro público de salud; seguro privado de salud; seguro de cesantía.
- **Anexo:** modificación firmada del contrato de trabajo.
- **Art. 22:** jornada sin límite de horas (gerentes, trabajo sin fiscalización superior inmediata).
- **DS 21 / DS 44:** reglamentos de la Ley Karin (investigación) y de la gestión preventiva de riesgos laborales.
- **DT:** Dirección del Trabajo, que fiscaliza el cumplimiento laboral.
- **EPP:** elementos de protección personal.
- **FEA:** firma electrónica avanzada (requiere un proveedor acreditado).
- **Finiquito:** documento que pone término a la relación laboral. Tiene poder liberatorio si se ratifica.
- **Fuero:** protección contra el despido sin autorización judicial (maternal, sindical y otros).
- **LRE:** Libro de Remuneraciones Electrónico, que se carga cada mes en Mi DT.
- **Mi DT:** portal de trámites de la Dirección del Trabajo.
- **Previred:** plataforma de pago de cotizaciones previsionales.
- **RIOHS / RIHS:** reglamento interno de orden, higiene y seguridad (10 o más trabajadores) / de higiene y seguridad (menos de 10).
- **SaaS:** software como servicio, con suscripción.
- **UF / UTM / IMM:** unidad de fomento; unidad tributaria mensual; ingreso mínimo mensual.

---

*Fuentes internas: código de `main`, `CLAUDE.md` (documentación técnica), `docs/briefing-comercial-jornada40.md` (mapa funcional y flujos), `docs/PENDIENTES.md` (pendientes y trámites) y `docs/PLAN_EXTENSION_MIDT.md` (extensión, en la rama de desarrollo).*
