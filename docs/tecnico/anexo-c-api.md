# Anexo C. Rutas de la API {.unnumbered #sec-anexo-c}

Las 220 rutas bajo `/api/`, generadas con `herramientas/anexos.py` desde el enrutador de Django. Las convenciones, los códigos de estado y los límites de intentos están en la sección 7.2. Columnas:

- **Métodos:** los que admite la ruta.
- **Vista:** la función o clase que la atiende; en las de DRF, también sus acciones.
- **Acceso:** quién la abre (sección 4.7). *Panel* pide la sesión del titular o de un usuario del equipo; *Portal*, *Ley Karin*, *Fiscalización* y *Extensión* piden la sesión o el token de ese acceso, y «sin sesión» marca sus rutas de ingreso; *Firma pública* pide el enlace de la solicitud y, para ver el documento y firmar, el código o la clave; *Público* no pide sesión.
- **Módulo:** en el panel, el módulo que exige a un usuario del equipo (sección 8.3); con dos, basta uno. «Lectura común» se abre a todo el equipo solo para consultar; «Identidad de la persona» actúa sobre la propia persona; «Solo el titular», solo para el dueño de la cuenta.

**Rutas auxiliares.** `auth/password/reset/` responde 410: la recuperación por correo está cerrada y se recupera por RUT. `diagnostico/red/` responde solo con `DIAGNOSTICO_RED=1`.

**Sin borrado.** **[Solo en staging]** Las rutas de trabajadores, contratos, liquidaciones, cartas, finiquitos y vacaciones no admiten DELETE (405): esos registros respaldan firmas y obligaciones laborales, y no se borran (sección 6.4.2).

#### `/api/anexos_contrato/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/anexos_contrato/` | AnexoContratoViewSet (create, list) | Panel | Contratos y anexos |
| DELETE, GET, PATCH, PUT | `/api/anexos_contrato/{pk}/` | AnexoContratoViewSet (destroy, partial_update, retrieve, update) | Panel | Contratos y anexos |
| GET | `/api/anexos_contrato/{pk}/generar_pdf/` | AnexoContratoViewSet (generar_pdf) | Panel | Contratos y anexos |

#### `/api/auth/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| POST | `/api/auth/codigo-prueba/` | revisar_codigo_prueba | Público | — |
| POST | `/api/auth/equipo/clave/` | clave_equipo | Público | — |
| POST | `/api/auth/equipo/ingresar/` | ingresar_equipo | Público | — |
| POST | `/api/auth/equipo/recuperar/` | recuperar_equipo | Público | — |
| POST | `/api/auth/login/` | ThrottledLoginView | Público | — |
| GET, POST | `/api/auth/logout/` | LogoutView | Público | — |
| POST | `/api/auth/password/change/` | PasswordChangeView | Panel | Identidad de la persona |
| POST | `/api/auth/password/reset/` | recuperacion_por_correo_cerrada | Público | — |
| POST | `/api/auth/password/reset/confirm/` | PasswordResetConfirmView | Público | — |
| POST | `/api/auth/recuperar-por-rut/` | recuperar_password_por_rut | Público | — |
| POST | `/api/auth/register/` | registrar_cliente | Público | — |
| GET | `/api/auth/sesion/` | sesion | Panel | Identidad de la persona |
| POST | `/api/auth/token/refresh/` | RefreshViewWithCookieSupport | Público | — |
| POST | `/api/auth/token/verify/` | TokenVerifyView | Público | — |
| GET, PATCH, PUT | `/api/auth/user/` | UserDetailsView | Panel | Identidad de la persona |

#### `/api/bitacora/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/bitacora/` | bitacora | Panel | Solo el titular |
| GET | `/api/bitacora/exportar/` | exportar_bitacora | Panel | Solo el titular |
| GET | `/api/bitacora/verificar/` | verificar_bitacora | Panel | Solo el titular |

#### `/api/catalogos/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/catalogos/trabajador/` | catalogos_trabajador | Panel | Lectura común |

