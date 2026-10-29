"""Códigos de prueba: un plan pagado gratis por unos meses al crear la cuenta (core/pruebas.py)."""
import datetime
import io
import re
from unittest.mock import patch

from django.contrib.admin.models import LogEntry
from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase

from .. import pruebas
from ..models import Cliente, CodigoPrueba, Empleado, Empresa, Plan, Suscripcion
from .utiles import _mock_config

CLAVE = 'Clave-Segura-2026'
PATRON = r'PYME-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}'


def _pyme():
    return Plan.objects.filter(activo=True, nivel=3).order_by('id').first()


def _registrar(client, rut='12.345.678-5', **extra):
    datos = {'rut': rut, 'password': CLAVE, 'email': 'ana@ferreteria.cl', 'nombres': 'Ana',
             'apellido_paterno': 'Pérez', **extra}
    return client.post('/api/auth/register/', datos, format='json')


class CodigosTests(TestCase):
    def test_se_guarda_solo_la_huella_y_se_reconoce_escrito_de_varias_formas(self):
        [(codigo, texto)] = pruebas.generar(_pyme(), nota='Piloto ferretería')
        self.assertRegex(texto, f'^{PATRON}$')
        self.assertTrue(set(texto.replace('-', '')[4:]) <= set(pruebas.ALFABETO))
        secreto = texto[5:].replace('-', '')
        self.assertNotIn(secreto, ' '.join([codigo.codigo_hash, codigo.prefijo, codigo.sufijo, codigo.nota]))
        self.assertEqual(codigo.visible, f'PYME-····-····-{texto[-4:]}')
        # Minúsculas, espacios en vez de guiones o sin el prefijo: es el mismo código.
        for variante in (texto, texto.lower(), texto.replace('-', ' '), secreto):
            self.assertEqual(pruebas.vigente(variante), codigo)
        otro = texto[:-1] + ('B' if texto[-1] == 'A' else 'A')
        self.assertIsNone(pruebas.vigente(otro))
        self.assertIsNone(pruebas.vigente('PYME-1234'))
        self.assertIsNone(pruebas.vigente(None))

    def test_cada_codigo_es_distinto(self):
        textos = [t for _, t in pruebas.generar(_pyme(), nota='Lote', cantidad=20)]
        self.assertEqual(len(set(textos)), 20)
        self.assertEqual(CodigoPrueba.objects.count(), 20)
        with self.assertRaises(ValueError):
            pruebas.generar(_pyme(), nota='Demasiados', cantidad=pruebas.MAXIMO_POR_VEZ + 1)

    def test_vencido_o_anulado_no_sirve(self):
        ayer = timezone.localdate() - datetime.timedelta(days=1)
        [(codigo, texto)] = pruebas.generar(_pyme(), nota='x', valido_hasta=ayer)
        self.assertEqual(codigo.estado(), 'VENCIDO')
        self.assertIsNone(pruebas.vigente(texto))
        [(codigo, texto)] = pruebas.generar(_pyme(), nota='x')
        codigo.activo = False
        codigo.save()
        self.assertEqual(codigo.estado(), 'ANULADO')
        self.assertIsNone(pruebas.vigente(texto))

    def test_sumar_meses(self):
        self.assertEqual(pruebas.sumar_meses(datetime.date(2026, 10, 29), 3), datetime.date(2027, 1, 29))
        self.assertEqual(pruebas.sumar_meses(datetime.date(2026, 11, 30), 3), datetime.date(2027, 2, 28))
        self.assertEqual(pruebas.sumar_meses(datetime.date(2027, 11, 30), 3), datetime.date(2028, 2, 29))
        self.assertEqual(pruebas.sumar_meses(datetime.date(2026, 12, 15), 1), datetime.date(2027, 1, 15))


class RegistroConCodigoTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.pyme = _pyme()
        [(self.codigo, self.texto)] = pruebas.generar(self.pyme, nota='Piloto ferretería')

    def test_la_cuenta_nace_en_prueba_y_el_codigo_queda_usado(self):
        with self.captureOnCommitCallbacks(execute=True):
            r = _registrar(self.client, codigo_prueba=self.texto)
        self.assertEqual(r.status_code, 201, r.data)
        hasta = pruebas.sumar_meses(timezone.localdate(), 3)
        self.assertEqual(r.data['prueba'], {'plan': self.pyme.nombre, 'hasta': hasta.isoformat()})
        cliente = Cliente.objects.get(rut='12.345.678-5')
        s = Suscripcion.objects.get(cliente=cliente)
        self.assertEqual((cliente.plan, s.plan, s.estado, s.prueba_hasta), (self.pyme, self.pyme, 'TRIAL', hasta))
        self.codigo.refresh_from_db()
        self.assertEqual((self.codigo.usado_por, self.codigo.estado()), (cliente, 'USADO'))
        # Jornada40 se entera de que el código se usó (con la nota, sin el código completo).
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('Piloto ferretería', mail.outbox[0].body)
        self.assertNotIn(self.texto, mail.outbox[0].body)

        self.client.force_authenticate(cliente.usuario)
        datos = self.client.get('/api/clientes/mi_suscripcion/').json()
        self.assertEqual((datos['estado'], datos['plan']['nivel']), ('TRIAL', 3))
        self.assertEqual(datos['prueba'], {'plan': self.pyme.nombre, 'hasta': hasta.isoformat(),
                                           'dias_restantes': (hasta - timezone.localdate()).days, 'terminada': False})

    def test_el_codigo_sirve_una_sola_vez(self):
        self.assertEqual(_registrar(self.client, codigo_prueba=self.texto).status_code, 201)
        r = _registrar(self.client, rut='11.111.111-1', codigo_prueba=self.texto)
        self.assertEqual((r.status_code, r.data['campo']), (400, 'codigo_prueba'))
        self.assertFalse(Cliente.objects.filter(rut='11.111.111-1').exists())

    def test_codigo_que_no_existe_no_crea_la_cuenta(self):
        r = _registrar(self.client, codigo_prueba='PYME-AAAA-BBBB-CCCC')
        self.assertEqual((r.status_code, r.data['error']), (400, pruebas.MENSAJE_NO_VALIDO))
        self.assertFalse(User.objects.filter(username='12.345.678-5').exists())

    def test_sin_codigo_la_cuenta_nace_en_el_plan_gratuito(self):
        self.assertEqual(_registrar(self.client).status_code, 201)
        s = Suscripcion.objects.get(cliente__rut='12.345.678-5')
        self.assertEqual((s.plan.nivel, s.estado, s.prueba_hasta), (1, 'ACTIVE', None))

    def test_si_el_registro_falla_el_codigo_no_se_gasta(self):
        self.assertEqual(_registrar(self.client).status_code, 201)
        r = _registrar(self.client, codigo_prueba=self.texto)   # el RUT ya tiene cuenta
        self.assertEqual(r.status_code, 400)
        self.codigo.refresh_from_db()
        self.assertEqual(self.codigo.estado(), 'DISPONIBLE')

    def test_dos_registros_a_la_vez_no_lo_usan_dos_veces(self):
        # Ambos lo leyeron disponible, pero el otro alcanzó a usarlo antes de este.
        leido = CodigoPrueba.objects.get(pk=self.codigo.pk)
        CodigoPrueba.objects.filter(pk=self.codigo.pk).update(usado_en=timezone.now())
        with patch('core.pruebas.vigente', return_value=leido):
            r = _registrar(self.client, codigo_prueba=self.texto)
        self.assertEqual((r.status_code, r.data['campo']), (400, 'codigo_prueba'))
        self.assertFalse(Cliente.objects.filter(rut='12.345.678-5').exists())

    def test_revisar_el_codigo_no_lo_usa(self):
        r = self.client.post('/api/auth/codigo-prueba/', {'codigo': self.texto.lower()}, format='json')
        self.assertEqual(r.status_code, 200)
        hasta = pruebas.sumar_meses(timezone.localdate(), 3)
        self.assertEqual(r.data, {'plan': {'nombre': self.pyme.nombre, 'nivel': 3}, 'meses': 3, 'hasta': hasta.isoformat()})
        self.codigo.refresh_from_db()
        self.assertEqual(self.codigo.estado(), 'DISPONIBLE')
        r = self.client.post('/api/auth/codigo-prueba/', {'codigo': 'PYME-AAAA-BBBB-CCCC'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_revisar_codigos_tiene_limite_por_ip(self):
        respuestas = [self.client.post('/api/auth/codigo-prueba/', {'codigo': f'PYME-AAAA-BBBB-CC{i:02d}'},
                                       format='json').status_code for i in range(21)]
        self.assertEqual(respuestas[:20], [400] * 20)
        self.assertEqual(respuestas[20], 429)


class FinDePruebaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.pyme = _pyme()
        [(_, texto)] = pruebas.generar(self.pyme, nota='Piloto')
        self.assertEqual(_registrar(self.client, codigo_prueba=texto).status_code, 201)
        self.cliente = Cliente.objects.get(rut='12.345.678-5')
        self.user = self.cliente.usuario
        self.client.force_authenticate(self.user)
        mail.outbox.clear()

    def _mi_suscripcion(self):
        # Usuario recién leído, como en cada petición real (force_authenticate reusa el objeto y su caché).
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        return self.client.get('/api/clientes/mi_suscripcion/').json()

    def _termina_en(self, dias):
        Suscripcion.objects.filter(cliente=self.cliente).update(prueba_hasta=timezone.localdate() +
                                                                datetime.timedelta(days=dias))

    def _suscripcion(self):
        return Suscripcion.objects.get(cliente=self.cliente)

    def _nivel(self):
        from core.views.base import _plan_activo
        return _plan_activo(User.objects.get(pk=self.user.pk)).nivel

    def test_durante_la_prueba_rige_el_plan_del_codigo(self):
        self._termina_en(0)   # el último día todavía es de prueba
        self.assertEqual(self._nivel(), 3)
        self.assertEqual(self._mi_suscripcion()['prueba']['dias_restantes'], 0)

    def test_vencida_rige_el_plan_gratuito_aunque_no_haya_corrido_el_proceso(self):
        self._termina_en(-1)
        self.assertEqual(self._nivel(), 1)
        datos = self._mi_suscripcion()
        self.assertEqual((datos['estado'], datos['plan']['nivel']), ('ACTIVE', 1))
        self.assertEqual((datos['prueba']['plan'], datos['prueba']['terminada']), (self.pyme.nombre, True))
        self.assertEqual(self._suscripcion().estado, 'TRIAL')   # el proceso diario la cierra

    def test_avisa_15_y_3_dias_antes_y_al_terminar_una_vez_cada_uno(self):
        enviados = []
        for dias in (20, 15, 15, 10, 3, 3, 1, 0, -1, -1, -5):
            self._termina_en(dias)
            enviados.append(pruebas.procesar_pruebas())
        self.assertEqual(enviados, [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0])
        asuntos = [m.subject for m in mail.outbox]
        self.assertIn('termina el', asuntos[0])
        self.assertIn('en 15 días', mail.outbox[0].body)
        self.assertIn('en 3 días', mail.outbox[1].body)
        self.assertIn('terminó', asuntos[2])
        self.assertIn(f'{self.cliente.usuario.email}', mail.outbox[2].to)
        s = self._suscripcion()
        self.assertEqual((s.estado, s.plan.nivel, s.prueba_aviso), ('ACTIVE', 1, 0))
        self.assertIsNotNone(s.prueba_terminada_en)
        self.cliente.refresh_from_db()
        self.assertEqual(self.cliente.plan.nivel, 1)
        datos = self._mi_suscripcion()
        self.assertEqual((datos['estado'], datos['plan']['nivel'], datos['prueba']['terminada']), ('ACTIVE', 1, True))

    def test_si_el_proceso_no_corrio_avisa_lo_mas_urgente(self):
        self._termina_en(2)
        self.assertEqual(pruebas.procesar_pruebas(), 1)
        self.assertIn('en 2 días', mail.outbox[0].body)
        self.assertEqual(self._suscripcion().prueba_aviso, 3)
        self.assertEqual(pruebas.procesar_pruebas(), 0)

    def test_si_el_correo_falla_el_aviso_se_reintenta(self):
        self._termina_en(15)
        with patch('core.pruebas.EmailMultiAlternatives.send', side_effect=OSError('sin conexión')):
            self.assertEqual(pruebas.procesar_pruebas(), 0)
        self.assertIsNone(self._suscripcion().prueba_aviso)
        self.assertEqual(pruebas.procesar_pruebas(), 1)

    def test_al_terminar_no_se_borra_nada_y_rigen_los_limites_del_gratuito(self):
        empresa = Empresa.objects.create(owner=self.user, nombre_legal='Ferretería', rut='76.000.555-K')
        for i, cuerpo in enumerate(('11.111.111-1', '12.222.222-0', '13.333.333-9', '14.444.444-8', '15.555.555-7')):
            Empleado.objects.create(empresa=empresa, rut=cuerpo, nombres=f'Persona {i}', apellido_paterno='X',
                                    cargo='Vendedor', fecha_ingreso='2026-01-01')
        self._termina_en(-1)
        pruebas.procesar_pruebas()
        self.assertTrue(Empresa.objects.filter(pk=empresa.pk, activo=True).exists())
        self.assertEqual(Empleado.objects.filter(empresa=empresa, activo=True).count(), 5)
        datos = self._mi_suscripcion()
        self.assertEqual((datos['trabajadores_actuales'], datos['plan']['nivel']), (5, 1))
        r = self.client.post('/api/empleados/', {'empresa': empresa.id, 'rut': '16.666.666-6', 'nombres': 'Otra',
                                                 'apellido_paterno': 'Y', 'cargo': 'Vendedora',
                                                 'fecha_ingreso': '2026-01-01'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_pagar_durante_la_prueba_la_termina(self):
        with patch('core.views.suscripciones.config', side_effect=_mock_config('secreto')):
            r = self.client.post('/api/pagos/webhook/reveniu/', {
                'event': 'subscription_activated',
                'data': {'subscription_id': 77, 'subscription_external_id': f'{self.cliente.id}_{self.pyme.id}'},
            }, format='json', HTTP_REVENIU_SECRET_KEY='secreto')
        self.assertEqual(r.status_code, 200)
        s = self._suscripcion()
        self.assertEqual((s.estado, s.plan, s.prueba_aviso), ('ACTIVE', self.pyme, 0))
        self.assertIsNotNone(s.prueba_terminada_en)
        self._termina_en(-1)
        self.assertEqual((pruebas.procesar_pruebas(), self._nivel()), (0, 3))
        self.assertIsNone(self._mi_suscripcion()['prueba'])

    def test_el_comando_diario_procesa_las_pruebas(self):
        self._termina_en(-1)
        salida = io.StringIO()
        call_command('enviar_resumenes', stdout=salida)
        self.assertIn('Pruebas: 1 avisos enviados.', salida.getvalue())
        self.assertEqual(self._suscripcion().plan.nivel, 1)


class AdminCodigosTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser('admin-pruebas', 'admin@x.cl', 'Clave-Admin-2026')
        self.client.force_login(self.admin)
        self.pyme = _pyme()

    def test_generar_muestra_los_codigos_una_sola_vez(self):
        r = self.client.get('/admin/core/codigoprueba/add/')
        self.assertRedirects(r, '/admin/core/codigoprueba/generar/')
        self.assertContains(self.client.get('/admin/core/codigoprueba/generar/'), 'Días para usarlo')
        r = self.client.post('/admin/core/codigoprueba/generar/', {
            'plan': self.pyme.id, 'meses': 3, 'dias_validez': 30, 'cantidad': 2, 'nota': 'Piloto Patagon'})
        self.assertEqual(r.status_code, 200)
        self.assertIn('no-store', r.headers.get('Cache-Control', ''))
        textos = sorted(set(re.findall(PATRON, r.content.decode())))
        self.assertEqual(len(textos), 2)
        for texto in textos:
            codigo = pruebas.vigente(texto)
            self.assertEqual((codigo.meses, codigo.nota, codigo.creado_por), (3, 'Piloto Patagon', self.admin))
            self.assertEqual(codigo.valido_hasta, timezone.localdate() + datetime.timedelta(days=30))
            self.assertContains(r, f'/register?codigo={texto}')
        self.assertEqual(LogEntry.objects.filter(user=self.admin).count(), 2)
        # Después, la lista solo muestra sus últimos 4 caracteres.
        lista = self.client.get('/admin/core/codigoprueba/').content.decode()
        for texto in textos:
            self.assertNotIn(texto, lista)
            self.assertIn(f'PYME-····-····-{texto[-4:]}', lista)

    def test_extender_la_prueba_reinicia_los_avisos(self):
        [(_, texto)] = pruebas.generar(self.pyme, nota='x')
        cache.clear()
        self.assertEqual(_registrar(self.client, codigo_prueba=texto).status_code, 201)
        s = Suscripcion.objects.get(cliente__rut='12.345.678-5')
        Suscripcion.objects.filter(pk=s.pk).update(prueba_aviso=3)
        nueva = timezone.localdate() + datetime.timedelta(days=40)
        url = f'/admin/core/suscripcion/{s.pk}/change/'
        formulario = self.client.get(url).context['adminform'].form
        datos = {k: v for k, v in formulario.initial.items() if v is not None}
        datos.update(cliente=s.cliente_id, plan=s.plan_id, prueba_hasta=nueva.isoformat(),
                     fecha_inicio_0='', fecha_proximo_cobro_0='', fecha_cancelacion_0='', prueba_terminada_en_0='')
        r = self.client.post(url, datos)
        self.assertEqual(r.status_code, 302, getattr(r, 'context', None) and r.context['adminform'].form.errors)
        s.refresh_from_db()
        self.assertEqual((s.prueba_hasta, s.prueba_aviso), (nueva, None))

    def test_anular_solo_los_que_no_se_usaron_y_no_se_borran(self):
        (libre, _), (usado, _) = pruebas.generar(self.pyme, nota='x', cantidad=2)
        CodigoPrueba.objects.filter(pk=usado.pk).update(usado_en=timezone.now())
        r = self.client.post('/admin/core/codigoprueba/', {'action': 'anular',
                                                            '_selected_action': [libre.pk, usado.pk]})
        self.assertEqual(r.status_code, 302)
        libre.refresh_from_db()
        usado.refresh_from_db()
        self.assertEqual((libre.estado(), usado.estado()), ('ANULADO', 'USADO'))
        self.assertEqual(self.client.get(f'/admin/core/codigoprueba/{libre.pk}/delete/').status_code, 403)
        self.assertContains(self.client.get('/admin/core/codigoprueba/?estado=ANULADO'), libre.sufijo)
