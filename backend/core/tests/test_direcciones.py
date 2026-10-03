"""Dirección por partes: calle, número o "sin número" con altura, y depto."""
from rest_framework.test import APITestCase

from ..direcciones import armar_direccion, desde_texto, partes
from ..models import Empleado, Empresa
from .utiles import crear_empleado, crear_usuario_completo


class DireccionPorPartesTests(APITestCase):

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('dir_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')

    def test_armar(self):
        self.assertEqual(armar_direccion('Merced', '280', False, 'depto 34'), 'Merced 280, depto 34')
        self.assertEqual(armar_direccion('San Pedro de Lilahue', 'km 2', True), 'San Pedro de Lilahue S/N, km 2')
        self.assertEqual(armar_direccion('Camino viejo', '', True), 'Camino viejo S/N')
        self.assertEqual(armar_direccion('', '12'), '')

    def test_separar_texto_antiguo(self):
        self.assertEqual(desde_texto('San Pedro de Lilahue S/N, km 2'),
                         {'calle': 'San Pedro de Lilahue', 'numero': 'km 2', 'sin_numero': True, 'depto': ''})
        self.assertEqual(desde_texto('Av. 5 de Abril 1020 depto 34')['numero'], '1020')
        self.assertIsNone(desde_texto('Parcela El Roble'))

    def test_carpeta_guarda_partes_y_arma_la_direccion(self):
        r = self.client.patch(f'/api/empleados/{self.emp.id}/',
                              {'calle': 'San Pedro de Lilahue', 'sin_numero': True, 'numero': 'km 2'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.emp.refresh_from_db()
        self.assertEqual(self.emp.direccion, 'SAN PEDRO DE LILAHUE S/N, KM 2')
        self.assertEqual(partes(self.emp), ('SAN PEDRO DE LILAHUE', 'S/N', ''))

    def test_empresa_y_direccion_antigua_sin_partes(self):
        r = self.client.patch(f'/api/empresas/{self.empresa.id}/', {'calle': 'Merced', 'numero': '280', 'depto': 'of. 5'},
                              format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Empresa.objects.get(pk=self.empresa.pk).direccion, 'MERCED 280, OF. 5')
        # Sin partes, la dirección escrita antes sigue igual y Mi DT la separa como antes.
        Empleado.objects.filter(pk=self.emp.pk).update(direccion='Merced N° 280', calle='')
        self.emp.refresh_from_db()
        self.assertEqual(partes(self.emp), ('Merced', '280', ''))