#### `/api/certificados/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/certificados/motivos-anulacion/` | motivos_anulacion_certificado | Panel | Trabajadores |
| GET | `/api/certificados/verificar/{codigo}/` | verificar_certificado | Público | — |
| POST | `/api/certificados/{certificado_id}/anular/` | anular_certificado | Panel | Trabajadores |
| GET | `/api/certificados/{certificado_id}/pdf/` | descargar_certificado_empleador | Panel | Trabajadores |

#### `/api/certificados-sueldos/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/certificados-sueldos/` | estado | Panel | Remuneraciones |
| POST | `/api/certificados-sueldos/emitir/` | emitir_vista | Panel | Remuneraciones |
| GET | `/api/certificados-sueldos/resumen-dj1887/` | resumen_dj1887 | Panel | Remuneraciones |
| GET | `/api/certificados-sueldos/zip/` | zip_vista | Panel | Remuneraciones |
| GET | `/api/certificados-sueldos/{certificado_id}/pdf/` | pdf_vista | Panel | Remuneraciones |

#### `/api/clientes/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/clientes/mi_suscripcion/` | mi_suscripcion | Panel | Lectura común |
| GET, PATCH, PUT | `/api/clientes/perfil/` | perfil_usuario | Panel | Solo el titular |
| GET, PATCH | `/api/clientes/resumen/` | preferencia_resumen | Panel | Identidad de la persona |

#### `/api/conceptos/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/conceptos/` | ConceptoRemuneracionViewSet (create, list) | Panel | Remuneraciones |
| GET | `/api/conceptos/codigos_lre/` | ConceptoRemuneracionViewSet (codigos_lre) | Panel | Remuneraciones |
| DELETE, GET, PATCH, PUT | `/api/conceptos/{pk}/` | ConceptoRemuneracionViewSet (destroy, partial_update, retrieve, update) | Panel | Remuneraciones |

#### `/api/contratos/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/contratos/` | ContratoViewSet (create, list) | Panel | Contratos y anexos |
| POST | `/api/contratos/evaluar-jornada/` | ContratoViewSet (evaluar_jornada) | Panel | Contratos y anexos |
| GET, PATCH, PUT | `/api/contratos/{pk}/` | ContratoViewSet (partial_update, retrieve, update) | Panel | Contratos y anexos |
| GET | `/api/contratos/{pk}/descargar_anexo_40h/` | ContratoViewSet (descargar_anexo_40h) | Panel | Contratos y anexos |
| GET | `/api/contratos/{pk}/descargar_contrato/` | ContratoViewSet (descargar_contrato) | Panel | Contratos y anexos |
| GET | `/api/contratos/{pk}/generar_anexo/` | ContratoViewSet (generar_anexo) | Panel | Contratos y anexos |
| POST | `/api/contratos/{pk}/generar_anexo_40h/` | ContratoViewSet (generar_anexo_40h) | Panel | Contratos y anexos |
| POST | `/api/contratos/{pk}/generar_contrato_pdf/` | ContratoViewSet (generar_contrato_pdf) | Panel | Contratos y anexos |

#### `/api/diagnostico/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/diagnostico/red/` | diagnostico_red | Público | — |

#### `/api/documentos-laborales/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/documentos-laborales/` | DocumentoLaboralViewSet (create, list) | Panel | Según el tipo de documento |
| GET | `/api/documentos-laborales/opciones/` | DocumentoLaboralViewSet (opciones) | Panel | Según el tipo de documento |
| POST | `/api/documentos-laborales/{pk}/anular/` | DocumentoLaboralViewSet (anular) | Panel | Según el tipo de documento |
| GET | `/api/documentos-laborales/{pk}/generar_pdf/` | DocumentoLaboralViewSet (generar_pdf) | Panel | Según el tipo de documento |
| POST | `/api/documentos-laborales/{pk}/revocar/` | DocumentoLaboralViewSet (revocar) | Panel | Según el tipo de documento |

