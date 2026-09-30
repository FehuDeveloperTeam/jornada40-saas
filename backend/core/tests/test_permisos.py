"""Catálogo de módulos y cupos de usuarios por plan."""
from django.test import SimpleTestCase

from ..models import Plan
from ..permisos import CODIGOS_MODULOS, cupo_equipo, cupo_ley_karin, normalizar_permisos


class CuposTests(SimpleTestCase):
    def test_cupos_por_plan(self):
        semilla = Plan(nivel=1, max_empresas=1)
        starter = Plan(nivel=2, max_empresas=1)
        pyme = Plan(nivel=3, max_empresas=3)
        corporativo = Plan(nivel=4, max_empresas=10)
        self.assertEqual([cupo_equipo(p) for p in (semilla, starter, pyme, corporativo)], [0, 2, 6, 20])
        self.assertEqual([cupo_ley_karin(p) for p in (semilla, starter, pyme, corporativo)], [0, 0, 1, 1])
        self.assertEqual(cupo_equipo(pyme, adicionales=2), 8)
        self.assertEqual(cupo_ley_karin(pyme, adicionales=1), 2)
        self.assertEqual(cupo_equipo(None), 0)

    def test_permisos_solo_de_la_lista(self):
        self.assertIn('REMUNERACIONES', CODIGOS_MODULOS)
        self.assertEqual(normalizar_permisos({'REMUNERACIONES': 'VER', 'LEY_KARIN': 'GESTIONAR', 'TERMINO': 'X'}),
                         {'REMUNERACIONES': 'VER'})
