from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EmpresaViewSet, EmpleadoViewSet, ContratoViewSet

router = DefaultRouter()
router.register(r'empresas', EmpresaViewSet)
router.register(r'empleados', EmpleadoViewSet)
router.register(r'contratos', ContratoViewSet)

urlpatterns = [
    path('', include(router.urls)),
]