#### `/api/documentos_legales/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/documentos_legales/` | DocumentoLegalViewSet (create, list) | Panel | Según el tipo de documento |
| GET, PATCH, PUT | `/api/documentos_legales/{pk}/` | DocumentoLegalViewSet (partial_update, retrieve, update) | Panel | Según el tipo de documento |
| GET | `/api/documentos_legales/{pk}/generar_pdf/` | DocumentoLegalViewSet (generar_pdf) | Panel | Según el tipo de documento |

#### `/api/empleados/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/empleados/` | EmpleadoViewSet (create, list) | Panel | Trabajadores |
| POST | `/api/empleados/carga_masiva/` | EmpleadoViewSet (carga_masiva) | Panel | Trabajadores |
| POST | `/api/empleados/descarga_masiva/` | EmpleadoViewSet (descarga_masiva) | Panel | Reportes y expedientes |
| POST | `/api/empleados/descargar_anexos_zip/` | EmpleadoViewSet (descargar_anexos_zip) | Panel | Reportes y expedientes |
| GET | `/api/empleados/{empleado_id}/certificados/` | certificados_empleado | Panel | Trabajadores |
| GET, PATCH, PUT | `/api/empleados/{pk}/` | EmpleadoViewSet (partial_update, retrieve, update) | Panel | Trabajadores |
| POST | `/api/empleados/{pk}/consentimiento/` | EmpleadoViewSet (consentimiento) | Panel | Dirección del Trabajo |
| POST | `/api/empleados/{pk}/digitalizar_contrato/` | EmpleadoViewSet (digitalizar_contrato) | Panel | Contratos y anexos |
| GET | `/api/empleados/{pk}/documentos_disponibles/` | EmpleadoViewSet (documentos_disponibles) | Panel | Trabajadores |
| GET | `/api/empleados/{pk}/historial_salarial/` | EmpleadoViewSet (historial_salarial) | Panel | Trabajadores |
| GET, POST | `/api/empleados/{pk}/portal/` | EmpleadoViewSet (portal) | Panel | Trabajadores |

#### `/api/empresas/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/empresas/` | EmpresaViewSet (create, list) | Panel | Lectura común; escribir, solo el titular |
| DELETE, GET, PATCH, PUT | `/api/empresas/{pk}/` | EmpresaViewSet (destroy, partial_update, retrieve, update) | Panel | Lectura común; escribir, solo el titular |
| PATCH | `/api/empresas/{pk}/configurar-firma/` | EmpresaViewSet (configurar_firma) | Panel | Solo el titular |
| POST | `/api/empresas/{pk}/reactivar/` | EmpresaViewSet (reactivar) | Panel | Solo el titular |

#### `/api/encargados-karin/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/encargados-karin/` | EncargadoKarinViewSet (create, list) | Panel | Solo el titular |
| GET | `/api/encargados-karin/resumen/` | EncargadoKarinViewSet (resumen) | Panel | Solo el titular |
| PATCH | `/api/encargados-karin/{pk}/` | EncargadoKarinViewSet (partial_update) | Panel | Solo el titular |
| POST | `/api/encargados-karin/{pk}/eliminar/` | EncargadoKarinViewSet (eliminar) | Panel | Solo el titular |
| POST | `/api/encargados-karin/{pk}/reenviar/` | EncargadoKarinViewSet (reenviar) | Panel | Solo el titular |

#### `/api/equipo/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/equipo/` | EquipoViewSet (create, list) | Panel | Solo el titular |
| PATCH | `/api/equipo/{pk}/` | EquipoViewSet (partial_update) | Panel | Solo el titular |
| POST | `/api/equipo/{pk}/eliminar/` | EquipoViewSet (eliminar) | Panel | Solo el titular |
| POST | `/api/equipo/{pk}/reenviar/` | EquipoViewSet (reenviar) | Panel | Solo el titular |

