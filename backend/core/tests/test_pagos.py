"""Planes, cupos, permisos por plan y webhook de Reveniu."""
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase
from ..models import Empleado, Plan

from .utiles import _mock_config, crear_empleado, crear_usuario_completo


class WebhookSeguridadTests(APITestCase):
    URL = '/api/pagos/webhook/reveniu/'

    def test_sin_secret_configurado_retorna_503(self):
        with patch('core.views.suscripciones.config', side_effect=_mock_config(None)):
            resp = self.client.post(self.URL, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)

    def test_token_incorrecto_retorna_401(self):
        with patch('core.views.suscripciones.config', side_effect=_mock_config('secret-real')):
            resp = self.client.post(
                self.URL, {}, format='json',
                HTTP_X_WEBHOOK_TOKEN='token-incorrecto'
            )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_correcto_pasa_la_autenticacion(self):
        with patch('core.views.suscripciones.config', side_effect=_mock_config('secret-real')):
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
        with patch('core.views.suscripciones.config', side_effect=_mock_config('secret-real')):
            resp = self.client.post(self.URL, {}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class WebhookSinSuscripcionTests(APITestCase):
    """Un pago válido no se pierde si la cuenta no tenía suscripción."""

    def test_crea_la_suscripcion_y_activa_el_plan(self):
        from django.contrib.auth.models import User
        from core.models import Cliente, Plan, Suscripcion
        u = User.objects.create_user(username='12.345.678-5', password='x')
        semilla = Plan.objects.create(nombre='Semilla', precio=0, max_empresas=1, limite_trabajadores=3, nivel=1)
        pyme = Plan.objects.create(nombre='Pyme', precio=39990, max_empresas=3, limite_trabajadores=75, nivel=3)
        cliente = Cliente.objects.create(usuario=u, rut='12.345.678-5', nombres='A', plan=semilla)
        with patch('core.views.suscripciones.config', side_effect=_mock_config('secret-real')):
            resp = self.client.post('/api/pagos/webhook/reveniu/', {
                'event': 'payment_succeeded', 'custom_reference': f'{cliente.id}_{pyme.id}',
                'subscription_id': 'sub_1',
            }, format='json', HTTP_X_WEBHOOK_TOKEN='secret-real')
        self.assertEqual(resp.status_code, 200)
        s = Suscripcion.objects.get(cliente=cliente)
        self.assertEqual((s.plan, s.estado), (pyme, 'ACTIVE'))
        cliente.refresh_from_db()
        self.assertEqual(cliente.plan, pyme)


class WebhookFormatoReveniuTests(APITestCase):
    """Avisos con el formato que documenta Reveniu: evento + data anidada, secreto en Reveniu-Secret-Key."""
    URL = '/api/pagos/webhook/reveniu/'

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Cliente, Plan
        self.semilla = Plan.objects.create(nombre='Semilla', precio=0, max_empresas=1, limite_trabajadores=3, nivel=1)
        self.starter = Plan.objects.create(nombre='Starter', precio=16990, max_empresas=1, limite_trabajadores=10, nivel=2)
        self.pyme = Plan.objects.create(nombre='Pyme', precio=39990, max_empresas=3, limite_trabajadores=75, nivel=3)
        self.user = User.objects.create_user(username='12.345.678-5', password='x')
        self.cliente = Cliente.objects.create(usuario=self.user, rut='12.345.678-5', nombres='A', plan=self.semilla)

    def _avisar(self, evento, **data):
        with patch('core.views.suscripciones.config', side_effect=_mock_config('secret-real')):
            return self.client.post(self.URL, {'event': evento, 'data': data}, format='json',
                                    HTTP_REVENIU_SECRET_KEY='secret-real')

    def _suscripcion(self):
        from core.models import Suscripcion
        self.cliente.refresh_from_db()
        return Suscripcion.objects.get(cliente=self.cliente)

    def test_activacion_con_referencia_externa(self):
        resp = self._avisar('subscription_activated', subscription_id=1482,
                            subscription_external_id=f'{self.cliente.id}_{self.pyme.id}')
        self.assertEqual(resp.status_code, 200)
        s = self._suscripcion()
        self.assertEqual((s.plan, s.estado, s.gateway_subscription_id), (self.pyme, 'ACTIVE', '1482'))
        self.assertEqual(self.cliente.plan, self.pyme)

    def test_pagos_quedan_en_el_historial_sin_duplicar_reintentos(self):
        self._avisar('subscription_activated', subscription_id=7, subscription_external_id=f'{self.cliente.id}_{self.starter.id}')
        for _ in range(2):  # Reveniu reintenta el mismo aviso
            self._avisar('subscription_payment_succeeded', subscription_id=7, subscription_external_id=None,
                         buy_order=9001, issued_on='05/09/2026', gateway_response=0, amount=16990.0)
        self.client.force_authenticate(self.user)
        datos = self.client.get('/api/clientes/mi_suscripcion/').json()
        self.assertEqual(datos['pagos'], [{'id': datos['pagos'][0]['id'], 'fecha': '2026-09-05', 'monto': 16990,
                                           'plan': 'Starter', 'orden': '9001'}])

    def test_renovacion_cancelada_mantiene_el_plan_hasta_desactivarse(self):
        self._avisar('subscription_activated', subscription_id=7, subscription_external_id=f'{self.cliente.id}_{self.pyme.id}')
        self._avisar('subscription_renewal_cancelled', subscription_id=7, subscription_external_id=None,
                     cancelled_by='user', reason='precio')
        s = self._suscripcion()
        self.assertEqual((s.estado, self.cliente.plan), ('ACTIVE', self.pyme))
        self.client.force_authenticate(self.user)
        self.assertTrue(self.client.get('/api/clientes/mi_suscripcion/').json()['renovacion_cancelada'])

        self._avisar('subscription_deactivated', subscription_id=7, subscription_external_id=None)
        s = self._suscripcion()
        self.assertEqual((s.estado, self.cliente.plan.nivel, self.cliente.plan.precio), ('CANCELED', 1, 0))

    def test_desactivar_la_suscripcion_anterior_no_baja_el_plan_nuevo(self):
        from django.core import mail
        self._avisar('subscription_activated', subscription_id=7, subscription_external_id=f'{self.cliente.id}_{self.starter.id}')
        self._avisar('subscription_activated', subscription_id=8, subscription_external_id=f'{self.cliente.id}_{self.pyme.id}')
        # El cambio de plan avisa para cancelar la anterior en Reveniu.
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('7', mail.outbox[0].body)
        self._avisar('subscription_deactivated', subscription_id=7, subscription_external_id=None)
        s = self._suscripcion()
        self.assertEqual((s.estado, s.gateway_subscription_id, self.cliente.plan), ('ACTIVE', '8', self.pyme))

    def test_aviso_sin_cuenta_se_guarda_y_se_asocia_desde_el_admin(self):
        from django.core import mail
        from core.models import EventoPasarela
        from core.views import aplicar_evento_pasarela
        resp = self._avisar('subscription_payment_succeeded', subscription_id=55, subscription_external_id=None,
                            buy_order=1, issued_on='01/09/2026', amount=39990)
        self.assertEqual((resp.status_code, resp.json()), (200, {'estado': 'sin_asociar'}))
        self.assertEqual(len(mail.outbox), 1)
        evento = EventoPasarela.objects.get()
        self.assertIsNone(evento.cliente)
        # Asociación manual (lo que hace el admin al guardar).
        evento.cliente, evento.plan = self.cliente, self.pyme
        evento.save()
        self.assertTrue(aplicar_evento_pasarela(evento))
        s = self._suscripcion()
        self.assertEqual((s.plan, s.gateway_subscription_id, self.cliente.plan), (self.pyme, '55', self.pyme))
        # Desde ahí los avisos de esa suscripción se aplican solos.
        self._avisar('subscription_deactivated', subscription_id=55, subscription_external_id=None)
        self.assertEqual(self._suscripcion().estado, 'CANCELED')


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


class CupoTrabajadoresTests(APITestCase):
    """Cupo del plan: vigentes y desvinculados del mes en curso (liberan su cupo el mes siguiente)."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo(
            'cupo_owner', '17.777.777-7', '76.777.111-4', plan_semilla=True)  # límite 3
        self.client.force_authenticate(self.user)
        self.emps = [crear_empleado(self.empresa, r) for r in ('12.345.678-5', '11.111.111-1', '9.876.543-3')]

    def _crear(self, rut='7.654.321-6'):
        return self.client.post('/api/empleados/', {'empresa': self.empresa.id, 'rut': rut, 'nombres': 'A', 'apellido_paterno': 'B',
                                                    'cargo': 'C', 'fecha_ingreso': '2025-01-01'}, format='json')

    def _desvincular(self, e):
        r = self.client.patch(f'/api/empleados/{e.id}/', {'activo': False}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        e.refresh_from_db()
        return e

    def test_no_se_supera_el_limite(self):
        r = self._crear()
        self.assertEqual(r.status_code, 400)
        self.assertIn('3 trabajadores', r.data['error'])

    def test_desvincular_no_libera_el_cupo_en_el_mismo_mes(self):
        from django.utils import timezone
        e = self._desvincular(self.emps[0])
        self.assertEqual(e.fecha_desvinculacion, timezone.localdate())
        self.assertEqual(self._crear().status_code, 400)     # rotar dentro del mes no suma cupo
        self.assertEqual(self.client.get('/api/clientes/mi_suscripcion/').data['trabajadores_actuales'], 3)
        # Reactivarlo en el mismo mes sí se puede: ya ocupaba su cupo.
        r = self.client.patch(f'/api/empleados/{e.id}/', {'activo': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        e.refresh_from_db()
        self.assertIsNone(e.fecha_desvinculacion)

    def test_el_mes_siguiente_el_cupo_queda_libre(self):
        import datetime
        e = self._desvincular(self.emps[0])
        Empleado.objects.filter(pk=e.pk).update(fecha_desvinculacion=e.fecha_desvinculacion - datetime.timedelta(days=40))
        self.assertEqual(self._crear().status_code, 201)
        # Ahora está lleno: reactivar al desvinculado de un mes anterior exige cupo.
        r = self.client.patch(f'/api/empleados/{e.id}/', {'activo': True}, format='json')
        self.assertEqual(r.status_code, 400)


class PlanesBaseMigracionTests(APITestCase):
    def test_planes_base_existen(self):
        self.assertEqual(sorted(Plan.objects.filter(nombre__in=['Semilla', 'Starter', 'Pyme', 'Corporativo'])
                                .values_list('nivel', flat=True)), [1, 2, 3, 4])


class ConsolidarPlanesTests(APITestCase):
    """Los planes antiguos ("Plan Pyme", con nivel 1) pasan sus clientes al plan equivalente y se desactivan."""

    def test_clientes_de_planes_antiguos_quedan_en_el_equivalente(self):
        import importlib
        from django.apps import apps
        from ..models import Cliente, Suscripcion
        migracion = importlib.import_module('core.migrations.0052_consolidar_planes')
        antiguo = Plan.objects.create(nombre='Plan Pyme', precio=29990, limite_trabajadores=40, nivel=1)
        user, cliente, _, _ = crear_usuario_completo('legacy', '21.000.000-3', '76.000.555-2')
        Cliente.objects.filter(pk=cliente.pk).update(plan=antiguo)
        Suscripcion.objects.filter(cliente=cliente).update(plan=antiguo)

        migracion.consolidar(apps, None)

        pyme = Plan.objects.get(nombre='Pyme')
        cliente.refresh_from_db()
        antiguo.refresh_from_db()
        self.assertEqual((cliente.plan, Suscripcion.objects.get(cliente=cliente).plan, pyme.nivel), (pyme, pyme, 3))
        self.assertFalse(antiguo.activo)
        # El panel recibe el nivel del plan que usa el backend.
        self.client.force_authenticate(user)
        plan = self.client.get('/api/clientes/mi_suscripcion/').data['plan']
        self.assertEqual((plan['nombre'], plan['nivel'], plan['max_empresas']), ('Pyme', 3, pyme.max_empresas))
        self.assertEqual(sorted(p['nivel'] for p in self.client.get('/api/planes/').data['results']), [1, 2, 3, 4])

    def test_registro_usa_el_plan_gratuito_por_nivel(self):
        from ..models import Suscripcion
        Plan.objects.filter(nombre='Semilla').update(nombre='Plan Semilla')
        antes = Plan.objects.count()
        r = self.client.post('/api/auth/register/', {
            'rut': '12.345.678-5', 'password': 'Clave-Segura-2026', 'email': 'nuevo@correo.cl',
            'nombres': 'Ana', 'apellido_paterno': 'Rojas', 'tipo_cliente': 'PERSONA'}, format='json')
        self.assertIn(r.status_code, (200, 201), r.data)
        self.assertEqual(Plan.objects.count(), antes)   # no crea un "Semilla" duplicado
        self.assertEqual(Suscripcion.objects.get(cliente__rut='12.345.678-5').plan.nivel, 1)


class PagoAnualTests(APITestCase):
    """Cada plan pagado se vende mensual o anual; el anual parte en 10 × el mensual."""

    def setUp(self):
        self.user, _, _, _ = crear_usuario_completo('anual_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.pyme = Plan.objects.get(nombre='Pyme')

    def test_precio_anual_inicial(self):
        self.assertEqual(self.pyme.precio_anual, self.pyme.precio * 10)
        self.assertEqual(Plan.objects.get(nombre='Semilla').precio_anual, 0)

    def test_checkout_anual_usa_su_propio_link(self):
        def config(clave, default=None, **kw):
            return {'REVENIU_LINK_PYME_ANUAL': 'https://pago.example/anual'}.get(clave, default)
        with patch('core.views.suscripciones.config', side_effect=config):
            r = self.client.post('/api/pagos/crear-checkout/', {'plan_id': self.pyme.id, 'ciclo': 'anual'}, format='json')
            self.assertEqual(r.status_code, 200, r.data)
            self.assertTrue(r.data['url'].startswith('https://pago.example/anual?'))
            r = self.client.post('/api/pagos/crear-checkout/', {'plan_id': self.pyme.id, 'ciclo': 'mensual'}, format='json')
            self.assertIn('REVENIU_LINK_PYME_MENSUAL', r.data['error'])
            r = self.client.post('/api/pagos/crear-checkout/', {'plan_id': self.pyme.id, 'ciclo': 'semestral'}, format='json')
            self.assertEqual(r.status_code, 400)


class CambioDeCicloTests(APITestCase):
    """Pasar del mensual al anual del mismo plan: la suscripción queda anual y se avisa cancelar la mensual."""
    URL = '/api/pagos/webhook/reveniu/'

    def setUp(self):
        from ..models import Suscripcion
        self.user, self.cliente, _, _ = crear_usuario_completo('ciclo_owner', '21.000.000-3', '76.000.555-2')
        self.pyme = Plan.objects.get(nombre='Pyme')
        Suscripcion.objects.filter(cliente=self.cliente).update(plan=self.pyme, gateway_subscription_id='10', ciclo='MENSUAL')

    def _avisar(self, evento, **data):
        with patch('core.views.suscripciones.config', side_effect=_mock_config('secret-real')):
            return self.client.post(self.URL, {'event': evento, 'data': data}, format='json', HTTP_REVENIU_SECRET_KEY='secret-real')

    def test_referencia_con_ciclo_anual(self):
        from django.core import mail
        from ..models import Suscripcion
        self._avisar('subscription_activated', subscription_id=11,
                     subscription_external_id=f'{self.cliente.id}_{self.pyme.id}_anual')
        s = Suscripcion.objects.get(cliente=self.cliente)
        self.assertEqual((s.ciclo, s.gateway_subscription_id), ('ANUAL', '11'))
        self.assertEqual(len(mail.outbox), 1)          # cancelar la mensual (10) en Reveniu
        self.assertIn('10', mail.outbox[0].body)
        from django.contrib.auth.models import User
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))   # sin la suscripción en caché
        self.assertEqual(self.client.get('/api/clientes/mi_suscripcion/').data['ciclo'], 'anual')

    def test_sin_referencia_se_deduce_del_monto(self):
        from ..models import Suscripcion
        self._avisar('subscription_payment_succeeded', subscription_id=10, subscription_external_id=None,
                     buy_order=5, issued_on='01/10/2026', amount=self.pyme.precio_anual)
        self.assertEqual(Suscripcion.objects.get(cliente=self.cliente).ciclo, 'ANUAL')
        self._avisar('subscription_payment_succeeded', subscription_id=10, subscription_external_id=None,
                     buy_order=6, issued_on='01/11/2026', amount=self.pyme.precio)
        self.assertEqual(Suscripcion.objects.get(cliente=self.cliente).ciclo, 'MENSUAL')

    def test_checkout_lleva_el_ciclo_en_la_referencia(self):
        def config(clave, default=None, **kw):
            return {'REVENIU_LINK_PYME_ANUAL': 'https://pago.example/anual'}.get(clave, default)
        self.client.force_authenticate(self.user)
        with patch('core.views.suscripciones.config', side_effect=config):
            r = self.client.post('/api/pagos/crear-checkout/', {'plan_id': self.pyme.id, 'ciclo': 'anual'}, format='json')
        self.assertIn(f'custom_reference={self.cliente.id}_{self.pyme.id}_anual', r.data['url'])
