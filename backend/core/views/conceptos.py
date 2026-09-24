"""Catálogo de haberes y descuentos."""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from ..models import ConceptoRemuneracion
from django.db.models import Q
from ..serializers import ConceptoRemuneracionSerializer


class ConceptoRemuneracionViewSet(viewsets.ModelViewSet):
    """Catálogo de haberes y descuentos disponible para el usuario.

    Devuelve los conceptos del sistema más los propios de sus empresas. Los
    del sistema son de solo lectura: una empresa no puede alterar la
    naturaleza previsional de un concepto compartido.
    """
    serializer_class = ConceptoRemuneracionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        qs = ConceptoRemuneracion.objects.filter(
            Q(empresa__isnull=True) | Q(empresa__owner=self.request.user)
        )
        # Los inactivos se ocultan del listado, pero el detalle los incluye:
        # si no, un concepto desactivado no se podía volver a activar.
        if self.action == 'list' and self.request.query_params.get('incluir_inactivos') != 'true':
            qs = qs.filter(activo=True)
        tipo = self.request.query_params.get('tipo')
        if tipo:
            qs = qs.filter(tipo=tipo)
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(Q(empresa__isnull=True) | Q(empresa_id=empresa_id))
        return qs

    def perform_create(self, serializer):
        empresa = serializer.validated_data.get('empresa')
        if empresa is None:
            raise ValidationError(
                {'empresa': 'Un concepto propio debe pertenecer a una empresa. '
                            'El catálogo del sistema no se edita desde aquí.'})
        if empresa.owner_id != self.request.user.id:
            raise ValidationError({'empresa': 'Empresa no encontrada.'})
        serializer.save()

    def _rechazar_si_es_del_sistema(self, instancia):
        if instancia.empresa_id is None:
            return Response(
                {'error': 'Los conceptos del catálogo del sistema no se pueden '
                          'modificar ni eliminar. Crea uno propio si necesitas '
                          'una variante.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return None

    def update(self, request, *args, **kwargs):
        return (self._rechazar_si_es_del_sistema(self.get_object())
                or super().update(request, *args, **kwargs))

    def destroy(self, request, *args, **kwargs):
        instancia = self.get_object()
        rechazo = self._rechazar_si_es_del_sistema(instancia)
        if rechazo:
            return rechazo
        # Desactivar en vez de borrar: las liquidaciones ya emitidas lo
        # referencian y deben poder seguir mostrándolo.
        instancia.activo = False
        instancia.save(update_fields=['activo'])
        return Response(status=status.HTTP_204_NO_CONTENT)
