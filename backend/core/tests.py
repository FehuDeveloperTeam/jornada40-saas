"""
Tests de seguridad automatizados — Jornada40 SaaS
Cubre: autenticación, aislamiento de datos, rate limiting, webhook,
       serializers read-only, límites de carga masiva y ZIP.

Correr con: python manage.py test core
"""
import io
import uuid
from unittest.mock import patch

import openpyxl
from django.contrib.auth.models import User
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Cliente, Contrato, Empleado, Empresa, Liquidacion, Plan, Suscripcion, SolicitudFirma
from .serializers import ContratoSerializer


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
        nivel=1 if plan_semilla else 3,
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
class ImpuestoUnicoTests(APITestCase):
    """Verifica la tabla de Impuesto Único de Segunda Categoría contra valores oficiales del SII."""

    def test_bajo_tramo_exento_no_paga_impuesto(self):
        from core.indicadores import calcular_impuesto_unico
        self.assertEqual(calcular_impuesto_unico(800_000, 71506.0), 0)

    def test_tramo_8_por_ciento_coincide_con_tabla_sii(self):
        # Ejemplo oficial: renta líquida $3.000.000, UTM $71.506 → $115.579,56 (redondeado 115.580)
        from core.indicadores import calcular_impuesto_unico
        self.assertEqual(calcular_impuesto_unico(3_000_000, 71506.0), 115580)

    def test_base_tributable_cero_no_paga_impuesto(self):
        from core.indicadores import calcular_impuesto_unico
        self.assertEqual(calcular_impuesto_unico(0, 71506.0), 0)

class ContratoValidacionFechasTests(APITestCase):
    """Verifica las reglas de fecha/duración de ContratoSerializer."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo(
            'contrato_owner', '11.111.111-1', '76.111.111-1'
        )
        self.empleado = crear_empleado(self.empresa, '22.222.222-2')

    def _data(self, **overrides):
        base = {
            'empleado': self.empleado.id,
            'tipo_contrato': 'PLAZO_FIJO',
            'cargo': 'Analista',
            'fecha_inicio': '2026-01-01',
            'fecha_fin': '2026-06-01',
            'sueldo_base': 500000,
        }
        base.update(overrides)
        return base

    def test_plazo_fijo_sin_fecha_fin_es_invalido(self):
        serializer = ContratoSerializer(data=self._data(fecha_fin=None))
        self.assertFalse(serializer.is_valid())
        self.assertIn('fecha_fin', serializer.errors)

    def test_fecha_fin_anterior_a_inicio_es_invalido(self):
        serializer = ContratoSerializer(data=self._data(fecha_inicio='2026-06-01', fecha_fin='2026-01-01'))
        self.assertFalse(serializer.is_valid())
        self.assertIn('fecha_fin', serializer.errors)

    def test_plazo_fijo_mas_de_un_ano_sin_titulo_es_invalido(self):
        serializer = ContratoSerializer(data=self._data(fecha_inicio='2026-01-01', fecha_fin='2027-06-01'))
        self.assertFalse(serializer.is_valid())
        self.assertIn('fecha_fin', serializer.errors)

    def test_plazo_fijo_dos_anos_con_titulo_es_valido(self):
        serializer = ContratoSerializer(data=self._data(
            fecha_inicio='2026-01-01', fecha_fin='2027-12-01', es_profesional_titulado=True
        ))
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_indefinido_sin_fecha_fin_es_valido(self):
        serializer = ContratoSerializer(data=self._data(tipo_contrato='INDEFINIDO', fecha_fin=None))
        self.assertTrue(serializer.is_valid(), serializer.errors)

class FirmaConcurrenciaTests(APITestCase):
    """Verifica que firmar/rechazar reclamen la solicitud antes de procesarla,
    de forma que una segunda petición concurrente no pueda duplicar la firma."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo(
            'firma_owner', '33.333.333-3', '77.777.777-7'
        )
        self.empleado = crear_empleado(self.empresa, '44.444.444-4')
        self.sesion_token = uuid.uuid4()
        self.solicitud = SolicitudFirma.objects.create(
            empleado=self.empleado,
            empresa=self.empresa,
            tipo_documento='CONTRATO',
            estado='PENDIENTE',
            b2_key_temporal='pendientes/test.pdf',
            sesion_token_trabajador=self.sesion_token,
            expira_en=timezone.now() + timezone.timedelta(days=1),
        )

    @patch('core.views.b2_client.eliminar_documento')
    @patch('core.views.b2_client.subir_documento')
    @patch('core.pdf_firma.agregar_certificado_firma')
    @patch('core.views.b2_client.descargar_documento')
    def test_segunda_peticion_de_firma_es_rechazada(self, mock_descargar, mock_certificado, mock_subir, mock_eliminar):
        mock_descargar.return_value = b'%PDF-original'
        mock_certificado.return_value = b'%PDF-firmado'

        payload = {
            'sesion_token': str(self.sesion_token),
            'firma_trabajador': 'data:image/png;base64,aGVsbG8=',
        }
        url = f'/api/firma-publica/{self.solicitud.token}/firmar/'

        resp1 = self.client.post(url, payload, format='json')
        self.assertEqual(resp1.status_code, 200)

        # Segunda petición (simula doble clic) sobre la misma solicitud ya FIRMADO
        resp2 = self.client.post(url, payload, format='json')
        self.assertEqual(resp2.status_code, 400)

        self.solicitud.refresh_from_db()
        self.assertEqual(self.solicitud.estado, 'FIRMADO')

    @patch('core.views.b2_client.subir_documento', side_effect=Exception('B2 caído'))
    @patch('core.pdf_firma.agregar_certificado_firma')
    @patch('core.views.b2_client.descargar_documento')
    def test_falla_en_b2_revierte_a_pendiente(self, mock_descargar, mock_certificado, mock_subir):
        mock_descargar.return_value = b'%PDF-original'
        mock_certificado.return_value = b'%PDF-firmado'

        url = f'/api/firma-publica/{self.solicitud.token}/firmar/'
        resp = self.client.post(url, {
            'sesion_token': str(self.sesion_token),
            'firma_trabajador': 'data:image/png;base64,aGVsbG8=',
        }, format='json')

        self.assertEqual(resp.status_code, 500)
        self.solicitud.refresh_from_db()
        # Debe quedar disponible para reintentar, no atascada en PROCESANDO
        self.assertEqual(self.solicitud.estado, 'PENDIENTE')

    def test_rechazar_solicitud_ya_no_pendiente_es_rechazado(self):
        self.solicitud.estado = 'FIRMADO'
        self.solicitud.save(update_fields=['estado'])

        url = f'/api/firma-publica/{self.solicitud.token}/rechazar/'
        resp = self.client.post(url, {'sesion_token': str(self.sesion_token)}, format='json')
        self.assertEqual(resp.status_code, 400)

