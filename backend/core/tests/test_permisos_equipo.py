"""Fase B: el cerco aplica módulos, niveles y empresas a los usuarios del equipo en todo el sistema."""
import re
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.test import RequestFactory
from django.urls import get_resolver
from rest_framework import exceptions
from rest_framework.parsers import JSONParser
from rest_framework.request import Request
from rest_framework.test import APIClient, APITestCase

from ..autenticacion import autorizar_equipo
from ..models import (Contrato, Empresa, Empleado, Liquidacion, RegistroBitacora, SolicitudFirma, UsuarioEquipo)
from ..permisos import CODIGOS_MODULOS
from .utiles import crear_empleado, crear_usuario_completo

CLAVE = 'Clave-Equipo-2026'
# Rutas que nunca abre un usuario del equipo, aunque tenga todos los módulos.
SOLO_TITULAR = ['/api/equipo/', '/api/encargados-karin/', '/api/bitacora/', '/api/bitacora/verificar/', '/api/clientes/perfil/',
                '/api/pagos/bajar-plan/', '/api/pagos/crear-checkout/',
                '/api/pagos/cancelar-cambio/', '/api/pagos/reanudar/']


def _rutas_panel():
    """Todas las rutas /api/ del panel, con 1 en lugar de cada parámetro."""
    rutas = set()

    def recorrer(patrones, prefijo=''):
        for pat in patrones:
            texto = prefijo + str(pat.pattern)
            if hasattr(pat, 'url_patterns'):
                recorrer(pat.url_patterns, texto)
                continue
            if '(?P<format>' in texto or 'format>' in texto:
                continue
            ruta = re.sub(r'\(\?P<[^>]+>[^)]+\)', '1', texto)
            ruta = re.sub(r'<[^>]+>', '1', ruta).replace('^', '').replace('$', '').replace('?', '')
            rutas.add('/' + ruta)
    recorrer(get_resolver().url_patterns)
    publicas = ('/api/trabajador/', '/api/inspeccion/', '/api/firma-publica/', '/api/certificados/verificar/',
                '/api/auth/', '/api/pagos/webhook/', '/api/diagnostico/')
    return sorted(r for r in rutas if r.startswith('/api/') and r != '/api/' and not r.startswith(publicas))


class PermisosEquipoTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user, self.cliente, self.plan, self.a = crear_usuario_completo('perm', '21.000.000-3', '76.000.555-K')
        self.plan.max_empresas = 3
        self.plan.save()
        self.b = Empresa.objects.create(owner=self.user, nombre_legal='Empresa B', rut='77.777.777-7')
        self.emp_a = crear_empleado(self.a, '12.345.678-5', nombres='Ana')
        self.emp_b = crear_empleado(self.b, '9.876.543-3', nombres='Beto')
        for emp in (self.emp_a, self.emp_b):
            Contrato.objects.create(empleado=emp, tipo_contrato='INDEFINIDO', fecha_inicio='2024-01-01',
                                    sueldo_base=600_000, horas_semanales=42)
            Liquidacion.objects.create(empleado=emp, mes=1, anio=2026, total_imponible=1, total_haberes=1,
                                       sueldo_liquido=1)

    def _equipo(self, permisos, empresas=None, rut='11.111.111-1'):
        u = User.objects.create_user(f'equipo:{self.user.pk}:{rut}', password=CLAVE)
        ue = UsuarioEquipo.objects.create(cuenta=self.user, usuario=u, rut=rut, nombres='Carla', apellidos='Díaz',
                                          correo='c@x.cl', permisos=permisos, estado='ACTIVO')
        ue.empresas.set(empresas or [self.a])
        c = APIClient()
        r = c.post('/api/auth/equipo/ingresar/', {'rut': rut, 'clave': CLAVE}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return c, ue

    def test_solo_sus_empresas(self):
        c, _ = self._equipo({'REMUNERACIONES': 'VER'})
        datos = c.get('/api/empleados/').data
        ids = [e['id'] for e in (datos['results'] if isinstance(datos, dict) else datos)]
        self.assertEqual(ids, [self.emp_a.id])
        self.assertEqual(c.get(f'/api/empleados/{self.emp_b.id}/').status_code, 404)
        empresas = c.get('/api/empresas/').data
        self.assertEqual([e['id'] for e in (empresas['results'] if isinstance(empresas, dict) else empresas)],
                         [self.a.id])
        liqs = c.get('/api/liquidaciones/').data
        liqs = liqs.get('results', liqs) if isinstance(liqs, dict) else liqs
        self.assertEqual({l['empleado'] for l in liqs}, {self.emp_a.id})

    @patch('core.views.calculo_liquidacion.obtener_uf', return_value=40000)
    @patch('core.views.calculo_liquidacion.obtener_utm', return_value=70000)
    @patch('core.views.parametros.obtener_uf', return_value=40000)
    @patch('core.views.parametros.obtener_utm', return_value=70000)
    def test_ver_no_modifica_y_gestionar_si(self, *_):
        c, ue = self._equipo({'REMUNERACIONES': 'VER'})
        datos = {'empleado': self.emp_a.id, 'mes': 2, 'anio': 2026, 'detalle_items': []}
        self.assertEqual(c.post('/api/liquidaciones/', datos, format='json').status_code, 403)
        self.assertNotEqual(c.post('/api/liquidaciones/simular/', datos, format='json').status_code, 403)
        self.assertEqual(c.patch(f'/api/empleados/{self.emp_a.id}/', {'cargo': 'X'}, format='json').status_code, 403)
        self.assertEqual(c.patch(f'/api/empresas/{self.a.id}/', {'giro': 'X'}, format='json').status_code, 403)
        self.assertEqual(c.get('/api/contratos/').status_code, 403)                 # otro módulo
        ue.permisos = {'REMUNERACIONES': 'GESTIONAR'}
        ue.save()
        with patch('core.views.calculo_liquidacion.obtener_uf', return_value=40000), \
                patch('core.views.calculo_liquidacion.obtener_utm', return_value=70000), \
                patch('core.views.parametros.obtener_uf', return_value=40000), \
                patch('core.views.parametros.obtener_utm', return_value=70000):
            self.assertEqual(c.post('/api/liquidaciones/', datos, format='json').status_code, 201)
            otra = {**datos, 'empleado': self.emp_b.id}
            self.assertEqual(c.post('/api/liquidaciones/', otra, format='json').status_code, 404)   # otra empresa
        registro = RegistroBitacora.objects.filter(accion='CREAR').last()
        self.assertEqual((registro.actor_tipo, registro.actor_nombre), ('EQUIPO', 'Carla Díaz (equipo)'))

    def test_firma_por_tipo_de_documento_y_a_nombre_de_quien_la_envia(self):
        c, _ = self._equipo({'REMUNERACIONES': 'GESTIONAR'})
        Empresa.objects.filter(pk=self.a.pk).update(firma_imagen='data:image/png;base64,AAAA')
        Empleado.objects.filter(pk=self.emp_a.pk).update(email='ana@x.cl')
        liq = Liquidacion.objects.get(empleado=self.emp_a)
        self.assertEqual(c.post('/api/firmas/solicitar/', {'empleado_id': self.emp_a.id, 'tipo_documento': 'CONTRATO'},
                                format='json').status_code, 403)              # contratos no es su módulo
        datos = {'empleado_id': self.emp_a.id, 'tipo_documento': 'LIQUIDACION', 'liquidacion_id': liq.id}
        self.assertEqual(c.post('/api/firmas/solicitar/', datos, format='json').status_code, 428)
        # Confirma con SU clave (no con la del titular).
        self.assertEqual(c.post('/api/firmas/confirmar_identidad/', {'clave': 'pass1234'}, format='json').status_code,
                         400)
        self.assertEqual(c.post('/api/firmas/confirmar_identidad/', {'clave': CLAVE}, format='json').status_code, 200)
        with patch('core.b2_client.subir_documento'):
            r = c.post('/api/firmas/solicitar/', datos, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(SolicitudFirma.objects.get().emisor.usuario_equipo.nombres, 'Carla')

    def test_su_clave_no_la_del_titular(self):
        c, ue = self._equipo({'TRABAJADORES': 'VER'})
        r = c.post('/api/auth/password/change/', {'old_password': CLAVE, 'new_password1': 'Nueva-Clave-2027',
                                                   'new_password2': 'Nueva-Clave-2027'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        ue.usuario.refresh_from_db()
        self.assertTrue(ue.usuario.check_password('Nueva-Clave-2027'))
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('pass1234'))

    def _cerco(self, ue, ruta, metodo):
        fabrica = RequestFactory()
        req = Request(fabrica.get(ruta) if metodo == 'GET' else
                      getattr(fabrica, metodo.lower())(ruta, data='{}', content_type='application/json'),
                      parsers=[JSONParser()])
        try:
            autorizar_equipo(req, ue)
            return True
        except exceptions.PermissionDenied:
            return False

    def test_ninguna_ruta_del_titular_queda_abierta(self):
        todo = UsuarioEquipo(cuenta=self.user, permisos={m: 'GESTIONAR' for m in CODIGOS_MODULOS})
        for ruta in SOLO_TITULAR:
            for metodo in ('GET', 'POST', 'PATCH'):
                self.assertFalse(self._cerco(todo, ruta, metodo), f'{metodo} {ruta}')
        for metodo in ('POST', 'PATCH', 'DELETE'):
            self.assertFalse(self._cerco(todo, f'/api/empresas/{self.a.id}/', metodo))
            self.assertFalse(self._cerco(todo, f'/api/empresas/{self.a.id}/configurar-firma/', metodo))

    def test_cada_ruta_abre_solo_con_su_modulo(self):
        """Con un solo módulo en "solo ver", ninguna ruta de otro módulo ni de escritura queda abierta."""
        rutas = _rutas_panel()
        self.assertGreater(len(rutas), 60)
        solo = UsuarioEquipo(cuenta=self.user, permisos={'SOLICITUDES': 'VER'})
        abiertas = {r for r in rutas if self._cerco(solo, r, 'GET')}
        # Rutas de identidad: actúan sobre la propia persona (su preferencia de resumen, su confirmación).
        identidad = ('/api/firmas/confirmar_identidad/', '/api/clientes/resumen/')
        permitidas = identidad + ('/api/solicitudes-documento/', '/api/empleados/', '/api/certificados/', '/api/empresas/',
                      '/api/clientes/mi_suscripcion/', '/api/indicadores/', '/api/parametros/vigentes/', '/api/planes/')
        self.assertEqual({r for r in abiertas if not r.startswith(permitidas)}, set())
        escritura = {r for r in rutas if self._cerco(solo, r, 'POST') and r not in identidad}
        self.assertEqual(escritura, set(), f'Rutas que un usuario "solo ver" puede modificar: {escritura}')

    def test_cada_modulo_abre_sus_rutas(self):
        muestras = {
            'CONTRATOS': '/api/contratos/', 'REMUNERACIONES': '/api/liquidaciones/', 'VACACIONES': '/api/vacaciones/',
            'TERMINO': '/api/finiquitos/', 'DIRECCION_TRABAJO': '/api/registro-dt/', 'SEGURIDAD': '/api/reglamentos/',
            'SOLICITUDES': '/api/solicitudes-documento/', 'DOCUMENTOS': '/api/documentos-laborales/',
            'REPORTES': '/api/liquidaciones/consolidado/', 'TRABAJADORES': '/api/empleados/',
        }
        for modulo, ruta in muestras.items():
            con = UsuarioEquipo(cuenta=self.user, permisos={modulo: 'VER'})
            self.assertTrue(self._cerco(con, ruta, 'GET'), modulo)
            self.assertFalse(self._cerco(con, ruta, 'POST'), modulo)
            gestiona = UsuarioEquipo(cuenta=self.user, permisos={modulo: 'GESTIONAR'})
            # Reportes solo descarga; en Documentos el módulo sale del tipo que se crea.
            self.assertTrue(self._cerco(gestiona, ruta, 'POST') or modulo in ('REPORTES', 'DOCUMENTOS'), modulo)
