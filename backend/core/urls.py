from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.views.generic import TemplateView
from .views import DocumentoLegalViewSet, EmpresaViewSet, EmpleadoViewSet, ContratoViewSet, registrar_cliente, LiquidacionViewSet,PlanViewSet, mi_suscripcion, recuperar_password_por_rut, webhook_reveniu, crear_checkout_reveniu, perfil_usuario


router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet, basename='empresa')
router.register(r'empleados', EmpleadoViewSet, basename='empleado')
router.register(r'contratos', ContratoViewSet, basename='contrato')
router.register(r'documentos_legales', DocumentoLegalViewSet, basename='documento_legal')
router.register(r'liquidaciones', LiquidacionViewSet, basename='liquidacion')
router.register(r'planes', PlanViewSet, basename='plan')

urlpatterns = [
    path('', include(router.urls)),
    path('pagos/crear-checkout/', crear_checkout_reveniu, name='crear_checkout_reveniu'),
    path('pagos/webhook/reveniu/', webhook_reveniu, name='webhook_reveniu'),
    path('auth/register/', registrar_cliente, name='api_register'),
    path('auth/recuperar-por-rut/', recuperar_password_por_rut, name='recuperar_por_rut'),
    path('clientes/mi_suscripcion/', mi_suscripcion, name='mi_suscripcion'),
    path('clientes/perfil/', perfil_usuario, name='perfil_usuario'),
    path('auth/password/reset/confirm/<str:uidb64>/<str:token>/', TemplateView.as_view(), name='password_reset_confirm'),
]
