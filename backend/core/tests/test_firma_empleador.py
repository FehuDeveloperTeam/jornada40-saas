"""Firma del empleador a distancia (plan Corporativo): pedido desde el panel, flujo del representante y evidencia."""
import base64
import io
import re
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from ..models import Empresa, RegistroBitacora, SolicitudFirmaEmpleador, UsuarioEquipo
from .utiles import crear_usuario_completo

CLAVE_EQUIPO = 'Clave-Equipo-2026'
RUT_REP = '12.345.678-5'


def _firma_png():
    buf = io.BytesIO()
    Image.new('RGBA', (60, 24), (20, 30, 90, 255)).save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def _codigo(correo):
    return re.search(r'\b(\d{6})\b', correo.body).group(1)


class FirmaEmpleadorTests(APITestCase):
    def setUp(self):
        cache.clear()   # límites de intentos de la firma pública
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo(
            'corp', '21.000.000-3', '76.000.555-K')
        self.plan.nombre, self.plan.nivel, self.plan.max_empresas = 'Corporativo', 4, 10
        self.plan.save()
        self.client.force_authenticate(self.user)
        self.publico = APIClient()

    def _pedir(self, cliente=None, empresa=None, **extra):
        datos = {'empresa': (empresa or self.empresa).id, 'nombre': 'María José Pérez Soto', 'rut': RUT_REP,
                 'cargo': 'Gerenta general', 'email': 'Maria.Perez@correo.cl', **extra}
        return (cliente or self.client).post('/api/firmas-empleador/', datos, format='json')

    def _solicitud(self):
        return SolicitudFirmaEmpleador.objects.latest('id')

    def _verificar(self, s):
        """RUT + código del correo → sesión para firmar."""
        r = self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': '12345678-5'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        r = self.publico.post(f'/api/firma-empleador/{s.token}/verificar/', {'codigo': _codigo(mail.outbox[-1])},
                              format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return r.data['sesion']

    def _firmar(self, s, sesion, **extra):
        return self.publico.post(f'/api/firma-empleador/{s.token}/firmar/',
                                 {'sesion': sesion, 'firma': _firma_png(), 'acepto': True, **extra}, format='json')

    # ── Panel ────────────────────────────────────────────────────────────────

    def test_solo_desde_corporativo(self):
        self.plan.nivel = 3
        self.plan.save()
        r = self.client.get('/api/firmas-empleador/')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['permitido'])
        r = self._pedir()
        self.assertEqual(r.status_code, 403)
        self.assertIn('Corporativo', r.data['error'])
        self.assertFalse(SolicitudFirmaEmpleador.objects.exists())

    def test_pedir_envia_el_enlace_y_avisa_lo_que_cambiara(self):
        r = self._pedir()
        self.assertEqual(r.status_code, 201, r.data)
        s = self._solicitud()
        self.assertEqual((s.estado, s.email, s.rut, s.pedida_por, s.correo_enviado),
                         ('PENDIENTE', 'maria.perez@correo.cl', RUT_REP, self.user, True))
        self.assertEqual(r.data['folio'], f'FE-{s.pk:06d}')
        # Sin representante registrado en la empresa: avisa que se completará al firmar.
        self.assertTrue(any('no tiene representante legal' in a for a in r.data['avisos']))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['maria.perez@correo.cl'])
        self.assertIn(f'/firma-empleador/{s.token}', mail.outbox[0].body)
        self.assertIn('Empresa Test SA', mail.outbox[0].subject)

        datos = self.client.get('/api/firmas-empleador/').data
        self.assertTrue(datos['permitido'])
        fila = datos['empresas'][0]
        self.assertEqual((fila['id'], fila['solicitud']['estado'], fila['firma']['configurada']),
                         (self.empresa.id, 'PENDIENTE', False))

    def test_avisa_si_el_rut_no_es_el_del_representante_registrado(self):
        self.empresa.representante_legal, self.empresa.rut_representante = 'PEDRO SOTO', '9.876.543-3'
        self.empresa.firma_imagen = _firma_png()
        self.empresa.save()
        r = self._pedir()
        self.assertEqual(r.status_code, 201)
        self.assertTrue(any('no es el del representante legal registrado' in a for a in r.data['avisos']))
        self.assertTrue(any('la nueva la reemplazará' in a for a in r.data['avisos']))

    def test_valida_los_datos_del_representante(self):
        self.assertEqual(self._pedir(rut='12.345.678-9').status_code, 400)
        r = self._pedir(rut='76.000.555-K')   # RUT de empresa
        self.assertEqual(r.status_code, 400)
        self.assertIn('persona', r.data['error'])
        self.assertEqual(self._pedir(email='no-es-correo').status_code, 400)
        self.assertEqual(self._pedir(nombre=' ').status_code, 400)
        otro, *_ = crear_usuario_completo('otra', '22.222.222-2', '77.777.777-7')
        self.assertEqual(self._pedir(empresa=Empresa.objects.get(owner=otro)).status_code, 404)
        self.assertFalse(SolicitudFirmaEmpleador.objects.exists())

    def test_un_pedido_nuevo_reemplaza_al_pendiente(self):
        self._pedir()
        primero = self._solicitud()
        self._pedir(email='otro@correo.cl')
        primero.refresh_from_db()
        self.assertEqual(primero.estado, 'CANCELADA')
        self.assertEqual(SolicitudFirmaEmpleador.objects.filter(estado='PENDIENTE').count(), 1)
        r = self.publico.post(f'/api/firma-empleador/{primero.token}/codigo/', {'rut': RUT_REP}, format='json')
        self.assertEqual(r.status_code, 410)

    def test_correo_que_falla_queda_informado_y_se_puede_reenviar(self):
        with patch('core.views.firma_empleador.EmailMultiAlternatives.send', side_effect=OSError('smtp')):
            r = self._pedir()
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.data['correo_enviado'])
        s = self._solicitud()
        with patch('core.views.firma_empleador.EmailMultiAlternatives.send', side_effect=OSError('smtp')):
            self.assertEqual(self.client.post(f'/api/firmas-empleador/{s.id}/reenviar/').status_code, 503)
        r = self.client.post(f'/api/firmas-empleador/{s.id}/reenviar/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['correo_enviado'])
        self.assertEqual(len(mail.outbox), 1)

    def test_cancelar_y_vencer(self):
        self._pedir()
        s = self._solicitud()
        r = self.client.post(f'/api/firmas-empleador/{s.id}/cancelar/')
        self.assertEqual((r.status_code, r.data['estado']), (200, 'CANCELADA'))
        self.assertEqual(self.client.post(f'/api/firmas-empleador/{s.id}/cancelar/').status_code, 400)
        self.assertEqual(self.client.post(f'/api/firmas-empleador/{s.id}/reenviar/').status_code, 400)

        self._pedir()
        s = self._solicitud()
        SolicitudFirmaEmpleador.objects.filter(pk=s.pk).update(expira_en=timezone.now() - timezone.timedelta(minutes=1))
        r = self.publico.get(f'/api/firma-empleador/{s.token}/')
        self.assertEqual(r.data['estado'], 'EXPIRADA')
        r = self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': RUT_REP}, format='json')
        self.assertEqual(r.status_code, 410)
        r = self.client.post(f'/api/firmas-empleador/{s.id}/reenviar/')
        self.assertEqual(r.status_code, 400)
        self.assertIn('venció', r.data['error'])

    # ── Flujo del representante ─────────────────────────────────────────────

    def test_codigo_solo_con_el_rut_del_representante_y_guardado_como_huella(self):
        self._pedir()
        s = self._solicitud()
        info = self.publico.get(f'/api/firma-empleador/{s.token}/').data
        self.assertEqual((info['estado'], info['email_enmascarado'], info['empresa_nombre']),
                         ('PENDIENTE', 'ma***@correo.cl', 'Empresa Test SA'))
        self.assertNotIn('declaracion', info)   # lleva el RUT: solo con la identidad verificada
        r = self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': '9.876.543-3'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(len(mail.outbox), 1)   # solo el pedido
        r = self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': '12345678-5'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        codigo = _codigo(mail.outbox[-1])
        s.refresh_from_db()
        self.assertEqual(len(s.codigo_hash), 64)
        self.assertNotIn(codigo, s.codigo_hash)
        self.assertTrue(s.coincide(codigo))
        # Un código por minuto.
        r = self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': RUT_REP}, format='json')
        self.assertEqual(r.status_code, 429)

    def test_codigo_tres_intentos_y_un_solo_uso(self):
        self._pedir()
        s = self._solicitud()
        self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': RUT_REP}, format='json')
        codigo = _codigo(mail.outbox[-1])
        malo = '000000' if codigo != '000000' else '111111'
        url = f'/api/firma-empleador/{s.token}/verificar/'
        r = self.publico.post(url, {'codigo': malo}, format='json')
        self.assertIn('2 intento', r.data['error'])
        self.publico.post(url, {'codigo': malo}, format='json')
        self.publico.post(url, {'codigo': malo}, format='json')
        r = self.publico.post(url, {'codigo': codigo}, format='json')
        self.assertEqual(r.status_code, 400)   # bloqueado aunque ahora sea el correcto
        # Uno nuevo (pasado el minuto) sí sirve, y una sola vez.
        SolicitudFirmaEmpleador.objects.filter(pk=s.pk).update(
            codigo_creado_en=timezone.now() - timezone.timedelta(minutes=2))
        self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': RUT_REP}, format='json')
        codigo = _codigo(mail.outbox[-1])
        r = self.publico.post(url, {'codigo': codigo}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIn('declaro que soy representante legal de Empresa Test SA', r.data['declaracion'])
        self.assertEqual(self.publico.post(url, {'codigo': codigo}, format='json').status_code, 400)
        info = self.publico.get(f'/api/firma-empleador/{s.token}/', {'sesion': r.data['sesion']}).data
        self.assertTrue(info['verificado'])
        self.assertIn(RUT_REP, info['declaracion'])

    def test_codigo_vencido(self):
        self._pedir()
        s = self._solicitud()
        self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': RUT_REP}, format='json')
        codigo = _codigo(mail.outbox[-1])
        SolicitudFirmaEmpleador.objects.filter(pk=s.pk).update(
            codigo_creado_en=timezone.now() - timezone.timedelta(minutes=11))
        r = self.publico.post(f'/api/firma-empleador/{s.token}/verificar/', {'codigo': codigo}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('venció', r.data['error'])

    def test_firmar_exige_aceptar_sesion_e_imagen_valida(self):
        self._pedir()
        s = self._solicitud()
        sesion = self._verificar(s)
        self.assertEqual(self._firmar(s, sesion, acepto=False).status_code, 400)
        self.assertEqual(self._firmar(s, sesion, firma='data:image/svg+xml;base64,PHN2Zz4=').status_code, 400)
        self.assertEqual(self._firmar(s, sesion, firma='data:image/png;base64,bm8gZXMgdW5hIGltYWdlbg==').status_code,
                         400)
        self.assertEqual(self._firmar(s, '00000000-0000-0000-0000-000000000000').status_code, 403)
        s.refresh_from_db()
        self.assertEqual(s.estado, 'PENDIENTE')
        self.empresa.refresh_from_db()
        self.assertEqual(self.empresa.firma_imagen, '')

    def test_firmar_deja_la_firma_de_la_empresa_y_la_evidencia(self):
        self._pedir()
        s = self._solicitud()
        sesion = self._verificar(s)
        mail.outbox.clear()
        r = self._firmar(s, sesion)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['folio'], s.folio)

        self.empresa.refresh_from_db()
        s.refresh_from_db()
        self.assertTrue(self.empresa.firma_imagen.startswith('data:image/png;base64,'))
        self.assertEqual((self.empresa.firma_firmante_nombre, self.empresa.firma_firmante_cargo,
                          self.empresa.firma_solicitud_id), ('MARÍA JOSÉ PÉREZ SOTO', 'GERENTA GENERAL', s.pk))
        # La empresa no tenía representante: queda con quien firmó.
        self.assertEqual((self.empresa.representante_legal, self.empresa.rut_representante),
                         ('MARÍA JOSÉ PÉREZ SOTO', RUT_REP))
        self.assertEqual(s.estado, 'FIRMADA')
        self.assertIn('autorizo que la firma que dibujo', s.declaracion)
        self.assertEqual((s.ip, len(s.huella_firma)), ('127.0.0.1', 64))
        self.assertEqual(s.firma_imagen, self.empresa.firma_imagen)

        registro = RegistroBitacora.objects.filter(cuenta=self.user, accion='FIRMA_EMPLEADOR').latest('id')
        self.assertIn(s.folio, registro.descripcion)
        self.assertEqual(registro.empresa, self.empresa)

        # Constancia al representante y, aparte, al titular; las dos con el PDF.
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), ['corp@test.com', 'maria.perez@correo.cl'])
        for m in mail.outbox:
            self.assertEqual(m.attachments[0][2], 'application/pdf')
            self.assertTrue(m.attachments[0][1].startswith(b'%PDF'))

        # Ya firmado: el enlace no vuelve a servir para firmar.
        self.assertEqual(self._firmar(s, sesion).status_code, 400)
        r = self.publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': RUT_REP}, format='json')
        self.assertEqual(r.status_code, 400)

        # Constancia: el representante con su sesión; el panel desde su lista.
        r = self.publico.get(f'/api/firma-empleador/{s.token}/constancia/', {'sesion': sesion})
        self.assertEqual((r.status_code, r['Content-Type']), (200, 'application/pdf'))
        self.assertEqual(self.publico.get(f'/api/firma-empleador/{s.token}/constancia/').status_code, 403)
        r = self.client.get(f'/api/firmas-empleador/{s.id}/pdf/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b'%PDF'))
        fila = self.client.get('/api/firmas-empleador/').data['empresas'][0]
        self.assertEqual((fila['firma']['configurada'], fila['firma']['a_distancia'], fila['firma']['folio']),
                         (True, True, s.folio))

    def test_no_reemplaza_el_representante_registrado(self):
        self.empresa.representante_legal, self.empresa.rut_representante = 'PEDRO SOTO', '9.876.543-3'
        self.empresa.save()
        self._pedir()
        s = self._solicitud()
        self.assertEqual(self._firmar(s, self._verificar(s)).status_code, 200)
        self.empresa.refresh_from_db()
        self.assertEqual((self.empresa.representante_legal, self.empresa.rut_representante),
                         ('PEDRO SOTO', '9.876.543-3'))
        self.assertEqual(self.empresa.firma_firmante_nombre, 'MARÍA JOSÉ PÉREZ SOTO')

    def test_dibujarla_en_el_panel_la_desliga_del_pedido(self):
        self._pedir()
        s = self._solicitud()
        self._firmar(s, self._verificar(s))
        r = self.client.patch(f'/api/empresas/{self.empresa.id}/configurar-firma/',
                              {'firma_imagen': _firma_png(), 'firma_firmante_nombre': 'Otra Persona',
                               'firma_firmante_cargo': 'Gerente'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.empresa.refresh_from_db()
        self.assertIsNone(self.empresa.firma_solicitud_id)
        self.assertEqual(self.client.get(f'/api/firmas-empleador/{s.id}/pdf/').status_code, 200)   # la evidencia queda

    def test_bitacora_del_panel(self):
        self._pedir()
        s = self._solicitud()
        self.client.post(f'/api/firmas-empleador/{s.id}/cancelar/')
        textos = list(RegistroBitacora.objects.filter(cuenta=self.user, accion='FIRMA_EMPLEADOR')
                      .order_by('id').values_list('descripcion', flat=True))
        self.assertEqual(textos, ['Pidió al representante legal registrar a distancia la firma del empleador',
                                  'Canceló el pedido de firma del empleador a distancia'])


class FirmaEmpleadorEquipoTests(APITestCase):
    """El equipo también pide la firma: con un módulo de documentos en "ver y gestionar", en sus empresas."""

    def setUp(self):
        cache.clear()
        self.user, self.cliente, self.plan, self.a = crear_usuario_completo('corpeq', '21.000.000-3', '76.000.555-K')
        self.plan.nombre, self.plan.nivel, self.plan.max_empresas = 'Corporativo', 4, 10
        self.plan.save()
        self.b = Empresa.objects.create(owner=self.user, nombre_legal='Empresa B', rut='77.777.777-7')

    def _equipo(self, permisos, rut='11.111.111-1', correo='carla@contadora.cl'):
        u = User.objects.create_user(f'equipo:{self.user.pk}:{rut}', password=CLAVE_EQUIPO)
        ue = UsuarioEquipo.objects.create(cuenta=self.user, usuario=u, rut=rut, nombres='Carla', apellidos='Díaz',
                                          correo=correo, permisos=permisos, estado='ACTIVO')
        ue.empresas.set([self.a])
        c = APIClient()
        r = c.post('/api/auth/equipo/ingresar/', {'rut': rut, 'clave': CLAVE_EQUIPO}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return c

    def _pedir(self, c, empresa):
        return c.post('/api/firmas-empleador/', {'empresa': empresa.id, 'nombre': 'Juan Rojas', 'rut': RUT_REP,
                                                 'email': 'juan@empresa.cl'}, format='json')

    def test_gestionar_pide_en_sus_empresas_y_recibe_la_constancia(self):
        c = self._equipo({'CONTRATOS': 'GESTIONAR'})
        empresas = c.get('/api/firmas-empleador/').data['empresas']
        self.assertEqual([e['id'] for e in empresas], [self.a.id])
        self.assertEqual(self._pedir(c, self.b).status_code, 404)
        r = self._pedir(c, self.a)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['pedida_por'], 'Carla Díaz')
        self.assertEqual(r.data['cargo'], 'Representante legal')
        self.assertIn('Carla Díaz', mail.outbox[-1].body)
        registro = RegistroBitacora.objects.filter(cuenta=self.user, accion='FIRMA_EMPLEADOR').latest('id')
        self.assertEqual(registro.actor_tipo, 'EQUIPO')

        s = SolicitudFirmaEmpleador.objects.latest('id')
        publico = APIClient()
        publico.post(f'/api/firma-empleador/{s.token}/codigo/', {'rut': RUT_REP}, format='json')
        sesion = publico.post(f'/api/firma-empleador/{s.token}/verificar/', {'codigo': _codigo(mail.outbox[-1])},
                              format='json').data['sesion']
        mail.outbox.clear()
        r = publico.post(f'/api/firma-empleador/{s.token}/firmar/', {'sesion': sesion, 'firma': _firma_png(),
                                                                    'acepto': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        # El titular y quien la pidió reciben el aviso (un correo, sin repetir), el representante el suyo.
        destinatarios = sorted(d for m in mail.outbox for d in m.to)
        self.assertEqual(destinatarios, ['carla@contadora.cl', 'corpeq@test.com', 'juan@empresa.cl'])
        self.assertEqual(c.get(f'/api/firmas-empleador/{s.id}/pdf/').status_code, 200)

    def test_solo_ver_consulta_pero_no_pide(self):
        c = self._equipo({'REMUNERACIONES': 'VER'})
        self.assertEqual(c.get('/api/firmas-empleador/').status_code, 200)
        self.assertEqual(self._pedir(c, self.a).status_code, 403)

    def test_sin_modulo_de_documentos_no_entra(self):
        c = self._equipo({'DIRECCION_TRABAJO': 'GESTIONAR'})
        self.assertEqual(c.get('/api/firmas-empleador/').status_code, 403)
        self.assertEqual(self._pedir(c, self.a).status_code, 403)
