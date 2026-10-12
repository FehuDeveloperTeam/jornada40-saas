"""Escrituras en la API que nacen en una página de otro sitio (CSRF).

La sesión del panel viaja en cookies: sin core.middleware.OrigenPermitidoMiddleware,
un formulario de otro sitio podía crear datos con la sesión abierta del titular.
En pruebas el origen permitido es el de desarrollo (http://localhost:5173).
"""
from django.core.cache import cache
from django.http import HttpResponse
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from .. import sesion_inactividad
from ..middleware import MENSAJE_ORIGEN_AJENO
from ..models import Empleado
from .utiles import crear_empleado, crear_usuario_completo

AJENO = 'https://sitio-ajeno.example'
APLICACION = 'http://localhost:5173'


class OrigenDeLasEscriturasTests(APITestCase):

    def setUp(self):
        cache.clear()
        self.user, _, _, self.empresa = crear_usuario_completo('11.111.111-1', '11.111.111-1', '76.000.000-0')
        r = self.client.post('/api/auth/login/', {'username': '11.111.111-1', 'password': 'pass1234'}, format='json')
        self.assertEqual(r.status_code, 200)

    def _formulario(self, **encabezados):
        """Lo que envía un formulario HTML: urlencoded, con las cookies de la sesión."""
        cuerpo = (f'empresa={self.empresa.id}&rut=12.345.678-5&nombres=Ana&apellido_paterno=Soto&cargo=Prueba'
                  '&sueldo_base=600000&fecha_ingreso=2026-01-05')
        return self.client.post('/api/empleados/', data=cuerpo, content_type='application/x-www-form-urlencoded',
                                **encabezados)

    def _rechazada(self, r):
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json(), {'error': MENSAJE_ORIGEN_AJENO})

    def test_formulario_de_otro_sitio_se_rechaza(self):
        self._rechazada(self._formulario(HTTP_ORIGIN=AJENO))
        self.assertFalse(Empleado.objects.filter(empresa=self.empresa).exists())

    def test_json_y_borrado_de_otro_sitio_se_rechazan(self):
        empleado = crear_empleado(self.empresa, '9.876.543-3')
        self._rechazada(self.client.post('/api/empresas/', {'nombre_legal': 'Otra SpA', 'rut': '77.777.777-7'},
                                         format='json', HTTP_ORIGIN=AJENO))
        self._rechazada(self.client.delete(f'/api/empleados/{empleado.id}/', HTTP_ORIGIN=AJENO))
        self.assertTrue(Empleado.objects.filter(pk=empleado.pk).exists())

    def test_origen_null_se_rechaza(self):
        # Lo envían un iframe aislado o un documento local: no es la aplicación.
        self._rechazada(self._formulario(HTTP_ORIGIN='null'))

    def test_sin_origin_se_revisa_el_referer(self):
        self._rechazada(self._formulario(HTTP_REFERER=f'{AJENO}/pagina-con-formulario'))
        self.assertEqual(self._formulario(HTTP_REFERER=f'{APLICACION}/app/trabajadores').status_code, 201)

    def test_la_aplicacion_puede_escribir(self):
        self.assertEqual(self._formulario(HTTP_ORIGIN=APLICACION).status_code, 201)

    def test_sin_origin_ni_referer_no_es_un_navegador(self):
        # Un cliente que no es un navegador no lleva la sesión de otra persona.
        self.assertEqual(self._formulario().status_code, 201)

    def test_la_propia_api_puede_escribir(self):
        # Administrador de Django y API navegable de DRF.
        self.assertEqual(self._formulario(HTTP_ORIGIN='http://testserver').status_code, 201)

    @override_settings(CORS_ALLOWED_ORIGIN_REGEXES=[r'^https://jornada40-saas(-[a-z0-9-]+)*\.vercel\.app$'])
    def test_vistas_previas_de_staging(self):
        self.assertEqual(self._formulario(HTTP_ORIGIN='https://jornada40-saas-git-rama.vercel.app').status_code, 201)
        self._rechazada(self._formulario(HTTP_ORIGIN='https://otro-proyecto.vercel.app'))

    def test_las_lecturas_no_se_revisan(self):
        self.assertEqual(self.client.get('/api/empleados/', HTTP_ORIGIN=AJENO).status_code, 200)

    def test_salir_del_portal_desde_otro_sitio_se_rechaza(self):
        self._rechazada(self.client.post('/api/trabajador/salir/', {}, format='json', HTTP_ORIGIN=AJENO))
        self.assertEqual(self.client.post('/api/trabajador/salir/', {}, format='json',
                                          HTTP_ORIGIN=APLICACION).status_code, 200)

    def test_aviso_de_pago_no_se_revisa(self):
        # De servidor a servidor: lo protege su clave secreta, no el origen.
        r = self.client.post('/api/pagos/webhook/reveniu/', {'event': 'subscription_activated'}, format='json',
                             HTTP_ORIGIN=AJENO)
        self.assertNotEqual(r.json().get('error'), MENSAJE_ORIGEN_AJENO)

    def test_la_extension_no_se_revisa(self):
        # Se identifica con su token, no con cookies, y su origen es chrome-extension://.
        r = self.client.post('/api/extension/v1/vincular/', {'codigo': 'ABCD2345'}, format='json',
                             HTTP_ORIGIN='chrome-extension://abcdefghijklmnop')
        self.assertEqual(r.status_code, 400)
        self.assertNotEqual(r.json().get('error'), MENSAJE_ORIGEN_AJENO)


class SameSiteDeLasCookiesTests(SimpleTestCase):

    @override_settings(IS_DEPLOYED=True, COOKIES_SAMESITE='Lax')
    def test_produccion_usa_lax(self):
        respuesta = sesion_inactividad.poner_cookie(HttpResponse(), 'jornada40-trabajador', 'valor', 900)
        cookie = respuesta.cookies['jornada40-trabajador']
        self.assertEqual(cookie['samesite'], 'Lax')
        self.assertTrue(cookie['secure'])
        self.assertTrue(cookie['httponly'])

    @override_settings(IS_DEPLOYED=True, COOKIES_SAMESITE='None')
    def test_staging_usa_none_con_secure(self):
        respuesta = sesion_inactividad.poner_cookie(HttpResponse(), 'jornada40-karin', 'valor', 300)
        self.assertEqual(respuesta.cookies['jornada40-karin']['samesite'], 'None')
        self.assertTrue(respuesta.cookies['jornada40-karin']['secure'])
        borrada = sesion_inactividad.borrar_cookie(HttpResponse(), 'jornada40-karin').cookies['jornada40-karin']
        self.assertEqual(borrada['samesite'], 'None')
        self.assertEqual(borrada['max-age'], 0)
