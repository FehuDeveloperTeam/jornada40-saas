"""Propone parámetros previsionales leídos de los indicadores de Previred.

Previred publica mensualmente la tabla que usa de facto toda la industria de
remuneraciones en Chile: topes imponibles, tasas de cada AFP e ingreso mínimo.
No existe una API oficial para estos valores (a diferencia de la UF y la UTM,
que sí son indicadores publicados), así que se leen de la página.

Este comando NUNCA aplica lo que lee. Crea una propuesta en estado
confirmado=False para que una persona la revise y la confirme desde el admin.
Leer mal un tope imponible y aplicarlo en silencio sería peor que quedarse
con el valor viejo.

Si la página cambia de maquetado, el comando informa qué no pudo interpretar
y no escribe nada. Cada valor extraído se contrasta contra un rango plausible
antes de ser aceptado.

    python manage.py sincronizar_previred                  # solo informa
    python manage.py sincronizar_previred --crear-propuesta
"""
import datetime
import re

import requests
from django.core.management.base import BaseCommand

from core.models import ParametroPrevisional, TasaAFP

URL_PREVIRED = 'https://www.previred.com/indicadores-previsionales/'

# Rango plausible de cada valor. Si lo leído cae fuera, se descarta: es señal
# de que el patrón capturó otra cosa de la página.
RANGOS = {
    'tope_imponible_afp_uf': (60.0, 200.0),
    'tope_imponible_afc_uf': (90.0, 300.0),
    'ingreso_minimo_mensual': (300_000, 2_000_000),
    # La página informa porcentajes (11,44), no fracciones: el rango valida lo
    # que se lee, y la conversión a fracción viene después.
    'tasa_afp_pct': (8.0, 16.0),
}

AFP_CONOCIDAS = ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO']


def _texto_plano(html: str) -> str:
    """Quita marcado y normaliza espacios.

    Se trabaja sobre el texto y no sobre selectores CSS a propósito: el texto
    sobrevive mejor a los rediseños que la estructura del DOM.
    """
    sin_script = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', html, flags=re.S | re.I)
    sin_tags = re.sub(r'<[^>]+>', ' ', sin_script)
    sin_entidades = (sin_tags.replace('&nbsp;', ' ').replace('&amp;', '&')
                             .replace('&oacute;', 'ó').replace('&iacute;', 'í'))
    return re.sub(r'\s+', ' ', sin_entidades)


def _a_numero(texto: str) -> float:
    """Convierte un número en formato chileno: 87,8 → 87.8 · 529.000 → 529000."""
    limpio = texto.strip().replace('$', '').replace(' ', '')
    if ',' in limpio:
        limpio = limpio.replace('.', '').replace(',', '.')
    else:
        limpio = limpio.replace('.', '')
    return float(limpio)


def _buscar(texto: str, patron: str, rango_clave: str):
    """Primer valor que calce con el patrón y caiga dentro de su rango."""
    minimo, maximo = RANGOS[rango_clave]
    for coincidencia in re.finditer(patron, texto, flags=re.I):
        try:
            valor = _a_numero(coincidencia.group(1))
        except ValueError:
            continue
        if minimo <= valor <= maximo:
            return valor
    return None