#### `/api/extension/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| POST | `/api/extension/codigo/` | crear_codigo | Panel | Dirección del Trabajo |
| GET | `/api/extension/dispositivos/` | dispositivos | Panel | Dirección del Trabajo |
| POST | `/api/extension/dispositivos/{pk}/desconectar/` | desconectar | Panel | Dirección del Trabajo |
| POST | `/api/extension/v1/levantamiento/` | levantamiento | Extensión | — |
| GET | `/api/extension/v1/mapeos/` | mapeos | Extensión | — |
| GET | `/api/extension/v1/registro/` | registro | Extensión | — |
| GET | `/api/extension/v1/registro/ficha/` | registro_ficha | Extensión | — |
| POST | `/api/extension/v1/registro/marcar/` | registro_marcar | Extensión | — |
| POST | `/api/extension/v1/salir/` | salir | Extensión | — |
| POST | `/api/extension/v1/vincular/` | vincular | Extensión, sin sesión | — |
| GET | `/api/extension/v1/yo/` | yo | Extensión | — |

#### `/api/finiquitos/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/finiquitos/` | FiniquitoViewSet (create, list) | Panel | Término de contrato |
| POST | `/api/finiquitos/simular/` | FiniquitoViewSet (simular) | Panel | Término de contrato |
| GET, PATCH, PUT | `/api/finiquitos/{pk}/` | FiniquitoViewSet (partial_update, retrieve, update) | Panel | Término de contrato |
| GET | `/api/finiquitos/{pk}/ficha_mi_dt/` | FiniquitoViewSet (ficha_mi_dt) | Panel | Término de contrato |
| GET | `/api/finiquitos/{pk}/generar_pdf/` | FiniquitoViewSet (generar_pdf) | Panel | Término de contrato |
| POST | `/api/finiquitos/{pk}/registrar_ratificacion/` | FiniquitoViewSet (registrar_ratificacion) | Panel | Término de contrato |

#### `/api/firma-publica/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/firma-publica/{token}/` | firma_publica_info | Firma pública | — |
| GET | `/api/firma-publica/{token}/documento/` | firma_publica_documento | Firma pública | — |
| POST | `/api/firma-publica/{token}/firmar/` | firma_publica_firmar | Firma pública | — |
| POST | `/api/firma-publica/{token}/rechazar/` | firma_publica_rechazar | Firma pública | — |
| POST | `/api/firma-publica/{token}/solicitar-otp/` | firma_publica_solicitar_otp | Firma pública | — |
| POST | `/api/firma-publica/{token}/verificar-clave/` | firma_publica_verificar_clave | Firma pública | — |
| POST | `/api/firma-publica/{token}/verificar-otp/` | firma_publica_verificar_otp | Firma pública | — |

#### `/api/firmas/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/firmas/` | SolicitudFirmaViewSet (list) | Panel | Según el tipo de documento |
| POST | `/api/firmas/confirmar_identidad/` | SolicitudFirmaViewSet (confirmar_identidad) | Panel | Identidad de la persona |
| POST | `/api/firmas/solicitar/` | SolicitudFirmaViewSet (solicitar) | Panel | Según el tipo de documento |
| POST | `/api/firmas/solicitar_liquidaciones/` | SolicitudFirmaViewSet (solicitar_liquidaciones) | Panel | Según el tipo de documento |
| PATCH | `/api/firmas/{pk}/cancelar/` | SolicitudFirmaViewSet (cancelar) | Panel | Según el tipo de documento |
| POST | `/api/firmas/{pk}/descargar/` | SolicitudFirmaViewSet (descargar) | Panel | Según el tipo de documento |
| POST | `/api/firmas/{pk}/reenviar/` | SolicitudFirmaViewSet (reenviar) | Panel | Según el tipo de documento |

#### `/api/indicadores/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/indicadores/` | indicadores_del_dia | Panel | Lectura común |

#### `/api/inspeccion/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/inspeccion/bitacora/` | bitacora_empleador | Panel | Dirección del Trabajo |
| GET | `/api/inspeccion/descargar/` | descargar | Fiscalización | — |
| GET | `/api/inspeccion/documentos/` | documentos | Fiscalización | — |
| POST | `/api/inspeccion/ingreso/` | ingreso | Fiscalización, sin sesión | — |
| POST | `/api/inspeccion/ratificar/` | ratificar | Fiscalización | — |
| POST | `/api/inspeccion/salir/` | salir | Fiscalización | — |
| GET | `/api/inspeccion/trabajadores/` | trabajadores | Fiscalización | — |
| POST | `/api/inspeccion/verificar/` | verificar | Fiscalización, sin sesión | — |
| GET | `/api/inspeccion/yo/` | yo | Fiscalización | — |

