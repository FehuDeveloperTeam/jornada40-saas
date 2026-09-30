"""Empresas visibles en la petición en curso.

Para un usuario del equipo, el cerco (core.autenticacion) fija aquí las empresas
que el titular le asignó, y los managers de los modelos (EnEmpresas) filtran por
ellas cualquier consulta: listas, detalles, descargas y cálculos. Para el
titular, los portales y los comandos queda en None y no se filtra nada.
`ContextoMiddleware` lo limpia al empezar y al terminar cada petición.
"""
from contextvars import ContextVar

from django.db import models

_empresas = ContextVar('empresas_permitidas', default=None)


def fijar_empresas(ids):
    return _empresas.set(frozenset(ids))


def empresas_permitidas():
    return _empresas.get()


def limpiar():
    _empresas.set(None)


class ContextoMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        limpiar()
        try:
            return self.get_response(request)
        finally:
            limpiar()


class _EnEmpresas(models.Manager):
    """Manager que, con empresas fijadas, deja ver solo lo que cuelga de ellas.

    El campo va en la clase (no en la instancia) porque Django crea los managers
    de las relaciones instanciando la clase sin argumentos."""
    campo = None
    permite_nulo = False

    def deconstruct(self):
        # Las migraciones no necesitan este manager.
        return (False, 'django.db.models.Manager', None, [], {})

    def get_queryset(self):
        qs = super().get_queryset()
        ids = empresas_permitidas()
        if ids is None or not self.campo:
            return qs
        filtro = models.Q(**{f'{self.campo}__in': ids})
        if self.permite_nulo:
            filtro |= models.Q(**{f'{self.campo}__isnull': True})
        return qs.filter(filtro)


def EnEmpresas(campo, permite_nulo=False):
    """Manager filtrado por las empresas del usuario del equipo, sobre `campo`."""
    clase = type(f'EnEmpresas_{campo}', (_EnEmpresas,), {'campo': campo, 'permite_nulo': permite_nulo,
                                                         '__module__': __name__})
    return clase()
