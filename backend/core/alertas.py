"""Aviso por correo de los errores del servidor (monitoreo básico, sin terceros).

Todo registro de nivel ERROR con una excepción —un error no controlado (500)
o uno capturado con `error_interno()` o `logger.exception()`— manda un correo
al equipo (`ALERTAS_ERRORES_EMAIL`). Para no repartir datos personales por
correo, el aviso trae solo:
- cuándo (hora de Chile), el entorno, el método y la ruta (sin parámetros);
- el tipo de error y el recorrido del código (archivo, línea y función);
- la plantilla del mensaje del registro, sin sus valores, salvo los que son
  claramente un identificador interno (p. ej. el contexto de `error_interno`).

Nunca el texto de la excepción (puede traer RUT, montos o correos) ni el cuerpo
de la solicitud: el detalle completo queda en los registros del servidor.
Un mismo error se avisa a lo más una vez por hora y no salen más de
`MAXIMO_POR_HORA` avisos por hora. Si `ALERTAS_ERRORES_EMAIL` está vacío, no hace nada.
"""
import hashlib
import logging
import re
import threading
import traceback

MAXIMO_POR_HORA = 20
_IDENTIFICADOR = re.compile(r'^[a-z_]{1,40}$')
_local = threading.local()


def _recorrido(tb, maximo=8):
    marcos = traceback.extract_tb(tb)[-maximo:]
    return marcos, '\n'.join(f'  {m.filename.split("/backend/")[-1]}:{m.lineno} en {m.name}' for m in marcos)


def _mensaje_sin_datos(record):
    """La plantilla del registro; de sus valores, solo los que son un identificador interno."""
    plantilla = str(record.msg)[:200]
    args = record.args if isinstance(record.args, tuple) else ()
    seguros = [a for a in args if isinstance(a, str) and _IDENTIFICADOR.match(a)]
    return plantilla + (f' [{", ".join(seguros)}]' if seguros else '')


class AlertaPorCorreo(logging.Handler):
    """Handler de logging: un correo por error nuevo (ver el docstring del módulo)."""

    def __init__(self):
        super().__init__(level=logging.ERROR)

    def emit(self, record):
        if getattr(_local, 'enviando', False) or not record.exc_info or not record.exc_info[0]:
            return
        _local.enviando = True
        try:
            self._avisar(record)
        except Exception:
            pass   # un aviso nunca debe romper la solicitud ni volver a registrar un error
        finally:
            _local.enviando = False

    def _avisar(self, record):
        from django.conf import settings
        from django.core.cache import cache
        from django.core.mail import send_mail
        from django.utils import timezone

        destino = getattr(settings, 'ALERTAS_ERRORES_EMAIL', '')
        if not destino:
            return
        tipo, _valor, tb = record.exc_info
        marcos, recorrido = _recorrido(tb)
        ultimo = f'{marcos[-1].filename}:{marcos[-1].lineno}' if marcos else record.name
        firma = hashlib.sha256(f'{tipo.__module__}.{tipo.__name__}|{ultimo}'.encode()).hexdigest()[:16]
        if not cache.add(f'alerta_error_{firma}', 1, 3600):
            return   # este mismo error ya se avisó en la última hora
        cache.add('alertas_error_hora', 0, 3600)
        if cache.incr('alertas_error_hora') > MAXIMO_POR_HORA:
            return

        solicitud = getattr(record, 'request', None)
        donde = f'{solicitud.method} {solicitud.path}' if solicitud is not None else '(fuera de una solicitud)'
        entorno = 'pruebas (staging)' if getattr(settings, 'IS_STAGING', False) else (
            'producción' if getattr(settings, 'IS_PRODUCTION', False) else 'desarrollo')
        cuando = timezone.localtime().strftime('%d-%m-%Y %H:%M:%S')
        asunto = f'[Jornada40 · {entorno}] Error en el servidor: {tipo.__name__}'
        cuerpo = (
            f'Hubo un error en el servidor de Jornada40 ({entorno}).\n\n'
            f'Cuándo: {cuando} (hora de Chile)\n'
            f'Dónde: {donde}\n'
            f'Error: {tipo.__module__}.{tipo.__name__}\n'
            f'Registro: {_mensaje_sin_datos(record)} (logger {record.name})\n\n'
            f'Recorrido del código (últimas llamadas):\n{recorrido}\n\n'
            'Este aviso no incluye datos de personas ni el contenido de la solicitud. El detalle completo '
            'está en los registros del servidor (Railway → Logs), a la hora indicada. Si el mismo error se '
            'repite, no se vuelve a avisar durante una hora.\n'
        )
        send_mail(asunto, cuerpo, settings.DEFAULT_FROM_EMAIL, [destino], fail_silently=True)