#### `/api/karin/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/karin/bitacora/` | bitacora | Ley Karin | — |
| GET | `/api/karin/bitacora/verificar/` | verificar_bitacora | Ley Karin | — |
| POST | `/api/karin/cambiar-clave/` | cambiar_clave | Ley Karin | — |
| POST | `/api/karin/clave/` | crear_clave | Ley Karin, sin sesión | — |
| GET, POST | `/api/karin/denuncias/` | DenunciaKarinViewSet (create, list) | Ley Karin | — |
| GET | `/api/karin/denuncias/catalogos/` | DenunciaKarinViewSet (catalogos) | Ley Karin | — |
| GET, PATCH | `/api/karin/denuncias/{pk}/` | DenunciaKarinViewSet (partial_update, retrieve) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/antecedentes/` | DenunciaKarinViewSet (antecedentes) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/archivos/` | DenunciaKarinViewSet (archivos) | Ley Karin | — |
| GET | `/api/karin/denuncias/{pk}/archivos/{archivo_id}/` | DenunciaKarinViewSet (descargar_archivo) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/cerrar/` | DenunciaKarinViewSet (cerrar) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/decidir/` | DenunciaKarinViewSet (decidir) | Ley Karin | — |
| GET | `/api/karin/denuncias/{pk}/documento/` | DenunciaKarinViewSet (documento) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/informe/` | DenunciaKarinViewSet (informe) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/investigador/` | DenunciaKarinViewSet (investigador) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/marcar/` | DenunciaKarinViewSet (marcar) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/medidas/` | DenunciaKarinViewSet (medidas) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/participantes/` | DenunciaKarinViewSet (participantes) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/pronunciamiento/` | DenunciaKarinViewSet (pronunciamiento) | Ley Karin | — |
| POST | `/api/karin/denuncias/{pk}/resguardo/` | DenunciaKarinViewSet (resguardo) | Ley Karin | — |
| POST | `/api/karin/ingresar/` | ingresar | Ley Karin, sin sesión | — |
| POST | `/api/karin/recuperar/` | recuperar | Ley Karin, sin sesión | — |
| POST | `/api/karin/salir/` | salir | Ley Karin | — |
| GET | `/api/karin/yo/` | yo | Ley Karin | — |

#### `/api/ley-karin/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/ley-karin/` | LeyKarinViewSet (list) | Panel | Reglamento y seguridad |
| POST | `/api/ley-karin/canal/` | LeyKarinViewSet (canal) | Panel | Reglamento y seguridad |
| POST | `/api/ley-karin/informar/` | LeyKarinViewSet (informar) | Panel | Reglamento y seguridad |

#### `/api/liquidaciones/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/liquidaciones/` | LiquidacionViewSet (create, list) | Panel | Remuneraciones |
| GET | `/api/liquidaciones/avisos_periodo/` | LiquidacionViewSet (avisos_periodo) | Panel | Remuneraciones |
| GET | `/api/liquidaciones/consolidado/` | LiquidacionViewSet (consolidado) | Panel | Remuneraciones o Reportes y expedientes |
| GET | `/api/liquidaciones/exportar_lre/` | LiquidacionViewSet (exportar_lre) | Panel | Remuneraciones |
| GET | `/api/liquidaciones/exportar_previred/` | LiquidacionViewSet (exportar_previred) | Panel | Remuneraciones |
| GET | `/api/liquidaciones/libro_remuneraciones/` | LiquidacionViewSet (libro_remuneraciones) | Panel | Remuneraciones o Reportes y expedientes |
| GET | `/api/liquidaciones/revisar_lre/` | LiquidacionViewSet (revisar_lre) | Panel | Remuneraciones |
| POST | `/api/liquidaciones/simular/` | LiquidacionViewSet (simular) | Panel | Remuneraciones |
| GET | `/api/liquidaciones/zip_periodo/` | LiquidacionViewSet (zip_periodo) | Panel | Remuneraciones o Reportes y expedientes |
| GET, PATCH, PUT | `/api/liquidaciones/{pk}/` | LiquidacionViewSet (partial_update, retrieve, update) | Panel | Remuneraciones |
| GET | `/api/liquidaciones/{pk}/generar_pdf/` | LiquidacionViewSet (generar_pdf) | Panel | Remuneraciones |