class Command(BaseCommand):
    help = 'Lee los indicadores previsionales de Previred y propone una actualización.'

    def add_arguments(self, parser):
        parser.add_argument('--crear-propuesta', action='store_true',
                            help='Crea la fila en estado sin confirmar si hay cambios.')
        parser.add_argument('--vigente-desde', type=str, default=None,
                            help='Fecha de vigencia de la propuesta (AAAA-MM-DD). '
                                 'Por defecto, el primer día del mes actual.')
        parser.add_argument('--url', type=str, default=URL_PREVIRED)

    def handle(self, *args, **opciones):
        try:
            resp = requests.get(
                opciones['url'], timeout=20,
                headers={'User-Agent': 'Jornada40/1.0 (actualizacion de indicadores previsionales)'},
            )
            resp.raise_for_status()
        except Exception as exc:
            self.stderr.write(self.style.ERROR(
                f'No se pudo consultar Previred: {exc}\nNo se modificó nada.'))
            return

        texto = _texto_plano(resp.text)

        leido = {
            'tope_imponible_afp_uf': _buscar(
                texto,
                r'tope\s+imponible[^.]{0,60}?([\d.,]+)\s*UF',
                'tope_imponible_afp_uf'),
            'tope_imponible_afc_uf': _buscar(
                texto,
                r'(?:cesant[íi]a|seguro\s+de\s+cesant[íi]a)[^.]{0,60}?([\d.,]+)\s*UF',
                'tope_imponible_afc_uf'),
            'ingreso_minimo_mensual': _buscar(
                texto,
                r'ingreso\s+m[íi]nimo[^.]{0,80}?\$?\s*([\d.,]+)',
                'ingreso_minimo_mensual'),
        }

        tasas = {}
        for afp in AFP_CONOCIDAS:
            porcentaje = _buscar(texto, rf'{afp}[^%]{{0,40}}?([\d.,]+)\s*%', 'tasa_afp_pct')
            if porcentaje is None:
                porcentaje = _buscar(texto, rf'{afp}[^\d]{{0,40}}?([\d.,]+)', 'tasa_afp_pct')
            if porcentaje is not None:
                # El modelo guarda fracción: 11,44% → 0.1144
                tasas[afp] = round(porcentaje / 100, 5)

        self.stdout.write('Valores interpretados desde Previred:\n')
        faltantes = []
        for campo, valor in leido.items():
            if valor is None:
                faltantes.append(campo)
                self.stdout.write(self.style.ERROR(f'  {campo}: no se pudo interpretar'))
            else:
                self.stdout.write(f'  {campo}: {valor}')
        self.stdout.write(f'  tasas AFP interpretadas: {len(tasas)} de {len(AFP_CONOCIDAS)}')
        for nombre, tasa in sorted(tasas.items()):
            self.stdout.write(f'    {nombre}: {tasa:.2%}')

        if faltantes or not tasas:
            self.stdout.write(self.style.ERROR(
                '\nLa lectura quedó incompleta, probablemente porque Previred cambió '
                'el maquetado de la página. No se escribió nada.\n'
                'Revisa los patrones en este comando o carga los valores a mano '
                'desde el admin.'))
            return

        # ── Comparación con lo vigente ──────────────────────────────────────
        vigente = ParametroPrevisional.objects.order_by('-vigente_desde').first()
        if vigente:
            iguales = (
                float(vigente.tope_imponible_afp_uf) == leido['tope_imponible_afp_uf']
                and float(vigente.tope_imponible_afc_uf) == leido['tope_imponible_afc_uf']
                and vigente.ingreso_minimo_mensual == int(leido['ingreso_minimo_mensual'])
            )
            if iguales:
                self.stdout.write(self.style.SUCCESS(
                    f'\nCoincide con lo vigente desde {vigente.vigente_desde}. '
                    f'No hay nada que actualizar.'))
                if not vigente.confirmado:
                    self.stdout.write(
                        'Eso sí, esa fila sigue marcada como no confirmada: '
                        'ahora tienes respaldo para confirmarla desde el admin.')
                return
            self.stdout.write(self.style.WARNING(
                f'\nDifiere de lo vigente desde {vigente.vigente_desde}:'))
            self.stdout.write(
                f'  tope AFP   {vigente.tope_imponible_afp_uf} → {leido["tope_imponible_afp_uf"]} UF\n'
                f'  tope AFC   {vigente.tope_imponible_afc_uf} → {leido["tope_imponible_afc_uf"]} UF\n'
                f'  sueldo mín ${vigente.ingreso_minimo_mensual:,} → '
                f'${int(leido["ingreso_minimo_mensual"]):,}'.replace(',', '.'))

        if not opciones['crear_propuesta']:
            self.stdout.write(
                '\nSimulación. Ejecuta con --crear-propuesta para dejarlo registrado '
                'como propuesta pendiente de confirmación.')
            return

        # ── Creación de la propuesta (nunca confirmada) ─────────────────────
        if opciones['vigente_desde']:
            vigencia = datetime.date.fromisoformat(opciones['vigente_desde'])
        else:
            hoy = datetime.date.today()
            vigencia = datetime.date(hoy.year, hoy.month, 1)

        existente = ParametroPrevisional.objects.filter(vigente_desde=vigencia).first()
        if existente and existente.confirmado:
            self.stdout.write(self.style.ERROR(
                f'Ya existe una fila confirmada para {vigencia}. No se toca: '
                f'si corresponde actualizarla, hazlo desde el admin.'))
            return

        base = {campo: getattr(vigente, campo) for campo in (
            'tasa_salud', 'tasa_afc_trabajador_indefinido', 'tasa_afc_empleador_indefinido',
            'tasa_afc_empleador_plazo', 'tasa_sis', 'tasa_mutual_base',
            'tasa_expectativa_vida', 'factor_gratificacion',
        )} if vigente else {}

        propuesta, creada = ParametroPrevisional.objects.update_or_create(
            vigente_desde=vigencia,
            defaults={
                **base,
                'tope_imponible_afp_uf': leido['tope_imponible_afp_uf'],
                'tope_imponible_afc_uf': leido['tope_imponible_afc_uf'],
                'ingreso_minimo_mensual': int(leido['ingreso_minimo_mensual']),
                'origen': 'PREVIRED',
                'confirmado': False,
                'notas': (f'Propuesta leída de Previred el '
                          f'{datetime.date.today()}. Requiere revisión humana '
                          f'antes de marcarse como confirmada.'),
            },
        )
        for nombre, tasa in tasas.items():
            TasaAFP.objects.update_or_create(
                nombre=nombre, vigente_desde=vigencia,
                defaults={'tasa': tasa, 'origen': 'PREVIRED', 'confirmado': False},
            )

        verbo = 'creada' if creada else 'actualizada'
        self.stdout.write(self.style.SUCCESS(
            f'\nPropuesta {verbo} con vigencia {vigencia}, en estado SIN CONFIRMAR.'))
        self.stdout.write(
            'El cálculo sigue usando los valores anteriores: una propuesta no '
            'rige hasta que la confirmas.\n'
            'Revísala en el admin, contrástala con la circular de la '
            'Superintendencia y marca "confirmado" para que entre en vigencia.')
