"""
Tests de seguridad automatizados — Jornada40 SaaS
Cubre: autenticación, aislamiento de datos, rate limiting, webhook,
       serializers read-only, límites de carga masiva y ZIP.

Correr con: python manage.py test core
"""
import io
from unittest.mock import patch

import openpyxl
from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Cliente, Contrato, Empleado, Empresa, Plan, Suscripcion


# ─── Helpers ──────────────────────────────────────────────────────────────────

def crear_excel_bytes(filas=1):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['rut', 'nombres', 'apellido_paterno', 'cargo', 'fecha_ingreso',
               'sueldo_base', 'horas_laborales'])
    for i in range(filas):
        ws.append([f'1234567{i % 10}-{i % 10}', 'Test', 'Apellido',
                   'Cargo', '2024-01-01', 500000, 40])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    buf.name = 'test.xlsx'
    return buf


def crear_usuario_completo(username, rut_cliente, rut_empresa, plan_semilla=False):
    """Crea user + Cliente + Plan + Suscripcion + Empresa listos para tests."""
    user = User.objects.create_user(
        username=username, password='pass1234',
        email=f'{username}@test.com'
    )
    plan = Plan.objects.create(
        nombre='Semilla' if plan_semilla else 'PYME',
        precio=0 if plan_semilla else 29990,
        limite_trabajadores=3 if plan_semilla else 100,
        max_empresas=1,
    )
    cliente = Cliente.objects.create(
        usuario=user, rut=rut_cliente, nombres='Usuario Test'
    )
    Suscripcion.objects.create(
        cliente=cliente, plan=plan,
        estado='TRIAL' if plan_semilla else 'ACTIVE'
    )
    empresa = Empresa.objects.create(
        owner=user, nombre_legal='Empresa Test SA', rut=rut_empresa
    )
    return user, cliente, plan, empresa


def crear_empleado(empresa, rut, nombres='Juan', apellido='Pérez', cargo='Analista'):
    return Empleado.objects.create(
        empresa=empresa, rut=rut,
        nombres=nombres, apellido_paterno=apellido,
        cargo=cargo, fecha_ingreso='2024-01-01',
    )


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
        payload = {'email': 'x@x.com'}
        for _ in range(2):
            self.client.post('/api/auth/password/reset/', payload, format='json')
        resp = self.client.post('/api/auth/password/reset/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_register_excesivo_retorna_429(self):
        payload = {'username': 'x', 'password': 'x', 'email': 'x@x.com', 'rut': '1-9'}
        for _ in range(3):
            self.client.post('/api/auth/register/', payload, format='json')
        resp = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


# ─── A4: Seguridad del webhook ────────────────────────────────────────────────

def _mock_config(secret):
    """Devuelve un side_effect para config() que retorna `secret` para REVENIU_WEBHOOK_SECRET."""
    def _side_effect(key, **kwargs):
        if key == 'REVENIU_WEBHOOK_SECRET':
            return secret
        return kwargs.get('default')
    return _side_effect


class WebhookSeguridadTests(APITestCase):
    URL = '/api/pagos/webhook/reveniu/'

    def test_sin_secret_configurado_retorna_503(self):
        with patch('core.views.config', side_effect=_mock_config(None)):
            resp = self.client.post(self.URL, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_token_incorrecto_retorna_401(self):
        with patch('core.views.config', side_effect=_mock_config('secret-real')):
            resp = self.client.post(
                self.URL, {}, format='json',
                HTTP_X_WEBHOOK_TOKEN='token-incorrecto'
            )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_correcto_pasa_la_autenticacion(self):
        with patch('core.views.config', side_effect=_mock_config('secret-real')):
            resp = self.client.post(
                self.URL, {'event': 'ping'}, format='json',
                HTTP_X_WEBHOOK_TOKEN='secret-real'
            )
        self.assertNotIn(resp.status_code, [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_503_SERVICE_UNAVAILABLE,
        ])

    def test_token_vacio_retorna_401(self):
        with patch('core.views.config', side_effect=_mock_config('secret-real')):
            resp = self.client.post(self.URL, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


# ─── A5: Campos read_only no son escribibles ──────────────────────────────────

class SerializerReadOnlyTests(APITestCase):
    """PATCH no debe poder modificar campos marcados como read_only."""

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo(
            'a5_user', '22200000-1', '33300001-1'
        )
        self.empleado = crear_empleado(self.empresa, '44400001-1', cargo='Contador')
        self.client.force_authenticate(user=self.user)

    def test_ficha_numero_no_modificable(self):
        ficha_original = self.empleado.ficha_numero
        self.client.patch(
            f'/api/empleados/{self.empleado.id}/',
            {'ficha_numero': 9999}, format='json'
        )
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.ficha_numero, ficha_original)

    def test_activo_no_modificable_via_patch(self):
        self.client.patch(
            f'/api/empleados/{self.empleado.id}/',
            {'activo': False}, format='json'
        )
        self.empleado.refresh_from_db()
        self.assertTrue(self.empleado.activo)

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


# ─── A6 / A7: Límites en carga masiva Excel ───────────────────────────────────

class CargaMasivaLimitesTests(APITestCase):
    """El endpoint de importación Excel debe rechazar archivos grandes o con muchas filas."""

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo(
            'a6_user', '55500000-1', '66600001-1'
        )
        self.client.force_authenticate(user=self.user)
        self.url = '/api/empleados/carga_masiva/'

    def test_archivo_mayor_5mb_retorna_400(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        contenido = b'0' * (6 * 1024 * 1024)
        archivo = SimpleUploadedFile('grande.xlsx', contenido,
                                     content_type='application/octet-stream')
        resp = self.client.post(
            self.url, {'empresa': self.empresa.id, 'file': archivo},
            format='multipart'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('5 MB', resp.data.get('error', ''))

    def test_mas_de_500_filas_retorna_400(self):
        excel = crear_excel_bytes(filas=501)
        resp = self.client.post(
            self.url, {'empresa': self.empresa.id, 'file': excel},
            format='multipart'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('500', resp.data.get('error', ''))

    def test_500_filas_exactas_no_retorna_400_por_limite(self):
        excel = crear_excel_bytes(filas=500)
        resp = self.client.post(
            self.url, {'empresa': self.empresa.id, 'file': excel},
            format='multipart'
        )
        # No debe rechazar por límite de filas (puede fallar por RUTs inválidos, pero no por límite)
        self.assertNotEqual(resp.data.get('error', ''), 'El archivo no puede tener más de 500 filas por importación.')


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
