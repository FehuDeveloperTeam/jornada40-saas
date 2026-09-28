from django.urls import path, include
from .views import portal_trabajador as portal
from rest_framework.routers import DefaultRouter
from django.views.generic import TemplateView
from .views import (
    DocumentoLegalViewSet, EmpresaViewSet, EmpleadoViewSet, ContratoViewSet,
    AnexoContratoViewSet, registrar_cliente, LiquidacionViewSet, PlanViewSet,
    SolicitudFirmaViewSet, VacacionViewSet, mi_suscripcion, recuperar_password_por_rut, diagnostico_red, indicadores_del_dia, parametros_vigentes,
    webhook_reveniu, crear_checkout_reveniu, bajar_plan, cancelar_cambio_plan, reanudar_renovacion, perfil_usuario,
    firma_publica_info, firma_publica_solicitar_otp, firma_publica_verificar_otp,
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
    path('pagos/cancelar-cambio/', cancelar_cambio_plan, name='cancelar_cambio_plan'),
    path('pagos/reanudar/', reanudar_renovacion, name='reanudar_renovacion'),
    path('auth/register/', registrar_cliente, name='api_register'),
    path('auth/recuperar-por-rut/', recuperar_password_por_rut, name='recuperar_por_rut'),
    path('diagnostico/red/', diagnostico_red, name='diagnostico_red'),
    path('indicadores/', indicadores_del_dia, name='indicadores_del_dia'),
    path('parametros/vigentes/', parametros_vigentes, name='parametros_vigentes'),
    path('clientes/mi_suscripcion/', mi_suscripcion, name='mi_suscripcion'),
    path('clientes/perfil/', perfil_usuario, name='perfil_usuario'),
    path('auth/password/reset/confirm/<str:uidb64>/<str:token>/', TemplateView.as_view(), name='password_reset_confirm'),
    # Firma electrónica — endpoints públicos (sin autenticación)
    path('firma-publica/<uuid:token>/', firma_publica_info, name='firma_publica_info'),
    path('firma-publica/<uuid:token>/solicitar-otp/', firma_publica_solicitar_otp, name='firma_publica_solicitar_otp'),
    path('firma-publica/<uuid:token>/verificar-otp/', firma_publica_verificar_otp, name='firma_publica_verificar_otp'),
    path('firma-publica/<uuid:token>/firmar/', firma_publica_firmar, name='firma_publica_firmar'),
    path('firma-publica/<uuid:token>/documento/', firma_publica_documento, name='firma_publica_documento'),
    path('firma-publica/<uuid:token>/rechazar/', firma_publica_rechazar, name='firma_publica_rechazar'),
]
