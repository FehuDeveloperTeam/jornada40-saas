"""Aviso por correo de los errores del servidor: sin datos personales, uno por error y por hora."""
import logging

from django.core import mail
from django.core.cache import cache
from django.test import RequestFactory, SimpleTestCase, override_settings

logger = logging.getLogger('core.views.prueba_alertas')


def _fallar(rut):
    raise ValueError(f'El trabajador {rut} tiene un sueldo de $1.234.567')


@override_settings(ALERTAS_ERRORES_EMAIL='equipo@example.com', IS_PRODUCTION=True, IS_STAGING=False)
class AlertasDeErroresTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def _registrar(self, rut='12.345.678-5', **extra):
        try:
            _fallar(rut)
        except ValueError:
            logger.exception('Error inesperado: %s', 'contratos', **extra)

    def test_avisa_con_ruta_y_recorrido_pero_sin_datos_personales(self):
        solicitud = RequestFactory().get('/api/contratos/7/?rut=12.345.678-5&correo=a@b.cl')
        self._registrar(extra={'request': solicitud})
        self.assertEqual(len(mail.outbox), 1)
        correo = mail.outbox[0]
        self.assertEqual(correo.to, ['equipo@example.com'])
        self.assertIn('producción', correo.subject)
        self.assertIn('ValueError', correo.subject)
        self.assertIn('GET /api/contratos/7/', correo.body)
        self.assertIn('Error inesperado: %s [contratos]', correo.body)
        self.assertIn('test_alertas.py', correo.body)       # recorrido del código
        for privado in ('12.345.678-5', '1.234.567', 'a@b.cl', 'rut='):
            self.assertNotIn(privado, correo.body)
            self.assertNotIn(privado, correo.subject)

    def test_el_mismo_error_se_avisa_una_vez_por_hora(self):
        for _ in range(3):
            self._registrar()
        self.assertEqual(len(mail.outbox), 1)

    def test_los_valores_que_no_son_identificadores_no_salen(self):
        try:
            _fallar('9.876.543-3')
        except ValueError:
            logger.exception('No se pudo agregar %s al ZIP', '98765433_Juan_Perez/Contrato.pdf')
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('No se pudo agregar %s al ZIP', mail.outbox[0].body)
        self.assertNotIn('Juan_Perez', mail.outbox[0].body)

    def test_sin_excepcion_o_sin_destino_no_avisa(self):
        logger.error('Algo raro pasó sin excepción')
        with override_settings(ALERTAS_ERRORES_EMAIL=''):
            self._registrar()
        self.assertEqual(len(mail.outbox), 0)

    def test_un_error_no_controlado_en_una_vista_avisa(self):
        from django.urls import path

        def vista_que_falla(request):
            _fallar('12.345.678-5')

        urlpatterns = [path('falla/', vista_que_falla)]
        with override_settings(ROOT_URLCONF=type('Urls', (), {'urlpatterns': urlpatterns})):
            self.client.raise_request_exception = False
            respuesta = self.client.get('/falla/?rut=12.345.678-5')
        self.assertEqual(respuesta.status_code, 500)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('GET /falla/', mail.outbox[0].body)
        self.assertNotIn('12.345.678-5', mail.outbox[0].body)
