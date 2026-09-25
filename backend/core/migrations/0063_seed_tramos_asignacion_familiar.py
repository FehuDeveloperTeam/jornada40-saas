"""Tramos de asignación familiar publicados por la SUSESO (monto por carga y
ingreso máximo del beneficiario). Solo crea los que faltan: si alguien ya los
cargó en el admin, se respeta lo que hay."""
import datetime

from django.db import migrations

TRAMOS = [
    # (vigente desde, tramo, monto, renta hasta, fuente)
    (datetime.date(2025, 5, 1), 'A', 22007, 620251, 'SUSESO, Circular O-01-S-01954-2025'),
    (datetime.date(2025, 5, 1), 'B', 13505, 905941, 'SUSESO, Circular O-01-S-01954-2025'),
    (datetime.date(2025, 5, 1), 'C', 4267, 1412957, 'SUSESO, Circular O-01-S-01954-2025'),
    (datetime.date(2026, 1, 1), 'A', 22007, 631976, 'SUSESO, Circular O-01-S-04473-2025'),
    (datetime.date(2026, 1, 1), 'B', 13505, 923067, 'SUSESO, Circular O-01-S-04473-2025'),
    (datetime.date(2026, 1, 1), 'C', 4267, 1439668, 'SUSESO, Circular O-01-S-04473-2025'),
    (datetime.date(2026, 5, 1), 'A', 22601, 649039, 'Ley N° 21.830 (D.O. 22.06.2026), SUSESO O-01-S-02728-2026'),
    (datetime.date(2026, 5, 1), 'B', 13870, 947990, 'Ley N° 21.830 (D.O. 22.06.2026), SUSESO O-01-S-02728-2026'),
    (datetime.date(2026, 5, 1), 'C', 4382, 1478539, 'Ley N° 21.830 (D.O. 22.06.2026), SUSESO O-01-S-02728-2026'),
]


def cargar(apps, schema_editor):
    Tramo = apps.get_model('core', 'TramoAsignacionFamiliar')
    for desde, tramo, monto, hasta, fuente in TRAMOS:
        Tramo.objects.get_or_create(vigente_desde=desde, tramo=tramo,
                                    defaults={'monto': monto, 'renta_hasta': hasta, 'fuente': fuente})


def quitar(apps, schema_editor):
    Tramo = apps.get_model('core', 'TramoAsignacionFamiliar')
    for desde, tramo, *_ in TRAMOS:
        Tramo.objects.filter(vigente_desde=desde, tramo=tramo).delete()


class Migration(migrations.Migration):
    dependencies = [('core', '0062_tramos_asignacion_familiar')]
    operations = [migrations.RunPython(cargar, quitar)]
