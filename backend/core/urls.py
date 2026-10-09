from django.urls import path, include
from .views import portal_trabajador as portal
from .views import solicitudes_documento
from .views import certificados
from .views import catalogos
from .views import conciliacion
from .views import peticiones_portal
from .views import documentos_laborales
from .views import inspeccion
from .views import certificado_sueldos
from .views import resumen
from .views import extension as vistas_extension
from .views import reglamento
from .views import ley_karin
from .views import bitacora as vista_bitacora
from .views import equipo
from .views import acceso_karin
from .views import denuncias_karin
from .views import karin_portal
from rest_framework.routers import DefaultRouter
from django.views.generic import TemplateView
from .views import (
    DocumentoLegalViewSet, EmpresaViewSet, EmpleadoViewSet, ContratoViewSet,
    AnexoContratoViewSet, registrar_cliente, LiquidacionViewSet, PlanViewSet,
    SolicitudFirmaViewSet, VacacionViewSet, mi_suscripcion, recuperar_password_por_rut, diagnostico_red, indicadores_del_dia, parametros_vigentes,
    webhook_reveniu, crear_checkout_reveniu, bajar_plan, cancelar_cambio_plan, reanudar_renovacion, perfil_usuario,
    firma_publica_info, firma_publica_solicitar_otp, firma_publica_verificar_otp, firma_publica_verificar_clave,
    firma_publica_firmar, firma_publica_documento, firma_publica_rechazar,
    FiniquitoViewSet, ConceptoRemuneracionViewSet, RegistroDTViewSet,
)


router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet, basename='empresa')
router.register(r'empleados', EmpleadoViewSet, basename='empleado')
router.register(r'contratos', ContratoViewSet, basename='contrato')
router.register(r'documentos_legales', DocumentoLegalViewSet, basename='documento_legal')
router.register(r'anexos_contrato', AnexoContratoViewSet, basename='anexo_contrato')
router.register(r'liquidaciones', LiquidacionViewSet, basename='liquidacion')
router.register(r'planes', PlanViewSet, basename='plan')
router.register(r'firmas', SolicitudFirmaViewSet, basename='firma')
router.register(r'vacaciones', VacacionViewSet, basename='vacacion')
router.register(r'finiquitos', FiniquitoViewSet, basename='finiquito')
router.register(r'conceptos', ConceptoRemuneracionViewSet, basename='concepto')
router.register(r'registro-dt', RegistroDTViewSet, basename='registro_dt')
router.register(r'equipo', equipo.EquipoViewSet, basename='equipo')
router.register(r'encargados-karin', acceso_karin.EncargadoKarinViewSet, basename='encargado_karin')
router.register(r'karin/denuncias', denuncias_karin.DenunciaKarinViewSet, basename='denuncia_karin')
router.register(r'ley-karin', ley_karin.LeyKarinViewSet, basename='ley_karin')
router.register(r'reglamentos', reglamento.ReglamentoViewSet, basename='reglamento')
router.register(r'documentos-laborales', documentos_laborales.DocumentoLaboralViewSet, basename='documento_laboral')
router.register(r'solicitudes-documento', solicitudes_documento.SolicitudDocumentoViewSet, basename='solicitud_documento')
router.register(r'solicitudes-conciliacion', conciliacion.SolicitudConciliacionViewSet, basename='solicitud_conciliacion')
router.register(r'solicitudes-permiso', peticiones_portal.SolicitudPermisoViewSet, basename='solicitud_permiso')

