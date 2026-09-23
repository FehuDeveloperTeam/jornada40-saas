import datetime

from django.db import migrations

# Valores verificados contra "Indicadores Previsionales PREVIRED" de
# septiembre 2026 (cotizaciones a pagar en octubre, remuneraciones de
# septiembre). Topes, ingreso mínimo y tasas AFP ya calzaban; cambian las
# tasas de cargo del empleador.
SEPTIEMBRE_2026 = datetime.date(2026, 9, 1)
VALORES = {
    'tope_imponible_afp_uf': '90.00',
    'tope_imponible_afc_uf': '135.20',
    'ingreso_minimo_mensual': 553553,
    'tasa_sis': '0.01780',
    'tasa_expectativa_vida': '0.00720',
    'tasa_rentabilidad_protegida': '0.00900',
    'tasa_afp_empleador': '0.00100',
    'tasa_afc_empleador_11_anios': '0.00800',
    'origen': 'MANUAL',
    'confirmado': True,
    'notas': 'Verificado contra Indicadores Previsionales Previred de septiembre 2026 (PDF).',
}

# Los aportes de la reforma (Ley 21.735) empiezan con las remuneraciones de
# agosto de 2025: antes no existían.
INICIO_REFORMA = datetime.date(2025, 8, 1)


def cargar(apps, schema_editor):
    ParametroPrevisional = apps.get_model('core', 'ParametroPrevisional')
    ParametroPrevisional.objects.filter(vigente_desde__lt=INICIO_REFORMA).update(
        tasa_rentabilidad_protegida=0, tasa_afp_empleador=0)

    anterior = ParametroPrevisional.objects.filter(vigente_desde__lt=SEPTIEMBRE_2026) \
        .order_by('-vigente_desde').first()
    base = {}
    if anterior:
        base = {campo: getattr(anterior, campo) for campo in (
            'factor_gratificacion', 'tasa_salud', 'tasa_afc_trabajador_indefinido',
            'tasa_afc_empleador_indefinido', 'tasa_afc_empleador_plazo', 'tasa_mutual_base')}
    ParametroPrevisional.objects.update_or_create(
        vigente_desde=SEPTIEMBRE_2026, defaults={**base, **VALORES})


def revertir(apps, schema_editor):
    apps.get_model('core', 'ParametroPrevisional').objects.filter(
        vigente_desde=SEPTIEMBRE_2026).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0044_parametros_reforma_pensiones'),
    ]

    operations = [
        migrations.RunPython(cargar, revertir),
    ]
