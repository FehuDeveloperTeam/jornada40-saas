# Anexo B. Diccionario de datos {.unnumbered #sec-anexo-b}

Campos de cada modelo de `backend/core/models.py`, generados con `herramientas/anexos.py`. Los modelos se agrupan por dominio, en el orden de la sección 6.2. Los tipos son los de la tabla «Tipos de datos» de la sección 6.1.

## Cuentas, planes y pagos {.unnumbered}

#### `Plan` {.unnumbered}

Tabla `core_plan`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `nombre` | texto | hasta 50 caracteres |
| `descripcion` | texto | admite nulo |
| `precio` | entero | por omisión: `0` |
| `precio_anual` | entero | por omisión: `0` |
| `max_empresas` | entero | por omisión: `1` |
| `limite_trabajadores` | entero | por omisión: `5` |
| `nivel` | entero | por omisión: `1` |
| `activo` | booleano | por omisión: sí |

#### `Cliente` {.unnumbered}

Tabla `core_cliente`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `usuario` | relación | Uno a uno con `User`; al borrar: CASCADE |
| `plan` | relación | Referencia a `Plan`; al borrar: SET_NULL; admite nulo |
| `tipo_cliente` | texto | por omisión: `PERSONA`; opciones: `PERSONA`, `EMPRESA` |
| `rut` | texto | único; hasta 20 caracteres |
| `nombres` | texto | hasta 100 caracteres |
| `apellido_paterno` | texto | admite nulo; hasta 100 caracteres |
| `apellido_materno` | texto | admite nulo; hasta 100 caracteres |
| `razon_social` | texto | admite nulo; hasta 255 caracteres |
| `direccion` | texto | admite nulo; hasta 255 caracteres |
| `calle` | texto | por omisión: vacío; hasta 200 caracteres |
| `numero` | texto | por omisión: vacío; hasta 30 caracteres; Número, o altura/kilómetro si no tiene número |
| `sin_numero` | booleano | por omisión: no |
| `depto` | texto | por omisión: vacío; hasta 30 caracteres; Depto, oficina, casa o block |
| `telefono` | texto | admite nulo; hasta 20 caracteres |
| `creado_en` | fecha_hora | se fija al crear |
| `correo` | correo | admite nulo |
| `usuarios_adicionales` | entero | por omisión: `0` |
| `encargados_karin_adicionales` | entero | por omisión: `0` |
| `frecuencia_resumen` | texto | por omisión: `SEMANAL`; opciones: `DIARIA`, `SEMANAL`, `NUNCA` |
| `resumen_hasta` | fecha_hora | admite nulo |

#### `Suscripcion` {.unnumbered}

Tabla `core_suscripcion`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cliente` | relación | Uno a uno con `Cliente`; al borrar: CASCADE |
| `plan` | relación | Referencia a `Plan`; al borrar: PROTECT |
| `estado` | texto | por omisión: `TRIAL`; opciones: `TRIAL`, `ACTIVE`, `PAST_DUE`, `CANCELED` |
| `ciclo` | texto | por omisión: `MENSUAL`; opciones: `MENSUAL`, `ANUAL` |
| `fecha_inicio` | fecha_hora | se fija al crear |
| `fecha_proximo_cobro` | fecha_hora | admite nulo |
| `fecha_cancelacion` | fecha_hora | admite nulo |
| `gateway_customer_id` | texto | admite nulo; hasta 100 caracteres; ID del cliente en la pasarela |
| `gateway_subscription_id` | texto | admite nulo; hasta 100 caracteres; ID de la suscripción/tarjeta |
| `metodo_pago_glosa` | texto | admite nulo; hasta 50 caracteres; Ej: Visa terminada en 4242 o Fintoc Banco de Chile |
| `plan_programado` | relación | Referencia a `Plan`; al borrar: PROTECT; admite nulo; Plan que rige desde el próximo cobro (bajada de plan) |
| `prueba_hasta` | fecha | admite nulo; Último día de la prueba gratuita |
| `prueba_aviso` | entero | admite nulo; Días antes del término (15 o 3); 0 = se avisó que terminó |
| `prueba_terminada_en` | fecha_hora | admite nulo |

#### `IntentoPago` {.unnumbered}

Tabla `core_intentopago`. Un checkout iniciado desde Jornada40. Su id viaja a Reveniu como external_id y vuelve en cada webhook: así el pago se asocia solo a la cuenta, el plan y el ciclo, sin depender de datos que escriba el cliente.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cliente` | relación | Referencia a `Cliente`; al borrar: CASCADE |
| `plan` | relación | Referencia a `Plan`; al borrar: PROTECT |
| `ciclo` | texto | por omisión: `MENSUAL`; opciones: `MENSUAL`, `ANUAL` |
| `gateway_subscription_id` | texto | por omisión: vacío; hasta 100 caracteres |
| `creado_en` | fecha_hora | se fija al crear |

#### `EventoPasarela` {.unnumbered}

Tabla `core_eventopasarela`. Cada aviso recibido de la pasarela (Reveniu), tal como llegó.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `evento` | texto | hasta 60 caracteres |
| `cliente` | relación | Referencia a `Cliente`; al borrar: SET_NULL; admite nulo |
| `plan` | relación | Referencia a `Plan`; al borrar: SET_NULL; admite nulo |
| `gateway_subscription_id` | texto | por omisión: vacío; hasta 100 caracteres |
| `orden_compra` | texto | por omisión: vacío; hasta 100 caracteres |
| `monto` | entero | por omisión: `0` |
| `fecha_pago` | fecha | admite nulo |
| `datos` | json | por omisión: `{}` |
| `aplicado` | booleano | por omisión: no; Si ya se reflejó en la suscripción del cliente |
| `recibido_en` | fecha_hora | se fija al crear |

#### `CodigoPrueba` {.unnumbered}

Tabla `core_codigoprueba`. Código de ingreso que regala un plan pagado por unos meses (p. ej. Pyme por 3). Sirve una sola vez, al crear la cuenta (core/pruebas.py). Se guarda solo su huella HMAC: el código completo se ve una vez, al generarlo en el admin.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `codigo_hash` | texto | único; hasta 64 caracteres |
| `prefijo` | texto | hasta 12 caracteres |
| `sufijo` | texto | hasta 4 caracteres; Últimos 4 caracteres, para reconocerlo |
| `plan` | relación | Referencia a `Plan`; al borrar: PROTECT |
| `meses` | entero | por omisión: `3` |
| `nota` | texto | hasta 200 caracteres; Para quién es (p. ej. "Ferretería El Clavo, piloto") |
| `valido_hasta` | fecha | Último día en que sirve para crear una cuenta |
| `activo` | booleano | por omisión: sí; Desmarcado: anulado, ya no sirve |
| `creado_en` | fecha_hora | se fija al crear |
| `creado_por` | relación | Referencia a `User`; al borrar: SET_NULL; admite nulo |
| `usado_en` | fecha_hora | admite nulo |
| `usado_por` | relación | Uno a uno con `Cliente`; al borrar: SET_NULL; admite nulo |

