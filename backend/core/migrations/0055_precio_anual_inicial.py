"""Precio anual inicial de los planes pagados: 10 × el mensual ("paga 10, usa 12").

Solo completa los que no tienen precio anual; después se administra en el admin.
"""
from django.db import migrations
from django.db.models import F


def precargar(apps, schema_editor):
    Plan = apps.get_model('core', 'Plan')
    Plan.objects.filter(precio__gt=0, precio_anual=0).update(precio_anual=F('precio') * 10)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0054_plan_precio_anual'),
    ]

    operations = [
        migrations.RunPython(precargar, migrations.RunPython.noop),
    ]
