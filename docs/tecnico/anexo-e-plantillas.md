# Anexo E. Plantillas de documentos y correos {.unnumbered #sec-anexo-e}

Inventario de las 39 plantillas de Django del servidor: 37 en `backend/core/templates/` y 2 en `backend/templates/registration/`. Las plantillas de documentos se convierten a PDF con xhtml2pdf; las de correo tienen una versión HTML y, casi siempre, una de texto. La sección 5.1.4 explica qué función produce cada PDF, y la 7.5, cuándo se envía cada correo.

**Reglas comunes.**

- **Marca del plan Semilla.** Ocho plantillas de documentos agregan al pie «Generado con Jornada40.cl | Plan Semilla» cuando la empresa tiene ese plan (variable `es_plan_semilla`): contrato, anexo de 40 horas, anexo de contrato, carta, carta de término, liquidación, comprobante de vacaciones y documento laboral.
- **Firmas.** Las plantillas de documentos traen líneas de firma para las partes. La imagen de la firma del empleador (`Empresa.firma_imagen`, que se exige antes de enviar a firma) va en la página de certificado que se agrega al firmar (sección 8.9), en los certificados del portal y en el Certificado N°6; si la imagen no se puede leer, esos certificados salen sin ella.
- **Versión firmada.** Ninguna plantilla se usa para un documento ya firmado: la descarga entrega el PDF firmado guardado (sección 5.1.4).
- **Enlaces.** Los correos arman sus enlaces con `SITIO_URL`.

#### Documentos laborales (PDF) {.unnumbered}

| Plantilla | Documento | Contenido principal |
|---|---|---|
| `contrato_trabajo.html` | Contrato de trabajo | Comparecencia de las partes. Cláusulas: primero, naturaleza de los servicios (cargo, funciones y modalidad); segundo, jornada y su distribución por día; tercero, remuneración, día de pago, quincena y gratificación (Art. 47 o 50); cuarto, documentación laboral electrónica; quinto, cláusulas especiales, si las hay; y vigencia. Firmas |
| `clausula_consentimiento_electronico.html` | Fragmento | Texto del consentimiento para recibir y firmar documentos electrónicos (Dictamen 0789/15). Lo incluyen el contrato y el anexo de contrato; por eso también va en el anexo de consentimiento de los trabajadores actuales, que usa esa plantilla |
| `anexo_40h.html` | Anexo de adecuación a la Ley 40 horas | Primero, la nueva jornada semanal (el menor valor entre la pactada y la máxima vigente, Ley 21.561); segundo, los días de distribución; tercero, que la remuneración no cambia |
| `anexo_contrato.html` | Anexo de contrato | Partes, antecedentes del contrato, cláusulas modificadas («se modifica de X a Y») y su vigencia. También para el anexo de consentimiento y el pacto de teletrabajo |
| `documento_legal.html` | Carta de amonestación, constancia o mutuo acuerdo | Destinatario y un texto según el tipo, con los hechos o la causal; firmas |
| `carta_despido.html` | Carta de término de contrato | Causal con su artículo, hechos, último día de trabajo, estado de las cotizaciones (Art. 162 inc. 5° CT) y modalidad del finiquito: presencial ante ministro de fe o electrónica, siempre voluntaria para el trabajador |
| `comprobante_vacaciones.html` | Comprobante de vacaciones | Fechas, días hábiles y observaciones; firmas |
| `documento_laboral.html` | Pactos, autorizaciones y constancias | Partes y las cláusulas que redacta el servidor según el tipo (`datos.clausulas`): horas extra, descuento, permiso legal, indemnización a todo evento, entrega de EPP, información de riesgos, canales de denuncia, recepción del reglamento y revocación de un descuento |
| `liquidacion.html` | Liquidación de sueldo | Datos de la empresa y del trabajador; días trabajados, de ausencia, de licencia y fuera de contrato; haberes imponibles y no imponibles, descuentos previsionales y otros, totales y líquido a pagar. Notas de la compensación de horas extra y del aporte de indemnización a todo evento, cuando corresponden |

En el código, sin plantilla: el finiquito, que arma su HTML en `views/finiquitos.py → html_finiquito`.

