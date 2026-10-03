"""Listas cerradas de la ficha del trabajador, servidas por el backend para que
el panel no tenga una copia propia (bancos, cuidados y fueros)."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..bancos import NOMBRES as BANCOS
from ..proteccion import CUIDADOS, FUEROS


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def catalogos_trabajador(request):
    # El valor del banco es el nombre en mayúsculas, como se guarda (core/bancos.py).
    return Response({
        'bancos': [{'valor': b.upper(), 'texto': b} for b in BANCOS],
        'cuidados': [{'valor': v, 'texto': t} for v, t in CUIDADOS],
        'fueros': [{'valor': v, 'texto': t} for v, t in FUEROS],
    })
