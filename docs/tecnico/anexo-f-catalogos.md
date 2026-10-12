# Anexo F. Catálogos y listas cerradas {.unnumbered #sec-anexo-f}

Las listas cerradas que usa el sistema, generadas con `herramientas/anexos.py`. Las primeras son las opciones de los campos de los modelos (se guardan como código); las siguientes, los catálogos que definen los módulos de reglas.

#### Opciones de los campos {.unnumbered}

| Modelo y campo | Opciones (código: texto) |
|---|---|
| `Cliente.tipo_cliente` | `PERSONA`: Persona Natural; `EMPRESA`: Empresa (Persona Jurídica) |
| `Cliente.frecuencia_resumen` | `DIARIA`: Cada día; `SEMANAL`: Cada lunes; `NUNCA`: No enviar |
| `Suscripcion.estado` | `TRIAL`: Período de Prueba; `ACTIVE`: Activa; `PAST_DUE`: Pago Pendiente / Moroso; `CANCELED`: Cancelada |
| `Suscripcion.ciclo` | `MENSUAL`: Mensual; `ANUAL`: Anual |
| `IntentoPago.ciclo` | `MENSUAL`: Mensual; `ANUAL`: Anual |
| `Empresa.mutual` | `00`: ISL (sin mutual); `01`: Asociación Chilena de Seguridad (ACHS); `02`: Mutual de Seguridad CChC; `03`: Instituto de Seguridad del Trabajo (IST) |
| `Empresa.ccaf` | `00`: Sin caja de compensación; `01`: Los Andes; `02`: La Araucana; `03`: Los Héroes; `04`: 18 de Septiembre |
| `Empleado.sexo` | `M`: Masculino; `F`: Femenino; `O`: Otro |
| `Empleado.modalidad` | `PRESENCIAL`: Presencial; `REMOTO`: Remoto; `HIBRIDO`: Híbrido |
| `Empleado.sistema_salud` | `FONASA`: Fonasa; `ISAPRE`: Isapre |
| `Empleado.isapre` | `01`: Banmédica; `02`: Consalud; `03`: Vida Tres; `04`: Colmena; `05`: Cruz Blanca; `10`: Nueva Masvida; `11`: Isalud; `12`: Fundación; `25`: Cruz del Norte; `28`: Esencial |
| `Empleado.tramo_asignacion_familiar` | `A`: Primer tramo; `B`: Segundo tramo; `C`: Tercer tramo; `D`: Sin derecho |
| `Empleado.tipo_impuesto_renta` | `1`: Impuesto de segunda categoría; `2`: Impuesto único obrero agrícola; `3`: Impuesto adicional |
| `Empleado.consentimiento_electronico_via` | `CONTRATO`: Cláusula del contrato; `ANEXO`: Anexo firmado; `PAPEL`: Firmado en papel |
| `Empleado.cuidado_de` | `MENOR_14`: Niño o niña menor de 14 años; `MENOR_18_DISCAPACIDAD`: Adolescente menor de 18 años con discapacidad o dependencia; `DISCAPACIDAD`: Persona adulta (18 años o más) con discapacidad; `DEPENDENCIA`: Persona adulta (18 años o más) en situación de dependencia severa o moderada |
| `Empleado.fuero` | `MATERNIDAD`: Maternidad: embarazo y hasta un año después del postnatal (Art. 201); `POSTNATAL_PARENTAL`: Padre que usa el postnatal parental (Art. 201 inc. 2°); `SINDICAL`: Dirigente o candidato sindical (Arts. 224, 243); `DELEGADO`: Delegado del personal o sindical (Arts. 229, 302); `COMITE_PARITARIO`: Representante titular del Comité Paritario (Art. 243); `NEGOCIACION`: Negociación colectiva en curso (Art. 309) |
| `Contrato.tipo_contrato` | `INDEFINIDO`: Indefinido; `PLAZO_FIJO`: Plazo Fijo; `OBRA_FAENA`: Por Obra o Faena |
| `Contrato.tipo_jornada` | `ORDINARIA`: Ordinaria (Lunes a Viernes/Sábado); `TURNOS`: Turnos Rotativos; `BISMANAL`: Bismanal; `ART_22`: Artículo 22 (Sin límite de horario); `PARCIAL`: Part-Time; `OTRO`: Otra (Jornada Personalizada) |
| `Contrato.gratificacion_legal` | `MENSUAL`: Mensual (Art. 50); `ANUAL`: Anual (Art. 47) |
| `AnexoContrato.tipo` | `GENERAL`: Modificación del contrato; `CONSENTIMIENTO_ELECTRONICO`: Autorización de documentación electrónica; `TELETRABAJO`: Pacto de trabajo a distancia o teletrabajo |
| `ConceptoRemuneracion.tipo` | `HABER_IMPONIBLE`: Haber imponible; `HABER_NO_IMPONIBLE`: Haber no imponible; `HORA_EXTRA`: Hora extra; `COMISION`: Comisión por venta; `DESCUENTO`: Descuento |
| `DocumentoLegal.tipo` | `AMONESTACION`: Carta de Amonestación; `DESPIDO`: Carta de Término de Contrato (Despido); `MUTUO_ACUERDO`: Renuncia / Mutuo Acuerdo; `CONSTANCIA`: Constancia Laboral |
| `DocumentoLegal.causal_articulo` | `159_1`: Art. 159 N°1 — Mutuo acuerdo de las partes; `159_2`: Art. 159 N°2 — Renuncia voluntaria del trabajador; `159_3`: Art. 159 N°3 — Muerte del trabajador; `159_4`: Art. 159 N°4 — Vencimiento del plazo convenido; `159_5`: Art. 159 N°5 — Conclusión del trabajo o servicio; `159_6`: Art. 159 N°6 — Caso fortuito o fuerza mayor; `160_1a`: Art. 160 N°1 a) — Falta de probidad; `160_1b`: Art. 160 N°1 b) — Acoso sexual; `160_1c`: Art. 160 N°1 c) — Vías de hecho contra empleador u otro trabajador; `160_1d`: Art. 160 N°1 d) — Injurias al empleador; `160_1e`: Art. 160 N°1 e) — Conducta inmoral grave; `160_1f`: Art. 160 N°1 f) — Acoso laboral (mobbing); `160_2`: Art. 160 N°2 — Negociaciones prohibidas en el contrato; `160_3`: Art. 160 N°3 — Inasistencias injustificadas; `160_4a`: Art. 160 N°4 a) — Abandono: salida intempestiva; `160_4b`: Art. 160 N°4 b) — Abandono: negativa injustificada a trabajar; `160_5`: Art. 160 N°5 — Actos que afectan la seguridad; `160_6`: Art. 160 N°6 — Daño material intencional; `160_7`: Art. 160 N°7 — Incumplimiento grave del contrato; `161_1`: Art. 161 inc. 1° — Necesidades de la empresa; `161_2`: Art. 161 inc. 2° — Desahucio del empleador; `163bis`: Art. 163 bis — Liquidación concursal del empleador |
| `DocumentoLegal.modalidad_finiquito` | `PRESENCIAL`: Presencial ante ministro de fe; `ELECTRONICO`: Electrónico (voluntario para el trabajador) |
| `DocumentoLaboral.tipo` | `HORAS_EXTRA`: Pacto de horas extraordinarias; `DESCUENTO`: Autorización de descuento; `PERMISO_LEGAL`: Constancia de permiso legal con goce; `INDEMNIZACION`: Pacto de indemnización a todo evento; `REGLAMENTO`: Constancia de recepción del reglamento interno; `CANALES_DENUNCIA`: Constancia de información de canales de denuncia (Ley Karin); `ENTREGA_EPP`: Constancia de entrega de elementos de protección personal; `INFORMACION_RIESGOS`: Constancia de información de riesgos laborales; `REVOCACION_DESCUENTO`: Constancia de revocación de descuento |
| `ReglamentoInterno.tipo` | `RIOHS`: Reglamento Interno de Orden, Higiene y Seguridad; `RIHS`: Reglamento Interno de Higiene y Seguridad |
| `SolicitudFirma.origen` | `PANEL`: Enviado por el empleador; `PORTAL`: Solicitado por el trabajador en su portal |
| `SolicitudFirma.tipo_documento` | `CONTRATO`: Contrato Laboral; `ANEXO_40H`: Anexo Ley 40 Horas; `AMONESTACION`: Carta de Amonestación; `DESPIDO`: Carta de Despido; `CONSTANCIA`: Constancia Laboral; `ANEXO_CONTRATO`: Anexo de Contrato; `LIQUIDACION`: Liquidación de Sueldo; `VACACION`: Comprobante de Vacaciones; `FINIQUITO`: Finiquito de Término; `HORAS_EXTRA`: Pacto de horas extraordinarias; `DESCUENTO`: Autorización de descuento; `PERMISO_LEGAL`: Constancia de permiso legal; `INDEMNIZACION`: Pacto de indemnización a todo evento; `REGLAMENTO`: Constancia de recepción del reglamento interno; `CANALES_DENUNCIA`: Constancia de canales de denuncia (Ley Karin); `ENTREGA_EPP`: Constancia de entrega de EPP; `INFORMACION_RIESGOS`: Constancia de información de riesgos; `REVOCACION_DESCUENTO`: Constancia de revocación de descuento |
| `SolicitudFirma.estado` | `PENDIENTE`: Pendiente de firma; `PROCESANDO`: Procesando firma; `FIRMADO`: Firmado; `RECHAZADO`: Rechazado por el trabajador; `EXPIRADO`: Plazo vencido; `CANCELADO`: Cancelado por el empleador |
| `SolicitudFirma.verificacion` | `CODIGO_CORREO`: Código de un solo uso enviado a su correo personal; `CLAVE_PORTAL`: Clave personal del portal del trabajador |
| `VacacionEmpleado.tipo` | `VACACION_LEGAL`: Vacación Legal (Art. 67); `VACACION_PROGRESIVA`: Feriado Progresivo (Art. 68); `PERMISO_SIN_GOCE`: Permiso Sin Goce de Sueldo; `DIA_COMPENSATORIO`: Día compensatorio por horas extra (Art. 32) |
| `VacacionEmpleado.estado` | `PENDIENTE`: Pendiente de aprobación; `APROBADO`: Aprobado; `RECHAZADO`: Rechazado |
| `VacacionEmpleado.origen` | `PANEL`: Registrada por el empleador; `PORTAL`: Pedida desde el portal |
| `VacacionEmpleado.motivo_rechazo` | `NECESIDADES_EMPRESA`: Las necesidades de la empresa no lo permiten en esas fechas; `COINCIDE_OTRO`: Coincide con las vacaciones de otro trabajador del área; `SIN_SALDO`: No tiene días suficientes; `OTRAS_FECHAS`: Conversemos otras fechas |
| `SolicitudPermiso.estado` | `PENDIENTE`: Pendiente; `APROBADA`: Aprobada; `RECHAZADA`: Rechazada |
| `SolicitudPermiso.motivo_rechazo` | `FALTA_CERTIFICADO`: Falta el certificado que acredita el hecho; `YA_USADO`: Ya usó este permiso por el mismo hecho; `NO_CORRESPONDE`: El permiso no corresponde a la situación informada |
| `SolicitudConciliacion.tipo` | `TELETRABAJO`: Teletrabajo o trabajo a distancia; `CAMBIO_JORNADA`: Cambio transitorio de turnos o jornada en vacaciones escolares |
| `SolicitudConciliacion.estado` | `PENDIENTE`: Pendiente; `ACEPTADA`: Aceptada; `ALTERNATIVA`: Se ofreció otra fórmula; `RECHAZADA`: Rechazada |
| `SolicitudConciliacion.motivo` | `CARGO_NO_PERMITE`: La naturaleza del cargo no permite hacerlo a distancia; `FUNCIONAMIENTO`: Afecta el funcionamiento de la empresa en ese período; `TURNOS`: No es posible reorganizar los turnos sin afectar a otros trabajadores; `SEGURIDAD`: Razones de seguridad o salud en el trabajo; `NO_ACREDITA_CUIDADO`: No se acreditaron las responsabilidades de cuidado |
| `SolicitudConciliacion.origen` | `PANEL`: Registrada por el empleador; `PORTAL`: Pedida desde el portal |
| `SolicitudConciliacion.cuidado_declarado` | `MENOR_14`: Niño o niña menor de 14 años; `MENOR_18_DISCAPACIDAD`: Adolescente menor de 18 años con discapacidad o dependencia; `DISCAPACIDAD`: Persona adulta (18 años o más) con discapacidad; `DEPENDENCIA`: Persona adulta (18 años o más) en situación de dependencia severa o moderada |
| `Finiquito.causal_articulo` | `159_1`: Art. 159 N°1 — Mutuo acuerdo de las partes; `159_2`: Art. 159 N°2 — Renuncia voluntaria del trabajador; `159_3`: Art. 159 N°3 — Muerte del trabajador; `159_4`: Art. 159 N°4 — Vencimiento del plazo convenido; `159_5`: Art. 159 N°5 — Conclusión del trabajo o servicio; `159_6`: Art. 159 N°6 — Caso fortuito o fuerza mayor; `160_1a`: Art. 160 N°1 a) — Falta de probidad; `160_1b`: Art. 160 N°1 b) — Acoso sexual; `160_1c`: Art. 160 N°1 c) — Vías de hecho contra empleador u otro trabajador; `160_1d`: Art. 160 N°1 d) — Injurias al empleador; `160_1e`: Art. 160 N°1 e) — Conducta inmoral grave; `160_1f`: Art. 160 N°1 f) — Acoso laboral (mobbing); `160_2`: Art. 160 N°2 — Negociaciones prohibidas en el contrato; `160_3`: Art. 160 N°3 — Inasistencias injustificadas; `160_4a`: Art. 160 N°4 a) — Abandono: salida intempestiva; `160_4b`: Art. 160 N°4 b) — Abandono: negativa injustificada a trabajar; `160_5`: Art. 160 N°5 — Actos que afectan la seguridad; `160_6`: Art. 160 N°6 — Daño material intencional; `160_7`: Art. 160 N°7 — Incumplimiento grave del contrato; `161_1`: Art. 161 inc. 1° — Necesidades de la empresa; `161_2`: Art. 161 inc. 2° — Desahucio del empleador; `163bis`: Art. 163 bis — Liquidación concursal del empleador |
| `Finiquito.modalidad` | `PRESENCIAL`: Presencial ante ministro de fe; `ELECTRONICO`: Electrónico en el portal Mi DT (voluntario para el trabajador) |
| `Finiquito.ratificado_via` | `MI_DT`: Portal Mi DT de la Dirección del Trabajo; `INSPECCION`: Inspector del Trabajo; `NOTARIO`: Notario público; `REGISTRO_CIVIL`: Oficial del Registro Civil; `SECRETARIO_MUNICIPAL`: Secretario municipal |
| `SolicitudDocumento.tipo` | `LIQUIDACION`: Liquidación de sueldo; `CONTRATO`: Contrato de trabajo; `ANEXO_40H`: Anexo Ley 40 horas; `VACACION`: Comprobante de vacaciones; `FINIQUITO`: Finiquito |
| `SolicitudDocumento.estado` | `PENDIENTE`: Pendiente; `RESUELTA`: Resuelta; `DESCARTADA`: Descartada |
| `SolicitudDocumento.motivo` | `ENTREGADO_PAPEL`: Se te entregó en papel.; `SIN_REMUNERACION`: Ese mes no hubo remuneración que liquidar.; `FUERA_DE_RELACION`: El período no corresponde a tu relación laboral.; `NO_CORRESPONDE`: El documento no corresponde a tu situación laboral. |
| `CertificadoEmitido.tipo` | `ANTIGUEDAD`: Certificado de antigüedad laboral; `RENTA`: Certificado de renta; `VACACIONES`: Certificado de vacaciones; `JORNADA`: Certificado de jornada y horario; `TERMINO`: Certificado de término de relación laboral; `COTIZACIONES`: Certificado de cotizaciones declaradas |
| `CertificadoEmitido.motivo_anulacion` | `DATO_ERRONEO`: Contenía un dato erróneo, ya corregido; `EMITIDO_POR_ERROR`: Se emitió por error; `RELACION_MODIFICADA`: Cambiaron las condiciones que certificaba |
| `RegistroDT.via` | `MANUAL`: Marcado en el panel; `EXTENSION`: Registrado con la extensión para Mi DT |
| `RegistroInspeccion.accion` | `INGRESO`: Ingreso; `DESCARGA`: Descarga de documento; `RATIFICACION`: Ratificación en terreno; `SALIDA`: Salida |
| `UsuarioEquipo.estado` | `INVITADO`: Invitado (aún no crea su clave); `ACTIVO`: Activo; `ELIMINADO`: Eliminado |
| `UsuarioEquipo.frecuencia_resumen` | `DIARIA`: Cada día; `SEMANAL`: Cada lunes; `NUNCA`: No enviar |
| `RegistroBitacora.actor_tipo` | `TITULAR`: Titular de la cuenta; `EQUIPO`: Usuario del equipo; `SISTEMA`: Sistema |
| `ExportacionBitacora.formato` | `PDF`: PDF; `XLSX`: Excel |
| `EncargadoKarin.estado` | `INVITADO`: Invitado (aún no crea su clave); `ACTIVO`: Activo; `ELIMINADO`: Eliminado |
| `DenunciaKarin.tipo` | `ACOSO_SEXUAL`: Acoso sexual; `ACOSO_LABORAL`: Acoso laboral; `VIOLENCIA`: Violencia en el trabajo ejercida por terceros |
| `DenunciaKarin.canal` | `ESCRITA`: Por escrito; `VERBAL`: Verbal (se levanta acta); `ELECTRONICA`: Por correo u otro medio electrónico |
| `DenunciaKarin.estado` | `RECIBIDA`: Recibida; `INVESTIGACION`: En investigación interna; `DERIVADA_DT`: Derivada a la Dirección del Trabajo; `INFORME`: Informe emitido; `REVISION_DT`: Informe en revisión de la DT; `MEDIDAS`: Aplicar medidas; `CERRADA`: Cerrada |
| `DenunciaKarin.origen` | `ENCARGADO`: Registrada por el encargado; `PORTAL`: Ingresada por el trabajador en su portal |
| `ArchivoKarin.tipo` | `DENUNCIA_ESCRITA`: Denuncia escrita; `ACTA_VERBAL`: Acta de denuncia verbal firmada; `ACTA_DECLARACION`: Acta de declaración firmada; `ANTECEDENTE`: Antecedente de la investigación; `COMPROBANTE_DT`: Comprobante o certificado de la DT; `PRONUNCIAMIENTO_DT`: Pronunciamiento de la DT; `NOTIFICACION`: Comunicación o notificación firmada |
| `ParametroPrevisional.origen` | `MANUAL`: Carga manual; `PREVIRED`: Propuesta leída de Previred |
| `TasaAFP.origen` | `MANUAL`: Carga manual; `PREVIRED`: Propuesta leída de Previred |
| `TramoAsignacionFamiliar.tramo` | `A`: Primer tramo; `B`: Segundo tramo; `C`: Tercer tramo |

