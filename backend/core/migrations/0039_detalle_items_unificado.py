"""Unifica las cinco listas de detalle en una sola.

El traspaso no inventa ni pierde información: la lista de origen ES la
naturaleza del ítem, así que se traslada tal cual. Los ítems históricos quedan
sin concepto del catálogo, que es lo acordado para no adivinar a qué concepto
correspondía cada glosa escrita a mano.

Las columnas antiguas se conservan con su contenido: nada las lee ya, pero
permiten revertir sin pérdida si algo saliera mal.
"""
from django.db import migrations, models

# Lista de origen → naturaleza del ítem
ORIGEN = [
    ('detalle_haberes_imponibles',    'HABER_IMPONIBLE'),
    ('detalle_horas_extras',          'HORA_EXTRA'),
    ('detalle_comisiones',            'COMISION'),
    ('detalle_haberes_no_imponibles', 'HABER_NO_IMPONIBLE'),
    ('detalle_otros_descuentos',      'DESCUENTO'),
]


def unificar(apps, schema_editor):
    Liquidacion = apps.get_model('core', 'Liquidacion')
    for liq in Liquidacion.objects.all().iterator():
        if liq.detalle_items:
            continue
        items = []
        for campo, naturaleza in ORIGEN:
            for item in (getattr(liq, campo, None) or []):
                if not isinstance(item, dict):
                    continue
                items.append({**item, 'naturaleza': naturaleza,
                              'concepto': item.get('concepto')})
        if items:
            liq.detalle_items = items
            liq.save(update_fields=['detalle_items'])


def separar(apps, schema_editor):
    """Reconstruye las listas antiguas desde la unificada."""
    Liquidacion = apps.get_model('core', 'Liquidacion')
    por_naturaleza = {naturaleza: campo for campo, naturaleza in ORIGEN}
    for liq in Liquidacion.objects.all().iterator():
        listas = {campo: [] for campo, _ in ORIGEN}
        for item in (liq.detalle_items or []):
            campo = por_naturaleza.get(item.get('naturaleza'))
            if campo:
                listas[campo].append({k: v for k, v in item.items() if k != 'naturaleza'})
        for campo, valores in listas.items():
            setattr(liq, campo, valores)
        liq.save(update_fields=list(listas))


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0038_seed_catalogo_conceptos'),
    ]

    operations = [
        migrations.AddField(
            model_name='liquidacion',
            name='detalle_items',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(unificar, separar),
    ]
