"""Ley Karin en el portal del trabajador: denunciar y ver su parte de cada caso.

Denunciar (Art. 11 DS 21: por escrito, ante el empleador, de manera electrónica):
el trabajador queda identificado por su sesión (no hay denuncias anónimas), elige
una de sus fichas y la denuncia llega al encargado de esa empresa con el plazo
corriendo desde ese momento. Recibe su comprobante al instante y por correo; el
encargado recibe un aviso sin contenido. Sin encargado designado, el portal
indica denunciar ante la Dirección del Trabajo.


El caso se asocia a la persona por su RUT, y solo en las empresas de las fichas
que su cuenta puede ver (correo verificado; ver portal_trabajador). Qué ve cada
rol lo decide core/denuncias_karin.vista_portal. Cada consulta y descarga queda
en la bitácora reservada del encargado.
"""
import datetime

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.db.models import Max
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .. import denuncias_karin as dk
from .. import documentos_karin
from ..karin import registrar_karin
from ..models import DenunciaKarin, EncargadoKarin, Empresa
from ..rut import formatear_rut
from .base import logger
from .portal_trabajador import _con_sesion, _nombre, fichas_accesibles

# Tope de denuncias que una cuenta puede ingresar en 24 horas (evita abusos; nunca debería alcanzarse).
MAX_POR_DIA = 3

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


def _encargados(empresa):
    return EncargadoKarin.objects.filter(empresas=empresa, estado='ACTIVO', usuario__is_active=True)


def canales(cuenta):
    """Por cada ficha: si su empresa recibe denuncias en Jornada40 (tiene encargado activo)."""
    return [{'empleo': e.id, 'empresa': e.empresa.alias or e.empresa.nombre_legal,
             'disponible': _encargados(e.empresa).exists()} for e in fichas_accesibles(cuenta)]


def _catalogo(lista):
    return [{'valor': v, 'texto': t} for v, t in lista]


@api_view(['GET'])
@_con_sesion
def casos_trabajador(request):
    lista = casos(request.user)
    for d, vista in lista:
        registrar_karin(d.cuenta, 'PORTAL', f'{d.folio}: {_ROL[vista["rol"]]} consultó el caso en su portal',
                        ip=_ip(request))
    return Response({'casos': [vista for _, vista in lista], 'canales': canales(request.user),
                     'catalogos': {'tipos': _catalogo(DenunciaKarin.TIPOS), 'vinculos': _catalogo(dk.VINCULOS),
                                   'representaciones': _catalogo(dk.REPRESENTACIONES)}})


def _avisar(d, persona, correo):
    """Comprobante por correo a quien denuncia y aviso sin contenido a los encargados."""
    sitio = getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')
    recibida = timezone.localtime(d.recibida_en)
    envios = [(correo, 'karin_denuncia_recibida', 'Recibimos tu denuncia',
               {'nombre': persona, 'folio': d.folio, 'empresa': d.empresa.nombre_legal,
                'fecha': recibida.strftime('%d-%m-%Y'), 'hora': recibida.strftime('%H:%M'), 'sitio': sitio})]
    for enc in _encargados(d.empresa):
        envios.append((enc.correo, 'karin_denuncia_nueva', 'Tienes una denuncia nueva (Ley Karin)',
                       {'nombre': enc.nombres, 'sitio': sitio}))
    for destino, plantilla, asunto, ctx in envios:
        if not destino:
            continue
        try:
            msg = EmailMultiAlternatives(f'Jornada40: {asunto}', render_to_string(f'{plantilla}.txt', ctx),
                                         settings.DEFAULT_FROM_EMAIL, to=[destino])
            msg.attach_alternative(render_to_string(f'{plantilla}.html', ctx), 'text/html')
            msg.send()
        except Exception:
            logger.exception('No se pudo enviar el correo de la denuncia %s', d.id)


@api_view(['POST'])
@_con_sesion
def denunciar(request):
    """El trabajador presenta una denuncia en su portal. Queda identificado por su sesión."""
    cuenta = request.user
    ficha = next((e for e in fichas_accesibles(cuenta) if str(e.id) == str(request.data.get('empleo'))), None)
    if ficha is None:
        return Response({'error': 'Elige la empresa en que ocurrieron los hechos.'}, status=status.HTTP_400_BAD_REQUEST)
    if not _encargados(ficha.empresa).exists():
        return Response({'error': 'Tu empresa aún no designó un encargado de denuncias en Jornada40. Puedes denunciar '
                                  'directamente ante la Dirección del Trabajo.'}, status=status.HTTP_400_BAD_REQUEST)
    hace_un_dia = timezone.now() - datetime.timedelta(days=1)
    recientes = sum(1 for d in DenunciaKarin.objects.filter(origen='PORTAL', recibida_en__gte=hace_un_dia,
                                                            empresa=ficha.empresa)
                    if 'DENUNCIANTE' in dk.roles_de(d, cuenta.rut) or 'AFECTADA' in dk.roles_de(d, cuenta.rut))
    if recientes >= MAX_POR_DIA:
        return Response({'error': 'Ya ingresaste varias denuncias hoy. Si necesitas agregar algo, hazlo con el '
                                  'encargado de denuncias.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    # La persona que entra al portal es siempre quien denuncia; sus datos salen de su ficha.
    yo = {'nombre': _nombre(ficha), 'rut': formatear_rut(cuenta.rut), 'cargo': ficha.cargo or '',
          'correo': (ficha.email or '').strip().lower(), 'empleado_id': ficha.id}
    soy_afectada = bool(request.data.get('soy_afectada', True))
    entrada = {'tipo': request.data.get('tipo'), 'canal': 'ELECTRONICA',
               'denunciados': request.data.get('denunciados'), 'relato': request.data.get('relato')}
    if soy_afectada:
        entrada['afectada'] = yo
    else:
        entrada.update({'afectada': request.data.get('afectada'), 'denunciante': yo,
                        'representacion': request.data.get('representacion')})
    try:
        datos = dk.validar_denuncia(entrada, ficha.empresa)
    except dk.DatosInvalidos as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        Empresa.objects.select_for_update().filter(pk=ficha.empresa_id).first()
        numero = (DenunciaKarin.objects.filter(empresa=ficha.empresa).aggregate(n=Max('numero'))['n'] or 0) + 1
        d = DenunciaKarin.objects.create(
            cuenta=ficha.empresa.owner, empresa=ficha.empresa, numero=numero, tipo=entrada['tipo'], canal='ELECTRONICA',
            recibida_en=timezone.now(), origen='PORTAL', datos=datos,
            pide_derivar_dt=bool(request.data.get('pide_derivar_dt')), hitos={})
    registrar_karin(d.cuenta, 'DENUNCIA', f'{d.folio}: Denuncia ingresada por el trabajador en su portal', ip=_ip(request))
    _avisar(d, yo['nombre'], yo['correo'])
    return Response(dk.vista_portal(d, cuenta.rut), status=status.HTTP_201_CREATED)


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
