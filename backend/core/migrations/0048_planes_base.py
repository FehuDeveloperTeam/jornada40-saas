"""Crea los planes base si no existen.

Antes los creaba un script del Procfile, que Railway no ejecuta (construye con
el Dockerfile). Solo crea los que falten: los precios y límites de un plan que
ya existe se siguen cambiando desde el admin y esta migración no los toca.
"""
from django.db import migrations

PLANES = [
    {'nombre': 'Semilla',     'precio': 0,     'max_empresas': 1,  'limite_trabajadores': 3,   'nivel': 1},
    {'nombre': 'Starter',     'precio': 16990, 'max_empresas': 1,  'limite_trabajadores': 10,  'nivel': 2},
    {'nombre': 'Pyme',        'precio': 39990, 'max_empresas': 3,  'limite_trabajadores': 75,  'nivel': 3},
    {'nombre': 'Corporativo', 'precio': 89990, 'max_empresas': 10, 'limite_trabajadores': 250, 'nivel': 4},
]


def crear_planes(apps, schema_editor):
    Plan = apps.get_model('core', 'Plan')
    for datos in PLANES:
        if not Plan.objects.filter(nombre__iexact=datos['nombre']).exists():
            Plan.objects.create(activo=True, **datos)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0047_finiquito_aviso_previo'),
    ]

    operations = [
        # Al revertir no se borran: podrían tener clientes asociados.
        migrations.RunPython(crear_planes, migrations.RunPython.noop),
    ]
