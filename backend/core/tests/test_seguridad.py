"""Autenticación, aislamiento entre clientes, límites de intentos, IP real y ZIP."""
from unittest.mock import patch
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .utiles import _mock_config, crear_empleado, crear_usuario_completo


# ─── A1: Endpoints privados requieren autenticación ───────────────────────────

class AuthRequeridaTests(APITestCase):
    """Todos los endpoints privados deben devolver 401/403 sin sesión."""

    ENDPOINTS = [
        ('get',  '/api/empleados/'),
        ('get',  '/api/empresas/'),
        ('get',  '/api/contratos/'),
        ('get',  '/api/liquidaciones/'),
        ('get',  '/api/documentos_legales/'),
        ('get',  '/api/clientes/mi_suscripcion/'),
        ('get',  '/api/clientes/perfil/'),
    ]

    def test_endpoints_privados_rechazan_sin_auth(self):
        for method, url in self.ENDPOINTS:
            with self.subTest(url=url):
                resp = getattr(self.client, method)(url)
                self.assertIn(
                    resp.status_code,
                    [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN],
                    msg=f'{url} devolvió {resp.status_code} sin autenticación'
                )


# ─── A2: Aislamiento de datos entre usuarios ──────────────────────────────────

class AislamientoDatosTests(APITestCase):
    """Usuario B no puede leer ni modificar datos de Usuario A."""

    def setUp(self):
        self.user_a, _, _, self.empresa_a = crear_usuario_completo(
            'a2_user_a', '12300000-1', '76000001-1'
        )
        self.user_b, _, _, self.empresa_b = crear_usuario_completo(
            'a2_user_b', '12300000-2', '76000001-2'
        )
        self.empleado_a = crear_empleado(self.empresa_a, '11100001-1')

    def test_usuario_b_no_ve_empleados_de_a(self):
        self.client.force_authenticate(user=self.user_b)
        resp = self.client.get('/api/empleados/')
        lista = resp.data.get('results') if isinstance(resp.data, dict) else resp.data
        ids = [e['id'] for e in lista]
        self.assertNotIn(self.empleado_a.id, ids)

    def test_usuario_b_no_puede_editar_empleado_de_a(self):
        self.client.force_authenticate(user=self.user_b)
        resp = self.client.patch(
            f'/api/empleados/{self.empleado_a.id}/',
            {'cargo': 'Hackeado'}, format='json'
        )
        self.assertIn(resp.status_code, [
            status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND
        ])

    def test_usuario_b_no_puede_ver_empresa_de_a(self):
        self.client.force_authenticate(user=self.user_b)
        resp = self.client.get(f'/api/empresas/{self.empresa_a.id}/')
        self.assertIn(resp.status_code, [
            status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND
        ])

    def test_usuario_b_no_puede_eliminar_empresa_de_a(self):
        self.client.force_authenticate(user=self.user_b)
        resp = self.client.delete(f'/api/empresas/{self.empresa_a.id}/')
        self.assertIn(resp.status_code, [
            status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND
        ])


# ─── A3 / A10: Rate limiting ──────────────────────────────────────────────────

THROTTLE_SETTINGS = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.AnonRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '1000/day',
        'login': '3/minute',
        'register': '3/minute',
        'password_reset': '2/hour',
    },
}


