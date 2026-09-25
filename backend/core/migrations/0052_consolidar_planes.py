"""Deja un solo juego de planes: Semilla, Starter, Pyme y Corporativo.

En producción convivían los planes antiguos ("Plan Semilla", "Plan Pyme",
"Plan Corporativo"), que quedaron con nivel 1 al crearse el campo, con los
que creó 0048_planes_base. Con nivel 1 un cliente Pyme se trataba como
Semilla: marca de agua y funciones bloqueadas. Aquí cada plan antiguo pasa
sus clientes, suscripciones y pagos al plan equivalente y queda inactivo (no
se borra: hay registros que lo referencian).
"""
from django.db import migrations

CANONICOS = {
    'semilla':     {'nombre': 'Semilla',     'precio': 0,     'max_empresas': 1,  'limite_trabajadores': 3,   'nivel': 1},
    'starter':     {'nombre': 'Starter',     'precio': 16990, 'max_empresas': 1,  'limite_trabajadores': 10,  'nivel': 2},
    'pyme':        {'nombre': 'Pyme',        'precio': 39990, 'max_empresas': 3,  'limite_trabajadores': 75,  'nivel': 3},
    'corporativo': {'nombre': 'Corporativo', 'precio': 89990, 'max_empresas': 10, 'limite_trabajadores': 250, 'nivel': 4},
}


def _familia(nombre):
    n = (nombre or '').strip().lower()
    if n.startswith('plan '):
        n = n[5:].strip()
    return n if n in CANONICOS else None


def consolidar(apps, schema_editor):
    Plan = apps.get_model('core', 'Plan')
    Cliente = apps.get_model('core', 'Cliente')
    Suscripcion = apps.get_model('core', 'Suscripcion')
    EventoPasarela = apps.get_model('core', 'EventoPasarela')

    canonico = {}
    for familia, datos in CANONICOS.items():
        plan = Plan.objects.filter(nombre__iexact=datos['nombre']).order_by('id').first()
        if plan is None:
            plan = Plan.objects.create(activo=True, **datos)
        else:
            # Precios y límites se administran en el admin; aquí solo se
            # asegura el nivel (lo que decide las funciones) y que esté activo.
            plan.nivel = datos['nivel']
            plan.activo = True
            plan.save(update_fields=['nivel', 'activo'])
        canonico[familia] = plan

    for plan in Plan.objects.all():
        familia = _familia(plan.nombre)
        if familia is None or plan.pk == canonico[familia].pk:
            continue
        destino = canonico[familia]
        Cliente.objects.filter(plan=plan).update(plan=destino)
        Suscripcion.objects.filter(plan=plan).update(plan=destino)
        EventoPasarela.objects.filter(plan=plan).update(plan=destino)
        plan.activo = False
        plan.save(update_fields=['activo'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0051_anios_previos_feriado'),
    ]

    operations = [
        migrations.RunPython(consolidar, migrations.RunPython.noop),
    ]
