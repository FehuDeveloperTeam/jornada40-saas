"""Código del Libro de Remuneraciones Electrónico en los conceptos del catálogo
del sistema (Manual LRE v8.0, Anexo N°1). Los valores quedan fijos aquí: si el
mapeo cambia, se hace otra migración. Solo completa los que estaban vacíos."""
from django.db import migrations

CODIGOS = {
    'BONO_PRODUCCION': '2113', 'BONO_METAS': '2113', 'BONO_ASISTENCIA': '2113', 'BONO_RESPONSABILIDAD': '2111',
    'BONO_TURNO': '2111', 'AGUINALDO': '2110', 'TRATO': '2112',
    'HORA_EXTRA_50': '2102', 'HORA_EXTRA_100': '2102',
    'COLACION': '2301', 'MOVILIZACION': '2302', 'VIATICO': '2303', 'PERDIDA_CAJA': '2304',
    'DESGASTE_HERRAMIENTAS': '2305', 'SALA_CUNA': '2308', 'ASIGNACION_FAMILIAR': '2311',
    'ANTICIPO': '3188', 'PRESTAMO': '3188', 'CUOTA_SINDICAL': '3171', 'SEGURO_COMPLEMENTARIO': '3183',
    'CAJA_COMPENSACION': '3110', 'RETENCION_JUDICIAL': '3186', 'DESCUENTO_VARIOS': '3185',
}


def asignar(apps, schema_editor):
    Concepto = apps.get_model('core', 'ConceptoRemuneracion')
    for codigo, lre in CODIGOS.items():
        Concepto.objects.filter(empresa__isnull=True, codigo=codigo, codigo_lre='').update(codigo_lre=lre)


def quitar(apps, schema_editor):
    Concepto = apps.get_model('core', 'ConceptoRemuneracion')
    for codigo, lre in CODIGOS.items():
        Concepto.objects.filter(empresa__isnull=True, codigo=codigo, codigo_lre=lre).update(codigo_lre='')


class Migration(migrations.Migration):
    dependencies = [('core', '0060_datos_lre_empleado')]
    operations = [migrations.RunPython(asignar, quitar)]
