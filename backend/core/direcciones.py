"""Dirección por partes: calle, número (o "sin número" con altura/kilómetro) y depto.

Empresa, Empleado y Cliente guardan las partes y además `direccion`, el texto
completo que usan los documentos, el LRE y Mi DT; el modelo lo arma al guardar
(`armar_direccion`). Una dirección antigua sin partes se sigue leyendo como antes
y `partes()` la separa con `registro_dt.separar_direccion`.

Ejemplos: "Merced 280, depto 34" · "San Pedro de Lilahue S/N, km 2".
"""
import re

CAMPOS = ('calle', 'numero', 'sin_numero', 'depto')


def armar_direccion(calle, numero='', sin_numero=False, depto=''):
    calle = ' '.join(str(calle or '').split())
    numero = ' '.join(str(numero or '').split())
    depto = ' '.join(str(depto or '').split())
    if not calle:
        return ''
    if sin_numero:
        texto = f'{calle} S/N' + (f', {numero}' if numero else '')
    else:
        texto = f'{calle} {numero}'.strip()
    return texto + (f', {depto}' if depto else '')


def completar(obj):
    """Antes de guardar: con calle, `direccion` sale de las partes."""
    if getattr(obj, 'calle', ''):
        obj.direccion = armar_direccion(obj.calle, obj.numero, obj.sin_numero, obj.depto)


def partes(obj):
    """(calle, número, depto) para Mi DT. Sin número → 'S/N'."""
    if getattr(obj, 'calle', ''):
        return obj.calle, ('S/N' if obj.sin_numero else obj.numero), obj.depto
    from .registro_dt import separar_direccion
    return separar_direccion(obj.direccion)


_SN = re.compile(r'^(.*?)[\s,]*\b(?:S/N|S/Nº|S\.N\.|SN|SIN N[UÚ]MERO|SIN NRO\.?)\b[\s,]*(.*)$', re.I)


def desde_texto(direccion):
    """Partes para una dirección escrita en un solo campo, o None si no se pueden separar con seguridad."""
    texto = ' '.join(str(direccion or '').split()).strip(' ,')
    if not texto:
        return None
    m = _SN.match(texto)
    if m and m.group(1).strip(' ,'):
        return {'calle': m.group(1).strip(' ,'), 'numero': m.group(2).strip(' ,')[:30], 'sin_numero': True, 'depto': ''}
    from .registro_dt import separar_direccion
    calle, numero, depto = separar_direccion(texto)
    if not numero:
        return None
    return {'calle': calle, 'numero': numero, 'sin_numero': False, 'depto': depto}
