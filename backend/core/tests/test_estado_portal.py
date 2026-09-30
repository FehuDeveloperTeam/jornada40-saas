"""Estado del portal del trabajador en la carpeta e invitación por correo."""
from datetime import timedelta

from django.core import mail
from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import CorreoTrabajador, CuentaTrabajador, Empleado
from .utiles import crear_empleado, crear_usuario_completo


class EstadoPortalTests(APITestCase):
    def setUp(self):
        self.user, _, self.plan, self.empresa = crear_usuario_completo('portal_e', '21.000.000-3', '76.000.555-K')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana', apellido='Rojas')
        Empleado.objects.filter(pk=self.emp.pk).update(email='ana@correo.cl')
        self.url = f'/api/empleados/{self.emp.id}/portal/'

    def test_estados(self):
        self.assertEqual(self.client.get(self.url).data['estado'], 'NO_INGRESA')
        cuenta = CuentaTrabajador.objects.create(rut='123456785', ultimo_ingreso=timezone.now())
        CorreoTrabajador.objects.create(cuenta=cuenta, email='otro@correo.cl')
        self.assertEqual(self.client.get(self.url).data['estado'], 'NO_INGRESA')     # otro correo no cuenta
        CorreoTrabajador.objects.create(cuenta=cuenta, email='ANA@correo.cl')
        d = self.client.get(self.url).data
        self.assertEqual(d['estado'], 'ACTIVO')
        self.assertEqual(d['ultimo_ingreso'], timezone.localdate().isoformat())
        Empleado.objects.filter(pk=self.emp.pk).update(email='')
        self.assertEqual(self.client.get(self.url).data['estado'], 'SIN_CORREO')
        Empleado.objects.filter(pk=self.emp.pk).update(activo=False, email='ana@correo.cl',
                                                       fecha_desvinculacion=timezone.localdate() - timedelta(days=200))
        self.assertEqual(self.client.get(self.url).data['estado'], 'SIN_ACCESO')
        self.plan.nivel = 2
        self.plan.save()
        self.assertEqual(self.client.get(self.url).data['estado'], 'SIN_PLAN')

    def test_invitacion_una_por_dia(self):
        r = self.client.post(self.url)
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['puede_invitar'])
        self.assertEqual(mail.outbox[0].to, ['ana@correo.cl'])
        self.assertIn('/trabajador', mail.outbox[0].body)
        self.assertEqual(self.client.post(self.url).status_code, 400)
        Empleado.objects.filter(pk=self.emp.pk).update(portal_invitado_en=timezone.now() - timedelta(hours=25))
        self.assertEqual(self.client.post(self.url).status_code, 200)
        self.assertEqual(len(mail.outbox), 2)

    def test_sin_correo_o_de_otro_empleador(self):
        Empleado.objects.filter(pk=self.emp.pk).update(email='')
        self.assertEqual(self.client.post(self.url).status_code, 400)
        otro, _, _, _ = crear_usuario_completo('portal_f', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get(self.url).status_code, 404)
        self.assertEqual(len(mail.outbox), 0)