#### Catálogos de los módulos de reglas {.unnumbered}

| Catálogo | Ubicación | Valores |
|---|---|---|
| Bancos e instituciones de pago | `core/bancos.py` | Banco de Chile; BancoEstado; Santander; BCI; Scotiabank; Itaú; BICE; Security; Banco Falabella; Banco Ripley; Banco Consorcio; Banco Internacional; BTG Pactual; HSBC; Coopeuch; Tenpo; Mercado Pago; MACH; Prepago Los Héroes; Otra institución |
| Rubros del reglamento interno | `core/reglamento_plantilla.py` | Administración y oficina; Comercio y ventas; Manufactura, producción e industria; Tecnología (TI); Construcción; Gastronomía y hotelería; Transporte y bodega; Agrícola; Aseo y mantención; Salud |
| Elementos de protección personal | `core/seguridad.py` | Casco de seguridad; Calzado de seguridad; Calzado antideslizante; Guantes de trabajo; Guantes anticorte; Guantes térmicos; Guantes de nitrilo o de procedimiento; Lentes de seguridad; Careta facial o de soldar; Protector auditivo; Respirador con filtro; Mascarilla; Arnés de seguridad con línea de vida; Chaleco reflectante; Ropa de trabajo; Ropa impermeable; Delantal o pechera; Cofia o gorro; Sombrero o legionario; Protector solar |
| Motivos de entrega de EPP | `core/seguridad.py` | Ingreso del trabajador; Reposición por desgaste; Reposición por deterioro o falla; Reposición por pérdida; Cambio de puesto o de tareas |
| Motivos de la información de riesgos | `core/seguridad.py` | Antes de empezar a trabajar; Cambio de puesto o de tareas; Nuevo proceso, tecnología, material o sustancia |
| Permisos legales con goce | `core/views/documentos_laborales.py` | Fallecimiento de un hijo (10 días corridos; Art. 66 del Código del Trabajo); Fallecimiento del cónyuge o conviviente civil (7 días corridos; Art. 66 del Código del Trabajo); Fallecimiento de un hijo en período de gestación (7 días hábiles; Art. 66 del Código del Trabajo); Fallecimiento del padre o de la madre (4 días hábiles; Art. 66 del Código del Trabajo); Fallecimiento de un hermano o hermana (4 días hábiles; Art. 66 del Código del Trabajo); Nacimiento o adopción de un hijo (5 días corridos; Art. 195 del Código del Trabajo); Matrimonio o acuerdo de unión civil (5 días hábiles; Art. 207 bis del Código del Trabajo) |
| Motivos de un pacto de horas extra | `core/views/documentos_laborales.py` | Aumento temporal de la demanda o de la producción; Inventario, cierre contable o auditoría; Situación imprevista que requiere dar continuidad a la operación; Proyecto o entrega con plazo acotado |
| Compensación de las horas extra | `core/views/documentos_laborales.py` | Se pagan en dinero; Se cambian por días libres; Mitad en dinero y mitad en días libres |
| Módulos del panel para el equipo | `core/permisos.py` | TRABAJADORES (Trabajadores); CONTRATOS (Contratos y anexos); REMUNERACIONES (Remuneraciones); VACACIONES (Vacaciones y permisos); DOCUMENTOS (Documentos y pactos); TERMINO (Término de contrato); DIRECCION_TRABAJO (Dirección del Trabajo); SEGURIDAD (Reglamento y seguridad); SOLICITUDES (Solicitudes del portal); REPORTES (Reportes y expedientes) |