#### Certificados y archivos de la empresa (PDF) {.unnumbered}

| Plantilla | Documento | Contenido principal |
|---|---|---|
| `certificado.html` | Certificados del portal del trabajador | Título según el tipo, datos que acredita, firma del empleador, folio `C-0000123`, código de verificación y código QR |
| `certificado_sueldos.html` | Certificado N°6 del SII | Formato horizontal de 16 columnas: montos mensuales (columnas 1 a 10) y montos actualizados con el factor del SII (11 a 16); firma del empleador (Res. Ex. SII N° 6.509) |
| `libro_remuneraciones.html` | Libro de remuneraciones del período | Una fila por trabajador: haberes imponibles y no imponibles, descuentos y líquido |
| `consolidado_remuneraciones.html` | Reporte multiempresa | Masa salarial, costo empleador y líquido por empresa y por mes |
| `bitacora.html` | Copia verificable de la bitácora | Folio `B-000001`, código de verificación, código QR y una fila por registro (fecha, persona, acción, empresa, IP y resultado) |
| `reglamento_plantilla.html` | Vista previa en PDF de la guía del reglamento interno | Envoltorio del texto de la guía por rubro, con las partes por completar resaltadas. La versión Word se arma sin plantilla (`core/docx_simple.py`) |
| `karin_documento.html` | Documentos de la Ley Karin | Diseño común de los diez documentos del expediente: recepción, acta verbal, resguardo, decisión, antecedentes para la DT, citación, acta de declaración, informe, notificación y medidas. El contenido lo arma `core/documentos_karin.py` |

En el código, sin plantilla: la página de certificado de la firma electrónica (`core/pdf_firma.py`, con reportlab) y la página de ratificación ante un inspector (`views/inspeccion.py`).

#### Correos {.unnumbered}

| Plantillas | Correo | Contenido |
|---|---|---|
| `portal_trabajador_codigo.html` | Código del portal y código de fiscalización | Código de 6 dígitos y minutos de vigencia. El texto plano va en el código |
| `portal_invitacion.html`, `.txt` | Invitación al portal | Empresa que invita, qué ofrece el portal y pasos para entrar con el RUT y un código |
| `peticion_aviso.html`, `.txt` | Aviso de una petición del portal | Al titular, qué pidió el trabajador; al trabajador, la respuesta |
| `resumen_empleador.html`, `.txt` | Resumen por correo | Un bloque por tema con letra grande y un botón claro |
| `equipo_invitacion.html`, `.txt` | Invitación de un usuario del equipo | Cuenta que invita y enlace para crear la clave |
| `equipo_recuperar.html`, `.txt` | Recuperación de la clave del equipo | Enlace de un solo uso |
| `karin_invitacion.html`, `.txt` | Designación del encargado Ley Karin | Enlace de un solo uso para crear la clave; acceso aparte y reservado |
| `karin_recuperar.html`, `.txt` | Recuperación de la clave Ley Karin | Enlace de un solo uso |
| `karin_denuncia_recibida.html`, `.txt` | Comprobante de denuncia | Folio, fecha y hora de recepción (Art. 11 del DS 21) |
| `karin_denuncia_nueva.html`, `.txt` | Aviso de denuncia nueva | Que llegó una denuncia por el portal y los primeros plazos; sin nombres ni folio |
| `karin_plazos.html`, `.txt` | Plazos de la Ley Karin | Solo cifras: plazos vencidos y por vencer, y posibles represalias por revisar |
| `registration/password_reset_email.html`, `.txt` | Recuperación de la clave del titular | Enlace a `SITIO_URL/reset-password/<uid>/<token>` |

En el código, sin plantilla: la solicitud de firma (`views/firmas.py`), el código de firma, el documento firmado y el rechazo (`views/firma_publica.py`), los avisos de pagos (`views/suscripciones.py`) y las alertas de errores (`core/alertas.py`).

**Observación.** El correo de recuperación del titular usa la plantilla HTML también como texto plano (`views/cuentas.py`), así que un lector que muestra solo texto ve las etiquetas. La plantilla `.txt` existe, pero solo la usa la recuperación por correo, que está cerrada. Está registrado en `docs/PENDIENTES.md`.