## Empresas, trabajadores y contratos {.unnumbered}

#### `Empresa` {.unnumbered}

Tabla `core_empresa`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `owner` | relación | Referencia a `User`; al borrar: CASCADE |
| `nombre_legal` | texto | hasta 255 caracteres |
| `rut` | texto | único; hasta 20 caracteres |
| `created_at` | fecha_hora | admite nulo; se fija al crear |
| `alias` | texto | admite nulo; hasta 100 caracteres |
| `giro` | texto | admite nulo; hasta 200 caracteres |
| `direccion` | texto | admite nulo; hasta 255 caracteres |
| `calle` | texto | por omisión: vacío; hasta 200 caracteres |
| `numero` | texto | por omisión: vacío; hasta 30 caracteres; Número, o altura/kilómetro si no tiene número |
| `sin_numero` | booleano | por omisión: no |
| `depto` | texto | por omisión: vacío; hasta 30 caracteres; Depto, oficina, casa o block |
| `comuna` | texto | admite nulo; hasta 100 caracteres |
| `ciudad` | texto | admite nulo; hasta 100 caracteres |
| `sucursal` | texto | admite nulo; hasta 100 caracteres |
| `representante_legal` | texto | admite nulo; hasta 200 caracteres |
| `rut_representante` | texto | admite nulo; hasta 20 caracteres |
| `activo` | booleano | por omisión: sí |
| `mutual` | texto | por omisión: `00`; opciones: `00`, `01`, `02`, `03` |
| `denuncias_responsable` | texto | por omisión: vacío; hasta 120 caracteres; Persona o cargo que recibe las denuncias |
| `denuncias_correo` | correo | por omisión: vacío |
| `rubro` | texto | por omisión: vacío; hasta 20 caracteres |
| `tasa_accidentes` | decimal | admite nulo |
| `sucursal_mutual` | texto | por omisión: vacío; hasta 3 caracteres |
| `ccaf` | texto | por omisión: `00`; opciones: `00`, `01`, `02`, `03`, `04` |
| `firma_imagen` | texto | por omisión: vacío |
| `firma_firmante_nombre` | texto | por omisión: vacío; hasta 200 caracteres |
| `firma_firmante_cargo` | texto | por omisión: vacío; hasta 200 caracteres |
| `firma_configurada_en` | fecha_hora | admite nulo |

#### `Empleado` {.unnumbered}

Tabla `core_empleado`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE |
| `rut` | texto | hasta 20 caracteres |
| `nombres` | texto | hasta 100 caracteres |
| `apellido_paterno` | texto | hasta 100 caracteres |
| `apellido_materno` | texto | admite nulo; hasta 100 caracteres |
| `sexo` | texto | admite nulo; opciones: `M`, `F`, `O` |
| `fecha_nacimiento` | fecha | admite nulo |
| `nacionalidad` | texto | por omisión: `Chilena`; hasta 50 caracteres |
| `estado_civil` | texto | admite nulo; hasta 50 caracteres |
| `direccion` | texto | admite nulo; hasta 255 caracteres |
| `calle` | texto | por omisión: vacío; hasta 200 caracteres |
| `numero` | texto | por omisión: vacío; hasta 30 caracteres; Número, o altura/kilómetro si no tiene número |
| `sin_numero` | booleano | por omisión: no |
| `depto` | texto | por omisión: vacío; hasta 30 caracteres; Depto, oficina, casa o block |
| `comuna` | texto | admite nulo; hasta 100 caracteres |
| `numero_telefono` | texto | admite nulo; hasta 20 caracteres |
| `email` | correo | admite nulo |
| `email_personal_confirmado` | booleano | por omisión: no |
| `portal_invitado_en` | fecha_hora | admite nulo |
| `departamento` | texto | admite nulo; hasta 100 caracteres |
| `cargo` | texto | hasta 100 caracteres |
| `sucursal` | texto | admite nulo; hasta 100 caracteres |
| `horas_laborales` | entero | por omisión: `40` |
| `modalidad` | texto | por omisión: `PRESENCIAL`; opciones: `PRESENCIAL`, `REMOTO`, `HIBRIDO` |
| `sueldo_base` | entero | por omisión: `0` |
| `afp` | texto | admite nulo; hasta 50 caracteres |
| `sistema_salud` | texto | admite nulo; opciones: `FONASA`, `ISAPRE` |
| `fecha_ingreso` | fecha |  |
| `centro_costo` | texto | admite nulo; hasta 100 caracteres |
| `ficha_numero` | entero | admite nulo |
| `forma_pago` | texto | por omisión: `Transferencia`; hasta 50 caracteres |
| `banco` | texto | admite nulo; hasta 50 caracteres |
| `tipo_cuenta` | texto | admite nulo; hasta 50 caracteres |
| `numero_cuenta` | texto | admite nulo; hasta 50 caracteres |
| `plan_isapre_uf` | decimal | por omisión: `0.0` |
| `isapre` | texto | por omisión: vacío; opciones: `01`, `02`, `03`, `04`, `05`, `10`, `11`, `12`, `25`, `28` |
| `numero_fun` | texto | por omisión: vacío; hasta 16 caracteres |
| `tramo_asignacion_familiar` | texto | por omisión: `D`; opciones: `A`, `B`, `C`, `D` |
| `cargas_simples` | entero | por omisión: `0` |
| `cargas_maternales` | entero | por omisión: `0` |
| `cargas_invalidas` | entero | por omisión: `0` |
| `anios_previos_feriado` | entero | por omisión: `0` |
| `fecha_desvinculacion` | fecha | admite nulo |
| `discapacidad` | booleano | por omisión: no |
| `pension_invalidez` | booleano | por omisión: no |
| `pensionado_vejez` | booleano | por omisión: no |
| `tecnico_extranjero_exento` | booleano | por omisión: no; Técnico extranjero exento de cotizar (Ley 18.156) |
| `tipo_impuesto_renta` | texto | por omisión: `1`; opciones: `1`, `2`, `3` |
| `consentimiento_electronico_en` | fecha_hora | admite nulo |
| `consentimiento_electronico_via` | texto | por omisión: vacío; opciones: `CONTRATO`, `ANEXO`, `PAPEL` |
| `cuidado_de` | texto | por omisión: vacío; opciones: `MENOR_14`, `MENOR_18_DISCAPACIDAD`, `DISCAPACIDAD`, `DEPENDENCIA`; Responsabilidades de cuidado no remuneradas (Ley 21.645) |
| `hijo_enfermedad_grave` | booleano | por omisión: no; Hijo/a menor de 18 con enfermedad grave (Ley SANNA) |
| `fuero` | texto | por omisión: vacío; opciones: `MATERNIDAD`, `POSTNATAL_PARENTAL`, `SINDICAL`, `DELEGADO`, `COMITE_PARITARIO`, `NEGOCIACION` |
| `fuero_hasta` | fecha | admite nulo; Vacío: vigente sin fecha de término conocida |
| `fecha_parto` | fecha | admite nulo |
| `activo` | booleano | por omisión: sí |
| `creado_en` | fecha_hora | se fija al crear |

