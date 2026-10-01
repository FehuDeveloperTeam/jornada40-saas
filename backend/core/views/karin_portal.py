"""Ley Karin en el portal del trabajador: cada persona ve solo su parte del caso.

El caso se asocia a la persona por su RUT, y solo en las empresas de las fichas
que su cuenta puede ver (correo verificado; ver portal_trabajador). Qué ve cada
rol lo decide core/denuncias_karin.vista_portal. Cada consulta y descarga queda
en la bitácora reservada del encargado.
"""
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import denuncias_karin as dk
from .. import documentos_karin
from ..karin import registrar_karin
from ..models import DenunciaKarin
from .portal_trabajador import _con_sesion, fichas_accesibles

_ROL = {'PARTE': 'La persona afectada o denunciante', 'DENUNCIADA': 'La persona denunciada', 'TESTIGO': 'Un testigo'}


def casos(cuenta):
    """[(denuncia, vista)] de los casos en que participa la cuenta."""
    empresas = {e.empresa_id for e in fichas_accesibles(cuenta)}
    if not empresas:
        return []
    resultado = []
    for d in DenunciaKarin.objects.filter(empresa_id__in=empresas).select_related('empresa'):
        vista = dk.vista_portal(d, cuenta.rut)
        if vista:
            resultado.append((d, vista))
    return resultado


def _ip(request):
    return request.META.get('REMOTE_ADDR', '')


@api_view(['GET'])
@_con_sesion
def casos_trabajador(request):
    lista = casos(request.user)
    for d, vista in lista:
        registrar_karin(d.cuenta, 'PORTAL', f'{d.folio}: {_ROL[vista["rol"]]} consultó el caso en su portal',
                        ip=_ip(request))
    return Response({'casos': [vista for _, vista in lista]})


@api_view(['GET'])
@_con_sesion
def documento_trabajador(request):
    tipo = request.query_params.get('tipo', '')
    participante = request.query_params.get('participante', '')
    caso = next(((d, v) for d, v in casos(request.user) if str(d.id) == request.query_params.get('denuncia')), None)
    if caso is None or {'tipo': tipo, 'participante': participante} not in caso[1]['documentos']:
        return Response({'error': 'Documento no disponible.'}, status=status.HTTP_404_NOT_FOUND)
    d, vista = caso
    titulo, contenido = documentos_karin.pdf(d, tipo, participante)
    registrar_karin(d.cuenta, 'PORTAL', f'{d.folio}: {_ROL[vista["rol"]]} descargó: {titulo.lower()}', ip=_ip(request))
    respuesta = HttpResponse(contenido, content_type='application/pdf')
    respuesta['Content-Disposition'] = f'attachment; filename="{d.folio}_{tipo.lower()}.pdf"'
    return respuesta
