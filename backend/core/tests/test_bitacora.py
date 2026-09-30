"""Bitácora de la cuenta: registro automático, cadena de huellas, solo lectura y acceso del titular."""
from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from ..bitacora import registrar, verificar
from ..models import RegistroBitacora
from .utiles import crear_empleado, crear_usuario_completo


class BitacoraTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('bita', '21.000.000-3', '76.000.555-K')
        self.user.username = '21.000.000-3'
        self.user.save()
        self.client.force_authenticate(self.user)

    def test_registra_escrituras_y_descargas_pero_no_lecturas_ni_simulaciones(self):
        emp = crear_empleado(self.empresa, '12.345.678-5')
        self.client.patch(f'/api/empleados/{emp.id}/', {'cargo': 'Jefa'}, format='json')
        self.client.get('/api/empleados/')                                   # lectura: no se registra
        self.client.post('/api/liquidaciones/simular/', {}, format='json')   # vista previa: no se registra
        self.client.get(f'/api/reglamentos/plantilla/?empresa={self.empresa.id}&rubro=COMERCIO')
        acciones = list(RegistroBitacora.objects.values_list('accion', 'descripcion'))
        self.assertEqual(acciones[0], ('MODIFICAR', f'Modificó trabajador N° {emp.id}'))
        self.assertEqual(acciones[1][0], 'DESCARGA')
        self.assertEqual(len(acciones), 2)
        r = RegistroBitacora.objects.first()
        self.assertEqual((r.actor_tipo, r.actor_rut, r.estado_http), ('TITULAR', '21.000.000-3', 200))

    def test_ingreso_y_fallidos(self):
        self.client.force_authenticate(None)
        self.user.set_password('Clave-Segura-2026')
        self.user.save()
        self.client.post('/api/auth/login/', {'username': '210000003', 'password': 'mala'}, format='json')
        self.client.post('/api/auth/login/', {'username': '21.000.000-3', 'password': 'Clave-Segura-2026'},
                         format='json')
        self.assertEqual(list(RegistroBitacora.objects.values_list('accion', flat=True)),
                         ['INGRESO_FALLIDO', 'INGRESO'])

    def test_cadena_detecta_alteraciones_y_no_se_puede_editar(self):
        for n in range(3):
            registrar(self.user, 'PRUEBA', f'Acción {n}', actor=self.user, actor_tipo='TITULAR')
        self.assertEqual(verificar(self.user), {'ok': True, 'registros': 3, 'roto_en': None})
        r = RegistroBitacora.objects.order_by('id')[1]
        with self.assertRaises(PermissionError):
            r.descripcion = 'otra'
            r.save()
        with self.assertRaises(PermissionError):
            RegistroBitacora.objects.all().delete()
        with self.assertRaises(PermissionError):
            RegistroBitacora.objects.filter(pk=r.pk).update(descripcion='otra')
        # Alguien la cambia directo en la base de datos: la verificación lo detecta.
        from django.db import connection
        with connection.cursor() as c:
            c.execute('UPDATE core_registrobitacora SET descripcion = %s WHERE id = %s', ['alterada', r.id])
        self.assertEqual(verificar(self.user)['roto_en'], r.id)

    def test_solo_el_titular_ve_su_bitacora(self):
        registrar(self.user, 'PRUEBA', 'Acción propia', actor=self.user, actor_tipo='TITULAR')
        datos = self.client.get('/api/bitacora/').data
        self.assertEqual(datos['total'], 1)
        self.assertTrue(self.client.get('/api/bitacora/verificar/').data['ok'])
        otro, _, _, _ = crear_usuario_completo('bita_b', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get('/api/bitacora/').data['total'], 0)
        sin_perfil = User.objects.create_user('suelto', password='x')
        self.client.force_authenticate(sin_perfil)
        self.assertEqual(self.client.get('/api/bitacora/').status_code, 403)
