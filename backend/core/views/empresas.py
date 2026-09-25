"""Empresas del cliente."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from ..models import Empresa
from django.utils import timezone
from ..rut import formatear_rut, validar_rut
from ..serializers import EmpresaSerializer

from .base import _plan_activo


def _exigir_rut_representante(datos):
    rut = str(datos.get('rut_representante') or '').strip()
    if rut and not validar_rut(rut):
        raise ValidationError({'error': 'El RUT del representante legal no es válido: revisa el dígito verificador.'})


class EmpresaViewSet(viewsets.ModelViewSet):
    serializer_class = EmpresaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.query_params.get('incluir_inactivas') == 'true':
            return Empresa.objects.filter(owner=self.request.user).order_by('id')
        return Empresa.objects.filter(owner=self.request.user, activo=True).order_by('id')
    
    @action(detail=True, methods=['post'])
    def reactivar(self, request, pk=None):
        try:
            empresa = Empresa.objects.get(pk=pk, owner=request.user)
        except Empresa.DoesNotExist:
            return Response({"error": "Empresa no encontrada"}, status=status.HTTP_404_NOT_FOUND)
        if not empresa.activo:
            # Reactivar ocupa un cupo igual que crear una empresa nueva.
            plan = _plan_activo(request.user)
            if plan and Empresa.objects.filter(owner=request.user, activo=True).count() >= plan.max_empresas:
                return Response({'error': f'Tu plan {plan.nombre} permite administrar un máximo de {plan.max_empresas} '
                                          f'empresas. Desactiva otra o actualiza tu plan para reactivar esta.'},
                                status=status.HTTP_400_BAD_REQUEST)
            empresa.activo = True
            empresa.save()
        return Response({"mensaje": "Empresa reactivada correctamente"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='configurar-firma')
    def configurar_firma(self, request, pk=None):
        """Guarda la firma dibujada del representante legal de la empresa."""
        empresa = self.get_object()

        firma_imagen = request.data.get('firma_imagen', '').strip()
        nombre       = request.data.get('firma_firmante_nombre', '').strip()
        cargo        = request.data.get('firma_firmante_cargo', '').strip()

        if not firma_imagen:
            return Response({'error': 'La imagen de firma es requerida.'}, status=status.HTTP_400_BAD_REQUEST)
        if not firma_imagen.startswith('data:image/'):
            return Response({'error': 'Formato de imagen inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(firma_imagen) > 500_000:
            return Response({'error': 'La imagen de firma es demasiado grande.'}, status=status.HTTP_400_BAD_REQUEST)

        empresa.firma_imagen          = firma_imagen
        empresa.firma_firmante_nombre = nombre
        empresa.firma_firmante_cargo  = cargo
        empresa.firma_configurada_en  = timezone.now()
        empresa.save(update_fields=['firma_imagen', 'firma_firmante_nombre',
                                    'firma_firmante_cargo', 'firma_configurada_en'])

        serializer = self.get_serializer(empresa)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # 1. REGLA DE NEGOCIO: Límite de empresas según el plan activo
        plan = _plan_activo(self.request.user)
        if plan:
            total_empresas = Empresa.objects.filter(owner=self.request.user, activo=True).count()
            if total_empresas >= plan.max_empresas:
                raise ValidationError({'error': f'Tu plan {plan.nombre} permite administrar un máximo de {plan.max_empresas} empresas. Actualiza tu plan para registrar más.'})

        # 2. Convertir a mayúsculas
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        rut_raw = self.request.data.get('rut', '')
        
        # 3. El servidor valida el dígito verificador igual que el formulario:
        # una empresa con RUT mal escrito no se crea (después no se puede
        # cambiar, porque los documentos quedan emitidos con ese RUT).
        if not validar_rut(rut_raw):
            raise ValidationError({'error': 'El RUT de la empresa no es válido: revisa el dígito verificador.'})
        _exigir_rut_representante(self.request.data)

        # 4. REGLA DE NEGOCIO: No repetir RUT en el mismo panel
        if rut_raw:
            rut_form = formatear_rut(rut_raw)
            if Empresa.objects.filter(rut=rut_form).exists():
                raise ValidationError({'error': 'Ya existe una empresa registrada con este RUT en el sistema. Contacta a soporte si crees que esto es un error.'})
            datos_mayusculas['rut'] = rut_form
            
        serializer.save(owner=self.request.user, **datos_mayusculas)

    # SOFT-DELETE: En vez de eliminar la empresa, la marcamos como inactiva
    def destroy(self, request, *args, **kwargs):
        empresa = self.get_object()
        empresa.activo = False
        empresa.save()
        return Response({"mensaje": "Empresa desactivada correctamente"}, status=status.HTTP_200_OK)
            
    def perform_update(self, serializer):
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}
        # El RUT de la empresa no cambia después de creada: contratos,
        # liquidaciones y firmas ya emitidos lo llevan. Otro RUT es otra empresa.
        rut_raw = self.request.data.get('rut', '')
        if rut_raw and formatear_rut(rut_raw) != serializer.instance.rut:
            raise ValidationError({'error': 'El RUT de la empresa no se puede cambiar. Si corresponde a otra '
                                            'persona jurídica, crea una empresa nueva.'})
        datos_mayusculas.pop('rut', None)
        _exigir_rut_representante(self.request.data)
        serializer.save(**datos_mayusculas)
