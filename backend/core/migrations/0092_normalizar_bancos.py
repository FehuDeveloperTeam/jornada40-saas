from django.db import migrations


def normalizar(apps, schema_editor):
    """Pasa los bancos escritos a mano al nombre de la lista cerrada (core/bancos.py).
    Lo que no se reconoce queda igual: la carpeta pide elegirlo de la lista."""
    from core.bancos import normalizar_banco
    Empleado = apps.get_model('core', 'Empleado')
    for emp in Empleado.objects.exclude(banco__isnull=True).exclude(banco='').only('id', 'banco'):
        banco = normalizar_banco(emp.banco)
        if banco and banco != emp.banco:
            Empleado.objects.filter(pk=emp.pk).update(banco=banco)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0091_denuncia_origen'),
    ]

    operations = [
        migrations.RunPython(normalizar, migrations.RunPython.noop),
    ]
