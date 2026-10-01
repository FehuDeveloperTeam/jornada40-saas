"""Bitácora reservada del acceso Ley Karin (RegistroKarin).

Va aparte de la bitácora del panel: el titular no ve qué hicieron los
encargados (la ley exige estricta reserva, Art. 211-C), solo que hubo actividad
ese día ("ACTIVIDAD_LEY_KARIN", sin detalle). Misma técnica de huellas
encadenadas que core/bitacora.py; la huella se calcula sobre el texto sin cifrar,
así que también delata un cambio en la descripción cifrada.
"""
import datetime
import hashlib
import json

from django.db import transaction
from django.utils import timezone

from .models import RegistroBitacora, RegistroKarin


def _huella(datos):
    return hashlib.sha256(json.dumps(datos, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def _contenido(r):
    return {'cuenta': r.cuenta_id, 'encargado': r.encargado_id, 'actor_nombre': r.actor_nombre,
            'actor_rut': r.actor_rut, 'accion': r.accion, 'descripcion': r.descripcion, 'ip': r.ip,
            'creado_en': r.creado_en.isoformat(), 'hash_anterior': r.hash_anterior}


def registrar_karin(cuenta, accion, descripcion, *, encargado=None, ip=''):
    """Agrega un registro reservado y deja constancia sin detalle en la bitácora del titular."""
    from .bitacora import registrar
    with transaction.atomic():
        type(cuenta).objects.select_for_update().filter(pk=cuenta.pk).first()
        anterior = RegistroKarin.objects.filter(cuenta=cuenta).order_by('-id').values_list('hash', flat=True).first()
        r = RegistroKarin(
            cuenta=cuenta, encargado=encargado,
            actor_nombre=(encargado.nombre_completo if encargado else 'Jornada40')[:150],
            actor_rut=(encargado.rut if encargado else '')[:15], accion=accion[:40], descripcion=descripcion[:500],
            ip=ip[:64], creado_en=timezone.now(), hash_anterior=anterior or '')
        r.hash = _huella(_contenido(r))
        r.save()
        # El titular solo sabe que hubo actividad (una vez por día), nunca qué ni sobre quién.
        inicio_del_dia = timezone.make_aware(datetime.datetime.combine(timezone.localdate(), datetime.time.min))
        if not RegistroBitacora.objects.filter(cuenta=cuenta, accion='ACTIVIDAD_LEY_KARIN',
                                               creado_en__gte=inicio_del_dia).exists():
            registrar(cuenta, 'ACTIVIDAD_LEY_KARIN',
                      'Hubo actividad en el acceso Ley Karin (el detalle es reservado del encargado)')
        return r


def verificar_karin(cuenta):
    """{'ok', 'registros', 'roto_en'}: el primer registro alterado o quitado."""
    anterior, n = '', 0
    for r in RegistroKarin.objects.filter(cuenta=cuenta).order_by('id').iterator():
        n += 1
        if r.hash_anterior != anterior or _huella(_contenido(r)) != r.hash:
            return {'ok': False, 'registros': n, 'roto_en': r.id}
        anterior = r.hash
    return {'ok': True, 'registros': n, 'roto_en': None}
