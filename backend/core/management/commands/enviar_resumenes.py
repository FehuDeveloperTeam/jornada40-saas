"""Envía el resumen por correo a los empleadores a quienes les toca hoy.

Pensado para correr una vez al día (cron de Railway). Es seguro repetirlo el
mismo día: quien ya recibió su resumen hoy no recibe otro.
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.models import Cliente, UsuarioEquipo
from core.views.resumen import corresponde, enviar, enviar_equipo

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Envía el resumen de pendientes a los empleadores y a sus equipos según su frecuencia.'

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
        # Usuarios del equipo: solo sus módulos y empresas.
        for ue in (UsuarioEquipo.objects.filter(estado='ACTIVO', usuario__is_active=True)
                   .exclude(frecuencia_resumen='NUNCA').select_related('cuenta__perfil_cliente')):
            if not corresponde(ue, hoy):
                continue
            revisados += 1
            try:
                enviados += enviar_equipo(ue, hoy)
            except Exception:
                errores += 1
                logger.exception('Resumen: falló el envío al usuario del equipo %s', ue.id)
                self.stderr.write(f'No se pudo enviar el resumen al usuario del equipo {ue.id}')
        self.stdout.write(f'Resumen: {revisados} revisados, {enviados} enviados, {errores} con error.')
