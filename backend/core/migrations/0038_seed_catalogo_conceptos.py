"""Catálogo base de haberes y descuentos de uso corriente en Chile.

Son los conceptos del sistema (empresa en null), disponibles para todas las
empresas. Cada una puede además crear los suyos.

Deliberadamente NO se incluye el APV: su aporte reduce la base tributable, y
ese tratamiento todavía no está implementado en el motor de cálculo. Cargarlo
como un descuento común daría un impuesto único mayor al que corresponde.
"""
from django.db import migrations

# (codigo, nombre, tipo)
CONCEPTOS = [
    # ── Haberes imponibles ──────────────────────────────────────────────────
    ('BONO_PRODUCCION',     'Bono de producción',              'HABER_IMPONIBLE'),
    ('BONO_METAS',          'Bono por cumplimiento de metas',  'HABER_IMPONIBLE'),
    ('BONO_RESPONSABILIDAD','Bono de responsabilidad',         'HABER_IMPONIBLE'),
    ('BONO_ASISTENCIA',     'Bono de asistencia',              'HABER_IMPONIBLE'),
    ('BONO_TURNO',          'Bono de turno',                   'HABER_IMPONIBLE'),
    ('AGUINALDO',           'Aguinaldo',                       'HABER_IMPONIBLE'),
    ('TRATO',               'Trato o tarea',                   'HABER_IMPONIBLE'),

    # ── Horas extras ────────────────────────────────────────────────────────
    ('HORA_EXTRA_50',       'Horas extras 50%',                'HORA_EXTRA'),
    ('HORA_EXTRA_100',      'Horas extras 100%',               'HORA_EXTRA'),

    # ── Haberes no imponibles ───────────────────────────────────────────────
    ('COLACION',            'Asignación de colación',          'HABER_NO_IMPONIBLE'),
    ('MOVILIZACION',        'Asignación de movilización',      'HABER_NO_IMPONIBLE'),
    ('VIATICO',             'Viático',                         'HABER_NO_IMPONIBLE'),
    ('PERDIDA_CAJA',        'Asignación de pérdida de caja',   'HABER_NO_IMPONIBLE'),
    ('DESGASTE_HERRAMIENTAS','Asignación por desgaste de herramientas', 'HABER_NO_IMPONIBLE'),
    ('SALA_CUNA',           'Sala cuna',                       'HABER_NO_IMPONIBLE'),
    ('ASIGNACION_FAMILIAR', 'Asignación familiar',             'HABER_NO_IMPONIBLE'),

    # ── Descuentos ──────────────────────────────────────────────────────────
    ('ANTICIPO',            'Anticipo de sueldo',              'DESCUENTO'),
    ('PRESTAMO',            'Cuota de préstamo',               'DESCUENTO'),
    ('CUOTA_SINDICAL',      'Cuota sindical',                  'DESCUENTO'),
    ('SEGURO_COMPLEMENTARIO','Seguro complementario de salud', 'DESCUENTO'),
    ('CAJA_COMPENSACION',   'Crédito caja de compensación',    'DESCUENTO'),
    ('RETENCION_JUDICIAL',  'Retención judicial',              'DESCUENTO'),
    ('DESCUENTO_VARIOS',    'Otros descuentos',                'DESCUENTO'),
]


def cargar(apps, schema_editor):
    Concepto = apps.get_model('core', 'ConceptoRemuneracion')
    # En una migración el modelo es histórico y no trae save() ni el mapa de
    # naturaleza, así que se replica acá.
    naturaleza = {
        'HABER_IMPONIBLE':    (True,  True,  True,  False),
        'HABER_NO_IMPONIBLE': (False, False, False, False),
        'HORA_EXTRA':         (True,  True,  True,  False),
        'COMISION':           (True,  True,  True,  True),
        'DESCUENTO':          (False, False, False, False),
    }
    for codigo, nombre, tipo in CONCEPTOS:
        imponible, tributable, gratificacion, semana_corrida = naturaleza[tipo]
        Concepto.objects.get_or_create(
            codigo=codigo, empresa=None,
            defaults={
                'nombre': nombre, 'tipo': tipo,
                'es_imponible': imponible, 'es_tributable': tributable,
                'afecta_gratificacion': gratificacion,
                'afecta_semana_corrida': semana_corrida,
            },
        )


def revertir(apps, schema_editor):
    codigos = [c[0] for c in CONCEPTOS]
    apps.get_model('core', 'ConceptoRemuneracion').objects.filter(
        empresa__isnull=True, codigo__in=codigos).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0037_concepto_remuneracion'),
    ]

    operations = [
        migrations.RunPython(cargar, revertir),
    ]