Unicidad: `empresa, rut`.

#### `Contrato` {.unnumbered}

Tabla `core_contrato`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Uno a uno con `Empleado`; al borrar: CASCADE |
| `tipo_contrato` | texto | por omisión: `INDEFINIDO`; opciones: `INDEFINIDO`, `PLAZO_FIJO`, `OBRA_FAENA` |
| `cargo` | texto | por omisión: `No especificado`; hasta 100 caracteres |
| `fecha_inicio` | fecha |  |
| `fecha_fin` | fecha | admite nulo |
| `es_profesional_titulado` | booleano | por omisión: no; Gerente o profesional/técnico con título de educación superior — habilita el tope de 2 años en vez de 1 para contratos a plazo fijo (Art. 159 N°4 del Código del Trabajo) |
| `sueldo_base` | entero |  |
| `tipo_jornada` | texto | por omisión: `ORDINARIA`; opciones: `ORDINARIA`, `TURNOS`, `BISMANAL`, `ART_22`, `PARCIAL`, `OTRO` |
| `horas_semanales` | decimal | por omisión: `jornada_maxima_por_defecto()` |
| `distribucion_dias` | entero | por omisión: `5` |
| `distribucion_horario` | json | admite nulo; por omisión: `{}` |
| `dia_pago` | entero | por omisión: `5` |
| `gratificacion_legal` | texto | por omisión: `MENSUAL`; opciones: `MENSUAL`, `ANUAL` |
| `tiene_quincena` | booleano | por omisión: no |
| `dia_quincena` | entero | admite nulo |
| `monto_quincena` | entero | admite nulo |
| `es_comisionista` | booleano | por omisión: no |
| `comisiones_config` | json | por omisión: `[]` |
| `jornada_personalizada` | texto | admite nulo |
| `funciones_especificas` | json | admite nulo; por omisión: `[]` |
| `clausulas_especiales` | json | admite nulo; por omisión: `[]` |
| `archivo_contrato` | archivo | admite nulo |
| `archivo_anexo_40h` | archivo | admite nulo |
| `creado_en` | fecha_hora | se fija al crear |

#### `AnexoContrato` {.unnumbered}

Tabla `core_anexocontrato`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `contrato` | relación | Referencia a `Contrato`; al borrar: CASCADE |
| `tipo` | texto | por omisión: `GENERAL`; opciones: `GENERAL`, `CONSENTIMIENTO_ELECTRONICO`, `TELETRABAJO` |
| `titulo` | texto | hasta 200 caracteres |
| `descripcion` | texto |  |
| `clausulas_modificadas` | json | por omisión: `[]` |
| `fecha_emision` | fecha |  |
| `archivo_pdf` | archivo | admite nulo |
| `creado_en` | fecha_hora | se fija al crear |
| `cambios` | json | por omisión: `{}` |
| `datos` | json | por omisión: `{}` |
| `vigencia_desde` | fecha | admite nulo |
| `aplicado` | booleano | por omisión: no |
| `aplicado_en` | fecha_hora | admite nulo |

## Remuneraciones y certificados del SII {.unnumbered}

#### `ConceptoRemuneracion` {.unnumbered}

Tabla `core_conceptoremuneracion`. Catálogo de haberes y descuentos que pueden aparecer en una liquidación.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `codigo` | texto | hasta 40 caracteres |
| `nombre` | texto | hasta 100 caracteres |
| `tipo` | texto | opciones: `HABER_IMPONIBLE`, `HABER_NO_IMPONIBLE`, `HORA_EXTRA`, `COMISION`, `DESCUENTO` |
| `es_imponible` | booleano | por omisión: no |
| `es_tributable` | booleano | por omisión: no |
| `afecta_gratificacion` | booleano | por omisión: no |
| `afecta_semana_corrida` | booleano | por omisión: no |
| `codigo_lre` | texto | por omisión: vacío; hasta 20 caracteres |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE; admite nulo |
| `activo` | booleano | por omisión: sí |
| `creado_en` | fecha_hora | se fija al crear |

Unicidad: `concepto_codigo_unico_en_sistema: codigo`; `concepto_codigo_unico_por_empresa: empresa, codigo`.

#### `Liquidacion` {.unnumbered}

Tabla `core_liquidacion`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `mes` | entero |  |
| `anio` | entero |  |
| `dias_trabajados` | entero | por omisión: `30` |
| `dias_licencia` | entero | por omisión: `0` |
| `dias_ausencia` | entero | por omisión: `0` |
| `dias_no_contratados` | entero | por omisión: `0` |
| `sueldo_base` | entero | por omisión: `0` |
| `gratificacion` | entero | por omisión: `0` |
| `detalle_items` | json | por omisión: `[]` |
| `detalle_haberes_imponibles` | json | por omisión: `[]` |
| `detalle_horas_extras` | json | por omisión: `[]` |
| `detalle_haberes_no_imponibles` | json | por omisión: `[]` |
| `detalle_comisiones` | json | por omisión: `[]` |
| `semana_corrida` | entero | por omisión: `0` |
| `afp_nombre` | texto | admite nulo; hasta 50 caracteres |
| `afp_monto` | entero | por omisión: `0` |
| `salud_nombre` | texto | admite nulo; hasta 50 caracteres |
| `isapre_cotizacion_uf` | decimal | por omisión: `0.0` |
| `salud_monto` | entero | por omisión: `0` |
| `seguro_cesantia` | entero | por omisión: `0` |
| `impuesto_unico` | entero | por omisión: `0` |
| `anticipo_quincena` | entero | por omisión: `0` |
| `detalle_otros_descuentos` | json | por omisión: `[]` |
| `sueldo_base_contrato` | entero | por omisión: `0` |
| `horas_semanales_contrato` | decimal | admite nulo |
| `gratificacion_legal` | texto | por omisión: vacío; hasta 20 caracteres |
| `tipo_contrato` | texto | por omisión: vacío; hasta 20 caracteres |
| `valor_uf` | decimal | por omisión: `0` |
| `total_imponible` | entero | por omisión: `0` |
| `total_haberes` | entero | por omisión: `0` |
| `total_descuentos` | entero | por omisión: `0` |
| `sueldo_liquido` | entero | por omisión: `0` |
| `tasa_indemnizacion` | decimal | por omisión: `0` |
| `aporte_indemnizacion` | entero | por omisión: `0` |
| `archivo_pdf` | archivo | admite nulo |
| `fecha_emision` | fecha | se fija al crear |

Unicidad: `empleado, mes, anio`.

#### `CertificadoSueldos` {.unnumbered}