class LiquidacionRecalculoTests(APITestCase):
    """Verifica que editar una liquidación existente recalcule los totales,
    en vez de dejarlos congelados con los valores de la creación original."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo(
            'liquidacion_owner', '55.555.555-5', '88.888.888-8'
        )
        self.empleado = crear_empleado(self.empresa, '66.666.666-6')
        self.contrato = Contrato.objects.create(
            empleado=self.empleado, tipo_contrato='INDEFINIDO',
            fecha_inicio='2024-01-01', sueldo_base=1_000_000,
            gratificacion_legal='MENSUAL',
        )
        self.client.force_authenticate(user=self.user)

    def test_editar_dias_ausencia_recalcula_totales(self):
        resp_crear = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 1, 'anio': 2026,
            'dias_ausencia': 0,
        }, format='json')
        self.assertEqual(resp_crear.status_code, 201)
        liquidacion_id = resp_crear.data['id']
        sueldo_base_sin_ausencias = resp_crear.data['sueldo_base']
        liquido_sin_ausencias = resp_crear.data['sueldo_liquido']

        resp_editar = self.client.patch(f'/api/liquidaciones/{liquidacion_id}/', {
            'dias_ausencia': 10,
        }, format='json')
        self.assertEqual(resp_editar.status_code, 200)

        # Con 10 días de ausencia, el sueldo base proporcional y el líquido
        # deben ser menores — si quedaran "congelados", serían idénticos.
        self.assertLess(resp_editar.data['sueldo_base'], sueldo_base_sin_ausencias)
        self.assertLess(resp_editar.data['sueldo_liquido'], liquido_sin_ausencias)
        self.assertEqual(resp_editar.data['dias_ausencia'], 10)

    def test_editar_liquidacion_limpia_pdf_generado(self):
        resp_crear = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 2, 'anio': 2026,
        }, format='json')
        liquidacion_id = resp_crear.data['id']

        liquidacion = Liquidacion.objects.get(id=liquidacion_id)
        liquidacion.archivo_pdf.save('test.pdf', ContentFile(b'%PDF-fake'), save=True)
        self.assertTrue(liquidacion.archivo_pdf)

        self.client.patch(f'/api/liquidaciones/{liquidacion_id}/', {'dias_ausencia': 5}, format='json')

        liquidacion.refresh_from_db()
        self.assertFalse(liquidacion.archivo_pdf)

class TopeImponibleTests(APITestCase):
    """El tope imponible limita la base de cotización (Ley 21.735 y DL 3.500).

    Lo que excede el tope no cotiza: sin este límite, una renta alta produce
    descuentos de AFP, salud y cesantía mayores a los que corresponden.
    """

    def setUp(self):
        from core.models import ParametroPrevisional, TasaAFP
        import datetime
        # Se fijan valores conocidos para no depender del seed ni de la UF real.
        # Se vacía el histórico cargado por migraciones: estas pruebas son sobre
        # cómo se aplica un tope, no sobre qué tope regía en marzo de 2025.
        ParametroPrevisional.objects.all().delete()
        TasaAFP.objects.all().delete()
        ParametroPrevisional.objects.update_or_create(
            vigente_desde=datetime.date(2025, 1, 1),
            defaults={
                'tope_imponible_afp_uf': '87.80',
                'tope_imponible_afc_uf': '131.90',
                'ingreso_minimo_mensual': 529000,
                'factor_gratificacion': '4.75',
            },
        )
        TasaAFP.objects.update_or_create(
            nombre='MODELO', vigente_desde=datetime.date(2025, 1, 1),
            defaults={'tasa': '0.10580'},
        )
        self.uf = 39000.0
        self.tope_afp = int(87.80 * self.uf)
        self.tope_afc = int(131.90 * self.uf)

    def _liquidar(self, sueldo_base, valor_uf=None):
        """Calcula una liquidación con UF fija y sin tocar la BD de contratos."""
        from core.views import _calcular_liquidacion

        class ContratoFalso:
            tipo_contrato = 'INDEFINIDO'
            gratificacion_legal = 'MENSUAL'
            tiene_quincena = False
            monto_quincena = 0
            comisiones_config = []

        class EmpleadoFalso:
            afp = 'MODELO'
            sistema_salud = 'FONASA'
            plan_isapre_uf = 0

        contrato = ContratoFalso()
        contrato.sueldo_base = sueldo_base
        terminos = {
            'sueldo_base_contrato': sueldo_base,
            'gratificacion_legal': 'MENSUAL',
            'tipo_contrato': 'INDEFINIDO',
            'anticipo_quincena': 0,
            'valor_uf': valor_uf or self.uf,
            'porcentajes_comision': {},
        }
        return _calcular_liquidacion(
            contrato, EmpleadoFalso(),
            {'mes': 3, 'anio': 2025, 'dias_trabajados': 30},
            terminos=terminos,
        )

    def test_renta_bajo_el_tope_cotiza_sobre_el_total(self):
        resultado = self._liquidar(1_000_000)
        self.assertLess(resultado['total_imponible'], self.tope_afp)
        self.assertEqual(resultado['afp_monto'], int(resultado['total_imponible'] * 0.1058))

    def test_renta_sobre_el_tope_cotiza_solo_hasta_el_tope(self):
        resultado = self._liquidar(6_000_000)
        self.assertGreater(resultado['total_imponible'], self.tope_afp)
        # La cotización se congela en el tope, no crece con la renta
        self.assertEqual(resultado['afp_monto'], int(self.tope_afp * 0.1058))
        self.assertEqual(resultado['salud_monto'], int(self.tope_afp * 0.07))

    def test_cesantia_usa_su_propio_tope_mas_alto(self):
        # Renta entre ambos topes: AFP topa, cesantía todavía no
        resultado = self._liquidar(4_000_000)
        imponible = resultado['total_imponible']
        self.assertGreater(imponible, self.tope_afp)
        self.assertLess(imponible, self.tope_afc)
        self.assertEqual(resultado['afp_monto'], int(self.tope_afp * 0.1058))
        self.assertEqual(resultado['seguro_cesantia'], int(imponible * 0.006))

    def test_subir_la_renta_sobre_el_tope_no_aumenta_la_cotizacion(self):
        alta = self._liquidar(6_000_000)
        mas_alta = self._liquidar(9_000_000)
        self.assertEqual(alta['afp_monto'], mas_alta['afp_monto'])
        self.assertEqual(alta['salud_monto'], mas_alta['salud_monto'])

    def test_tope_de_gratificacion_sale_del_sueldo_minimo(self):
        # 4,75 × 529.000 / 12 = 209.395, no el valor fijo de 200.000 anterior
        resultado = self._liquidar(6_000_000)
        self.assertEqual(resultado['gratificacion'], int(4.75 * 529000 / 12))

    def test_parametros_se_resuelven_por_periodo_liquidado(self):
        """Un período anterior al primer registro usa el más antiguo disponible."""
        from core.views import _parametros_previsionales
        antiguo = _parametros_previsionales(1, 2020)
        self.assertEqual(antiguo['ingreso_minimo_mensual'], 529000)

    def test_valor_uf_queda_congelado_en_la_liquidacion(self):
        resultado = self._liquidar(1_000_000, valor_uf=38500.0)
        self.assertEqual(float(resultado['valor_uf']), 38500.0)


class PropuestaParametrosTests(APITestCase):
    """Una propuesta automática no debe alterar cálculos por su cuenta.

    Leer mal un tope imponible desde una página web y aplicarlo en silencio
    sería peor que quedarse con el valor anterior: por eso las filas de origen
    PREVIRED solo entran al cálculo una vez confirmadas por una persona.
    """

    def setUp(self):
        import datetime
        from core.models import ParametroPrevisional, TasaAFP
        self.enero = datetime.date(2025, 1, 1)
        self.junio = datetime.date(2025, 6, 1)
        # Igual que arriba: el histórico real haría que el período de prueba
        # resolviera a otra fila y estas pruebas son sobre confirmado/origen.
        ParametroPrevisional.objects.all().delete()
        TasaAFP.objects.all().delete()
        ParametroPrevisional.objects.update_or_create(
            vigente_desde=self.enero,
            defaults={'tope_imponible_afp_uf': '87.80', 'ingreso_minimo_mensual': 529000,
                      'origen': 'MANUAL', 'confirmado': True},
        )
        TasaAFP.objects.update_or_create(
            nombre='MODELO', vigente_desde=self.enero,
            defaults={'tasa': '0.10580', 'origen': 'MANUAL', 'confirmado': True},
        )

    def _crear_propuesta(self):
        from core.models import ParametroPrevisional, TasaAFP
        ParametroPrevisional.objects.create(
            vigente_desde=self.junio, tope_imponible_afp_uf='99.99',
            ingreso_minimo_mensual=999000, origen='PREVIRED', confirmado=False,
        )
        TasaAFP.objects.create(
            nombre='MODELO', vigente_desde=self.junio, tasa='0.15000',
            origen='PREVIRED', confirmado=False,
        )

    def test_propuesta_sin_confirmar_no_cambia_los_parametros(self):
        from core.views import _parametros_previsionales
        self._crear_propuesta()
        vigentes = _parametros_previsionales(8, 2025)
        self.assertEqual(vigentes['tope_imponible_afp_uf'], 87.80)
        self.assertEqual(vigentes['ingreso_minimo_mensual'], 529000)

    def test_propuesta_sin_confirmar_no_cambia_las_tasas_afp(self):
        from core.views import _tasas_afp
        self._crear_propuesta()
        self.assertEqual(_tasas_afp(8, 2025)['MODELO'], 0.1058)

    def test_al_confirmarla_si_entra_en_vigencia(self):
        from core.models import ParametroPrevisional, TasaAFP
        from core.views import _parametros_previsionales, _tasas_afp
        self._crear_propuesta()
        ParametroPrevisional.objects.filter(vigente_desde=self.junio).update(confirmado=True)
        TasaAFP.objects.filter(vigente_desde=self.junio).update(confirmado=True)

        self.assertEqual(_parametros_previsionales(8, 2025)['tope_imponible_afp_uf'], 99.99)
        self.assertEqual(_tasas_afp(8, 2025)['MODELO'], 0.15)

    def test_carga_manual_rige_sin_necesidad_de_confirmar(self):
        """Editar a mano en el admin debe surtir efecto de inmediato."""
        from core.models import ParametroPrevisional
        from core.views import _parametros_previsionales
        ParametroPrevisional.objects.create(
            vigente_desde=self.junio, tope_imponible_afp_uf='90.00',
            ingreso_minimo_mensual=550000, origen='MANUAL', confirmado=False,
        )
        self.assertEqual(_parametros_previsionales(8, 2025)['tope_imponible_afp_uf'], 90.00)

    def test_advierte_cuando_los_parametros_no_estan_confirmados(self):
        from core.models import ParametroPrevisional
        from core.views import advertencias_parametros
        ParametroPrevisional.objects.filter(vigente_desde=self.enero).update(confirmado=False)
        self.assertTrue(any('no han sido confirmados' in a
                            for a in advertencias_parametros(3, 2025)))

    def test_advierte_cuando_los_parametros_quedaron_viejos(self):
        from core.views import advertencias_parametros
        # Liquidar 2027 con parámetros de enero 2025: los topes se reajustan cada enero
        self.assertTrue(any('antigüedad' in a for a in advertencias_parametros(6, 2027)))

    def test_sin_advertencias_cuando_todo_esta_al_dia(self):
        from core.views import advertencias_parametros
        self.assertEqual(advertencias_parametros(3, 2025), [])


class RespaldoIndicadoresTests(APITestCase):
    """Calcular con la UF de respaldo no debe pasar inadvertido."""

    def setUp(self):
        cache.clear()

    def test_sin_respaldo_activo_no_hay_advertencias(self):
        from core.indicadores import estado_indicadores
        self.assertEqual(estado_indicadores(), [])

    def test_caer_en_respaldo_queda_registrado_y_se_advierte(self):
        from core.indicadores import estado_indicadores, obtener_uf, UF_FALLBACK
        with patch('core.indicadores.requests.get', side_effect=Exception('sin red')):
            self.assertEqual(obtener_uf(), UF_FALLBACK)
        advertencias = estado_indicadores()
        self.assertTrue(any('UF' in a for a in advertencias))

    def test_al_recuperarse_la_api_deja_de_advertir(self):
        from core.indicadores import estado_indicadores, obtener_uf
        with patch('core.indicadores.requests.get', side_effect=Exception('sin red')):
            obtener_uf()
        self.assertTrue(estado_indicadores())

        cache.delete('indicador_uf')  # forzar nueva consulta
        respuesta = type('R', (), {
            'raise_for_status': lambda self: None,
            'json': lambda self: {'serie': [{'valor': 41000.0}]},
        })()
        with patch('core.indicadores.requests.get', return_value=respuesta):
            self.assertEqual(obtener_uf(), 41000.0)
        self.assertEqual(estado_indicadores(), [])


class ParserPreviredTests(APITestCase):
    """El lector de Previred debe interpretar bien o no interpretar nada.

    Es la pieza más frágil del flujo: depende del maquetado de una página
    ajena. Preferimos que falle en voz alta a que proponga un tope inventado.
    """

    HTML = """
    <html><body><table>
    <tr><td>Renta Tope Imponible AFP</td><td>87,8 UF</td></tr>
    <tr><td>Renta Tope Imponible Seguro de Cesant&iacute;a</td><td>131,9 UF</td></tr>
    <tr><td>Ingreso M&iacute;nimo Mensual</td><td>$529.000</td></tr>
    </table>
    <table><tr><th>AFP</th><th>Tasa</th></tr>
    <tr><td>CAPITAL</td><td>11,44%</td></tr>
    <tr><td>MODELO</td><td>10,58%</td></tr>
    </table></body></html>
    """

    def setUp(self):
        from core.management.commands import sincronizar_previred as sp
        self.sp = sp
        self.texto = sp._texto_plano(self.HTML)

    def test_numeros_en_formato_chileno(self):
        self.assertEqual(self.sp._a_numero('87,8'), 87.8)
        self.assertEqual(self.sp._a_numero('$529.000'), 529000.0)
        self.assertEqual(self.sp._a_numero('1.234,56'), 1234.56)

    def test_lee_los_topes_y_el_sueldo_minimo(self):
        self.assertEqual(
            self.sp._buscar(self.texto, r'tope\s+imponible[^.]{0,60}?([\d.,]+)\s*UF',
                            'tope_imponible_afp_uf'), 87.8)
        self.assertEqual(
            self.sp._buscar(self.texto, r'(?:cesant[íi]a)[^.]{0,60}?([\d.,]+)\s*UF',
                            'tope_imponible_afc_uf'), 131.9)
        self.assertEqual(
            self.sp._buscar(self.texto, r'ingreso\s+m[íi]nimo[^.]{0,80}?\$?\s*([\d.,]+)',
                            'ingreso_minimo_mensual'), 529000.0)

    def test_lee_las_tasas_afp_como_porcentaje(self):
        """El rango valida el porcentaje leído, no la fracción resultante."""
        for afp, esperado in (('CAPITAL', 11.44), ('MODELO', 10.58)):
            leido = self.sp._buscar(self.texto, rf'{afp}[^%]{{0,40}}?([\d.,]+)\s*%',
                                    'tasa_afp_pct')
            self.assertEqual(leido, esperado)
            self.assertEqual(round(leido / 100, 5), round(esperado / 100, 5))

    def test_descarta_valores_fuera_de_rango_plausible(self):
        absurdo = self.sp._buscar('Tope Imponible 9999 UF',
                                  r'tope\s+imponible[^.]{0,60}?([\d.,]+)\s*UF',
                                  'tope_imponible_afp_uf')
        self.assertIsNone(absurdo)

    def test_pagina_irreconocible_no_devuelve_nada(self):
        otro = self.sp._texto_plano('<html><body>Sitio en mantención</body></html>')
        self.assertIsNone(self.sp._buscar(
            otro, r'tope\s+imponible[^.]{0,60}?([\d.,]+)\s*UF', 'tope_imponible_afp_uf'))


class CatalogoConceptosTests(APITestCase):
    """El catálogo reemplaza la glosa libre y define la naturaleza del haber."""

    def setUp(self):
        from core.models import ConceptoRemuneracion
        self.user, _, _, self.empresa = crear_usuario_completo(
            'cat_user', '19000000-1', '76900001-1')
        self.otro_user, _, _, self.otra_empresa = crear_usuario_completo(
            'cat_otro', '19000000-2', '76900001-2')
        self.client.force_authenticate(user=self.user)
        self.colacion = ConceptoRemuneracion.objects.get(codigo='COLACION', empresa=None)
        self.bono = ConceptoRemuneracion.objects.get(codigo='BONO_PRODUCCION', empresa=None)

    # ── Naturaleza derivada del tipo ────────────────────────────────────────

    def test_la_naturaleza_la_fija_el_tipo_y_no_quien_lo_crea(self):
        """Un concepto no imponible no puede nacer marcado como imponible."""
        from core.models import ConceptoRemuneracion
        concepto = ConceptoRemuneracion.objects.create(
            codigo='BONO_RARO', nombre='Bono raro', tipo='HABER_NO_IMPONIBLE',
            empresa=self.empresa, es_imponible=True, afecta_gratificacion=True,
        )
        concepto.refresh_from_db()
        self.assertFalse(concepto.es_imponible)
        self.assertFalse(concepto.afecta_gratificacion)

    def test_comision_afecta_semana_corrida_y_hora_extra_no(self):
        """Art. 32 inciso final: las horas extras se excluyen de semana corrida."""
        from core.models import ConceptoRemuneracion
        comision = ConceptoRemuneracion.objects.create(
            codigo='COM_X', nombre='Comisión X', tipo='COMISION', empresa=self.empresa)
        hora = ConceptoRemuneracion.objects.get(codigo='HORA_EXTRA_50', empresa=None)
        self.assertTrue(comision.afecta_semana_corrida)
        self.assertFalse(hora.afecta_semana_corrida)

    # ── Endpoint ────────────────────────────────────────────────────────────

    def test_lista_incluye_catalogo_del_sistema(self):
        resp = self.client.get('/api/conceptos/?tipo=HABER_NO_IMPONIBLE')
        codigos = [c['codigo'] for c in resp.data]
        self.assertIn('COLACION', codigos)
        self.assertIn('MOVILIZACION', codigos)

    def test_no_se_ven_conceptos_propios_de_otra_empresa(self):
        from core.models import ConceptoRemuneracion
        ajeno = ConceptoRemuneracion.objects.create(
            codigo='AJENO', nombre='Bono ajeno', tipo='HABER_IMPONIBLE',
            empresa=self.otra_empresa)
        resp = self.client.get('/api/conceptos/')
        self.assertNotIn(ajeno.id, [c['id'] for c in resp.data])

    def test_no_se_puede_modificar_un_concepto_del_sistema(self):
        resp = self.client.patch(f'/api/conceptos/{self.colacion.id}/',
                                 {'nombre': 'Secuestrado'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_eliminar_un_concepto_propio_lo_desactiva(self):
        """Las liquidaciones emitidas lo referencian: no se borra, se oculta."""
        from core.models import ConceptoRemuneracion
        propio = ConceptoRemuneracion.objects.create(
            codigo='PROPIO', nombre='Bono propio', tipo='HABER_IMPONIBLE',
            empresa=self.empresa)
        resp = self.client.delete(f'/api/conceptos/{propio.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        propio.refresh_from_db()
        self.assertFalse(propio.activo)

    # ── Efecto en el cálculo ────────────────────────────────────────────────

    def _liquidar(self, **listas):
        from core.views import _calcular_liquidacion

        class ContratoFalso:
            sueldo_base = 1_000_000
            tipo_contrato = 'INDEFINIDO'
            gratificacion_legal = 'MENSUAL'
            tiene_quincena = False
            monto_quincena = 0
            comisiones_config = []

        class EmpleadoFalso:
            afp = 'MODELO'
            sistema_salud = 'FONASA'
            plan_isapre_uf = 0

        datos = {'mes': 3, 'anio': 2025, 'dias_trabajados': 30, **listas}
        return _calcular_liquidacion(ContratoFalso(), EmpleadoFalso(), datos)

    def test_haber_no_imponible_no_entra_a_la_base_de_cotizacion(self):
        sin = self._liquidar()
        con = self._liquidar(detalle_haberes_no_imponibles=[
            {'concepto': self.colacion.id, 'glosa': 'x', 'valor': 100_000}])
        self.assertEqual(sin['total_imponible'], con['total_imponible'])
        self.assertEqual(con['total_haberes'], sin['total_haberes'] + 100_000)

    def test_haber_imponible_si_entra_a_la_base(self):
        sin = self._liquidar()
        con = self._liquidar(detalle_haberes_imponibles=[
            {'concepto': self.bono.id, 'glosa': 'x', 'valor': 100_000}])
        self.assertGreater(con['total_imponible'], sin['total_imponible'])
        self.assertGreater(con['afp_monto'], sin['afp_monto'])

    def test_la_glosa_se_congela_desde_el_concepto(self):
        """Lo que el cliente mande como glosa no manda: la fija el catálogo."""
        resultado = self._liquidar(detalle_haberes_no_imponibles=[
            {'concepto': self.colacion.id, 'glosa': 'lo que sea', 'valor': 50_000}])
        self.assertEqual(resultado['detalle_items'][0]['glosa'], self.colacion.nombre)

    def test_item_sin_concepto_conserva_el_comportamiento_anterior(self):
        """Los datos previos al catálogo se siguen clasificando por su lista."""
        resultado = self._liquidar(detalle_haberes_imponibles=[
            {'glosa': 'Bono antiguo sin concepto', 'valor': 80_000}])
        base = self._liquidar()
        self.assertGreater(resultado['total_imponible'], base['total_imponible'])

    # ── Validación ──────────────────────────────────────────────────────────

    def test_rechaza_un_concepto_en_la_seccion_equivocada(self):
        empleado = crear_empleado(self.empresa, '11900001-1')
        Contrato.objects.create(empleado=empleado, sueldo_base=800_000,
                                fecha_inicio='2024-01-01', cargo='Analista')
        resp = self.client.post('/api/liquidaciones/', {
            'empleado': empleado.id, 'mes': 3, 'anio': 2025,
            'dias_trabajados': 30,
            # Colación es no imponible: no puede ir entre los imponibles
            'detalle_haberes_imponibles': [
                {'concepto': self.colacion.id, 'glosa': 'x', 'valor': 50_000}],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rechaza_un_concepto_de_otra_empresa(self):
        from core.models import ConceptoRemuneracion
        ajeno = ConceptoRemuneracion.objects.create(
            codigo='AJENO2', nombre='Bono ajeno', tipo='HABER_IMPONIBLE',
            empresa=self.otra_empresa)
        empleado = crear_empleado(self.empresa, '11900002-2')
        Contrato.objects.create(empleado=empleado, sueldo_base=800_000,
                                fecha_inicio='2024-01-01', cargo='Analista')
        resp = self.client.post('/api/liquidaciones/', {
            'empleado': empleado.id, 'mes': 4, 'anio': 2025, 'dias_trabajados': 30,
            'detalle_haberes_imponibles': [
                {'concepto': ajeno.id, 'glosa': 'x', 'valor': 50_000}],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class ComportamientoListasDetalleTests(APITestCase):
    """Fija el comportamiento actual de las listas de detalle antes de unificarlas.

    No prueban código nuevo: existen para que, al pasar de cuatro listas a una
    sola, cualquier diferencia en los montos, en los PDF o en el Libro de
    Remuneraciones salte de inmediato. Son la red de seguridad del refactor.
    """

    def setUp(self):
        from core.models import ConceptoRemuneracion
        self.user, _, _, self.empresa = crear_usuario_completo(
            'det_user', '17000000-1', '76700001-1')
        self.client.force_authenticate(user=self.user)
        self.empleado = crear_empleado(self.empresa, '11700001-1')
        self.contrato = Contrato.objects.create(
            empleado=self.empleado, sueldo_base=1_000_000,
            fecha_inicio='2024-01-01', cargo='Vendedor',
            es_comisionista=True,
            comisiones_config=[{'glosa': 'Carrocería', 'porcentaje': 0.5}],
        )
        self.bono = ConceptoRemuneracion.objects.get(codigo='BONO_PRODUCCION', empresa=None)
        self.colacion = ConceptoRemuneracion.objects.get(codigo='COLACION', empresa=None)
        self.hora50 = ConceptoRemuneracion.objects.get(codigo='HORA_EXTRA_50', empresa=None)
        self.anticipo = ConceptoRemuneracion.objects.get(codigo='ANTICIPO', empresa=None)

    def _payload(self, **extra):
        return {
            'empleado': self.empleado.id, 'mes': 5, 'anio': 2025,
            'dias_trabajados': 30,
            'detalle_haberes_imponibles': [
                {'concepto': self.bono.id, 'glosa': 'Bono', 'valor': 200_000}],
            'detalle_horas_extras': [
                {'concepto': self.hora50.id, 'glosa': 'HE', 'horas': 10,
                 'recargo': 50, 'valor': 80_000}],
            'detalle_haberes_no_imponibles': [
                {'concepto': self.colacion.id, 'glosa': 'Colación', 'valor': 60_000}],
            'detalle_otros_descuentos': [
                {'concepto': self.anticipo.id, 'glosa': 'Anticipo', 'valor': 50_000}],
            'detalle_comisiones': [
                {'glosa': 'Carrocería', 'monto_vendido': 4_000_000}],
            **extra,
        }

    def _crear(self, **extra):
        resp = self.client.post('/api/liquidaciones/', self._payload(**extra), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        return resp.data

    @staticmethod
    def _items(liq, naturaleza):
        """Ítems de una naturaleza en la respuesta del API."""
        return [i for i in liq['detalle_items'] if i.get('naturaleza') == naturaleza]

    # ── Montos ──────────────────────────────────────────────────────────────

    def test_cada_lista_aporta_a_los_totales_que_le_corresponden(self):
        liq = self._crear()
        # Imponible incluye sueldo, bono, horas extras, comisión y semana corrida
        self.assertGreater(liq['total_imponible'], 1_000_000 + 200_000 + 80_000)
        # La colación suma a haberes pero no a imponible
        self.assertEqual(liq['total_haberes'], liq['total_imponible'] + 60_000)
        # El anticipo suma a los descuentos
        self.assertIn(50_000, [d['valor'] for d in self._items(liq, 'DESCUENTO')])

    def test_la_comision_se_calcula_con_el_porcentaje_del_contrato(self):
        liq = self._crear()
        # 4.000.000 x 0,5% = 20.000
        comision = self._items(liq, 'COMISION')[0]
        self.assertEqual(comision['valor'], 20_000)
        self.assertEqual(comision['porcentaje'], 0.5)

    def test_la_comision_genera_semana_corrida_y_las_horas_extras_no(self):
        con_comision = self._crear()
        self.assertGreater(con_comision['semana_corrida'], 0)

        sin_comision = self.client.post('/api/liquidaciones/', self._payload(
            mes=6, detalle_comisiones=[]), format='json').data
        self.assertEqual(sin_comision['semana_corrida'], 0)

    # ── Recálculo con términos congelados ───────────────────────────────────

    def test_editar_conserva_el_porcentaje_historico_de_la_comision(self):
        """El riesgo más sutil: recalcular no debe perder la comisión."""
        liq = self._crear()
        liq_id = liq['id']

        # Cambia la tasa pactada después de emitida
        self.contrato.comisiones_config = [{'glosa': 'Carrocería', 'porcentaje': 9.9}]
        self.contrato.save(update_fields=['comisiones_config'])

        resp = self.client.patch(f'/api/liquidaciones/{liq_id}/',
                                 {'dias_ausencia': 1}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        # Sigue usando el 0,5% con que se emitió, no el 9,9% nuevo
        comision = self._items(resp.data, 'COMISION')[0]
        self.assertEqual(comision['porcentaje'], 0.5)
        self.assertEqual(comision['valor'], 20_000)

    def test_editar_conserva_todas_las_listas(self):
        liq = self._crear()
        resp = self.client.patch(f'/api/liquidaciones/{liq["id"]}/',
                                 {'dias_ausencia': 2}, format='json')
        for naturaleza in ('HABER_IMPONIBLE', 'HORA_EXTRA', 'HABER_NO_IMPONIBLE',
                           'DESCUENTO', 'COMISION'):
            self.assertEqual(len(self._items(resp.data, naturaleza)), 1,
                             f'{naturaleza} se perdió al editar')

    # ── Salidas: PDF y Libro de Remuneraciones ──────────────────────────────

    def test_el_pdf_de_la_liquidacion_se_genera(self):
        liq = self._crear()
        resp = self.client.get(f'/api/liquidaciones/{liq["id"]}/generar_pdf/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp['Content-Type'], 'application/pdf')
        self.assertGreater(len(resp.content), 1000)

    def test_el_libro_cuadra_las_columnas_con_el_total(self):
        """Otros imponibles debe cubrir bono, horas extras, comisión y semana corrida."""
        liq = self._crear()
        resp = self.client.get(
            f'/api/liquidaciones/libro_remuneraciones/?mes=5&anio=2025'
            f'&empresa={self.empresa.id}&formato=excel')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        registro = Liquidacion.objects.get(id=liq['id'])
        # La hora extra la calcula el backend desde horas, recargo y contrato:
        # los $80.000 del payload ya no se toman tal cual.
        otros_imp = (200_000
                     + registro.items_de('HORA_EXTRA')[0]['valor']
                     + registro.items_de('COMISION')[0]['valor']
                     + registro.semana_corrida)
        self.assertEqual(
            registro.sueldo_base + registro.gratificacion + otros_imp,
            registro.total_imponible)


class DetalleUnificadoTests(APITestCase):
    """La lista única reemplaza a las cuatro anteriores."""

    def setUp(self):
        from core.models import ConceptoRemuneracion
        self.user, _, _, self.empresa = crear_usuario_completo(
            'uni_user', '18000000-1', '76800001-1')
        self.client.force_authenticate(user=self.user)
        self.empleado = crear_empleado(self.empresa, '11800001-1')
        Contrato.objects.create(
            empleado=self.empleado, sueldo_base=1_000_000,
            fecha_inicio='2024-01-01', cargo='Analista')
        self.bono = ConceptoRemuneracion.objects.get(codigo='BONO_PRODUCCION', empresa=None)
        self.colacion = ConceptoRemuneracion.objects.get(codigo='COLACION', empresa=None)

    def test_acepta_el_formato_nuevo_de_lista_unica(self):
        resp = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 7, 'anio': 2025,
            'dias_trabajados': 30,
            'detalle_items': [
                {'concepto': self.bono.id, 'naturaleza': 'HABER_IMPONIBLE',
                 'glosa': 'x', 'valor': 150_000},
                {'concepto': self.colacion.id, 'naturaleza': 'HABER_NO_IMPONIBLE',
                 'glosa': 'x', 'valor': 40_000},
            ],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(len(resp.data['detalle_items']), 2)
        # La colación no cotiza pero sí suma a haberes
        self.assertEqual(resp.data['total_haberes'], resp.data['total_imponible'] + 40_000)

    def test_los_dos_formatos_dan_el_mismo_resultado(self):
        """Compatibilidad: un cliente sin actualizar debe calcular igual."""
        viejo = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 8, 'anio': 2025, 'dias_trabajados': 30,
            'detalle_haberes_imponibles': [
                {'concepto': self.bono.id, 'glosa': 'x', 'valor': 150_000}],
            'detalle_haberes_no_imponibles': [
                {'concepto': self.colacion.id, 'glosa': 'x', 'valor': 40_000}],
        }, format='json').data

        nuevo = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 9, 'anio': 2025, 'dias_trabajados': 30,
            'detalle_items': [
                {'concepto': self.bono.id, 'naturaleza': 'HABER_IMPONIBLE',
                 'glosa': 'x', 'valor': 150_000},
                {'concepto': self.colacion.id, 'naturaleza': 'HABER_NO_IMPONIBLE',
                 'glosa': 'x', 'valor': 40_000},
            ],
        }, format='json').data

        for campo in ('total_imponible', 'total_haberes', 'total_descuentos',
                      'sueldo_liquido', 'afp_monto', 'salud_monto'):
            self.assertEqual(viejo[campo], nuevo[campo], f'{campo} difiere entre formatos')

    def test_items_agrupados_separa_por_naturaleza(self):
        resp = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 10, 'anio': 2025, 'dias_trabajados': 30,
            'detalle_items': [
                {'concepto': self.bono.id, 'naturaleza': 'HABER_IMPONIBLE',
                 'glosa': 'x', 'valor': 100_000},
                {'concepto': self.colacion.id, 'naturaleza': 'HABER_NO_IMPONIBLE',
                 'glosa': 'x', 'valor': 30_000},
            ],
        }, format='json')
        registro = Liquidacion.objects.get(id=resp.data['id'])
        agrupados = registro.items_agrupados
        self.assertEqual(len(agrupados['imponibles']), 1)
        self.assertEqual(len(agrupados['no_imponibles']), 1)
        self.assertEqual(agrupados['descuentos'], [])


class ComisionesCatalogoTests(APITestCase):
    """Las categorías de comisión se identifican por concepto, no por glosa.

    Identificarlas por nombre significaba que renombrar una categoría dejaba
    huérfanas las liquidaciones ya emitidas y su comisión se recalculaba en
    cero. El id del concepto no cambia al renombrar.
    """

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo(
            'com_user', '16000000-1', '76600001-1')
        self.client.force_authenticate(user=self.user)
        self.empleado = crear_empleado(self.empresa, '11600001-1')

    def _crear_contrato(self, categorias):
        resp = self.client.post('/api/contratos/', {
            'empleado': self.empleado.id, 'sueldo_base': 1_000_000,
            'fecha_inicio': '2024-01-01', 'cargo': 'Vendedor',
            'es_comisionista': True, 'comisiones_config': categorias,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        return Contrato.objects.get(id=resp.data['id'])

    def test_guardar_el_contrato_crea_el_concepto_de_la_categoria(self):
        from core.models import ConceptoRemuneracion
        contrato = self._crear_contrato([{'glosa': 'Carrocería', 'porcentaje': 0.5}])

        concepto = ConceptoRemuneracion.objects.get(
            empresa=self.empresa, tipo='COMISION', nombre='Carrocería')
        self.assertTrue(concepto.afecta_semana_corrida)
        self.assertEqual(contrato.comisiones_config,
                         [{'concepto': concepto.id, 'porcentaje': 0.5}])

    def test_la_misma_categoria_no_se_duplica(self):
        from core.models import ConceptoRemuneracion
        self._crear_contrato([{'glosa': 'Carrocería', 'porcentaje': 0.5}])
        otro = crear_empleado(self.empresa, '11600002-2')
        self.client.post('/api/contratos/', {
            'empleado': otro.id, 'sueldo_base': 900_000,
            'fecha_inicio': '2024-01-01', 'cargo': 'Vendedor',
            'es_comisionista': True,
            'comisiones_config': [{'glosa': 'carrocería', 'porcentaje': 0.7}],
        }, format='json')

        self.assertEqual(ConceptoRemuneracion.objects.filter(
            empresa=self.empresa, tipo='COMISION').count(), 1)

    def test_renombrar_la_categoria_no_rompe_la_liquidacion_emitida(self):
        """El caso que motivó el cambio."""
        from core.models import ConceptoRemuneracion
        contrato = self._crear_contrato([{'glosa': 'Carrocería', 'porcentaje': 0.5}])
        concepto = ConceptoRemuneracion.objects.get(
            empresa=self.empresa, tipo='COMISION', nombre='Carrocería')

        liq = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 4, 'anio': 2025,
            'dias_trabajados': 30,
            'detalle_items': [{
                'concepto': concepto.id, 'naturaleza': 'COMISION',
                'glosa': 'Carrocería', 'monto_vendido': 4_000_000,
            }],
        }, format='json').data
        comision = [i for i in liq['detalle_items'] if i['naturaleza'] == 'COMISION'][0]
        self.assertEqual(comision['valor'], 20_000)

        # Se renombra el concepto en el catálogo
        concepto.nombre = 'Carrocería Pesada'
        concepto.save(update_fields=['nombre'])

        resp = self.client.patch(f'/api/liquidaciones/{liq["id"]}/',
                                 {'dias_ausencia': 1}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        recalculada = [i for i in resp.data['detalle_items']
                       if i['naturaleza'] == 'COMISION'][0]
        # Antes esto daba 0 porque la glosa ya no calzaba con la del contrato
        self.assertEqual(recalculada['porcentaje'], 0.5)
        self.assertEqual(recalculada['valor'], 20_000)

    def test_una_liquidacion_previa_al_catalogo_sigue_resolviendo_por_glosa(self):
        """Compatibilidad con lo emitido antes de que existieran los conceptos."""
        from core.views import _terminos_congelados
        contrato = self._crear_contrato([{'glosa': 'Carrocería', 'porcentaje': 0.5}])
        liq = Liquidacion.objects.create(
            empleado=self.empleado, mes=1, anio=2025, sueldo_base_contrato=1_000_000,
            detalle_items=[{'naturaleza': 'COMISION', 'glosa': 'Carrocería',
                            'monto_vendido': 2_000_000, 'porcentaje': 0.5,
                            'valor': 10_000}],
        )
        porcentajes = _terminos_congelados(liq, contrato)['porcentajes_comision']
        self.assertEqual(porcentajes.get('Carrocería'), 0.5)


class HistoricoParametrosTests(APITestCase):
    """El histórico cargado en migraciones debe resolver cada período con sus valores.

    Recalcular una liquidación antigua tiene que usar el sueldo mínimo y los
    topes que regían entonces: si el motor aplicara siempre los de hoy, corregir
    un error de 2025 lo convertiría en otro error distinto.
    """

    def _imm(self, mes, anio):
        from core.views import _parametros_previsionales
        return _parametros_previsionales(mes, anio)['ingreso_minimo_mensual']

    def _topes(self, mes, anio):
        from core.views import _parametros_previsionales
        par = _parametros_previsionales(mes, anio)
        return par['tope_imponible_afp_uf'], par['tope_imponible_afc_uf']

    def test_ingreso_minimo_vigente_hoy(self):
        # Ley 21.830: $553.553 desde las remuneraciones de mayo de 2026.
        self.assertEqual(self._imm(9, 2026), 553553)

    def test_cada_reajuste_del_ingreso_minimo_rige_desde_su_mes(self):
        self.assertEqual(self._imm(6, 2024), 460000)   # Ley 21.578
        self.assertEqual(self._imm(8, 2024), 500000)   # Ley 21.578
        self.assertEqual(self._imm(3, 2025), 510636)   # Decreto 3 de Hacienda
        self.assertEqual(self._imm(7, 2025), 529000)   # Ley 21.751
        self.assertEqual(self._imm(3, 2026), 539000)   # Ley 21.751
        self.assertEqual(self._imm(5, 2026), 553553)   # Ley 21.830

    def test_el_mes_anterior_a_un_reajuste_conserva_el_valor_viejo(self):
        self.assertEqual(self._imm(4, 2025), 510636)
        self.assertEqual(self._imm(4, 2026), 539000)

    def test_topes_imponibles_distinguen_provisional_y_definitivo(self):
        # La Superintendencia informa un valor provisional para las
        # remuneraciones de enero y el definitivo desde febrero.
        self.assertEqual(self._topes(1, 2026), (89.90, 135.10))
        self.assertEqual(self._topes(2, 2026), (90.00, 135.20))
        self.assertEqual(self._topes(1, 2025), (87.80, 131.80))
        self.assertEqual(self._topes(2, 2025), (87.80, 131.90))

    def test_tope_de_gratificacion_con_el_minimo_vigente(self):
        from core.views import _parametros_previsionales
        par = _parametros_previsionales(9, 2026)
        tope = int(par['factor_gratificacion'] * par['ingreso_minimo_mensual'] / 12)
        self.assertEqual(tope, 219114)

    def test_afp_uno_baja_su_comision_en_octubre_de_2025(self):
        from core.views import _tasas_afp
        # 10% obligatorio + comisión: 0,49% hasta septiembre, 0,46% desde octubre.
        self.assertEqual(_tasas_afp(9, 2025)['UNO'], 0.1049)
        self.assertEqual(_tasas_afp(10, 2025)['UNO'], 0.1046)
        # Las demás no se movieron con la licitación.
        self.assertEqual(_tasas_afp(10, 2025)['MODELO'], 0.1058)

    def test_el_historico_no_dispara_advertencias_de_antiguedad(self):
        from core.views import advertencias_parametros
        self.assertEqual(advertencias_parametros(9, 2026), [])


class TopeEnPesosTests(APITestCase):
    """El tope en pesos debe coincidir al peso con el que publica Previred."""

    def test_no_pierde_un_peso_por_el_punto_flotante(self):
        from core.views import _tope_en_pesos
        # 90 × 41.057,20 es exactamente 3.695.148, pero en float da
        # 3.695.147,9999... y truncar ahí devolvía un peso de menos.
        self.assertEqual(_tope_en_pesos(90.00, 41057.20), 3695148)
        self.assertEqual(_tope_en_pesos(135.20, 41057.20), 5550933)

    def test_trunca_los_decimales_reales(self):
        from core.views import _tope_en_pesos
        self.assertEqual(_tope_en_pesos(87.80, 41057.20), 3604822)

    def test_acepta_decimal_y_float_indistintamente(self):
        from decimal import Decimal
        from core.views import _tope_en_pesos
        self.assertEqual(_tope_en_pesos(Decimal('90.00'), Decimal('41057.20')),
                         _tope_en_pesos(90.00, 41057.20))


class RegistroDatosClienteTests(APITestCase):
    """El registro guarda el tipo de cliente, la razón social y el teléfono.

    Los campos existían en el modelo pero el endpoint los descartaba: quien se
    registraba como empresa quedaba como persona natural y sin razón social.
    """

    def setUp(self):
        cache.clear()

    def _registrar(self, **extra):
        payload = {
            'rut': '12.345.678-5', 'password': 'Clave-Segura-2026',
            'email': 'ana@maestranza.cl', 'nombres': 'Ana', 'apellido_paterno': 'Pérez',
            **extra,
        }
        return self.client.post('/api/auth/register/', payload, format='json')

    def _cliente(self):
        from core.models import Cliente
        return Cliente.objects.get(rut='12.345.678-5')

    def test_empresa_guarda_razon_social_y_telefono(self):
        resp = self._registrar(tipo_cliente='EMPRESA', razon_social='Maestranza Los Andes SpA',
                               telefono='+56 9 1234 5678')
        self.assertEqual(resp.status_code, 201)
        cliente = self._cliente()
        self.assertEqual(cliente.tipo_cliente, 'EMPRESA')
        self.assertEqual(cliente.razon_social, 'Maestranza Los Andes SpA')
        self.assertEqual(cliente.telefono, '+56 9 1234 5678')

    def test_persona_natural_no_guarda_razon_social(self):
        # Una razón social enviada por error no debe quedar en una persona natural.
        self._registrar(tipo_cliente='PERSONA', razon_social='No corresponde')
        cliente = self._cliente()
        self.assertEqual(cliente.tipo_cliente, 'PERSONA')
        self.assertIsNone(cliente.razon_social)

    def test_tipo_desconocido_queda_como_persona(self):
        self._registrar(tipo_cliente='ADMIN')
        self.assertEqual(self._cliente().tipo_cliente, 'PERSONA')

    def test_formulario_anterior_sigue_registrando(self):
        """El registro anterior envía EMPRESA sin razón social.

        Railway y Vercel despliegan por separado: mientras convivan, ese
        formulario tiene que seguir funcionando contra el backend nuevo.
        """
        resp = self._registrar(tipo_cliente='EMPRESA', plan_id=1)
        self.assertEqual(resp.status_code, 201)
        cliente = self._cliente()
        self.assertEqual(cliente.tipo_cliente, 'EMPRESA')
        self.assertIsNone(cliente.razon_social)

    def test_telefono_se_recorta_al_largo_del_campo(self):
        self._registrar(telefono='9' * 40)
        self.assertEqual(len(self._cliente().telefono), 20)


class LoginSoloRutTests(APITestCase):
    """Se entra solo con el RUT del titular, nunca con el correo.

    El correo puede repetirse entre cuentas: antes, dos cuentas con el mismo
    correo hacían que el login por correo respondiera 500.
    """

    def setUp(self):
        cache.clear()
        from django.contrib.auth.models import User
        User.objects.create_user(username='12.345.678-5', password='Clave-Segura-2026', email='mismo@correo.cl')
        User.objects.create_user(username='9.876.543-3', password='Otra-Clave-2026', email='mismo@correo.cl')

    def _login(self, **datos):
        return self.client.post('/api/auth/login/', datos, format='json')

    def test_entra_con_rut(self):
        resp = self._login(username='12.345.678-5', password='Clave-Segura-2026')
        self.assertEqual(resp.status_code, 200)

    def test_con_correo_no_entra(self):
        resp = self._login(email='mismo@correo.cl', password='Clave-Segura-2026')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('username', resp.data)

    def test_correo_repetido_ya_no_da_500(self):
        # Antes: MultipleObjectsReturned sin capturar → 500.
        resp = self._login(email='mismo@correo.cl', password='cualquiera')
        self.assertEqual(resp.status_code, 400)

    def test_correo_en_el_campo_username_no_entra(self):
        resp = self._login(username='mismo@correo.cl', password='Clave-Segura-2026')
        self.assertEqual(resp.status_code, 400)

    def test_clave_incorrecta(self):
        resp = self._login(username='12.345.678-5', password='incorrecta')
        self.assertEqual(resp.status_code, 400)


import datetime  # noqa: E402  (usado por las pruebas de jornada)


class JornadaMaximaTests(APITestCase):
    """Calendario de la Ley 21.561 y avisos de jornada.

    Criterio de producto: el sistema avisa, nunca bloquea. Estas pruebas fijan
    qué se avisa y que guardar un contrato que incumple siga permitido.
    """
    HOY = datetime.date(2026, 9, 23)

    def _horario(self, dias, entrada='09:00', salida='18:00', colacion=60):
        return {d: {'activo': True, 'entrada': entrada, 'salida': salida, 'colacion': colacion} for d in dias}

    def _codigos(self, *args, **kwargs):
        from core.jornada import avisos_jornada
        return [a['codigo'] for a in avisos_jornada(*args, fecha=kwargs.pop('fecha', self.HOY), **kwargs)]

    SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

    def test_calendario_en_los_dias_de_cambio(self):
        from core.jornada import jornada_maxima_vigente as m
        self.assertEqual(m(datetime.date(2024, 4, 25)), 45)
        self.assertEqual(m(datetime.date(2024, 4, 26)), 44)
        self.assertEqual(m(datetime.date(2026, 4, 25)), 44)
        self.assertEqual(m(datetime.date(2026, 4, 26)), 42)
        self.assertEqual(m(datetime.date(2028, 4, 26)), 40)

    def test_44_horas_excede_el_maximo_de_42(self):
        self.assertIn('EXCEDE_MAXIMO', self._codigos('ORDINARIA', 44, {}))

    def test_42_horas_cumple(self):
        # 5 días × 8,4 h = 42 h exactas.
        horario = self._horario(self.SEMANA, '09:00', '18:24', 60)
        self.assertEqual(self._codigos('ORDINARIA', 42, horario), [])

    def test_horario_que_suma_mas_que_lo_pactado(self):
        # El caso real: se pactan 20 h pero el horario suma 40.
        horario = self._horario(self.SEMANA)  # 8 h × 5
        self.assertIn('HORARIO_SUPERA_PACTADO', self._codigos('ORDINARIA', 20, horario))

    def test_articulo_22_con_horario_fijo(self):
        horario = self._horario(self.SEMANA)
        self.assertIn('ART22_CON_HORARIO', self._codigos('ART_22', 42, horario))

    def test_articulo_22_con_20_horas_pactadas(self):
        # El caso real: se registran 20 h "para pagar menos" en un Art. 22.
        self.assertEqual(self._codigos('ART_22', 20, {}), ['ART22_CON_HORAS'])

    def test_articulo_22_sin_horario_ni_horas_bajo_el_maximo_no_avisa(self):
        self.assertEqual(self._codigos('ART_22', 42, {}), [])
        # Las horas no rigen en un Art. 22: 44 no es "exceso".
        self.assertEqual(self._codigos('ART_22', 44, {}), [])

    def test_dia_de_mas_de_10_horas(self):
        horario = self._horario(['lunes'], '08:00', '20:00', 60)  # 11 h netas
        self.assertIn('DIA_SUPERA_10H', self._codigos('ORDINARIA', 42, horario))

    def test_turnos_no_aplica_el_tope_diario(self):
        horario = self._horario(['lunes'], '08:00', '20:00', 60)
        self.assertNotIn('DIA_SUPERA_10H', self._codigos('TURNOS', 42, horario))

    def test_jornada_parcial_sobre_dos_tercios(self):
        # Con máximo 42 h, parcial es hasta 28 h.
        self.assertIn('PARCIAL_SOBRE_TOPE', self._codigos('PARCIAL', 30, {}))
        self.assertNotIn('PARCIAL_SOBRE_TOPE', self._codigos('PARCIAL', 28, {}))

    def test_aviso_de_la_proxima_reduccion_solo_cerca_de_la_fecha(self):
        # 42 h cumple hoy; la baja a 40 h es el 26-04-2028.
        lejos = self._codigos('ORDINARIA', 42, {}, fecha=datetime.date(2026, 9, 23))
        cerca = self._codigos('ORDINARIA', 42, {}, fecha=datetime.date(2028, 1, 10))
        self.assertNotIn('PROXIMA_REDUCCION', lejos)
        self.assertIn('PROXIMA_REDUCCION', cerca)

    def test_colacion_no_cuenta_como_jornada(self):
        from core.jornada import horas_por_dia
        self.assertEqual(horas_por_dia(self._horario(['lunes']))['lunes'], 8)


class AvisosJornadaApiTests(APITestCase):
    """Los avisos llegan en la API y guardar un contrato que incumple sigue permitido."""

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Cliente, Empresa, Empleado, Plan
        self.user = User.objects.create_user(username='12.345.678-5', password='x')
        plan = Plan.objects.create(nombre='Pyme', precio=0, max_empresas=3, limite_trabajadores=75, nivel=3)
        Cliente.objects.create(usuario=self.user, rut='12.345.678-5', nombres='A', plan=plan)
        empresa = Empresa.objects.create(owner=self.user, nombre_legal='E', rut='76.123.456-0')
        self.empleado = Empleado.objects.create(
            empresa=empresa, rut='9.876.543-3', nombres='T', apellido_paterno='P', cargo='C',
            fecha_ingreso='2026-01-01')
        self.client.force_authenticate(self.user)

    def test_contrato_de_44_se_guarda_y_trae_el_aviso(self):
        resp = self.client.post('/api/contratos/', {
            'empleado': self.empleado.id, 'tipo_contrato': 'INDEFINIDO', 'cargo': 'Soldador',
            'fecha_inicio': '2026-09-01', 'sueldo_base': 800000,
            'tipo_jornada': 'ORDINARIA', 'horas_semanales': '44.0',
        }, format='json')
        self.assertEqual(resp.status_code, 201)  # avisa, no bloquea
        self.assertEqual(resp.data['jornada_maxima_vigente'], 42)
        self.assertIn('EXCEDE_MAXIMO', [a['codigo'] for a in resp.data['avisos_jornada']])

    def test_contrato_nuevo_toma_el_maximo_vigente_por_defecto(self):
        from core.models import Contrato
        c = Contrato.objects.create(empleado=self.empleado, fecha_inicio='2026-09-01', sueldo_base=1)
        self.assertEqual(float(c.horas_semanales), 42.0)

    def test_evaluar_borrador_sin_guardar(self):
        resp = self.client.post('/api/contratos/evaluar-jornada/', {
            'tipo_jornada': 'ART_22', 'horas_semanales': 20,
            'distribucion_horario': {'lunes': {'activo': True, 'entrada': '09:00', 'salida': '18:00', 'colacion': 60}},
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual([a['codigo'] for a in resp.data['avisos']], ['ART22_CON_HORARIO', 'ART22_CON_HORAS'])

    def test_anexo_40h_propone_el_maximo_vigente(self):
        from core.models import Contrato
        c = Contrato.objects.create(empleado=self.empleado, fecha_inicio='2026-09-01', sueldo_base=1,
                                    horas_semanales=44)
        self.assertEqual(c.horas_propuestas_anexo_40h, '42')
        c.horas_semanales = 40
        self.assertEqual(c.horas_propuestas_anexo_40h, '40')


class RegistroValidadoEnServidorTests(APITestCase):
    """El servidor valida el registro igual que el formulario.

    Nada impide llamar a la API directo: RUT, correo y contraseña se validan
    aquí, y la cuenta queda con el RUT de la persona titular.
    """

    def setUp(self):
        cache.clear()

    def _registrar(self, **cambios):
        datos = {'rut': '12.345.678-5', 'password': 'Clave-Segura-2026', 'email': 'ana@correo.cl',
                 'nombres': 'Ana', 'apellido_paterno': 'Pérez', **cambios}
        return self.client.post('/api/auth/register/', datos, format='json')

    def test_digito_verificador_incorrecto(self):
        resp = self._registrar(rut='12.345.678-9')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('dígito verificador', resp.data['error'])

    def test_rut_sin_formato_se_guarda_formateado(self):
        from django.contrib.auth.models import User
        self.assertEqual(self._registrar(rut='123456785').status_code, 201)
        self.assertTrue(User.objects.filter(username='12.345.678-5').exists())

    def test_rut_de_empresa_no_puede_ser_titular(self):
        resp = self._registrar(rut='76.123.456-0')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('RUT personal', resp.data['error'])

    def test_contrasena_debil_se_rechaza(self):
        self.assertEqual(self._registrar(password='12345678').status_code, 400)

    def test_correo_invalido_se_rechaza(self):
        self.assertEqual(self._registrar(email='no-es-correo').status_code, 400)

    def test_la_suscripcion_nace_con_la_cuenta(self):
        from core.models import Suscripcion
        self._registrar()
        s = Suscripcion.objects.get(cliente__rut='12.345.678-5')
        self.assertEqual((s.plan.nombre, s.estado), ('Semilla', 'ACTIVE'))


class WebhookSinSuscripcionTests(APITestCase):
    """Un pago válido no se pierde si la cuenta no tenía suscripción."""

    def test_crea_la_suscripcion_y_activa_el_plan(self):
        from django.contrib.auth.models import User
        from core.models import Cliente, Plan, Suscripcion
        u = User.objects.create_user(username='12.345.678-5', password='x')
        semilla = Plan.objects.create(nombre='Semilla', precio=0, max_empresas=1, limite_trabajadores=3, nivel=1)
        pyme = Plan.objects.create(nombre='Pyme', precio=39990, max_empresas=3, limite_trabajadores=75, nivel=3)
        cliente = Cliente.objects.create(usuario=u, rut='12.345.678-5', nombres='A', plan=semilla)
        with patch('core.views.config', side_effect=_mock_config('secret-real')):
            resp = self.client.post('/api/pagos/webhook/reveniu/', {
                'event': 'payment_succeeded', 'custom_reference': f'{cliente.id}_{pyme.id}',
                'subscription_id': 'sub_1',
            }, format='json', HTTP_X_WEBHOOK_TOKEN='secret-real')
        self.assertEqual(resp.status_code, 200)
        s = Suscripcion.objects.get(cliente=cliente)
        self.assertEqual((s.plan, s.estado), (pyme, 'ACTIVE'))
        cliente.refresh_from_db()
        self.assertEqual(cliente.plan, pyme)


class RecuperacionSoloPorRutTests(APITestCase):
    """La recuperación es solo por RUT y no revela qué RUT tienen cuenta."""

    def setUp(self):
        cache.clear()
        from django.contrib.auth.models import User
        from core.models import Cliente
        u = User.objects.create_user(username='12.345.678-5', password='x', email='ana@correo.cl')
        Cliente.objects.create(usuario=u, rut='12.345.678-5', nombres='Ana', correo='ana@correo.cl')
        # Otra cuenta con el mismo correo: no debe recibir enlace.
        u2 = User.objects.create_user(username='9.876.543-3', password='x', email='ana@correo.cl')
        Cliente.objects.create(usuario=u2, rut='9.876.543-3', nombres='Otra', correo='ana@correo.cl')

    def _pedir(self, rut):
        return self.client.post('/api/auth/recuperar-por-rut/', {'rut': rut}, format='json')

    def test_misma_respuesta_exista_o_no_el_rut(self):
        existe, no_existe = self._pedir('12.345.678-5'), self._pedir('11.111.111-1')
        self.assertEqual((existe.status_code, existe.data), (no_existe.status_code, no_existe.data))
        self.assertNotIn('correo_oculto', existe.data)

    def test_envia_un_solo_enlace_aunque_el_correo_se_repita(self):
        from django.core import mail
        self._pedir('123456785')  # sin formato: se normaliza
        self.assertEqual(len(mail.outbox), 1)

    def test_rut_invalido(self):
        self.assertEqual(self._pedir('12.345.678-9').status_code, 400)

    def test_ruta_por_correo_cerrada(self):
        resp = self.client.post('/api/auth/password/reset/', {'email': 'ana@correo.cl'}, format='json')
        self.assertEqual(resp.status_code, 410)

    def test_enlace_vence_en_24_horas(self):
        from django.conf import settings
        self.assertEqual(settings.PASSWORD_RESET_TIMEOUT, 86400)


class LoginRutNormalizadoTests(APITestCase):
    def setUp(self):
        cache.clear()
        from django.contrib.auth.models import User
        User.objects.create_user(username='12.345.678-5', password='Clave-Segura-2026')

    def test_entra_con_rut_sin_formato(self):
        resp = self.client.post('/api/auth/login/', {'username': '123456785', 'password': 'Clave-Segura-2026'},
                                format='json')
        self.assertEqual(resp.status_code, 200)

    def test_limite_por_cuenta_no_se_salta_cambiando_el_formato(self):
        from core.views import LoginAccountRateThrottle
        claves = {LoginAccountRateThrottle().get_cache_key(
            type('R', (), {'data': {'username': u}})(), None)
            for u in ['123456785', '12.345.678-5', '12345678-5']}
        self.assertEqual(len(claves), 1)


class HorasExtraEnServidorTests(APITestCase):
    """El valor de las horas extra lo calcula el backend con los datos del contrato."""

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Cliente, Empresa, Empleado, Plan, Contrato
        u = User.objects.create_user(username='12.345.678-5', password='x')
        plan = Plan.objects.create(nombre='Pyme', precio=0, max_empresas=3, limite_trabajadores=75, nivel=3)
        Cliente.objects.create(usuario=u, rut='12.345.678-5', nombres='A', plan=plan)
        empresa = Empresa.objects.create(owner=u, nombre_legal='E', rut='76.123.456-0')
        # Ficha con 44 h (dato viejo) y contrato con 42 h: manda el contrato.
        self.empleado = Empleado.objects.create(empresa=empresa, rut='9.876.543-3', nombres='T',
            apellido_paterno='P', cargo='C', fecha_ingreso='2026-01-01', horas_laborales=44)
        self.contrato = Contrato.objects.create(empleado=self.empleado, fecha_inicio='2026-01-01',
            sueldo_base=840000, horas_semanales=42)

    def _calcular(self, items):
        from core.views import _calcular_liquidacion, _terminos_vigentes
        terminos = {**_terminos_vigentes(self.contrato), 'valor_uf': 40000.0}
        return _calcular_liquidacion(self.contrato, self.empleado,
                                     {'mes': 9, 'anio': 2026, 'dias_trabajados': 30, 'detalle_items': items},
                                     terminos=terminos)

    def test_valor_con_las_horas_del_contrato(self):
        # 840.000 / 30 × 7 / 42 = 4.666,67 la hora; con 50 % = 7.000; × 10 h = 70.000.
        r = self._calcular([{'naturaleza': 'HORA_EXTRA', 'glosa': 'Horas extra', 'horas': 10,
                             'recargo': 50, 'valor': 1}])
        extra = [i for i in r['detalle_items'] if i['naturaleza'] == 'HORA_EXTRA'][0]
        self.assertEqual(extra['valor'], 70000)  # el "1" del navegador se ignora
        self.assertEqual(float(r['horas_semanales_contrato']), 42.0)

    def test_sin_recargo_usa_el_minimo_legal(self):
        r = self._calcular([{'naturaleza': 'HORA_EXTRA', 'glosa': 'HE', 'horas': 10, 'valor': 0}])
        extra = [i for i in r['detalle_items'] if i['naturaleza'] == 'HORA_EXTRA'][0]
        self.assertEqual((extra['recargo'], extra['valor']), (50.0, 70000))

    def test_item_sin_horas_conserva_su_valor(self):
        r = self._calcular([{'naturaleza': 'HORA_EXTRA', 'glosa': 'HE antigua', 'valor': 12345}])
        extra = [i for i in r['detalle_items'] if i['naturaleza'] == 'HORA_EXTRA'][0]
        self.assertEqual(extra['valor'], 12345)

    def test_la_ficha_refleja_las_horas_del_contrato(self):
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.horas_laborales, 42)
        self.contrato.horas_semanales = 40
        self.contrato.save()
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.horas_laborales, 40)


class DiagnosticoRedTests(APITestCase):
    """El diagnóstico de red está apagado salvo que se encienda a propósito."""

    def test_apagado_por_defecto(self):
        with patch('core.views.config', side_effect=_mock_config(None)):
            self.assertEqual(self.client.get('/api/diagnostico/red/').status_code, 404)

    def test_encendido_muestra_los_encabezados_del_solicitante(self):
        with patch('core.views.config', side_effect=lambda k, default=None, **kw: '1' if k == 'DIAGNOSTICO_RED' else default):
            resp = self.client.get('/api/diagnostico/red/', HTTP_X_FORWARDED_FOR='1.2.3.4, 5.6.7.8')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['x_forwarded_for'], '1.2.3.4, 5.6.7.8')


class PreviredSeptiembre2026Tests(APITestCase):
    """Parámetros verificados contra el PDF de Previred de septiembre 2026."""

    def test_valores_de_septiembre(self):
        from core.views import _parametros_previsionales, _tasas_afp
        p = _parametros_previsionales(9, 2026)
        self.assertEqual((p['tope_imponible_afp_uf'], p['tope_imponible_afc_uf']), (90.0, 135.2))
        self.assertEqual(p['ingreso_minimo_mensual'], 553553)
        self.assertEqual(p['tasa_sis'], 0.0178)
        self.assertEqual(p['tasa_expectativa_vida'], 0.0072)
        self.assertEqual(p['tasa_rentabilidad_protegida'], 0.009)
        self.assertEqual(p['tasa_afp_empleador'], 0.001)
        self.assertEqual(p['tasa_afc_empleador_11_anios'], 0.008)
        tasas = _tasas_afp(9, 2026)
        self.assertEqual(tasas, {**tasas, 'CAPITAL': 0.1144, 'CUPRUM': 0.1144, 'HABITAT': 0.1127,
                                 'PLANVITAL': 0.1116, 'PROVIDA': 0.1145, 'MODELO': 0.1058, 'UNO': 0.1046})

    def test_antes_de_la_reforma_no_hay_aportes_de_la_reforma(self):
        from core.views import _parametros_previsionales
        p = _parametros_previsionales(3, 2025)
        self.assertEqual((p['tasa_rentabilidad_protegida'], p['tasa_afp_empleador']), (0.0, 0.0))


class AfcOnceAniosTests(APITestCase):
    """Desde el año 11 de un contrato indefinido el trabajador no cotiza cesantía."""

    def _liquidar(self, fecha_ingreso, tipo='INDEFINIDO'):
        from core.views import _calcular_liquidacion

        class C:
            sueldo_base = 1_000_000; tipo_contrato = tipo; gratificacion_legal = 'MENSUAL'
            tiene_quincena = False; monto_quincena = 0; comisiones_config = []; horas_semanales = 42
            fecha_inicio = None

        class E:
            afp = 'MODELO'; sistema_salud = 'FONASA'; plan_isapre_uf = 0

        e = E(); e.fecha_ingreso = fecha_ingreso
        return _calcular_liquidacion(C(), e, {'mes': 9, 'anio': 2026, 'dias_trabajados': 30})

    def test_diez_anios_cotiza(self):
        self.assertGreater(self._liquidar(datetime.date(2016, 1, 1))['seguro_cesantia'], 0)

    def test_once_anios_no_cotiza(self):
        self.assertEqual(self._liquidar(datetime.date(2015, 1, 1))['seguro_cesantia'], 0)

    def test_borde_del_aniversario(self):
        from core.views import _anios_de_servicio

        class E: pass
        e = E()
        e.fecha_ingreso = datetime.date(2015, 9, 30)
        self.assertEqual(_anios_de_servicio(e, None, 9, 2026), 11)   # cumple el 30-09-2026
        e.fecha_ingreso = datetime.date(2015, 10, 1)
        self.assertEqual(_anios_de_servicio(e, None, 9, 2026), 10)

    def test_tasa_del_empleador(self):
        from core.views import _parametros_previsionales, _tasas_afc
        p = _parametros_previsionales(9, 2026)
        self.assertEqual(_tasas_afc(p, 'INDEFINIDO', 11), (0.0, 0.008))
        self.assertEqual(_tasas_afc(p, 'INDEFINIDO', 3), (0.006, 0.024))
        self.assertEqual(_tasas_afc(p, 'PLAZO_FIJO', 20), (0.0, 0.03))


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


class PermisosPorPlanTests(APITestCase):
    """Cartas de término desde Starter; consolidado multiempresa desde Pyme."""

    def _usuario(self, nivel):
        from django.contrib.auth.models import User
        from core.models import Cliente, Empresa, Empleado, Plan, Suscripcion
        plan = Plan.objects.create(nombre=f'P{nivel}', precio=0, max_empresas=10, limite_trabajadores=250, nivel=nivel)
        u = User.objects.create_user(username=f'{nivel}1.111.111-1', password='x')
        c = Cliente.objects.create(usuario=u, rut=f'{nivel}1.111.111-1', nombres='A', plan=plan)
        Suscripcion.objects.create(cliente=c, plan=plan, estado='ACTIVE')
        e = Empresa.objects.create(owner=u, nombre_legal='E', rut=f'7{nivel}.000.001-1')
        emp = Empleado.objects.create(empresa=e, rut=f'{nivel}.333.333-3', nombres='V', apellido_paterno='V',
                                      cargo='C', fecha_ingreso='2025-01-01')
        self.client.force_authenticate(u)
        return emp

    def _carta(self, emp):
        return self.client.post('/api/documentos_legales/', {'empleado': emp.id, 'tipo': 'DESPIDO',
                                'fecha_emision': '2026-09-01', 'hechos': 'x'}, format='json')

    def test_semilla_no_emite_cartas_de_termino(self):
        self.assertEqual(self._carta(self._usuario(1)).status_code, 403)

    def test_starter_emite_cartas_de_termino(self):
        self.assertEqual(self._carta(self._usuario(2)).status_code, 201)

    def test_semilla_si_emite_amonestaciones(self):
        emp = self._usuario(1)
        r = self.client.post('/api/documentos_legales/', {'empleado': emp.id, 'tipo': 'AMONESTACION',
                             'fecha_emision': '2026-09-01', 'hechos': 'x'}, format='json')
        self.assertEqual(r.status_code, 201)

    def test_consolidado_desde_pyme(self):
        self._usuario(2)
        self.assertEqual(self.client.get('/api/liquidaciones/consolidado/?anio=2026').status_code, 403)
        self._usuario(3)
        self.assertNotEqual(self.client.get('/api/liquidaciones/consolidado/?anio=2026').status_code, 403)


class PanelApiTests(APITestCase):
    """Endpoints que usa el panel nuevo."""

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Empresa, Empleado
        self.u = User.objects.create_user(username='1-9', password='x')
        e1 = Empresa.objects.create(owner=self.u, nombre_legal='E1', rut='76.000.001-K')
        self.e2 = Empresa.objects.create(owner=self.u, nombre_legal='E2', rut='76.000.002-8')
        Empleado.objects.create(empresa=e1, rut='3-5', nombres='A', apellido_paterno='A', cargo='C', fecha_ingreso='2025-01-01')
        Empleado.objects.create(empresa=self.e2, rut='4-3', nombres='B', apellido_paterno='B', cargo='C', fecha_ingreso='2025-01-01')
        self.client.force_authenticate(self.u)

    def test_filtro_por_empresa(self):
        r = self.client.get(f'/api/empleados/?empresa={self.e2.id}')
        datos = r.data['results'] if isinstance(r.data, dict) else r.data
        self.assertEqual([e['nombres'] for e in datos], ['B'])
        r = self.client.get('/api/empleados/')
        datos = r.data['results'] if isinstance(r.data, dict) else r.data
        self.assertEqual(len(datos), 2)

    def test_indicadores(self):
        r = self.client.get('/api/indicadores/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('uf', r.data)
        self.assertEqual(r.data['jornada_maxima_vigente'], 42)
