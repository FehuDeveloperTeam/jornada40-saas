"""Revisa que el motor de cálculo no esté operando con valores desactualizados.

Cubre las dos formas en que eso puede pasar sin que nadie lo note:

  · Los parámetros legales (topes, sueldo mínimo, tasas) quedaron viejos o
    nunca se confirmaron contra fuente oficial.
  · mindicador.cl no responde y la UF o la UTM se están resolviendo con el
    valor de respaldo escrito en el código.

    python manage.py estado_indicadores
"""
import datetime

from django.core.management.base import BaseCommand

from core.indicadores import estado_indicadores, obtener_uf, obtener_utm
from core.models import ParametroPrevisional, TasaAFP


def _clp(valor, decimales=0) -> str:
    """Formato chileno: miles con punto, decimales con coma."""
    return f'{valor:,.{decimales}f}'.translate(str.maketrans({',': '.', '.': ','}))


class Command(BaseCommand):
    help = 'Informa si se está calculando con parámetros o indicadores desactualizados.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--periodo', type=str, default=None,
            help='Período a evaluar en formato MM/AAAA (por defecto, el mes actual).',
        )

    def handle(self, *args, **opciones):
        from core.views import advertencias_parametros

        hoy = datetime.date.today()
        mes, anio = hoy.month, hoy.year
        if opciones['periodo']:
            try:
                mes, anio = (int(p) for p in opciones['periodo'].split('/'))
            except ValueError:
                self.stderr.write('Formato de período inválido. Usa MM/AAAA.')
                return

        self.stdout.write(f'Período evaluado: {mes:02d}/{anio}\n')

        # ── Parámetros legales ──────────────────────────────────────────────
        fila = ParametroPrevisional.objects.filter(
            vigente_desde__lte=datetime.date(anio, mes, 1)
        ).order_by('-vigente_desde').first()

        if fila:
            estado = 'confirmados' if fila.confirmado else 'SIN CONFIRMAR'
            self.stdout.write(
                f'Parámetros vigentes desde {fila.vigente_desde} ({estado})\n'
                f'  tope AFP/salud  {fila.tope_imponible_afp_uf} UF\n'
                f'  tope cesantía   {fila.tope_imponible_afc_uf} UF\n'
                f'  sueldo mínimo   ${_clp(fila.ingreso_minimo_mensual)}'
            )
            self.stdout.write(f'  tasas AFP       {TasaAFP.objects.count()} cargadas\n')

        # ── Indicadores del día ─────────────────────────────────────────────
        self.stdout.write(
            f'UF ${_clp(obtener_uf(), 2)} · UTM ${_clp(obtener_utm(), 2)}\n'
        )

        # ── Advertencias ────────────────────────────────────────────────────
        advertencias = advertencias_parametros(mes, anio) + estado_indicadores()

        if not advertencias:
            self.stdout.write(self.style.SUCCESS(
                'Sin advertencias: los valores están vigentes y confirmados.'))
            return

        self.stdout.write(self.style.WARNING(f'\n{len(advertencias)} advertencia(s):'))
        for texto in advertencias:
            self.stdout.write(self.style.WARNING(f'  · {texto}'))
        self.stdout.write(
            '\nPara actualizar: python manage.py sincronizar_previred '
            '(propone) y luego confirma desde el admin.')
