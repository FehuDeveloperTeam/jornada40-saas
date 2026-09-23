"""Lleva las categorías de comisión del contrato al catálogo de conceptos.

Se identificaban por su glosa, así que renombrar una categoría rompía la
correspondencia con las liquidaciones ya emitidas y su comisión pasaba a
calcularse en cero. El id del concepto no cambia al renombrar.

Cada categoría existente se convierte en un concepto de tipo COMISION propio
de la empresa. Las liquidaciones ya emitidas también quedan referenciadas, de
modo que recalcular una antigua siga encontrando su porcentaje.
"""
from django.db import migrations
from django.utils.text import slugify

NATURALEZA_COMISION = dict(
    es_imponible=True, es_tributable=True,
    afecta_gratificacion=True, afecta_semana_corrida=True,
)


def _codigo_libre(Concepto, empresa_id, nombre):
    base = (slugify(nombre).upper().replace('-', '_') or 'COMISION')[:36]
    codigo, sufijo = base, 1
    while Concepto.objects.filter(empresa_id=empresa_id, codigo=codigo).exists():
        sufijo += 1
        codigo = f'{base[:34]}_{sufijo}'
    return codigo


def migrar(apps, schema_editor):
    Concepto = apps.get_model('core', 'ConceptoRemuneracion')
    Contrato = apps.get_model('core', 'Contrato')
    Liquidacion = apps.get_model('core', 'Liquidacion')

    # nombre en minúsculas + empresa → concepto, para reutilizar entre contratos
    cache = {}

    def concepto_para(nombre, empresa_id):
        clave = (empresa_id, nombre.strip().lower())
        if clave in cache:
            return cache[clave]
        concepto = Concepto.objects.filter(
            empresa_id=empresa_id, tipo='COMISION', nombre=nombre.strip()).first()
        if concepto is None:
            concepto = Concepto.objects.create(
                empresa_id=empresa_id, tipo='COMISION',
                codigo=_codigo_libre(Concepto, empresa_id, nombre),
                nombre=nombre.strip(), **NATURALEZA_COMISION,
            )
        cache[clave] = concepto
        return concepto

    for contrato in Contrato.objects.select_related('empleado').iterator():
        config = contrato.comisiones_config or []
        if not config or all(c.get('concepto') for c in config if isinstance(c, dict)):
            continue
        empresa_id = contrato.empleado.empresa_id
        nueva = []
        for entrada in config:
            if not isinstance(entrada, dict):
                continue
            nombre = str(entrada.get('glosa', '') or '').strip()
            if not nombre:
                continue
            concepto = concepto_para(nombre, empresa_id)
            nueva.append({'concepto': concepto.id,
                          'porcentaje': float(entrada.get('porcentaje', 0) or 0)})
        contrato.comisiones_config = nueva
        contrato.save(update_fields=['comisiones_config'])

    # Las liquidaciones emitidas conservan su glosa; se les agrega el concepto
    # para que recalcularlas resuelva por id y no dependa del nombre.
    for liq in Liquidacion.objects.select_related('empleado').iterator():
        items = liq.detalle_items or []
        comisiones = [i for i in items
                      if isinstance(i, dict) and i.get('naturaleza') == 'COMISION']
        if not comisiones or all(i.get('concepto') for i in comisiones):
            continue
        empresa_id = liq.empleado.empresa_id
        for item in comisiones:
            if item.get('concepto'):
                continue
            nombre = str(item.get('glosa', '') or '').strip()
            if nombre:
                item['concepto'] = concepto_para(nombre, empresa_id).id
        liq.detalle_items = items
        liq.save(update_fields=['detalle_items'])


def revertir(apps, schema_editor):
    """Devuelve las categorías a su forma por glosa."""
    Concepto = apps.get_model('core', 'ConceptoRemuneracion')
    Contrato = apps.get_model('core', 'Contrato')
    nombres = {c.id: c.nombre for c in Concepto.objects.filter(tipo='COMISION')}

    for contrato in Contrato.objects.iterator():
        config = contrato.comisiones_config or []
        if not config:
            continue
        contrato.comisiones_config = [
            {'glosa': nombres.get(c.get('concepto'), c.get('glosa', '')),
             'porcentaje': c.get('porcentaje', 0)}
            for c in config if isinstance(c, dict)
        ]
        contrato.save(update_fields=['comisiones_config'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0039_detalle_items_unificado'),
    ]

    operations = [
        migrations.RunPython(migrar, revertir),
    ]
