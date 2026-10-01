"""Vuelve a cifrar los datos reservados con la clave actual (la primera de KARIN_CLAVES_CIFRADO).

Rotar una clave: agregar la nueva al principio de KARIN_CLAVES_CIFRADO
(manteniendo la antigua después), desplegar, correr este comando y recién
entonces quitar la clave antigua.
"""
from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection

from core.cifrado import JSONCifrado, TextoCifrado, rotar


class Command(BaseCommand):
    help = 'Vuelve a cifrar los campos cifrados con la clave actual.'

    def handle(self, *args, **opciones):
        total = 0
        for modelo in apps.get_app_config('core').get_models():
            campos = [f for f in modelo._meta.fields if isinstance(f, (TextoCifrado, JSONCifrado))]
            if not campos:
                continue
            tabla = connection.ops.quote_name(modelo._meta.db_table)
            pk = connection.ops.quote_name(modelo._meta.pk.column)
            # Directo en SQL: algunas tablas (bitácoras) no permiten save(), y aquí el
            # contenido no cambia, solo su cifrado.
            with connection.cursor() as c:
                for campo in campos:
                    col = connection.ops.quote_name(campo.column)
                    c.execute(f'SELECT {pk}, {col} FROM {tabla} WHERE {col} IS NOT NULL')
                    for ident, valor in c.fetchall():
                        nuevo = rotar(valor)
                        if nuevo != valor:
                            c.execute(f'UPDATE {tabla} SET {col} = %s WHERE {pk} = %s', [nuevo, ident])
                            total += 1
        self.stdout.write(f'Valores cifrados de nuevo: {total}.')
