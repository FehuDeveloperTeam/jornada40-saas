import datetime

from django.db import migrations

# Histórico de parámetros legales, verificado contra fuente oficial en
# septiembre de 2026. Cada fila rige desde el mes de la REMUNERACIÓN (no del
# pago de las cotizaciones, que ocurre al mes siguiente).
#
# Ingreso mínimo mensual
#   1 ene 2024  $460.000   Ley 21.578
#   1 jul 2024  $500.000   Ley 21.578
#   1 ene 2025  $510.636   Decreto 3 de Hacienda (reajuste IPC jul-dic 2024)
#   1 may 2025  $529.000   Ley 21.751
#   1 ene 2026  $539.000   Ley 21.751
#   1 may 2026  $553.553   Ley 21.830
#
# Topes imponibles (Superintendencia de Pensiones). Cada año se informa un
# valor provisional en enero y el definitivo desde las remuneraciones de
# febrero, por eso enero tiene fila propia en 2025 y 2026.
#   2024        84,30 UF / 126,60 UF
#   ene 2025    87,80 UF / 131,80 UF   (provisional)
#   feb 2025    87,80 UF / 131,90 UF   (definitivo)
#   ene 2026    89,90 UF / 135,10 UF   (provisional)
#   feb 2026    90,00 UF / 135,20 UF   (definitivo)

# Tasas que no cambian con estos reajustes: salud 7% (DL 3.500) y seguro de
# cesantía 0,6% trabajador / 2,4% empleador indefinido / 3,0% plazo fijo
# (Ley 19.728).
_TASAS_ESTABLES = {
    'factor_gratificacion': '4.75',
    'tasa_salud': '0.07000',
    'tasa_afc_trabajador_indefinido': '0.00600',
    'tasa_afc_empleador_indefinido': '0.02400',
    'tasa_afc_empleador_plazo': '0.03000',
}

# El SIS, la mutual y la cotización por expectativa de vida son de cargo del
# empleador: no alteran el líquido del trabajador, solo el costo empresa y el
# archivo Previred. Se arrastran los valores que ya estaban cargados porque su
# historial no se verificó en esta pasada.
_TASAS_EMPLEADOR_SIN_VERIFICAR = {
    'tasa_sis': '0.01490',
    'tasa_mutual_base': '0.00930',
    'tasa_expectativa_vida': '0.00900',
}

_NOTA = (
    'Ingreso mínimo y topes imponibles verificados contra la Dirección del '
    'Trabajo, la Superintendencia de Pensiones y los indicadores Previred '
    '(septiembre 2026). Las tasas de SIS, mutual y expectativa de vida son de '
    'cargo del empleador y se arrastran sin verificar: revisar antes de '
    'apoyarse en el costo empresa o en el archivo Previred.'
)

HISTORICO = [
    # (vigente_desde, tope AFP UF, tope AFC UF, ingreso mínimo)
    (datetime.date(2024, 1, 1), '84.30', '126.60', 460000),
    (datetime.date(2024, 7, 1), '84.30', '126.60', 500000),
    (datetime.date(2025, 1, 1), '87.80', '131.80', 510636),
    (datetime.date(2025, 2, 1), '87.80', '131.90', 510636),
    (datetime.date(2025, 5, 1), '87.80', '131.90', 529000),
    (datetime.date(2026, 1, 1), '89.90', '135.10', 539000),
    (datetime.date(2026, 2, 1), '90.00', '135.20', 539000),
    (datetime.date(2026, 5, 1), '90.00', '135.20', 553553),
]

# AFP Uno bajó su comisión de 0,49% a 0,46% al adjudicarse la licitación de
# nuevos afiliados 2025-2027; rige desde el 1 de octubre de 2025. La tasa que
# guardamos es el 10% obligatorio más la comisión. Las demás AFP no cambiaron.
TASA_UNO_DESDE = datetime.date(2025, 10, 1)
TASA_UNO = '0.10460'

# Firma de la fila sembrada en 0035: si la fila de enero 2025 sigue así, nadie
# la editó y se puede corregir. Si alguien la ajustó a mano en el admin, su
# criterio manda y esta migración no la toca.
_SEMILLA_0035 = dict(
    origen='MANUAL', confirmado=False,
    tope_imponible_afp_uf='87.80', tope_imponible_afc_uf='131.90',
    ingreso_minimo_mensual=529000,
)


def _es_la_semilla(fila) -> bool:
    return (
        fila.origen == _SEMILLA_0035['origen']
        and fila.confirmado == _SEMILLA_0035['confirmado']
        and str(fila.tope_imponible_afp_uf) == _SEMILLA_0035['tope_imponible_afp_uf']
        and str(fila.tope_imponible_afc_uf) == _SEMILLA_0035['tope_imponible_afc_uf']
        and fila.ingreso_minimo_mensual == _SEMILLA_0035['ingreso_minimo_mensual']
    )


def cargar(apps, schema_editor):
    ParametroPrevisional = apps.get_model('core', 'ParametroPrevisional')
    TasaAFP = apps.get_model('core', 'TasaAFP')

    for vigente_desde, tope_afp, tope_afc, imm in HISTORICO:
        valores = dict(
            _TASAS_ESTABLES, **_TASAS_EMPLEADOR_SIN_VERIFICAR,
            tope_imponible_afp_uf=tope_afp,
            tope_imponible_afc_uf=tope_afc,
            ingreso_minimo_mensual=imm,
            origen='MANUAL', confirmado=True, notas=_NOTA,
        )
        fila = ParametroPrevisional.objects.filter(vigente_desde=vigente_desde).first()
        if fila is None:
            ParametroPrevisional.objects.create(vigente_desde=vigente_desde, **valores)
        elif _es_la_semilla(fila):
            for campo, valor in valores.items():
                setattr(fila, campo, valor)
            fila.save()

    TasaAFP.objects.get_or_create(
        nombre='UNO', vigente_desde=TASA_UNO_DESDE,
        defaults={'tasa': TASA_UNO, 'origen': 'MANUAL', 'confirmado': True},
    )


def revertir(apps, schema_editor):
    """Deja la tabla como la dejó 0035: una sola fila en enero de 2025."""
    ParametroPrevisional = apps.get_model('core', 'ParametroPrevisional')
    TasaAFP = apps.get_model('core', 'TasaAFP')

    semilla = datetime.date(2025, 1, 1)
    ParametroPrevisional.objects.filter(
        vigente_desde__in=[f[0] for f in HISTORICO],
    ).exclude(vigente_desde=semilla).delete()

    ParametroPrevisional.objects.filter(vigente_desde=semilla).update(
        notas=(
            'Valores de partida cargados al parametrizar el motor de cálculo. '
            'Pendiente de confirmación contra fuente oficial.'
        ),
        **_SEMILLA_0035,
    )
    TasaAFP.objects.filter(nombre='UNO', vigente_desde=TASA_UNO_DESDE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0040_comisiones_a_conceptos'),
    ]

    operations = [
        migrations.RunPython(cargar, revertir),
    ]
