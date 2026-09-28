"""Portal del trabajador: ingreso, aislamiento entre empleadores, plan, ventana de acceso y clave."""
import datetime
import re

from django.core import mail
from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import Contrato, CuentaTrabajador, Empleado, Liquidacion, SolicitudFirma
from ..views.portal_trabajador import COOKIE
from .utiles import crear_empleado, crear_usuario_completo

RUT = '12.345.678-5'


class PortalBase(APITestCase):
    def setUp(self):
        self.jefe, _, _, self.empresa = crear_usuario_completo('portal_a', '21.000.000-3', '76.000.555-2')
        self.ficha = crear_empleado(self.empresa, RUT, nombres='Ana', apellido='Rojas')
        Empleado.objects.filter(pk=self.ficha.pk).update(email='ana@correo.cl')
        Contrato.objects.create(empleado=self.ficha, tipo_contrato='INDEFINIDO', cargo='Analista',
                                fecha_inicio='2024-01-01', sueldo_base=800_000)

    def _codigo(self):
        return re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)

    def _entrar(self, rut=RUT):
        r = self.client.post('/api/trabajador/ingreso/', {'rut': rut}, format='json')
        self.assertEqual(r.data['metodo'], 'codigo', r.data)
        r = self.client.post('/api/trabajador/codigo/verificar/', {'rut': rut, 'codigo': self._codigo()}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return r.data


class IngresoTests(PortalBase):
    def test_ingreso_con_codigo_y_datos_de_la_cuenta(self):
        datos = self._entrar()
        self.assertEqual(mail.outbox[0].to, ['ana@correo.cl'])
        self.assertEqual([e['empresa'] for e in datos['empleos']], ['Empresa Test Sa'])
        self.assertTrue(datos['mostrar_invitacion_clave'])
        self.assertEqual(self.client.get('/api/trabajador/yo/').data['nombre'], 'Ana Rojas')

    def test_rut_sin_fichas_responde_igual_y_no_envia_nada(self):
        r = self.client.post('/api/trabajador/ingreso/', {'rut': '9.876.543-3'}, format='json')
        self.assertEqual((r.data['metodo'], r.data['destinos']), ('codigo', []))
        self.assertEqual(len(mail.outbox), 0)

    def test_codigo_incorrecto_y_limite_de_intentos(self):
        self.client.post('/api/trabajador/ingreso/', {'rut': RUT}, format='json')
        for _ in range(3):
            r = self.client.post('/api/trabajador/codigo/verificar/', {'rut': RUT, 'codigo': '000000'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/trabajador/codigo/verificar/', {'rut': RUT, 'codigo': self._codigo()}, format='json')
        self.assertIn('intentos', r.data['error'])

    def test_solo_json(self):
        r = self.client.post('/api/trabajador/ingreso/', {'rut': RUT})     # formulario
        self.assertEqual(r.status_code, 415)

    def test_sesiones_de_empleador_y_trabajador_no_se_mezclan(self):
        self.client.force_authenticate(self.jefe)
        self.assertEqual(self.client.get('/api/trabajador/yo/').status_code, 403)
        self.client.force_authenticate(None)
        self._entrar()
        self.assertEqual(self.client.get('/api/empleados/').status_code, 401)


class AislamientoTests(PortalBase):
    def setUp(self):
        super().setUp()
        # Otro empleador registra una ficha con el mismo RUT y un correo distinto.
        _, _, _, self.otra = crear_usuario_completo('portal_b', '11.111.111-1', '77.777.777-7')
        self.ajena = crear_empleado(self.otra, RUT, nombres='Ana', apellido='Rojas')
        Empleado.objects.filter(pk=self.ajena.pk).update(email='otro@correo.cl')
        Liquidacion.objects.create(empleado=self.ajena, mes=1, anio=2026, total_haberes=900_000, sueldo_liquido=700_000)

    def _codigo_de(self, correo):
        mensaje = [m for m in mail.outbox if m.to == [correo]][-1]
        return re.search(r'\b(\d{6})\b', mensaje.body).group(1)

    def test_cada_correo_recibe_su_propio_codigo(self):
        self.client.post('/api/trabajador/ingreso/', {'rut': RUT}, format='json')
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['ana@correo.cl', 'otro@correo.cl'])
        self.assertTrue(all(len(m.to) == 1 for m in mail.outbox))       # nadie ve los otros correos
        self.assertNotEqual(self._codigo_de('ana@correo.cl'), self._codigo_de('otro@correo.cl'))

    def test_la_ficha_de_otro_empleador_no_se_ve_con_el_codigo_propio(self):
        self.client.post('/api/trabajador/ingreso/', {'rut': RUT}, format='json')
        # Quien controla otro@ (p. ej. un empleador que registró el RUT ajeno) solo ve esa ficha.
        r = self.client.post('/api/trabajador/codigo/verificar/',
                             {'rut': RUT, 'codigo': self._codigo_de('otro@correo.cl')}, format='json')
        self.assertEqual([e['id'] for e in r.data['empleos']], [self.ajena.id])
        self.assertEqual([p['id'] for p in r.data['por_vincular']], [self.ficha.id])
        self.assertEqual(self.client.get('/api/trabajador/descargar/', {'tipo': 'contrato',
                         'id': Contrato.objects.get(empleado=self.ficha).id}).status_code, 404)

    def test_vincular_otro_empleo_verificando_su_correo(self):
        from ..models import CodigoTrabajador
        self.client.post('/api/trabajador/ingreso/', {'rut': RUT}, format='json')
        r = self.client.post('/api/trabajador/codigo/verificar/',
                             {'rut': RUT, 'codigo': self._codigo_de('ana@correo.cl')}, format='json')
        self.assertEqual([e['id'] for e in r.data['empleos']], [self.ficha.id])
        r = self.client.get('/api/trabajador/descargar/', {'tipo': 'liquidacion',
                                                             'id': Liquidacion.objects.get(empleado=self.ajena).id})
        self.assertEqual(r.status_code, 404)
        CodigoTrabajador.objects.update(creado_en=timezone.now() - datetime.timedelta(minutes=2))
        r = self.client.post('/api/trabajador/empleos/vincular/', {'ficha': self.ajena.id}, format='json')
        self.assertEqual((r.status_code, mail.outbox[-1].to), (200, ['otro@correo.cl']))
        r = self.client.post('/api/trabajador/empleos/confirmar/', {'codigo': self._codigo_de('otro@correo.cl')},
                             format='json')
        self.assertEqual(len(r.data['empleos']), 2)


class ReglasDeAccesoTests(PortalBase):
    def test_empresa_bajo_plan_pyme_no_habilita_el_portal(self):
        from ..models import Plan
        Plan.objects.update(nivel=2)
        r = self.client.post('/api/trabajador/ingreso/', {'rut': RUT}, format='json')
        self.assertEqual((r.data['destinos'], len(mail.outbox)), ([], 0))

    def test_desvinculado_tres_meses_desde_desvinculacion_o_finiquito_firmado(self):
        hoy = timezone.localdate()
        Empleado.objects.filter(pk=self.ficha.pk).update(activo=False, fecha_desvinculacion=hoy - datetime.timedelta(days=60))
        self.assertEqual(self.client.post('/api/trabajador/ingreso/', {'rut': RUT}, format='json').data['destinos'],
                         ['an***@correo.cl'])
        Empleado.objects.filter(pk=self.ficha.pk).update(fecha_desvinculacion=hoy - datetime.timedelta(days=100))
        self.assertEqual(self.client.post('/api/trabajador/codigo/', {'rut': RUT}, format='json').data['destinos'], [])
        # Con finiquito firmado en Jornada40, cuenta desde la firma.
        SolicitudFirma.objects.create(empleado=self.ficha, empresa=self.empresa, tipo_documento='FINIQUITO',
                                      estado='FIRMADO', firmado_en=timezone.now() - datetime.timedelta(days=20))
        from ..models import CodigoTrabajador
        CodigoTrabajador.objects.update(creado_en=timezone.now() - datetime.timedelta(minutes=2))
        self.assertEqual(self.client.post('/api/trabajador/codigo/', {'rut': RUT}, format='json').data['destinos'],
                         ['an***@correo.cl'])


class ClaveTests(PortalBase):
    def test_crear_clave_cambia_el_ingreso_y_cierra_otras_sesiones(self):
        self._entrar()
        vieja = self.client.cookies[COOKIE].value
        r = self.client.post('/api/trabajador/clave/', {'clave_nueva': '12345678'}, format='json')
        self.assertEqual(r.status_code, 400)                      # solo números
        r = self.client.post('/api/trabajador/clave/', {'clave_nueva': 'MiClave-2026'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(self.client.get('/api/trabajador/yo/').data['mostrar_invitacion_clave'])
        # Una sesión anterior al cambio queda cerrada.
        self.client.cookies[COOKIE] = vieja
        self.assertEqual(self.client.get('/api/trabajador/yo/').status_code, 403)
        # Ahora el ingreso pide la clave.
        self.assertEqual(self.client.post('/api/trabajador/ingreso/', {'rut': RUT}, format='json').data['metodo'], 'clave')
        r = self.client.post('/api/trabajador/clave/ingresar/', {'rut': RUT, 'clave': 'otra'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/trabajador/clave/ingresar/', {'rut': RUT, 'clave': 'MiClave-2026'}, format='json')
        self.assertEqual((r.status_code, r.data['ingreso_con']), (200, 'clave'))
        # Quien entró con clave debe dar la actual para cambiarla.
        r = self.client.post('/api/trabajador/clave/', {'clave_nueva': 'OtraClave-2026'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/trabajador/clave/', {'clave_actual': 'MiClave-2026', 'clave_nueva': 'OtraClave-2026'},
                             format='json')
        self.assertEqual(r.status_code, 200)

    def test_omitir_la_invitacion_no_la_vuelve_a_mostrar(self):
        self._entrar()
        self.client.post('/api/trabajador/invitacion/omitir/', {}, format='json')
        self.assertFalse(self.client.get('/api/trabajador/yo/').data['mostrar_invitacion_clave'])


class DocumentosTests(PortalBase):
    def test_liquidaciones_visibles_y_descarga(self):
        hoy = timezone.localdate()
        actual = Liquidacion.objects.create(empleado=self.ficha, mes=hoy.month, anio=hoy.year, total_haberes=1, sueldo_liquido=1)
        pasada = Liquidacion.objects.create(empleado=self.ficha, mes=1, anio=2026, total_haberes=900_000, sueldo_liquido=700_000)
        self._entrar()
        ids = [l['id'] for l in self.client.get('/api/trabajador/liquidaciones/').data]
        self.assertEqual(ids, [pasada.id])                      # la del mes en curso puede estar en edición
        r = self.client.get('/api/trabajador/descargar/', {'tipo': 'liquidacion', 'id': pasada.id})
        self.assertEqual((r.status_code, r['Content-Type']), (200, 'application/pdf'))
        r = self.client.get('/api/trabajador/descargar/', {'tipo': 'liquidacion', 'id': actual.id})
        self.assertEqual(r.status_code, 404)
        docs = self.client.get('/api/trabajador/documentos/').data
        self.assertEqual([d['tipo'] for d in docs], ['contrato'])
