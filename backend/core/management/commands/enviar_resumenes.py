"""Envía el resumen por correo a los empleadores a quienes les toca hoy.

Pensado para correr una vez al día (cron de Railway). Es seguro repetirlo el
mismo día: quien ya recibió su resumen hoy no recibe otro.
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Cliente
from core.views.resumen import corresponde, enviar

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Envía el resumen de pendientes a los empleadores según su frecuencia.'

    def handle(self, *args, **opciones):
        hoy = timezone.localdate()
        enviados = revisados = errores = 0
        for cliente in Cliente.objects.exclude(frecuencia_resumen='NUNCA').select_related('usuario'):
            if not corresponde(cliente, hoy):
                continue
            revisados += 1
            try:
                enviados += enviar(cliente, hoy)
            except Exception:
                errores += 1
                logger.exception('Resumen: falló el envío al cliente %s', cliente.id)
                self.stderr.write(f'No se pudo enviar el resumen al cliente {cliente.id}')
        self.stdout.write(f'Resumen: {revisados} revisados, {enviados} enviados, {errores} con error.')
