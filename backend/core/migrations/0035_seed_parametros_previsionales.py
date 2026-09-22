import datetime

from django.db import migrations

# Valores de partida. Quedan con confirmado=False a propósito: hay que
# contrastarlos con la Superintendencia de Pensiones y la Dirección del
# Trabajo, y corregirlos desde el admin (no requiere despliegue).
VIGENTE_DESDE = datetime.date(2025, 1, 1)

PARAMETROS = {
    'tope_imponible_afp_uf': '87.80',
    'tope_imponible_afc_uf': '131.90',
    'ingreso_minimo_mensual': 529000,
    'factor_gratificacion': '4.75',
    'tasa_salud': '0.07000',
    'tasa_afc_trabajador_indefinido': '0.00600',
    'tasa_afc_empleador_indefinido': '0.02400',
    'tasa_afc_empleador_plazo': '0.03000',
    'tasa_sis': '0.01490',
    'tasa_mutual_base': '0.00930',
    'tasa_expectativa_vida': '0.00900',
    'confirmado': False,
    'notas': (
        'Valores de partida cargados al parametrizar el motor de cálculo. '
        'Pendiente de confirmación contra fuente oficial.'
    ),
}

# Tasas que estaban embebidas en el código antes de esta migración.
TASAS_AFP = {
    'MODELO': '0.10580',
    'HABITAT': '0.11270',
    'PROVIDA': '0.11450',
    'CAPITAL': '0.11440',
    'CUPRUM': '0.11440',
    'PLANVITAL': '0.11160',
    'UNO': '0.10490',
}


def cargar(apps, schema_editor):
    ParametroPrevisional = apps.get_model('core', 'ParametroPrevisional')
    TasaAFP = apps.get_model('core', 'TasaAFP')

    ParametroPrevisional.objects.get_or_create(
        vigente_desde=VIGENTE_DESDE, defaults=PARAMETROS,
    )
    for nombre, tasa in TASAS_AFP.items():
        TasaAFP.objects.get_or_create(
            nombre=nombre, vigente_desde=VIGENTE_DESDE, defaults={'tasa': tasa},
        )


def revertir(apps, schema_editor):
    apps.get_model('core', 'ParametroPrevisional').objects.filter(
        vigente_desde=VIGENTE_DESDE).delete()
    apps.get_model('core', 'TasaAFP').objects.filter(
        vigente_desde=VIGENTE_DESDE).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_parametros_previsionales'),
    ]

    operations = [
        migrations.RunPython(cargar, revertir),
    ]
