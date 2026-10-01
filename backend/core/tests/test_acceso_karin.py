"""Acceso Ley Karin: designación por el titular, puerta y sesión aisladas, bitácora reservada y cifrado."""
import re

from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.db import connection
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase

from ..cifrado import PREFIJO, cifrar, descifrar
from ..karin import verificar_karin
from ..models import EncargadoKarin, RegistroBitacora, RegistroKarin, UsuarioEquipo
from .utiles import crear_usuario_completo

CLAVE = 'Clave-Karin-2026'


class AccesoKarinTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('lk', '21.000.000-3', '76.000.555-K')
        self.client.force_authenticate(self.user)

    def _designar(self, rut='12.345.678-5', **extra):
        datos = {'rut': rut, 'nombres': 'Rosa', 'apellidos': 'Díaz', 'correo': 'rosa@asesoria.cl',
                 'empresas': [self.empresa.id], **extra}
        return self.client.post('/api/encargados-karin/', datos, format='json')

    def _activar(self, clave=CLAVE):
        enlace = re.search(r'/karin/clave/(\S+)/(\S+)', mail.outbox[-1].body)
        return APIClient().post('/api/karin/clave/', {'uid': enlace.group(1), 'token': enlace.group(2),
                                                      'clave': clave}, format='json')

    def _entrar(self, rut='12.345.678-5', clave=CLAVE):
        c = APIClient()
        r = c.post('/api/karin/ingresar/', {'rut': rut, 'clave': clave}, format='json')
        return c, r

    def test_designacion_clave_ingreso_y_salida(self):
        r = self._designar()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(mail.outbox[-1].to, ['rosa@asesoria.cl'])
        self.assertIn('Encargado Ley Karin', mail.outbox[-1].body)
        self.assertEqual(self._designar(rut='11.111.111-1').status_code, 400)      # cupo: uno por cuenta (Pyme)
        self.assertEqual(self._activar(clave='123456785').status_code, 400)       # no el RUT
        self.assertEqual(self._activar().status_code, 200)
        self.assertEqual(self._activar().status_code, 400)                        # el enlace vale una vez

        self.assertEqual(self._entrar(clave='mala')[1].status_code, 400)
        c, r = self._entrar()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['empresas'][0]['id'], self.empresa.id)
        self.assertIn('jornada40-karin', r.cookies)
        self.assertEqual(c.get('/api/karin/yo/').data['nombre'], 'Rosa Díaz')
        acciones = list(RegistroKarin.objects.values_list('accion', flat=True))
        self.assertEqual(acciones, ['DESIGNACION', 'CLAVE', 'INGRESO_FALLIDO', 'INGRESO'])
        self.assertEqual(c.post('/api/karin/salir/', {}, format='json').status_code, 200)
        self.assertEqual(c.get('/api/karin/yo/').status_code, 403)

    def test_sesiones_aisladas(self):
        self._designar()
        self._activar()
        c, _ = self._entrar()
        # La sesión Ley Karin no abre el panel…
        for ruta in ('/api/empleados/', '/api/auth/user/', '/api/bitacora/', '/api/empresas/'):
            self.assertIn(c.get(ruta).status_code, (401, 403), ruta)
        # …y la del panel (titular o equipo) no abre el acceso Ley Karin.
        self.assertEqual(self.client.get('/api/karin/yo/').status_code, 403)
        self.assertEqual(self.client.get('/api/karin/bitacora/').status_code, 403)
        # El usuario interno tampoco entra por el login del titular.
        enc = EncargadoKarin.objects.get()
        r = APIClient().post('/api/auth/login/', {'username': enc.usuario.username, 'password': CLAVE}, format='json')
        self.assertNotEqual(r.status_code, 200)
        # Ni con un JWT válido de ese usuario (defensa en profundidad del cerco).
        from rest_framework_simplejwt.tokens import RefreshToken
        panel = APIClient()
        panel.cookies['jornada40-auth'] = str(RefreshToken.for_user(enc.usuario).access_token)
        self.assertEqual(panel.get('/api/auth/user/').status_code, 401)

    def test_solo_el_titular_designa(self):
        from django.contrib.auth.models import User
        persona = User.objects.create(username='equipo:x:1')
        ue = UsuarioEquipo.objects.create(cuenta=self.user, usuario=persona, rut='11.111.111-1', nombres='Eva',
                                          correo='eva@x.cl', estado='ACTIVO', permisos={'SEGURIDAD': 'GESTIONAR'})
        ue.empresas.set([self.empresa])
        c = APIClient()
        c.force_authenticate(persona)
        self.assertEqual(c.get('/api/encargados-karin/').status_code, 403)
        self.assertEqual(c.post('/api/encargados-karin/', {}, format='json').status_code, 403)

    def test_bajo_pyme_no_hay_encargado(self):
        self.plan.nivel = 2
        self.plan.save()
        self.assertEqual(self._designar().status_code, 403)

    def test_eliminar_cierra_la_sesion_y_libera_el_cupo(self):
        self._designar()
        self._activar()
        c, _ = self._entrar()
        enc = EncargadoKarin.objects.get()
        self.assertEqual(self.client.post(f'/api/encargados-karin/{enc.id}/eliminar/').status_code, 200)
        self.assertEqual(c.get('/api/karin/yo/').status_code, 403)
        self.assertEqual(self._entrar()[1].status_code, 400)
        self.assertEqual(self._designar(rut='12.345.678-5').status_code, 201)      # puede volver a designarse

    def test_cambiar_clave_cierra_otras_sesiones(self):
        self._designar()
        self._activar()
        c1, _ = self._entrar()
        c2, _ = self._entrar()
        r = c1.post('/api/karin/cambiar-clave/', {'actual': CLAVE, 'nueva': 'Otra-Clave-2026'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(c1.get('/api/karin/yo/').status_code, 200)               # la propia sigue
        self.assertEqual(c2.get('/api/karin/yo/').status_code, 403)

    def test_bitacora_reservada(self):
        self._designar()
        self._activar()
        c, _ = self._entrar()
        datos = c.get('/api/karin/bitacora/').data
        self.assertEqual(datos['registros'][0]['accion'], 'INGRESO')
        self.assertTrue(c.get('/api/karin/bitacora/verificar/').data['ok'])
        # El titular solo ve que hubo actividad, una vez por día y sin detalle.
        del_titular = RegistroBitacora.objects.filter(cuenta=self.user, accion='ACTIVIDAD_LEY_KARIN')
        self.assertEqual(del_titular.count(), 1)
        self.assertNotIn('Rosa', del_titular.get().descripcion)
        # La descripción va cifrada en la base y la cadena delata cambios.
        r = RegistroKarin.objects.order_by('id').first()
        with connection.cursor() as cur:
            cur.execute('SELECT descripcion FROM core_registrokarin WHERE id = %s', [r.id])
            crudo = cur.fetchone()[0]
        self.assertTrue(crudo.startswith(PREFIJO))
        self.assertNotIn('Rosa', crudo)
        with connection.cursor() as cur:
            cur.execute('UPDATE core_registrokarin SET descripcion = %s WHERE id = %s', [cifrar('otra cosa'), r.id])
        self.assertEqual(verificar_karin(self.user)['roto_en'], r.id)
        with self.assertRaises(PermissionError):
            RegistroKarin.objects.all().delete()


class CifradoTests(APITestCase):
    def test_cifrar_descifrar_y_rotar(self):
        from cryptography.fernet import Fernet
        vieja, nueva = Fernet.generate_key().decode(), Fernet.generate_key().decode()
        with override_settings(KARIN_CLAVES_CIFRADO=vieja):
            token = cifrar('relato reservado')
            self.assertTrue(token.startswith(PREFIJO))
            self.assertEqual(descifrar(token), 'relato reservado')
        self.assertEqual(descifrar('texto anterior al cifrado'), 'texto anterior al cifrado')
        # Rotación: con la nueva primero, la antigua aún descifra.
        with override_settings(KARIN_CLAVES_CIFRADO=f'{nueva},{vieja}'):
            self.assertEqual(descifrar(token), 'relato reservado')
        with override_settings(KARIN_CLAVES_CIFRADO=nueva):
            from django.core.exceptions import ImproperlyConfigured
            with self.assertRaises(ImproperlyConfigured):
                descifrar(token)

    def test_comando_rotar(self):
        from cryptography.fernet import Fernet
        user, *_ = crear_usuario_completo('rot', '21.000.001-1', '76.000.556-8')
        vieja, nueva = Fernet.generate_key().decode(), Fernet.generate_key().decode()
        from ..karin import registrar_karin
        with override_settings(KARIN_CLAVES_CIFRADO=vieja):
            registrar_karin(user, 'PRUEBA', 'dato reservado')
        with override_settings(KARIN_CLAVES_CIFRADO=f'{nueva},{vieja}'):
            call_command('rotar_cifrado', stdout=open('/dev/null', 'w'))
        with override_settings(KARIN_CLAVES_CIFRADO=nueva):
            self.assertEqual(RegistroKarin.objects.get().descripcion, 'dato reservado')
            self.assertTrue(verificar_karin(user)['ok'])