Tabla `core_certificadosueldos`. Certificado N°6 sobre sueldos (Art. 101 LIR) de un trabajador y un año. Se numera correlativo por empresa; uno nuevo del mismo año reemplaza al anterior (otro número).

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `anio` | entero |  |
| `numero` | entero |  |
| `datos` | json | por omisión: `{}` |
| `reemplaza` | relación | Referencia a `CertificadoSueldos`; al borrar: SET_NULL; admite nulo |
| `emitido_en` | fecha_hora | se fija al crear |

Unicidad: `empresa, numero`.

## Cartas, pactos, constancias y reglamento {.unnumbered}

#### `DocumentoLegal` {.unnumbered}

Tabla `core_documentolegal`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `tipo` | texto | opciones: `AMONESTACION`, `DESPIDO`, `MUTUO_ACUERDO`, `CONSTANCIA` |
| `fecha_emision` | fecha |  |
| `causal_legal` | texto | admite nulo; hasta 255 caracteres |
| `hechos` | texto |  |
| `aviso_previo_pagado` | booleano | por omisión: no |
| `causal_articulo` | texto | admite nulo; 22 opciones (anexo F) |
| `fecha_ultimo_dia` | fecha | admite nulo |
| `cotizaciones_al_dia` | booleano | admite nulo |
| `aviso_previo_dias` | entero | admite nulo |
| `monto_indemnizacion_anos` | entero | admite nulo |
| `monto_indemnizacion_sustitutiva` | entero | admite nulo |
| `modalidad_finiquito` | texto | admite nulo; opciones: `PRESENCIAL`, `ELECTRONICO` |
| `copia_inspeccion_trabajo` | booleano | admite nulo |
| `archivo_pdf` | archivo | admite nulo |
| `creado_en` | fecha_hora | se fija al crear |

#### `DocumentoLaboral` {.unnumbered}

Tabla `core_documentolaboral`. Pactos, autorizaciones y constancias que Jornada40 redacta desde datos estructurados (sin texto libre): el backend valida cada tipo y arma su texto; se firman como los demás documentos (SolicitudFirma.documento_laboral). Surten efecto (avisos en la liquidación, marca en la ficha) solo firmados.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `reglamento` | relación | Referencia a `ReglamentoInterno`; al borrar: PROTECT; admite nulo |
| `tipo` | texto | opciones: `HORAS_EXTRA`, `DESCUENTO`, `PERMISO_LEGAL`, `INDEMNIZACION`, `REGLAMENTO`, `CANALES_DENUNCIA`, `ENTREGA_EPP`, `INFORMACION_RIESGOS`, `REVOCACION_DESCUENTO` |
| `fecha_emision` | fecha |  |
| `vigente_desde` | fecha |  |
| `vigente_hasta` | fecha | admite nulo; Vacío: sin término (hasta revocación) |
| `concepto` | relación | Referencia a `ConceptoRemuneracion`; al borrar: PROTECT; admite nulo; Descuento autorizado (solo autorizaciones de descuento) |
| `datos` | json | por omisión: `{}` |
| `activo` | booleano | por omisión: sí |
| `creado_en` | fecha_hora | se fija al crear |

#### `ReglamentoInterno` {.unnumbered}

Tabla `core_reglamentointerno`. Reglamento interno que el empleador sube (PDF final), con sus plazos.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE |
| `tipo` | texto | opciones: `RIOHS`, `RIHS` |
| `version` | entero |  |
| `archivo` | archivo |  |
| `publicado_en` | fecha | Día en que se dio a conocer a los trabajadores |
| `vigente_desde` | fecha |  |
| `remitido_dt_en` | fecha | admite nulo |
| `remitido_salud_en` | fecha | admite nulo |
| `activo` | booleano | por omisión: sí |
| `creado_en` | fecha_hora | se fija al crear |

Unicidad: `reglamento_version_unica: empresa, version`.

## Firma electrónica {.unnumbered}

#### `SolicitudFirma` {.unnumbered}

Tabla `core_solicitudfirma`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: PROTECT |
| `empresa` | relación | Referencia a `Empresa`; al borrar: PROTECT |
| `contrato` | relación | Referencia a `Contrato`; al borrar: PROTECT; admite nulo |
| `documento_legal` | relación | Referencia a `DocumentoLegal`; al borrar: PROTECT; admite nulo |
| `anexo_contrato` | relación | Referencia a `AnexoContrato`; al borrar: PROTECT; admite nulo |
| `liquidacion` | relación | Referencia a `Liquidacion`; al borrar: PROTECT; admite nulo |
| `vacacion` | relación | Referencia a `VacacionEmpleado`; al borrar: PROTECT; admite nulo |
| `finiquito` | relación | Referencia a `Finiquito`; al borrar: PROTECT; admite nulo |
| `documento_laboral` | relación | Referencia a `DocumentoLaboral`; al borrar: PROTECT; admite nulo |
| `origen` | texto | por omisión: `PANEL`; opciones: `PANEL`, `PORTAL` |
| `emisor` | relación | Referencia a `User`; al borrar: SET_NULL; admite nulo |
| `emisor_ip` | texto | por omisión: vacío; hasta 64 caracteres |
| `emisor_confirmado_en` | fecha_hora | admite nulo |
| `tipo_documento` | texto | 19 opciones (anexo F) |
| `token` | uuid | único; por omisión: un identificador aleatorio |
| `estado` | texto | por omisión: `PENDIENTE`; opciones: `PENDIENTE`, `PROCESANDO`, `FIRMADO`, `RECHAZADO`, `EXPIRADO`, `CANCELADO` |
| `b2_key_temporal` | texto | por omisión: vacío; hasta 500 caracteres |
| `b2_key_firmado` | texto | por omisión: vacío; hasta 500 caracteres |
| `firma_trabajador_imagen` | texto | por omisión: vacío |
| `ip_firmante` | ip | admite nulo |
| `email_firmante` | correo | por omisión: vacío |
| `sesion_token_trabajador` | uuid | admite nulo |
| `verificacion` | texto | por omisión: vacío; opciones: `CODIGO_CORREO`, `CLAVE_PORTAL` |
| `intentos_clave` | entero | por omisión: `0` |
| `ultimo_intento_clave` | fecha_hora | admite nulo |
| `enviado_en` | fecha_hora | se fija al crear |
| `firmado_en` | fecha_hora | admite nulo |
| `expira_en` | fecha_hora |  |
| `motivo_rechazo` | texto | por omisión: vacío |
| `folio` | texto | por omisión: vacío; hasta 20 caracteres |
| `hash_original` | texto | por omisión: vacío; hasta 64 caracteres |
| `hash_firmado` | texto | por omisión: vacío; hasta 64 caracteres |
| `incluye_consentimiento` | booleano | por omisión: no |
| `creado_en` | fecha_hora | se fija al crear |
| `actualizado_en` | fecha_hora | se actualiza al guardar |

#### `OTPFirma` {.unnumbered}

