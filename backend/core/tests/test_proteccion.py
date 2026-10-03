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


class FueroCalculadoYConciliacionTests(APITestCase):

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('conc_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')

    def test_fuero_maternal_desde_el_parto(self):
        from ..proteccion import fin_fuero
        self.emp.fuero = 'MATERNIDAD'
        self.assertIsNone(fin_fuero(self.emp))                          # embarazo: sin término conocido
        self.emp.fecha_parto = datetime.date(2026, 1, 10)
        self.assertEqual(fin_fuero(self.emp), datetime.date(2027, 4, 4))  # +12 semanas (4-abr-2026) +1 año
        self.assertIn('calculado desde el parto', avisos(self.emp, datetime.date(2026, 10, 3))[0]['detalle'])
        self.emp.fuero_hasta = datetime.date(2027, 6, 1)                # ingresado a mano: manda
        self.assertEqual(fin_fuero(self.emp), datetime.date(2027, 6, 1))

    def test_solicitud_con_plazo_y_respuesta_fundada(self):
        Empleado.objects.filter(pk=self.emp.pk).update(cuidado_de='MENOR_14')
        r = self.client.post('/api/solicitudes-conciliacion/', {
            'empleado': self.emp.id, 'tipo': 'TELETRABAJO', 'presentada_el': '2026-09-01'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['vence_el'], '2026-09-16')                # 15 días
        self.assertTrue(any('venció' in a for a in r.data['avisos']))
        ficha = self.client.get(f'/api/empleados/{self.emp.id}/').data
        self.assertIn('CONCILIACION', [a['codigo'] for a in ficha['avisos_proteccion']])
        url = f"/api/solicitudes-conciliacion/{r.data['id']}/responder/"
        self.assertEqual(self.client.post(url, {'estado': 'RECHAZADA'}, format='json').status_code, 400)
        r = self.client.post(url, {'estado': 'RECHAZADA', 'motivo': 'CARGO_NO_PERMITE',
                                   'fundamento': 'Atiende público en caja todo el día.', 'respondida_el': '2026-09-20'},
                             format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(any('fuera de plazo' in a for a in r.data['avisos']))

    def test_cambio_de_jornada_avisa_poca_anticipacion(self):
        r = self.client.post('/api/solicitudes-conciliacion/', {
            'empleado': self.emp.id, 'tipo': 'CAMBIO_JORNADA', 'presentada_el': '2026-06-20',
            'desde': '2026-07-01', 'hasta': '2026-07-15'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['vence_el'], '2026-06-30')               # 10 días
        self.assertTrue(any('30 días de anticipación' in a for a in r.data['avisos']))

    def test_vacaciones_escolares_en_el_aviso_de_cuidado(self):
        from ..models import PeriodoVacacionesEscolares
        PeriodoVacacionesEscolares.objects.create(nombre='Vacaciones de verano', desde=datetime.date(2026, 12, 21),
                                                  hasta=datetime.date(2027, 2, 28))
        self.emp.cuidado_de = 'MENOR_14'
        self.assertIn('Vacaciones de verano del 21-12', avisos(self.emp, datetime.date(2026, 10, 3))[0]['detalle'])