#### `/api/pagos/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| POST | `/api/pagos/bajar-plan/` | bajar_plan | Panel | Solo el titular |
| POST | `/api/pagos/cancelar-cambio/` | cancelar_cambio_plan | Panel | Solo el titular |
| POST | `/api/pagos/crear-checkout/` | crear_checkout_reveniu | Panel | Solo el titular |
| POST | `/api/pagos/reanudar/` | reanudar_renovacion | Panel | Solo el titular |
| POST | `/api/pagos/webhook/reveniu/` | webhook_reveniu | Público | — |

#### `/api/parametros/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/parametros/vigentes/` | parametros_vigentes | Panel | Lectura común |

#### `/api/peticiones-portal/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/peticiones-portal/` | peticiones_empleador | Panel | Vacaciones y permisos o Trabajadores |

#### `/api/planes/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/planes/` | PlanViewSet (list) | Público | — |
| GET | `/api/planes/{pk}/` | PlanViewSet (retrieve) | Público | — |

#### `/api/registro-dt/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/registro-dt/` | RegistroDTViewSet (list) | Panel | Dirección del Trabajo |
| POST | `/api/registro-dt/anexos_consentimiento/` | RegistroDTViewSet (anexos_consentimiento) | Panel | Dirección del Trabajo |
| GET | `/api/registro-dt/csv/` | RegistroDTViewSet (csv) | Panel | Dirección del Trabajo |
| POST | `/api/registro-dt/desmarcar/` | RegistroDTViewSet (desmarcar) | Panel | Dirección del Trabajo |
| GET | `/api/registro-dt/ficha/` | RegistroDTViewSet (ficha) | Panel | Dirección del Trabajo |
| POST | `/api/registro-dt/marcar/` | RegistroDTViewSet (marcar) | Panel | Dirección del Trabajo |

#### `/api/reglamentos/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/reglamentos/` | ReglamentoViewSet (create, list) | Panel | Reglamento y seguridad |
| POST | `/api/reglamentos/informar_riesgos/` | ReglamentoViewSet (informar_riesgos) | Panel | Reglamento y seguridad |
| GET | `/api/reglamentos/plantilla/` | ReglamentoViewSet (plantilla) | Panel | Reglamento y seguridad |
| POST | `/api/reglamentos/{pk}/entregar/` | ReglamentoViewSet (entregar) | Panel | Reglamento y seguridad |
| GET | `/api/reglamentos/{pk}/pdf/` | ReglamentoViewSet (pdf) | Panel | Reglamento y seguridad |
| POST | `/api/reglamentos/{pk}/remision/` | ReglamentoViewSet (remision) | Panel | Reglamento y seguridad |

#### `/api/solicitudes-conciliacion/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/solicitudes-conciliacion/` | SolicitudConciliacionViewSet (create, list) | Panel | Trabajadores |
| GET | `/api/solicitudes-conciliacion/opciones/` | SolicitudConciliacionViewSet (opciones) | Panel | Trabajadores |
| GET | `/api/solicitudes-conciliacion/{pk}/` | SolicitudConciliacionViewSet (retrieve) | Panel | Trabajadores |
| POST | `/api/solicitudes-conciliacion/{pk}/anular/` | SolicitudConciliacionViewSet (anular) | Panel | Trabajadores |
| POST | `/api/solicitudes-conciliacion/{pk}/responder/` | SolicitudConciliacionViewSet (responder) | Panel | Trabajadores |