Tabla `core_otpfirma`. Código de un solo uso que confirma la identidad del trabajador antes de firmar.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `solicitud` | relación | Referencia a `SolicitudFirma`; al borrar: CASCADE |
| `codigo_hash` | texto | por omisión: vacío; hasta 64 caracteres |
| `email_destino` | correo |  |
| `creado_en` | fecha_hora | se fija al crear |
| `expira_en` | fecha_hora |  |
| `verificado` | booleano | por omisión: no |
| `intentos` | entero | por omisión: `0` |

## Vacaciones, permisos, conciliación y término {.unnumbered}

#### `VacacionEmpleado` {.unnumbered}

Tabla `core_vacacionempleado`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE |
| `fecha_inicio` | fecha |  |
| `fecha_fin` | fecha |  |
| `dias_habiles` | entero | por omisión: `0` |
| `horas_compensatorias` | decimal | por omisión: `0` |
| `tipo` | texto | por omisión: `VACACION_LEGAL`; opciones: `VACACION_LEGAL`, `VACACION_PROGRESIVA`, `PERMISO_SIN_GOCE`, `DIA_COMPENSATORIO` |
| `estado` | texto | por omisión: `APROBADO`; opciones: `PENDIENTE`, `APROBADO`, `RECHAZADO` |
| `observaciones` | texto | por omisión: vacío |
| `archivo_pdf` | archivo | admite nulo |
| `creado_en` | fecha_hora | se fija al crear |
| `origen` | texto | por omisión: `PANEL`; opciones: `PANEL`, `PORTAL` |
| `motivo_rechazo` | texto | por omisión: vacío; opciones: `NECESIDADES_EMPRESA`, `COINCIDE_OTRO`, `SIN_SALDO`, `OTRAS_FECHAS` |
| `respondida_en` | fecha_hora | admite nulo |

#### `SolicitudPermiso` {.unnumbered}

Tabla `core_solicitudpermiso`. Permiso legal con goce (Art. 66, 195, 207 bis) pedido desde el portal. Al aprobarlo se crea la constancia PERMISO_LEGAL (DocumentoLaboral), que se envía a firma.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `permiso` | texto | hasta 30 caracteres |
| `fecha_hecho` | fecha |  |
| `inicio` | fecha | admite nulo |
| `estado` | texto | por omisión: `PENDIENTE`; opciones: `PENDIENTE`, `APROBADA`, `RECHAZADA` |
| `motivo_rechazo` | texto | por omisión: vacío; opciones: `FALTA_CERTIFICADO`, `YA_USADO`, `NO_CORRESPONDE` |
| `documento` | relación | Referencia a `DocumentoLaboral`; al borrar: SET_NULL; admite nulo |
| `creada_en` | fecha_hora | se fija al crear |
| `respondida_en` | fecha_hora | admite nulo |

#### `SolicitudConciliacion` {.unnumbered}

Tabla `core_solicitudconciliacion`. Lo que pide un trabajador con responsabilidades de cuidado (Ley 21.645), con el plazo legal para responder: teletrabajo 15 días (Art. 152 quáter O bis) y cambio transitorio de turnos o jornada en vacaciones escolares 10 días, propuesto con 30 de anticipación (Art. 207 ter). Días corridos. El empleador registra la solicitud (la recibe por escrito) y su respuesta; si rechaza u ofrece otra fórmula, debe fundarla.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `tipo` | texto | opciones: `TELETRABAJO`, `CAMBIO_JORNADA` |
| `presentada_el` | fecha |  |
| `desde` | fecha | admite nulo; Inicio propuesto (cambio de jornada) |
| `hasta` | fecha | admite nulo |
| `estado` | texto | por omisión: `PENDIENTE`; opciones: `PENDIENTE`, `ACEPTADA`, `ALTERNATIVA`, `RECHAZADA` |
| `motivo` | texto | por omisión: vacío; opciones: `CARGO_NO_PERMITE`, `FUNCIONAMIENTO`, `TURNOS`, `SEGURIDAD`, `NO_ACREDITA_CUIDADO` |
| `fundamento` | texto | por omisión: vacío; hasta 500 caracteres; Circunstancias que justifican rechazar u ofrecer otra fórmula |
| `respondida_el` | fecha | admite nulo |
| `activo` | booleano | por omisión: sí |
| `creada_en` | fecha_hora | se fija al crear |
| `origen` | texto | por omisión: `PANEL`; opciones: `PANEL`, `PORTAL` |
| `cuidado_declarado` | texto | por omisión: vacío; opciones: `MENOR_14`, `MENOR_18_DISCAPACIDAD`, `DISCAPACIDAD`, `DEPENDENCIA` |

#### `Finiquito` {.unnumbered}

Tabla `core_finiquito`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `documento_legal` | relación | Referencia a `DocumentoLegal`; al borrar: SET_NULL; admite nulo |
| `causal_articulo` | texto | por omisión: vacío; 22 opciones (anexo F) |
| `fecha_termino` | fecha |  |
| `fecha_emision` | fecha |  |
| `sueldo_base` | entero | por omisión: `0` |
| `dias_trabajados_ultimo_mes` | entero | por omisión: `30` |
| `gratificacion_proporcional` | entero | por omisión: `0` |
| `feriado_proporcional` | entero | por omisión: `0` |
| `indemnizacion_anos_servicio` | entero | por omisión: `0` |
| `indemnizacion_sustitutiva_aviso` | entero | por omisión: `0` |
| `otros_haberes` | entero | por omisión: `0` |
| `otros_descuentos` | entero | por omisión: `0` |
| `descuentos_prevision` | entero | por omisión: `0` |
| `total_a_pagar` | entero | por omisión: `0` |
| `aviso_previo_dado` | booleano | por omisión: no |
| `modalidad` | texto | por omisión: `PRESENCIAL`; opciones: `PRESENCIAL`, `ELECTRONICO` |
| `ratificado_en` | fecha | admite nulo |
| `ratificado_via` | texto | por omisión: vacío; opciones: `MI_DT`, `INSPECCION`, `NOTARIO`, `REGISTRO_CIVIL`, `SECRETARIO_MUNICIPAL` |
| `archivo_pdf` | archivo | admite nulo |
| `creado_en` | fecha_hora | se fija al crear |
| `actualizado_en` | fecha_hora | se actualiza al guardar |

## Portal del trabajador {.unnumbered}

#### `CuentaTrabajador` {.unnumbered}

Tabla `core_cuentatrabajador`. Acceso de una persona al portal: su RUT y los correos que demostró recibir.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `rut` | texto | hasta 12 caracteres; RUT sin puntos ni guion (limpio) |
| `password` | texto | por omisión: vacío; hasta 128 caracteres |
| `invitacion_clave_vista` | booleano | por omisión: no |
| `version_sesion` | entero | por omisión: `1` |
| `ultimo_ingreso` | fecha_hora | admite nulo |
| `creado_en` | fecha_hora | se fija al crear |

#### `CorreoTrabajador` {.unnumbered}

