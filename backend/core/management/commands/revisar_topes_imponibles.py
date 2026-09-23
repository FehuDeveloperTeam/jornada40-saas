"""Detecta liquidaciones emitidas antes de que existiera el tope imponible.

Hasta la parametrización del motor de cálculo, las cotizaciones de AFP, salud
y cesantía se calculaban sobre el total imponible sin aplicar el tope legal.
En rentas altas eso significa cotizaciones y líquidos incorrectos.

Sin argumentos solo informa. Con --aplicar recalcula las liquidaciones que no
tengan una firma confirmada: una liquidación ya firmada por el trabajador no
se toca, porque su corrección pasa por emitir una nueva.

    python manage.py revisar_topes_imponibles
    python manage.py revisar_topes_imponibles --aplicar
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from core.indicadores import obtener_uf
from core.models import Contrato, Liquidacion, SolicitudFirma


class Command(BaseCommand):
    help = 'Informa (y opcionalmente corrige) liquidaciones calculadas sin tope imponible.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--aplicar', action='store_true',
            help='Recalcula las liquidaciones afectadas que no estén firmadas.',
        )

    def handle(self, *args, **opciones):
        # Import diferido: views importa modelos y evitamos el ciclo al cargar.
        from core.views import (_calcular_liquidacion, _parametros_previsionales,
                                _terminos_congelados, _tope_en_pesos)

        aplicar = opciones['aplicar']
        afectadas = []

        for liq in Liquidacion.objects.select_related('empleado').order_by('anio', 'mes'):
            parametros = _parametros_previsionales(liq.mes, liq.anio)
            uf = float(liq.valor_uf) or obtener_uf()
            tope = _tope_en_pesos(parametros['tope_imponible_afp_uf'], uf)
            if int(liq.total_imponible or 0) > tope:
                afectadas.append((liq, tope))

        if not afectadas:
            self.stdout.write(self.style.SUCCESS(
                'No hay liquidaciones con renta imponible sobre el tope legal.'))
            return

        self.stdout.write(self.style.WARNING(
            f'{len(afectadas)} liquidación(es) con renta sobre el tope imponible:\n'))

        firmadas = SolicitudFirma.objects.filter(
            tipo_documento='LIQUIDACION', estado='FIRMADO',
        ).values_list('liquidacion_id', flat=True)
        firmadas = set(firmadas)

        corregidas = omitidas = 0

        for liq, tope in afectadas:
            empleado = liq.empleado
            exceso = int(liq.total_imponible) - tope
            etiqueta = (f'  {empleado.rut} {empleado.apellido_paterno} '
                        f'{liq.mes:02d}/{liq.anio} · imponible '
                        f'${int(liq.total_imponible):,} · tope ${tope:,} · '
                        f'exceso ${exceso:,}'.replace(',', '.'))

            if liq.id in firmadas:
                self.stdout.write(etiqueta + self.style.NOTICE('  [FIRMADA — no se toca]'))
                omitidas += 1
                continue

            if not aplicar:
                self.stdout.write(etiqueta)
                continue

            contrato = Contrato.objects.filter(empleado=empleado).first()
            if contrato is None:
                self.stdout.write(etiqueta + self.style.ERROR('  [sin contrato — omitida]'))
                omitidas += 1
                continue

            liquido_previo = liq.sueldo_liquido
            datos = {
                'mes': liq.mes, 'anio': liq.anio,
                'dias_trabajados': liq.dias_trabajados,
                'dias_ausencia': liq.dias_ausencia,
                'dias_licencia': liq.dias_licencia,
                'dias_no_contratados': liq.dias_no_contratados,
                'detalle_items': liq.detalle_items,
            }

            with transaction.atomic():
                calculado = _calcular_liquidacion(
                    contrato, empleado, datos,
                    terminos=_terminos_congelados(liq, contrato),
                )
                for campo, valor in calculado.items():
                    setattr(liq, campo, valor)
                # El PDF anterior ya no refleja los montos corregidos.
                if liq.archivo_pdf:
                    liq.archivo_pdf.delete(save=False)
                liq.save()

            delta = liq.sueldo_liquido - liquido_previo
            self.stdout.write(etiqueta + self.style.SUCCESS(
                f'  [corregida · líquido {delta:+,}]'.replace(',', '.')))
            corregidas += 1

        self.stdout.write('')
        if aplicar:
            self.stdout.write(self.style.SUCCESS(
                f'{corregidas} corregida(s), {omitidas} omitida(s).'))
            if omitidas:
                self.stdout.write(
                    'Las firmadas requieren emitir una liquidación nueva; '
                    'corregirlas en silencio alteraría un documento ya firmado.')
        else:
            self.stdout.write(
                'Simulación. Ejecuta con --aplicar para corregir las no firmadas.')
