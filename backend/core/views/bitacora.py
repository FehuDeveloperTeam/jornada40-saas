"""Bitácora de la cuenta: solo el titular la consulta y verifica que nadie la alteró."""
import datetime

from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..bitacora import cuenta_de, verificar
from ..models import RegistroBitacora

POR_PAGINA = 100


def _solo_titular(request):
    cuenta, tipo = cuenta_de(request.user)
    return cuenta if tipo == 'TITULAR' else None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bitacora(request):
    """Registros de la cuenta, del más reciente al más antiguo (filtros: empresa, desde, hasta, página)."""
    cuenta = _solo_titular(request)
    if cuenta is None:
        return Response({'error': 'Solo el titular de la cuenta puede ver la bitácora.'}, status=403)
    qs = RegistroBitacora.objects.filter(cuenta=cuenta).select_related('empresa').order_by('-id')
    if request.query_params.get('empresa'):
        qs = qs.filter(empresa_id=request.query_params['empresa'])
    try:
        if request.query_params.get('desde'):
            qs = qs.filter(creado_en__date__gte=datetime.date.fromisoformat(request.query_params['desde']))
        if request.query_params.get('hasta'):
            qs = qs.filter(creado_en__date__lte=datetime.date.fromisoformat(request.query_params['hasta']))
        pagina = max(int(request.query_params.get('pagina') or 1), 1)
    except ValueError:
        return Response({'error': 'Filtros inválidos.'}, status=400)
    total = qs.count()
    filas = qs[(pagina - 1) * POR_PAGINA: pagina * POR_PAGINA]
    return Response({
        'total': total, 'pagina': pagina, 'por_pagina': POR_PAGINA,
        'registros': [{
            'id': r.id, 'fecha': timezone.localtime(r.creado_en).isoformat(), 'actor': r.actor_nombre,
            'actor_tipo': r.actor_tipo, 'accion': r.accion, 'descripcion': r.descripcion,
            'empresa': r.empresa.nombre_legal if r.empresa else None, 'ip': r.ip, 'resultado': r.estado_http,
        } for r in filas],
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def verificar_bitacora(request):
    """Recorre la cadena de huellas: si alguien alteró o quitó un registro, lo informa."""
    cuenta = _solo_titular(request)
    if cuenta is None:
        return Response({'error': 'Solo el titular de la cuenta puede ver la bitácora.'}, status=403)
    return Response(verificar(cuenta))