Tabla `core_correotrabajador`. Correo que el trabajador demostró recibir (ingresó el código enviado ahí).

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `CuentaTrabajador`; al borrar: CASCADE |
| `email` | correo |  |
| `verificado_en` | fecha_hora | se actualiza al guardar |

Unicidad: `correo_trabajador_unico: cuenta, email`.

#### `CodigoTrabajador` {.unnumbered}

Tabla `core_codigotrabajador`. Código de 6 dígitos enviado por correo para entrar al portal o verificar un correo más. Se guarda solo su huella.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `rut` | texto | hasta 12 caracteres |
| `huella` | texto | hasta 64 caracteres |
| `correos` | json | por omisión: `[]` |
| `intentos` | entero | por omisión: `0` |
| `usado` | booleano | por omisión: no |
| `expira_en` | fecha_hora |  |
| `creado_en` | fecha_hora | se fija al crear |

#### `SolicitudDocumento` {.unnumbered}

Tabla `core_solicituddocumento`. Documento que el trabajador pide desde su portal. Solo se ofrecen los que Jornada40 genera y que aún no existen o no se han enviado a firma; no hay texto libre. Se resuelven solos cuando el empleador envía el documento a firma (ese correo es el aviso al trabajador); el empleador puede descartarlas eligiendo un motivo.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `cuenta` | relación | Referencia a `CuentaTrabajador`; al borrar: SET_NULL; admite nulo |
| `tipo` | texto | opciones: `LIQUIDACION`, `CONTRATO`, `ANEXO_40H`, `VACACION`, `FINIQUITO` |
| `mes` | entero | admite nulo |
| `anio` | entero | admite nulo |
| `vacacion` | relación | Referencia a `VacacionEmpleado`; al borrar: SET_NULL; admite nulo |
| `estado` | texto | por omisión: `PENDIENTE`; opciones: `PENDIENTE`, `RESUELTA`, `DESCARTADA` |
| `motivo` | texto | por omisión: vacío; opciones: `ENTREGADO_PAPEL`, `SIN_REMUNERACION`, `FUERA_DE_RELACION`, `NO_CORRESPONDE`; Por qué se descartó (lo ve el trabajador) |
| `creada_en` | fecha_hora | se fija al crear |
| `resuelta_en` | fecha_hora | admite nulo |

#### `CertificadoEmitido` {.unnumbered}