urlpatterns = [
    path('', include(router.urls)),
    path('pagos/crear-checkout/', crear_checkout_reveniu, name='crear_checkout_reveniu'),
    path('pagos/webhook/reveniu/', webhook_reveniu, name='webhook_reveniu'),
    path('pagos/bajar-plan/', bajar_plan, name='bajar_plan'),
    # Portal del trabajador (sesión propia, independiente de la del empleador)
    path('trabajador/ingreso/', portal.ingreso, name='portal_ingreso'),
    path('trabajador/codigo/', portal.pedir_codigo, name='portal_pedir_codigo'),
    path('trabajador/codigo/verificar/', portal.verificar_codigo, name='portal_verificar_codigo'),
    path('trabajador/clave/ingresar/', portal.ingresar_con_clave, name='portal_ingresar_clave'),
    path('trabajador/salir/', portal.salir, name='portal_salir'),
    path('trabajador/yo/', portal.yo, name='portal_yo'),
    path('trabajador/clave/', portal.fijar_clave, name='portal_fijar_clave'),
    path('trabajador/invitacion/omitir/', portal.omitir_invitacion, name='portal_omitir_invitacion'),
    path('trabajador/empleos/vincular/', portal.vincular_empleo, name='portal_vincular'),
    path('trabajador/empleos/confirmar/', portal.confirmar_empleo, name='portal_confirmar'),
    path('trabajador/liquidaciones/', portal.liquidaciones, name='portal_liquidaciones'),
    path('trabajador/documentos/', portal.documentos, name='portal_documentos'),
    path('trabajador/descargar/', portal.descargar, name='portal_descargar'),
    path('trabajador/vacaciones/', portal.vacaciones, name='portal_vacaciones'),
    path('trabajador/firmas/', portal.firmas_pendientes, name='portal_firmas'),
    path('trabajador/firmar/', portal.firmar_liquidacion, name='portal_firmar_liquidacion'),
    path('trabajador/solicitudes/', solicitudes_documento.solicitudes_trabajador, name='portal_solicitudes'),
    path('certificados-sueldos/', certificado_sueldos.estado, name='certificados_sueldos'),
    path('certificados-sueldos/emitir/', certificado_sueldos.emitir_vista, name='certificados_sueldos_emitir'),
    path('certificados-sueldos/zip/', certificado_sueldos.zip_vista, name='certificados_sueldos_zip'),
    path('certificados-sueldos/resumen-dj1887/', certificado_sueldos.resumen_dj1887, name='certificados_sueldos_dj1887'),
    path('certificados-sueldos/<int:certificado_id>/pdf/', certificado_sueldos.pdf_vista, name='certificados_sueldos_pdf'),
    path('inspeccion/ingreso/', inspeccion.ingreso, name='inspeccion_ingreso'),
    path('inspeccion/verificar/', inspeccion.verificar, name='inspeccion_verificar'),
    path('inspeccion/yo/', inspeccion.yo, name='inspeccion_yo'),
    path('inspeccion/salir/', inspeccion.salir, name='inspeccion_salir'),
    path('inspeccion/trabajadores/', inspeccion.trabajadores, name='inspeccion_trabajadores'),
    path('inspeccion/documentos/', inspeccion.documentos, name='inspeccion_documentos'),
    path('inspeccion/descargar/', inspeccion.descargar, name='inspeccion_descargar'),
    path('inspeccion/ratificar/', inspeccion.ratificar, name='inspeccion_ratificar'),
    path('inspeccion/bitacora/', inspeccion.bitacora_empleador, name='inspeccion_bitacora'),
    path('trabajador/certificados/', certificados.certificados_trabajador, name='portal_certificados'),
    path('trabajador/peticiones/', peticiones_portal.peticiones, name='portal_peticiones'),
    path('trabajador/peticiones/calcular/', peticiones_portal.calcular, name='portal_peticiones_calcular'),
    path('trabajador/peticiones/vacaciones/', peticiones_portal.pedir_vacaciones, name='portal_pedir_vacaciones'),
    path('trabajador/peticiones/permisos/', peticiones_portal.pedir_permiso, name='portal_pedir_permiso'),
    path('trabajador/peticiones/conciliacion/', peticiones_portal.pedir_conciliacion, name='portal_pedir_conciliacion'),
    path('peticiones-portal/', peticiones_portal.peticiones_empleador, name='peticiones_portal'),
    path('trabajador/karin/', karin_portal.casos_trabajador, name='portal_karin'),
    path('trabajador/karin/denunciar/', karin_portal.denunciar, name='portal_karin_denunciar'),
    path('trabajador/karin/documento/', karin_portal.documento_trabajador, name='portal_karin_documento'),
    path('certificados/verificar/<str:codigo>/', certificados.verificar_certificado, name='verificar_certificado'),
    path('empleados/<int:empleado_id>/certificados/', certificados.certificados_empleado, name='certificados_empleado'),
    path('certificados/<int:certificado_id>/pdf/', certificados.descargar_certificado_empleador,
         name='certificado_pdf'),
    path('certificados/<int:certificado_id>/anular/', certificados.anular_certificado, name='certificado_anular'),
    path('certificados/motivos-anulacion/', certificados.motivos_anulacion_certificado,
         name='certificado_motivos_anulacion'),
    path('pagos/cancelar-cambio/', cancelar_cambio_plan, name='cancelar_cambio_plan'),
    path('pagos/reanudar/', reanudar_renovacion, name='reanudar_renovacion'),
    path('auth/register/', registrar_cliente, name='api_register'),
    path('auth/recuperar-por-rut/', recuperar_password_por_rut, name='recuperar_por_rut'),
    path('diagnostico/red/', diagnostico_red, name='diagnostico_red'),
    path('indicadores/', indicadores_del_dia, name='indicadores_del_dia'),
    path('catalogos/trabajador/', catalogos.catalogos_trabajador, name='catalogos_trabajador'),
    path('parametros/vigentes/', parametros_vigentes, name='parametros_vigentes'),
    path('clientes/mi_suscripcion/', mi_suscripcion, name='mi_suscripcion'),
    path('clientes/perfil/', perfil_usuario, name='perfil_usuario'),
    path('clientes/resumen/', resumen.preferencia_resumen, name='preferencia_resumen'),
    path('bitacora/', vista_bitacora.bitacora, name='bitacora'),
    path('auth/equipo/ingresar/', equipo.ingresar_equipo, name='ingresar_equipo'),
    path('auth/equipo/recuperar/', equipo.recuperar_equipo, name='recuperar_equipo'),
    path('auth/equipo/clave/', equipo.clave_equipo, name='clave_equipo'),
    path('auth/sesion/', equipo.sesion, name='sesion'),
    # Acceso Ley Karin: puerta y sesión propias (cookie jornada40-karin), nunca el JWT del panel.
    path('karin/ingresar/', acceso_karin.ingresar, name='karin_ingresar'),
    path('karin/recuperar/', acceso_karin.recuperar, name='karin_recuperar'),
    path('karin/clave/', acceso_karin.crear_clave, name='karin_clave'),
    path('karin/yo/', acceso_karin.yo, name='karin_yo'),
    path('karin/salir/', acceso_karin.salir, name='karin_salir'),
    path('karin/cambiar-clave/', acceso_karin.cambiar_clave, name='karin_cambiar_clave'),
    path('karin/bitacora/', acceso_karin.bitacora, name='karin_bitacora'),
    path('karin/bitacora/verificar/', acceso_karin.verificar_bitacora, name='karin_bitacora_verificar'),
    path('bitacora/verificar/', vista_bitacora.verificar_bitacora, name='verificar_bitacora'),
    path('bitacora/exportar/', vista_bitacora.exportar_bitacora, name='exportar_bitacora'),
    path('auth/password/reset/confirm/<str:uidb64>/<str:token>/', TemplateView.as_view(), name='password_reset_confirm'),
    # Firma electrónica — endpoints públicos (sin autenticación)
    path('firma-publica/<uuid:token>/', firma_publica_info, name='firma_publica_info'),
    path('firma-publica/<uuid:token>/solicitar-otp/', firma_publica_solicitar_otp, name='firma_publica_solicitar_otp'),
    path('firma-publica/<uuid:token>/verificar-otp/', firma_publica_verificar_otp, name='firma_publica_verificar_otp'),
    path('firma-publica/<uuid:token>/verificar-clave/', firma_publica_verificar_clave, name='firma_publica_verificar_clave'),
    path('firma-publica/<uuid:token>/firmar/', firma_publica_firmar, name='firma_publica_firmar'),
    path('firma-publica/<uuid:token>/documento/', firma_publica_documento, name='firma_publica_documento'),
    path('firma-publica/<uuid:token>/rechazar/', firma_publica_rechazar, name='firma_publica_rechazar'),
    # Extensión "Jornada40 para Mi DT": panel (sesión del panel) y extensión (solo con su token).
    path('extension/dispositivos/', vistas_extension.dispositivos, name='extension_dispositivos'),
    path('extension/dispositivos/<int:pk>/desconectar/', vistas_extension.desconectar, name='extension_desconectar'),
    path('extension/codigo/', vistas_extension.crear_codigo, name='extension_codigo'),
    path('extension/v1/vincular/', vistas_extension.vincular, name='extension_vincular'),
    path('extension/v1/yo/', vistas_extension.yo, name='extension_yo'),
    path('extension/v1/salir/', vistas_extension.salir, name='extension_salir'),
    path('extension/v1/registro/', vistas_extension.registro, name='extension_registro'),
    path('extension/v1/registro/ficha/', vistas_extension.registro_ficha, name='extension_ficha'),
    path('extension/v1/registro/marcar/', vistas_extension.registro_marcar, name='extension_marcar'),
    path('extension/v1/mapeos/', vistas_extension.mapeos, name='extension_mapeos'),
    path('extension/v1/levantamiento/', vistas_extension.levantamiento, name='extension_levantamiento'),
]