@override_settings(REST_FRAMEWORK=THROTTLE_SETTINGS)
class RateLimitingTests(APITestCase):
    """Los endpoints de auth bloquean tras superar el límite configurado."""

    def setUp(self):
        cache.clear()

    def test_login_excesivo_retorna_429(self):
        payload = {'username': 'noexiste', 'password': 'noexiste'}
        for _ in range(3):
            self.client.post('/api/auth/login/', payload, format='json')
        resp = self.client.post('/api/auth/login/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_password_reset_excesivo_retorna_429(self):
        # La recuperación es solo por RUT (la ruta por correo quedó cerrada).
        payload = {'rut': '12.345.678-5'}
        for _ in range(2):
            self.client.post('/api/auth/recuperar-por-rut/', payload, format='json')
        resp = self.client.post('/api/auth/recuperar-por-rut/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_register_excesivo_retorna_429(self):
        payload = {'username': 'x', 'password': 'x', 'email': 'x@x.com', 'rut': '1-9'}
        for _ in range(3):
            self.client.post('/api/auth/register/', payload, format='json')
        resp = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


# ─── A5: Campos read_only no son escribibles ──────────────────────────────────

class SerializerReadOnlyTests(APITestCase):
    """PATCH no debe poder modificar campos marcados como read_only."""

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo(
            'a5_user', '22200000-1', '33300001-1'
        )
        self.empleado = crear_empleado(self.empresa, '44400001-1', cargo='Contador')
        self.client.force_authenticate(user=self.user)

    def test_ficha_numero_editable_sin_repetir(self):
        resp = self.client.patch(f'/api/empleados/{self.empleado.id}/', {'ficha_numero': 9999}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.ficha_numero, 9999)
        otro = crear_empleado(self.empresa, '55500001-4', cargo='Bodega')
        resp = self.client.patch(f'/api/empleados/{otro.id}/', {'ficha_numero': 9999}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('ficha_numero', resp.data)

    def test_activo_si_es_modificable_para_desvincular(self):
        """'activo' debe ser escribible: es el toggle de desvinculación.

        Estuvo en read_only_fields y el backend descartaba el cambio en
        silencio, así que el trabajador seguía apareciendo como vigente.
        """
        self.client.patch(
            f'/api/empleados/{self.empleado.id}/',
            {'activo': False}, format='json'
        )
        self.empleado.refresh_from_db()
        self.assertFalse(self.empleado.activo)

    def test_creado_en_no_modificable(self):
        ts_original = self.empleado.creado_en
        self.client.patch(
            f'/api/empleados/{self.empleado.id}/',
            {'creado_en': '2000-01-01T00:00:00Z'}, format='json'
        )
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.creado_en, ts_original)

    def test_owner_empresa_no_modificable(self):
        otro_user = User.objects.create_user('intruso', password='x')
        self.client.patch(
            f'/api/empresas/{self.empresa.id}/',
            {'owner': otro_user.id}, format='json'
        )
        self.empresa.refresh_from_db()
        self.assertEqual(self.empresa.owner, self.user)


# ─── A8 / A9: Límites en generación de ZIP ────────────────────────────────────

class ZipLimitesTests(APITestCase):
    """Descarga masiva ZIP no debe aceptar más de 50 empleados ni plan Semilla."""

    def setUp(self):
        self.user_pyme, _, _, self.empresa_pyme = crear_usuario_completo(
            'a8_pyme', '77700000-1', '88800001-1'
        )
        self.user_semilla, _, _, self.empresa_semilla = crear_usuario_completo(
            'a9_semilla', '77700000-2', '88800001-2', plan_semilla=True
        )

    def test_descarga_masiva_mas_de_50_empleados_retorna_400(self):
        self.client.force_authenticate(user=self.user_pyme)
        resp = self.client.post(
            '/api/empleados/descarga_masiva/',
            {'empleados': list(range(1, 52)),
             'empresa_id': self.empresa_pyme.id,
             'documentos': ['contrato']},
            format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('50', resp.data.get('error', ''))

    def test_descarga_masiva_plan_semilla_retorna_403(self):
        self.client.force_authenticate(user=self.user_semilla)
        resp = self.client.post(
            '/api/empleados/descarga_masiva/',
            {'empleados': [1],
             'empresa_id': self.empresa_semilla.id,
             'documentos': ['contrato']},
            format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_descargar_anexos_zip_mas_de_50_retorna_400(self):
        self.client.force_authenticate(user=self.user_pyme)
        resp = self.client.post(
            '/api/empleados/descargar_anexos_zip/',
            {'empleados': list(range(1, 52))},
            format='json'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('50', resp.data.get('error', ''))

    def test_descarga_masiva_50_empleados_exactos_pasa_validacion(self):
        self.client.force_authenticate(user=self.user_pyme)
        resp = self.client.post(
            '/api/empleados/descarga_masiva/',
            {'empleados': list(range(1, 51)),
             'empresa_id': self.empresa_pyme.id,
             'documentos': ['contrato']},
            format='json'
        )
        # 50 empleados exactos NO deben ser rechazados por el límite
        if resp.status_code == status.HTTP_400_BAD_REQUEST:
            self.assertNotIn('50', resp.data.get('error', ''))


class IpRealTests(APITestCase):
    """En Railway la IP del visitante sale de X-Real-IP, no de X-Forwarded-For (que trae la de Cloudflare)."""

    def _ident(self, **encabezados):
        from django.test import RequestFactory
        from rest_framework.request import Request
        from rest_framework.throttling import AnonRateThrottle
        from core.middleware import IpRealMiddleware
        req = RequestFactory().get('/api/planes/', REMOTE_ADDR='100.64.0.1', **encabezados)
        IpRealMiddleware(lambda r: None)(req)
        return AnonRateThrottle().get_ident(Request(req)), req.META['REMOTE_ADDR']

    def test_en_railway_usa_x_real_ip_y_no_se_esquiva_con_x_forwarded_for(self):
        with self.settings(IS_DEPLOYED=True):
            a = self._ident(HTTP_X_REAL_IP='186.40.197.30', HTTP_X_FORWARDED_FOR='172.68.14.252, 152.233.76.11')
            b = self._ident(HTTP_X_REAL_IP='186.40.197.30', HTTP_X_FORWARDED_FOR='9.9.9.9, 172.68.14.252, 152.233.76.11')
        self.assertEqual(a, ('186.40.197.30', '186.40.197.30'))
        self.assertEqual(b, a)

    def test_valor_invalido_o_local_no_toca_remote_addr(self):
        with self.settings(IS_DEPLOYED=True):
            self.assertEqual(self._ident(HTTP_X_REAL_IP='no-es-ip')[1], '100.64.0.1')
        with self.settings(IS_DEPLOYED=False):
            self.assertEqual(self._ident(HTTP_X_REAL_IP='186.40.197.30')[1], '100.64.0.1')


class DiagnosticoRedTests(APITestCase):
    """El diagnóstico de red está apagado salvo que se encienda a propósito."""

    def test_apagado_por_defecto(self):
        with patch('core.views.cuentas.config', side_effect=_mock_config(None)):
            self.assertEqual(self.client.get('/api/diagnostico/red/').status_code, 404)

    def test_encendido_muestra_los_encabezados_del_solicitante(self):
        with patch('core.views.cuentas.config', side_effect=lambda k, default=None, **kw: '1' if k == 'DIAGNOSTICO_RED' else default):
            resp = self.client.get('/api/diagnostico/red/', HTTP_X_FORWARDED_FOR='1.2.3.4, 5.6.7.8')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['x_forwarded_for'], '1.2.3.4, 5.6.7.8')


class AislamientoAlCrearTests(APITestCase):
    """Nadie puede crear datos dentro de la empresa de otro cliente."""

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Cliente, Empresa, Empleado, Plan
        plan = Plan.objects.create(nombre='Corporativo', precio=0, max_empresas=10, limite_trabajadores=250, nivel=4)
        self.a = User.objects.create_user(username='1-9', password='x')
        Cliente.objects.create(usuario=self.a, rut='1-9', nombres='A', plan=plan)
        b = User.objects.create_user(username='2-7', password='x')
        Cliente.objects.create(usuario=b, rut='2-7', nombres='B', plan=plan)
        self.empresa_b = Empresa.objects.create(owner=b, nombre_legal='EB', rut='76.000.001-K')
        self.emp_b = Empleado.objects.create(empresa=self.empresa_b, rut='3-5', nombres='V',
                                             apellido_paterno='V', cargo='C', fecha_ingreso='2025-01-01')
        self.client.force_authenticate(self.a)

    def test_no_crea_trabajador_en_empresa_ajena(self):
        r = self.client.post('/api/empleados/', {'empresa': self.empresa_b.id, 'rut': '4-3', 'nombres': 'X',
                             'apellido_paterno': 'Y', 'cargo': 'C', 'fecha_ingreso': '2025-01-01'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_no_crea_documento_legal_a_trabajador_ajeno(self):
        r = self.client.post('/api/documentos_legales/', {'empleado': self.emp_b.id, 'tipo': 'AMONESTACION',
                             'fecha_emision': '2026-09-01', 'hechos': 'x'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_no_crea_vacaciones_a_trabajador_ajeno(self):
        r = self.client.post('/api/vacaciones/', {'empleado': self.emp_b.id, 'empresa': self.empresa_b.id,
                             'fecha_inicio': '2026-10-01', 'fecha_fin': '2026-10-05', 'dias_habiles': 5}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_no_crea_contrato_a_trabajador_ajeno(self):
        r = self.client.post('/api/contratos/', {'empleado': self.emp_b.id, 'fecha_inicio': '2026-01-01',
                             'sueldo_base': 1}, format='json')
        self.assertEqual(r.status_code, 400)