Tabla `core_certificadoemitido`. Certificado que el trabajador genera desde su portal, sin intervención del empleador. `datos` guarda exactamente lo que el certificado afirma: el PDF se reconstruye desde ahí (misma versión siempre) y la página pública de verificación lo muestra con el código impreso en el documento.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empleado` | relación | Referencia a `Empleado`; al borrar: CASCADE |
| `cuenta` | relación | Referencia a `CuentaTrabajador`; al borrar: SET_NULL; admite nulo |
| `tipo` | texto | opciones: `ANTIGUEDAD`, `RENTA`, `VACACIONES`, `JORNADA`, `TERMINO`, `COTIZACIONES` |
| `opcion` | texto | por omisión: vacío; hasta 10 caracteres |
| `codigo` | texto | único; hasta 14 caracteres; Código de verificación impreso en el PDF |
| `datos` | json | por omisión: `{}` |
| `emitido_en` | fecha_hora | se fija al crear |
| `anulado_en` | fecha_hora | admite nulo |
| `motivo_anulacion` | texto | por omisión: vacío; opciones: `DATO_ERRONEO`, `EMITIDO_POR_ERROR`, `RELACION_MODIFICADA` |

## Registro en Mi DT y fiscalización {.unnumbered}

#### `RegistroDT` {.unnumbered}

Tabla `core_registrodt`. Constancia de que un contrato, anexo o término quedó registrado en Mi DT (Ley 21.327). `clave` identifica lo registrado: CONTRATO:<id>, ANEXO:<id>, ANEXO40H:<solicitud>, TERMINO:<finiquito> o TERMINO_EMP:<empleado>.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE |
| `clave` | texto | hasta 40 caracteres |
| `registrado_en` | fecha |  |
| `creado_en` | fecha_hora | se fija al crear |
| `via` | texto | por omisión: `MANUAL`; opciones: `MANUAL`, `EXTENSION` |
| `comprobante` | texto | por omisión: vacío; hasta 60 caracteres |
| `registrado_por` | relación | Referencia a `User`; al borrar: SET_NULL; admite nulo |

Unicidad: `registro_dt_unico: empresa, clave`.

#### `CodigoInspeccion` {.unnumbered}

Tabla `core_codigoinspeccion`.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE |
| `correo` | correo |  |
| `nombre` | texto | hasta 150 caracteres |
| `rut_inspector` | texto | hasta 12 caracteres |
| `huella` | texto | hasta 64 caracteres |
| `intentos` | entero | por omisión: `0` |
| `usado` | booleano | por omisión: no |
| `expira_en` | fecha_hora |  |
| `creado_en` | fecha_hora | se fija al crear |

#### `RegistroInspeccion` {.unnumbered}

Tabla `core_registroinspeccion`. Bitácora de la fiscalización: ingresos, consultas, descargas y ratificaciones.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE |
| `correo` | correo |  |
| `nombre` | texto | hasta 150 caracteres |
| `rut_inspector` | texto | hasta 12 caracteres |
| `accion` | texto | opciones: `INGRESO`, `DESCARGA`, `RATIFICACION`, `SALIDA` |
| `detalle` | texto | por omisión: vacío; hasta 255 caracteres |
| `ip` | texto | por omisión: vacío; hasta 64 caracteres |
| `creado_en` | fecha_hora | se fija al crear |

#### `RatificacionInspeccion` {.unnumbered}

Tabla `core_ratificacioninspeccion`. Firma de un inspector sobre un documento, en terreno, con su sola identificación.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `empresa` | relación | Referencia a `Empresa`; al borrar: CASCADE |
| `clave` | texto | hasta 40 caracteres; Documento: <tipo>:<id>, como lo lista el portal |
| `titulo` | texto | hasta 200 caracteres |
| `inspector_nombre` | texto | hasta 150 caracteres |
| `inspector_rut` | texto | hasta 12 caracteres |
| `inspector_correo` | correo |  |
| `firma_imagen` | texto |  |
| `ip` | texto | por omisión: vacío; hasta 64 caracteres |
| `ratificado_en` | fecha_hora | se fija al crear |

## Extensión para Mi DT {.unnumbered}

#### `DispositivoExtension` {.unnumbered}

Tabla `core_dispositivoextension`. Navegador conectado a la extensión "Jornada40 para Mi DT".

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: CASCADE |
| `persona` | relación | Referencia a `User`; al borrar: CASCADE |
| `nombre` | texto | hasta 80 caracteres |
| `token_hash` | texto | único; hasta 64 caracteres |
| `creado_en` | fecha_hora | se fija al crear |
| `ultimo_uso` | fecha_hora | admite nulo |
| `revocado_en` | fecha_hora | admite nulo |

#### `CodigoExtension` {.unnumbered}

Tabla `core_codigoextension`. Código de un solo uso (10 minutos) para conectar la extensión desde el panel. Se guarda su huella HMAC, no el código.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: CASCADE |
| `persona` | relación | Referencia a `User`; al borrar: CASCADE |
| `codigo_hash` | texto | hasta 64 caracteres |
| `creado_en` | fecha_hora | se fija al crear |
| `expira_en` | fecha_hora |  |
| `usado` | booleano | por omisión: no |

#### `LevantamientoMiDT` {.unnumbered}

Tabla `core_levantamientomidt`. Estructura de una pantalla de Mi DT enviada desde la extensión (modo levantamiento): etiquetas, identificadores, tipos y opciones de los campos, sin ningún valor escrito. Con esto se arman los mapeos (core/datos/mapeos_midt.json).

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: CASCADE |
| `persona` | relación | Referencia a `User`; al borrar: SET_NULL; admite nulo |
| `ruta` | texto | hasta 300 caracteres |
| `titulo` | texto | por omisión: vacío; hasta 200 caracteres |
| `version_extension` | texto | por omisión: vacío; hasta 20 caracteres |
| `estructura` | json | por omisión: `{}` |
| `creado_en` | fecha_hora | se fija al crear |

## Usuarios del equipo y bitácora {.unnumbered}

#### `UsuarioEquipo` {.unnumbered}

Tabla `core_usuarioequipo`. Persona del equipo que el titular invita al panel (tabla aparte de los clientes).

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: PROTECT |
| `usuario` | relación | Uno a uno con `User`; al borrar: PROTECT |
| `rut` | texto | hasta 12 caracteres; Formato 12.345.678-5 |
| `nombres` | texto | hasta 100 caracteres |
| `apellidos` | texto | por omisión: vacío; hasta 150 caracteres |
| `correo` | correo |  |
| `permisos` | json | por omisión: `{}` |
| `estado` | texto | por omisión: `INVITADO`; opciones: `INVITADO`, `ACTIVO`, `ELIMINADO` |
| `invitado_en` | fecha_hora | admite nulo |
| `activado_en` | fecha_hora | admite nulo |
| `eliminado_en` | fecha_hora | admite nulo |
| `frecuencia_resumen` | texto | por omisión: `SEMANAL`; opciones: `DIARIA`, `SEMANAL`, `NUNCA` |
| `resumen_hasta` | fecha_hora | admite nulo |
| `creado_en` | fecha_hora | se fija al crear |
| `empresas` | relación | Muchos a muchos con `Empresa` |

#### `RegistroBitacora` {.unnumbered}

Tabla `core_registrobitacora`. Acción hecha en el panel de una cuenta, para presentar ante una fiscalización.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: PROTECT |
| `actor` | relación | Referencia a `User`; al borrar: SET_NULL; admite nulo |
| `actor_tipo` | texto | opciones: `TITULAR`, `EQUIPO`, `SISTEMA` |
| `actor_nombre` | texto | hasta 150 caracteres |
| `actor_rut` | texto | por omisión: vacío; hasta 15 caracteres |
| `empresa` | relación | Referencia a `Empresa`; al borrar: SET_NULL; admite nulo |
| `accion` | texto | hasta 40 caracteres |
| `descripcion` | texto | hasta 300 caracteres |
| `metodo` | texto | por omisión: vacío; hasta 8 caracteres |
| `ruta` | texto | por omisión: vacío; hasta 200 caracteres |
| `estado_http` | entero | admite nulo |
| `ip` | texto | por omisión: vacío; hasta 64 caracteres |
| `creado_en` | fecha_hora |  |
| `hash_anterior` | texto | por omisión: vacío; hasta 64 caracteres |
| `hash` | texto | único; hasta 64 caracteres |

#### `ExportacionBitacora` {.unnumbered}

Tabla `core_exportacionbitacora`. Copia de la bitácora descargada en PDF o Excel para presentarla (p. ej. a la DT).

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: PROTECT |
| `numero` | entero | Correlativo por cuenta |
| `codigo` | texto | único; hasta 14 caracteres |
| `formato` | texto | opciones: `PDF`, `XLSX` |
| `empresa` | relación | Referencia a `Empresa`; al borrar: SET_NULL; admite nulo |
| `desde` | fecha | admite nulo |
| `hasta` | fecha | admite nulo |
| `persona` | texto | por omisión: vacío; hasta 15 caracteres; RUT de la persona filtrada, si hubo |
| `registros` | entero |  |
| `primer_registro` | entero | admite nulo |
| `ultimo_registro` | entero | admite nulo |
| `huella` | texto | hasta 64 caracteres |
| `generado_por` | relación | Referencia a `User`; al borrar: SET_NULL; admite nulo |
| `generado_por_nombre` | texto | hasta 150 caracteres |
| `creado_en` | fecha_hora | se fija al crear |

Unicidad: `exportacion_bitacora_numero_unico: cuenta, numero`.

## Ley Karin {.unnumbered}

#### `EncargadoKarin` {.unnumbered}

Tabla `core_encargadokarin`. Encargado de recibir y gestionar las denuncias de la Ley Karin (Ley 21.643).

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: PROTECT |
| `usuario` | relación | Uno a uno con `User`; al borrar: PROTECT |
| `rut` | texto | hasta 12 caracteres; Formato 12.345.678-5 |
| `nombres` | texto | hasta 100 caracteres |
| `apellidos` | texto | por omisión: vacío; hasta 150 caracteres |
| `correo` | correo |  |
| `estado` | texto | por omisión: `INVITADO`; opciones: `INVITADO`, `ACTIVO`, `ELIMINADO` |
| `version_sesion` | entero | por omisión: `1` |
| `invitado_en` | fecha_hora | admite nulo |
| `activado_en` | fecha_hora | admite nulo |
| `eliminado_en` | fecha_hora | admite nulo |
| `aviso_plazos_en` | fecha | admite nulo |
| `creado_en` | fecha_hora | se fija al crear |
| `empresas` | relación | Muchos a muchos con `Empresa` |

#### `DenunciaKarin` {.unnumbered}

Tabla `core_denunciakarin`. Denuncia de acoso sexual, acoso laboral o violencia en el trabajo (Ley 21.643, DS 21 de 2024).

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: PROTECT |
| `empresa` | relación | Referencia a `Empresa`; al borrar: PROTECT |
| `numero` | entero | Correlativo por empresa |
| `tipo` | texto | opciones: `ACOSO_SEXUAL`, `ACOSO_LABORAL`, `VIOLENCIA` |
| `canal` | texto | opciones: `ESCRITA`, `VERBAL`, `ELECTRONICA` |
| `recibida_en` | fecha_hora |  |
| `registrada_por` | relación | Referencia a `EncargadoKarin`; al borrar: SET_NULL; admite nulo |
| `estado` | texto | por omisión: `RECIBIDA`; opciones: `RECIBIDA`, `INVESTIGACION`, `DERIVADA_DT`, `INFORME`, `REVISION_DT`, `MEDIDAS`, `CERRADA` |
| `pide_derivar_dt` | booleano | por omisión: no |
| `origen` | texto | por omisión: `ENCARGADO`; opciones: `ENCARGADO`, `PORTAL` |
| `datos` | JSONCifrado |  |
| `resguardo` | JSONCifrado | admite nulo |
| `investigacion` | JSONCifrado | admite nulo |
| `informe` | JSONCifrado | admite nulo |
| `medidas` | JSONCifrado | admite nulo |
| `hitos` | json | por omisión: `{}` |
| `creado_en` | fecha_hora | se fija al crear |
| `actualizado_en` | fecha_hora | se actualiza al guardar |

Unicidad: `denuncia_karin_numero_unico: empresa, numero`.

#### `ArchivoKarin` {.unnumbered}

Tabla `core_archivokarin`. Archivo de un expediente Ley Karin (escaneo de un acta firmada, denuncia escrita…). Se guarda cifrado en B2; aquí quedan su nombre (cifrado), tamaño y huella.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `denuncia` | relación | Referencia a `DenunciaKarin`; al borrar: PROTECT |
| `tipo` | texto | opciones: `DENUNCIA_ESCRITA`, `ACTA_VERBAL`, `ACTA_DECLARACION`, `ANTECEDENTE`, `COMPROBANTE_DT`, `PRONUNCIAMIENTO_DT`, `NOTIFICACION` |
| `participante` | texto | por omisión: vacío; hasta 12 caracteres |
| `nombre` | TextoCifrado |  |
| `clave` | texto | hasta 200 caracteres |
| `tamano` | entero |  |
| `huella` | texto | hasta 64 caracteres; SHA-256 del archivo original |
| `subido_por` | relación | Referencia a `EncargadoKarin`; al borrar: SET_NULL; admite nulo |
| `subido_en` | fecha_hora | se fija al crear |
| `activo` | booleano | por omisión: sí |

#### `RegistroKarin` {.unnumbered}

Tabla `core_registrokarin`. Bitácora reservada del acceso Ley Karin, aparte de la del panel.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `cuenta` | relación | Referencia a `User`; al borrar: PROTECT |
| `encargado` | relación | Referencia a `EncargadoKarin`; al borrar: SET_NULL; admite nulo |
| `actor_nombre` | texto | hasta 150 caracteres |
| `actor_rut` | texto | por omisión: vacío; hasta 15 caracteres |
| `accion` | texto | hasta 40 caracteres |
| `descripcion` | TextoCifrado |  |
| `ip` | texto | por omisión: vacío; hasta 64 caracteres |
| `creado_en` | fecha_hora |  |
| `hash_anterior` | texto | por omisión: vacío; hasta 64 caracteres |
| `hash` | texto | único; hasta 64 caracteres |

## Parámetros legales {.unnumbered}

#### `ParametroPrevisional` {.unnumbered}

Tabla `core_parametroprevisional`. Parámetros legales del sistema previsional chileno, versionados por período.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `vigente_desde` | fecha | único; Primer día del período en que rigen estos valores |
| `tope_imponible_afp_uf` | decimal | por omisión: `87.8` |
| `tope_imponible_afc_uf` | decimal | por omisión: `131.9` |
| `ingreso_minimo_mensual` | entero | por omisión: `529000` |
| `factor_gratificacion` | decimal | por omisión: `4.75` |
| `tasa_salud` | decimal | por omisión: `0.07` |
| `tasa_afc_trabajador_indefinido` | decimal | por omisión: `0.006` |
| `tasa_afc_empleador_indefinido` | decimal | por omisión: `0.024` |
| `tasa_afc_empleador_plazo` | decimal | por omisión: `0.03` |
| `tasa_sis` | decimal | por omisión: `0.0149` |
| `tasa_mutual_base` | decimal | por omisión: `0.0093` |
| `tasa_expectativa_vida` | decimal | por omisión: `0.0072` |
| `tasa_rentabilidad_protegida` | decimal | por omisión: `0.009` |
| `tasa_afp_empleador` | decimal | por omisión: `0.001` |
| `tasa_afc_empleador_11_anios` | decimal | por omisión: `0.008` |
| `origen` | texto | por omisión: `MANUAL`; opciones: `MANUAL`, `PREVIRED` |
| `confirmado` | booleano | por omisión: no |
| `notas` | texto | por omisión: vacío |

#### `TasaAFP` {.unnumbered}

Tabla `core_tasaafp`. Tasa de cotización de cada AFP, versionada por período.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `nombre` | texto | hasta 50 caracteres |
| `tasa` | decimal |  |
| `vigente_desde` | fecha |  |
| `origen` | texto | por omisión: `MANUAL`; opciones: `MANUAL`, `PREVIRED` |
| `confirmado` | booleano | por omisión: sí |

Unicidad: `nombre, vigente_desde`.

#### `TramoAsignacionFamiliar` {.unnumbered}

Tabla `core_tramoasignacionfamiliar`. Monto por carga de la asignación familiar según tramo de ingreso (Ley 18.987 y sus reajustes; la SUSESO publica cada cambio). Versionado por fecha, como los demás parámetros: una liquidación usa el que regía en su período. El tramo del trabajador lo determina el IPS; aquí solo el monto.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `vigente_desde` | fecha |  |
| `tramo` | texto | opciones: `A`, `B`, `C` |
| `monto` | entero | Monto mensual por carga (las cargas por invalidez reciben el doble) |
| `renta_hasta` | entero | Ingreso mensual máximo del beneficiario para este tramo |
| `fuente` | texto | por omisión: vacío; hasta 200 caracteres |

Unicidad: `tramo_af_unico: vigente_desde, tramo`.

#### `FactorActualizacionSII` {.unnumbered}

Tabla `core_factoractualizacionsii`. Factor de actualización de cada mes de un año comercial (publicado por el SII para la Operación Renta: 1 + variación del IPC hasta fin de noviembre). Se carga en el admin cuando el SII lo publica; sin los 12 meses no se emiten certificados.

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `anio` | entero |  |
| `mes` | entero |  |
| `factor` | decimal |  |

Unicidad: `anio, mes`.

#### `PeriodoVacacionesEscolares` {.unnumbered}

Tabla `core_periodovacacionesescolares`. Vacaciones escolares del calendario del Mineduc (se cargan en el admin cada año). Las usan los avisos de cuidado: quien cuida a menores tiene preferencia para su feriado en estos períodos (Ley 21.645).

| Campo | Tipo | Detalle |
|---|---|---|
| `id` | entero | identificador |
| `nombre` | texto | hasta 80 caracteres; Ej.: Vacaciones de invierno 2027 |
| `desde` | fecha |  |
| `hasta` | fecha |  |
| `regiones` | texto | por omisión: vacío; hasta 200 caracteres; Vacío: todo el país. Si no, las regiones a las que aplica |

