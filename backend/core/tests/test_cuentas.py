"""Registro, login y recuperación por RUT, perfil, empresas y endpoints del panel."""
from django.contrib.auth.models import User
from django.core.cache import cache
from rest_framework.test import APITestCase
from ..models import Empresa, Plan

from .utiles import crear_usuario_completo, indicadores_fijos


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


class RutEmpresaTests(APITestCase):
    """El RUT de la empresa se valida en el servidor al crearla y no cambia después."""

    def setUp(self):
        self.user, _, plan, self.empresa = crear_usuario_completo('rut_owner', '21.000.000-3', '76.000.555-2')
        Plan.objects.filter(pk=plan.pk).update(max_empresas=5)
        self.user = User.objects.get(pk=self.user.pk)   # sin el plan en caché
        self.client.force_authenticate(self.user)

    def test_rut_con_digito_malo_no_crea_la_empresa(self, *_):
        r = self.client.post('/api/empresas/', {'nombre_legal': 'Otra SpA', 'rut': '76.123.456-1'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('dígito verificador', r.data['error'])
        self.assertFalse(Empresa.objects.filter(nombre_legal__iexact='Otra SpA').exists())

    def test_rut_valido_crea_la_empresa(self, *_):
        r = self.client.post('/api/empresas/', {'nombre_legal': 'Otra SpA', 'rut': '76.123.456-0'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)

    def test_representante_con_rut_malo_se_rechaza(self, *_):
        r = self.client.post('/api/empresas/', {'nombre_legal': 'Otra SpA', 'rut': '76.123.456-0',
                                                'rut_representante': '12.345.678-9'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_rut_no_cambia_despues_de_creada(self, *_):
        r = self.client.patch(f'/api/empresas/{self.empresa.id}/', {'rut': '76.123.456-0'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.empresa.refresh_from_db()
        self.assertEqual(self.empresa.rut, '76.000.555-2')
        # El resto de los datos sí se edita.
        r = self.client.patch(f'/api/empresas/{self.empresa.id}/', {'giro': 'Comercio'}, format='json')
        self.assertEqual(r.status_code, 200)


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


class MiCuentaYParametrosTests(APITestCase):
    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('cuenta_owner', '19.999.999-9', '76.999.999-9')
        self.user.set_password('Clave-Actual-2026'); self.user.save()
        self.client.force_authenticate(self.user)

    def test_perfil_patch_y_validaciones(self):
        r = self.client.patch('/api/clientes/perfil/', {'tipo_cliente': 'EMPRESA', 'razon_social': 'Mi Pyme SpA',
                                                        'telefono': '+56911112222', 'email': 'NUEVO@Example.com'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['email'], 'nuevo@example.com')
        self.assertEqual(r.data['rut'], '19.999.999-9')
        self.assertEqual(self.client.patch('/api/clientes/perfil/', {'email': 'malo'}, format='json').status_code, 400)
        self.assertEqual(self.client.patch('/api/clientes/perfil/', {'razon_social': ''}, format='json').status_code, 400)
        # El RUT no se cambia por esta vía
        self.client.patch('/api/clientes/perfil/', {'rut': '11.111.111-1'}, format='json')
        self.cliente.refresh_from_db(); self.assertEqual(self.cliente.rut, '19.999.999-9')

    def test_cambio_de_clave_exige_la_actual(self):
        r = self.client.post('/api/auth/password/change/', {'new_password1': 'Otra-Clave-2027', 'new_password2': 'Otra-Clave-2027'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/auth/password/change/', {'old_password': 'Clave-Actual-2026',
                                                             'new_password1': 'Otra-Clave-2027', 'new_password2': 'Otra-Clave-2027'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)

    @indicadores_fijos
    def test_parametros_vigentes_solo_lectura(self, *_):
        r = self.client.get('/api/parametros/vigentes/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('ingreso_minimo_mensual', r.data)
        self.assertIn('HABITAT', r.data['tasas_afp'])
        self.assertEqual(self.client.post('/api/parametros/vigentes/', {}).status_code, 405)