#### `/api/solicitudes-documento/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/solicitudes-documento/` | SolicitudDocumentoViewSet (list) | Panel | Solicitudes del portal |
| POST | `/api/solicitudes-documento/{pk}/descartar/` | SolicitudDocumentoViewSet (descartar) | Panel | Solicitudes del portal |

#### `/api/solicitudes-permiso/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET | `/api/solicitudes-permiso/` | SolicitudPermisoViewSet (list) | Panel | Vacaciones y permisos |
| POST | `/api/solicitudes-permiso/{pk}/responder/` | SolicitudPermisoViewSet (responder) | Panel | Vacaciones y permisos |

#### `/api/trabajador/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/trabajador/certificados/` | certificados_trabajador | Portal | — |
| POST | `/api/trabajador/clave/` | fijar_clave | Portal | — |
| POST | `/api/trabajador/clave/ingresar/` | ingresar_con_clave | Portal, sin sesión | — |
| POST | `/api/trabajador/codigo/` | pedir_codigo | Portal, sin sesión | — |
| POST | `/api/trabajador/codigo/verificar/` | verificar_codigo | Portal, sin sesión | — |
| GET | `/api/trabajador/descargar/` | descargar | Portal | — |
| GET | `/api/trabajador/documentos/` | documentos | Portal | — |
| POST | `/api/trabajador/empleos/confirmar/` | confirmar_empleo | Portal | — |
| POST | `/api/trabajador/empleos/vincular/` | vincular_empleo | Portal | — |
| POST | `/api/trabajador/firmar/` | firmar_liquidacion | Portal | — |
| GET | `/api/trabajador/firmas/` | firmas_pendientes | Portal | — |
| POST | `/api/trabajador/ingreso/` | ingreso | Portal, sin sesión | — |
| POST | `/api/trabajador/invitacion/omitir/` | omitir_invitacion | Portal | — |
| GET | `/api/trabajador/karin/` | casos_trabajador | Portal | — |
| POST | `/api/trabajador/karin/denunciar/` | denunciar | Portal | — |
| GET | `/api/trabajador/karin/documento/` | documento_trabajador | Portal | — |
| GET | `/api/trabajador/liquidaciones/` | liquidaciones | Portal | — |
| GET | `/api/trabajador/peticiones/` | peticiones | Portal | — |
| POST | `/api/trabajador/peticiones/calcular/` | calcular | Portal | — |
| POST | `/api/trabajador/peticiones/conciliacion/` | pedir_conciliacion | Portal | — |
| POST | `/api/trabajador/peticiones/permisos/` | pedir_permiso | Portal | — |
| POST | `/api/trabajador/peticiones/vacaciones/` | pedir_vacaciones | Portal | — |
| POST | `/api/trabajador/salir/` | salir | Portal, sin sesión | — |
| GET, POST | `/api/trabajador/solicitudes/` | solicitudes_trabajador | Portal | — |
| GET | `/api/trabajador/vacaciones/` | vacaciones | Portal | — |
| GET | `/api/trabajador/yo/` | yo | Portal | — |

#### `/api/vacaciones/` {.unnumbered}

| Métodos | Ruta | Vista | Acceso | Módulo |
|---|---|---|---|---|
| GET, POST | `/api/vacaciones/` | VacacionViewSet (create, list) | Panel | Vacaciones y permisos |
| GET | `/api/vacaciones/compensatorias/` | VacacionViewSet (compensatorias) | Panel | Vacaciones y permisos |
| GET | `/api/vacaciones/dias_habiles/` | VacacionViewSet (dias_habiles) | Panel | Vacaciones y permisos |
| GET | `/api/vacaciones/saldo/` | VacacionViewSet (saldo) | Panel | Vacaciones y permisos |
| GET, PATCH, PUT | `/api/vacaciones/{pk}/` | VacacionViewSet (partial_update, retrieve, update) | Panel | Vacaciones y permisos |
| GET | `/api/vacaciones/{pk}/generar_pdf/` | VacacionViewSet (generar_pdf) | Panel | Vacaciones y permisos |
| POST | `/api/vacaciones/{pk}/responder/` | VacacionViewSet (responder) | Panel | Vacaciones y permisos |

