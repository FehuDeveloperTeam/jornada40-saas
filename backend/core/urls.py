from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.views.generic import TemplateView
from .views import DocumentoLegalViewSet, EmpresaViewSet, EmpleadoViewSet, ContratoViewSet, registrar_cliente, LiquidacionViewSet,PlanViewSet, mi_suscripcion, crear_checkout_reveniu, webhook_reveniu


router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet, basename='empresa')
router.register(r'empleados', EmpleadoViewSet, basename='empleado')
router.register(r'contratos', ContratoViewSet, basename='contrato')
router.register(r'documentos_legales', DocumentoLegalViewSet, basename='documento_legal')
router.register(r'liquidaciones', LiquidacionViewSet, basename='liquidacion')
router.register(r'planes', PlanViewSet, basename='plan')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', registrar_cliente, name='api_register'),
    path('auth/', include('dj_rest_auth.urls')),  # Incluye rutas de login/logout/password reset
    path('clientes/mi_suscripcion/', mi_suscripcion, name='mi_suscripcion'),
    path('pagos/crear_checkout/', crear_checkout_reveniu, name='crear_checkout_reveniu'),
    path('pagos/webhook/reveniu/', webhook_reveniu, name='webhook_reveniu'),
    path('auth/password/reset/confirm/<str:uidb64>/<str:token>/', TemplateView.as_view(), name='password_reset_confirm'),
]
