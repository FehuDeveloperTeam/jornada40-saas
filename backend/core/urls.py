from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DocumentoLegalViewSet, EmpresaViewSet, EmpleadoViewSet, ContratoViewSet, registrar_cliente, LiquidacionViewSet

router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet, basename='empresa')
router.register(r'empleados', EmpleadoViewSet, basename='empleado')
router.register(r'contratos', ContratoViewSet, basename='contrato')
router.register(r'documentos_legales', DocumentoLegalViewSet, basename='documento_legal')
router.register(r'liquidaciones', LiquidacionViewSet, basename='liquidacion')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/register/', registrar_cliente, name='api_register'),
]
