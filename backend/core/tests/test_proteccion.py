"""Protecciones especiales del trabajador (cuidado Ley 21.645, SANNA, fuero): avisos, nunca bloqueos."""
import datetime

from rest_framework.test import APITestCase

from ..models import Empleado
from ..proteccion import avisos, fuero_vigente
from .utiles import crear_empleado, crear_usuario_completo


class ProteccionTests(APITestCase):

    def setUp(self):
        self.user, _, self.plan, self.empresa = crear_usuario_completo('prot_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')

    def test_fuero_vigente_y_vencido(self):
        hoy = datetime.date(2026, 10, 3)
        self.emp.fuero = 'MATERNIDAD'
        self.assertTrue(fuero_vigente(self.emp, hoy))        # sin fecha: vigente
        self.emp.fuero_hasta = datetime.date(2026, 10, 2)
        self.assertFalse(fuero_vigente(self.emp, hoy))
        self.emp.fuero_hasta = datetime.date(2027, 3, 1)
        a = avisos(self.emp, hoy)
        self.assertEqual((a[0]['codigo'], a[0]['gravedad']), ('FUERO', 'alta'))
        self.assertIn('01-03-2027', a[0]['titulo'])

    def test_cuidado_de_menores_menciona_vacaciones_escolares(self):
        self.emp.cuidado_de = 'MENOR_14'
        self.assertIn('vacaciones escolares', avisos(self.emp)[0]['detalle'])
        self.emp.cuidado_de = 'DEPENDENCIA'
        self.assertNotIn('vacaciones escolares', avisos(self.emp)[0]['detalle'])

    def test_carpeta_guarda_y_devuelve_avisos(self):
        r = self.client.patch(f'/api/empleados/{self.emp.id}/',
                              {'cuidado_de': 'MENOR_14', 'hijo_enfermedad_grave': True, 'fuero': 'SINDICAL'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([a['codigo'] for a in r.data['avisos_proteccion']], ['FUERO', 'CUIDADO', 'SANNA'])
        r = self.client.patch(f'/api/empleados/{self.emp.id}/', {'fuero': 'INVENTADO'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_finiquito_avisa_fuero_sin_bloquear(self):
        from ..models import Contrato
        self.plan.nivel = 3; self.plan.save()
        Empleado.objects.filter(pk=self.emp.pk).update(fuero='MATERNIDAD', fecha_ingreso=datetime.date(2019, 3, 1))
        Contrato.objects.filter(empleado=self.emp).delete()
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2019-03-01',
                                sueldo_base=800_000, gratificacion_legal='MENSUAL')
        r = self.client.post('/api/finiquitos/simular/', {
            'empleado': self.emp.id, 'fecha_termino': '2026-09-15', 'causal_articulo': '161_1',
            'dias_trabajados_ultimo_mes': 15}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['avisos'][0]['codigo'], 'FUERO')
