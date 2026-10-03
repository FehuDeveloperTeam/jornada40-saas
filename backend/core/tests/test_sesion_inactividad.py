"""Sesiones que vencen por inactividad (Karin, portal del trabajador, inspector) y duración del JWT del panel."""
from unittest.mock import patch

from django.conf import settings
from django.core import signing
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase

from .. import sesion_inactividad as si

SAL = 'prueba-sesion'


class SesionInactividadTests(SimpleTestCase):

    def test_vence_tras_la_inactividad(self):
        with patch('time.time', return_value=1_000_000):
            valor = si.firmar({'e': 1}, SAL)
        with patch('time.time', return_value=1_000_000 + 4 * 60):
            self.assertEqual(si.leer(valor, SAL, 5 * 60, 4 * 3600)['e'], 1)
        with patch('time.time', return_value=1_000_000 + 6 * 60):
            with self.assertRaises(signing.BadSignature):
                si.leer(valor, SAL, 5 * 60, 4 * 3600)

    def test_renovar_corre_el_plazo_pero_no_pasa_del_maximo(self):
        with patch('time.time', return_value=1_000_000):
            valor = si.firmar({'e': 1}, SAL)
        datos = signing.loads(valor, salt=SAL)
        # Con actividad cada 4 minutos sigue viva, pero no más allá del tope desde el ingreso.
        with patch('time.time', return_value=1_000_000 + 3 * 3600):
            renovada = si.firmar(datos, SAL)
            self.assertEqual(si.leer(renovada, SAL, 5 * 60, 4 * 3600)['i'], 1_000_000)
        with patch('time.time', return_value=1_000_000 + 4 * 3600 + 60):
            renovada = si.firmar(datos, SAL)
            with self.assertRaises(signing.BadSignature):
                si.leer(renovada, SAL, 5 * 60, 4 * 3600)

    def test_cookie_antigua_sin_hora_de_ingreso_no_sirve(self):
        with self.assertRaises(signing.BadSignature):
            si.leer(signing.dumps({'e': 1}, salt=SAL), SAL, 300, 3600)

    def test_middleware_pone_la_cookie_renovada_salvo_que_la_vista_la_cambie(self):
        request = RequestFactory().get('/')
        si.renovar(request, 'galleta', {'e': 1}, SAL, 300)
        respuesta = si.RenovarSesionMiddleware(lambda r: HttpResponse())(request)
        self.assertEqual(respuesta.cookies['galleta']['max-age'], 300)
        self.assertTrue(respuesta.cookies['galleta']['httponly'])

        def salir(_):
            r = HttpResponse()
            r.delete_cookie('galleta')
            return r
        respuesta = si.RenovarSesionMiddleware(salir)(request)
        self.assertEqual(respuesta.cookies['galleta'].value, '')

    def test_jwt_del_panel_corto(self):
        self.assertEqual(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds(), 5 * 60)
        self.assertEqual(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds(), 15 * 60)
        self.assertTrue(settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS'))
