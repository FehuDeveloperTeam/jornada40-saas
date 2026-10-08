"""Firma electrónica: concurrencia, folio, comprobante y verificación de identidad."""
import uuid
from unittest.mock import patch
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase
from ..models import CorreoTrabajador, CuentaTrabajador, Empleado, OTPFirma, SolicitudFirma

from .utiles import crear_empleado, crear_usuario_completo, confirmar_identidad


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

    @patch('core.b2_client.eliminar_documento')
    @patch('core.b2_client.subir_documento')
    @patch('core.pdf_firma.agregar_certificado_firma')
    @patch('core.b2_client.descargar_documento')
    def test_segunda_peticion_de_firma_es_rechazada(self, mock_descargar, mock_certificado, mock_subir, mock_eliminar):
        mock_descargar.return_value = b'%PDF-original'
        mock_certificado.return_value = b'%PDF-firmado'

        payload = {
            'sesion_token': str(self.sesion_token),
            'firma_trabajador': 'data:image/png;base64,aGVsbG8=',
            'acepto': True,
        }
        url = f'/api/firma-publica/{self.solicitud.token}/firmar/'

        resp1 = self.client.post(url, payload, format='json')
        self.assertEqual(resp1.status_code, 200)

        # Segunda petición (simula doble clic) sobre la misma solicitud ya FIRMADO
        resp2 = self.client.post(url, payload, format='json')
        self.assertEqual(resp2.status_code, 400)

        self.solicitud.refresh_from_db()
        self.assertEqual(self.solicitud.estado, 'FIRMADO')

    @patch('core.b2_client.subir_documento', side_effect=Exception('B2 caído'))
    @patch('core.pdf_firma.agregar_certificado_firma')
    @patch('core.b2_client.descargar_documento')
    def test_falla_en_b2_revierte_a_pendiente(self, mock_descargar, mock_certificado, mock_subir):
        mock_descargar.return_value = b'%PDF-original'
        mock_certificado.return_value = b'%PDF-firmado'

        url = f'/api/firma-publica/{self.solicitud.token}/firmar/'
        resp = self.client.post(url, {
            'sesion_token': str(self.sesion_token),
            'firma_trabajador': 'data:image/png;base64,aGVsbG8=',
            'acepto': True,
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


class ComprobanteFirmaTests(APITestCase):
    """Paso C: RUT antes del código, tope de códigos, folio y huellas SHA-256."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo(
            'comprobante_owner', '15.555.555-5', '76.555.444-3')
        self.empleado = crear_empleado(self.empresa, '12.345.678-5')
        self.empleado.email = 'trabajador@example.com'
        self.empleado.save()

    def _solicitud(self, **extra):
        datos = dict(empleado=self.empleado, empresa=self.empresa, tipo_documento='CONTRATO', estado='PENDIENTE',
                     b2_key_temporal='pendientes/x.pdf', email_firmante='trabajador@example.com',
                     expira_en=timezone.now() + timezone.timedelta(days=1))
        datos.update(extra)
        return SolicitudFirma.objects.create(**datos)

    @patch('core.views.firma_publica._enviar_email_otp')
    def test_codigo_exige_rut_del_trabajador(self, _mail):
        s = self._solicitud()
        url = f'/api/firma-publica/{s.token}/solicitar-otp/'
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 400)
        r = self.client.post(url, {'rut': '11.111.111-1'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('RUT no coincide', r.data['error'])
        self.assertEqual(self.client.post(url, {'rut': '123456785'}, format='json').status_code, 200)

    @patch('core.views.firma_publica._enviar_email_otp')
    def test_tope_de_codigos_por_hora(self, _mail):
        from core.models import OTPFirma
        s = self._solicitud()
        antes = timezone.now() - timezone.timedelta(minutes=5)
        for _ in range(5):
            o = OTPFirma.objects.create(solicitud=s, codigo_hash=OTPFirma.huella(s.token, '000000'), email_destino='x@example.com')
            OTPFirma.objects.filter(id=o.id).update(creado_en=antes)
        r = self.client.post(f'/api/firma-publica/{s.token}/solicitar-otp/', {'rut': '12.345.678-5'}, format='json')
        self.assertEqual(r.status_code, 429)

    @patch('core.views.firma_publica._enviar_emails_firma_completada')
    @patch('core.b2_client.eliminar_documento')
    @patch('core.b2_client.subir_documento')
    @patch('core.b2_client.descargar_documento')
    def test_firma_asigna_folio_correlativo_y_huellas(self, descargar, _subir, _eliminar, _mails):
        import hashlib, io
        from pypdf import PdfReader
        from reportlab.pdfgen import canvas
        buf = io.BytesIO(); c = canvas.Canvas(buf); c.drawString(100, 700, 'Contrato'); c.save()
        original = buf.getvalue()
        descargar.return_value = original
        firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        folios = []
        for _ in range(2):
            tok = uuid.uuid4()
            s = self._solicitud(sesion_token_trabajador=tok)
            r = self.client.post(f'/api/firma-publica/{s.token}/firmar/',
                                 {'sesion_token': str(tok), 'firma_trabajador': firma, 'acepto': True}, format='json')
            self.assertEqual(r.status_code, 200, r.data)
            folios.append(r.data['folio'])
            s.refresh_from_db()
            self.assertEqual(s.hash_original, hashlib.sha256(original).hexdigest())
            self.assertEqual(len(s.hash_firmado), 64)
            self.assertEqual(r.data['hash_firmado'], s.hash_firmado)
        año = timezone.localdate().year
        self.assertEqual(folios, [f'J40-{año}-000001', f'J40-{año}-000002'])
        # El PDF subido es el que corresponde a la huella, y su certificado trae folio y huella original.
        subido = _subir.call_args[0][0]
        self.assertEqual(hashlib.sha256(subido).hexdigest(), s.hash_firmado)
        texto = PdfReader(io.BytesIO(subido)).pages[-1].extract_text()
        self.assertIn(folios[1], texto)
        self.assertIn(s.hash_original, texto.replace('\n', ''))
        self.assertIn('hora de Chile', texto)
        # El enlace ya firmado muestra el comprobante.
        info = self.client.get(f'/api/firma-publica/{s.token}/').data
        self.assertEqual(info['folio'], folios[1])


class VerificacionDeIdentidadTests(APITestCase):
    """Ord. DT N°136 y N°79 (2025): el código o la clave solo verifican la identidad;
    firma la aceptación expresa y el trazo del trabajador. El código se guarda como
    huella y la clave del portal sirve solo si es de quien verificó este correo."""

    FIRMA = ('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kg'
             'AAAABJRU5ErkJggg==')

    def setUp(self):
        cache.clear()   # límites de intentos de la firma pública (misma IP)
        _, _, _, self.empresa = crear_usuario_completo('verif_owner', '15.555.555-5', '76.555.444-3')
        self.empleado = crear_empleado(self.empresa, '12.345.678-5')
        Empleado.objects.filter(pk=self.empleado.pk).update(email='trabajador@example.com')
        self.s = SolicitudFirma.objects.create(
            empleado=self.empleado, empresa=self.empresa, tipo_documento='CONTRATO', estado='PENDIENTE',
            b2_key_temporal='pendientes/x.pdf', email_firmante='trabajador@example.com',
            expira_en=timezone.now() + timezone.timedelta(days=1))
        self.base = f'/api/firma-publica/{self.s.token}'

    def _cuenta_con_clave(self, correo='trabajador@example.com', clave='Mi-Clave-2026'):
        cuenta = CuentaTrabajador.objects.create(rut='123456785')
        cuenta.fijar_clave(clave)
        cuenta.save()
        CorreoTrabajador.objects.create(cuenta=cuenta, email=correo)
        return cuenta

    def _con_clave(self, clave='Mi-Clave-2026', rut='12.345.678-5'):
        return self.client.post(f'{self.base}/verificar-clave/', {'rut': rut, 'clave': clave}, format='json')

    @patch('core.views.firma_publica._enviar_email_otp')
    def test_el_codigo_se_guarda_solo_como_huella(self, enviar):
        self.assertEqual(self.client.post(f'{self.base}/solicitar-otp/', {'rut': '12.345.678-5'},
                                          format='json').status_code, 200)
        codigo = enviar.call_args[0][2]
        otp = OTPFirma.objects.get(solicitud=self.s)
        self.assertEqual(otp.codigo_hash, OTPFirma.huella(self.s.token, codigo))
        self.assertNotEqual(otp.codigo_hash, codigo)
        self.assertNotIn('codigo', [f.name for f in OTPFirma._meta.get_fields()])
        malo = '000000' if codigo != '000000' else '111111'
        self.assertEqual(self.client.post(f'{self.base}/verificar-otp/', {'codigo': malo}, format='json').status_code, 400)
        r = self.client.post(f'{self.base}/verificar-otp/', {'codigo': codigo}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.s.refresh_from_db()
        self.assertEqual((str(self.s.sesion_token_trabajador), self.s.verificacion),
                         (r.data['sesion_token'], 'CODIGO_CORREO'))

    def test_la_clave_del_portal_confirma_la_identidad(self):
        self.assertFalse(self.client.get(f'{self.base}/').data['clave_disponible'])
        self._cuenta_con_clave()
        self.assertTrue(self.client.get(f'{self.base}/').data['clave_disponible'])
        self.assertEqual(self._con_clave('otra-clave').status_code, 400)
        self.assertEqual(self._con_clave(rut='11.111.111-1').status_code, 400)
        r = self._con_clave()
        self.assertEqual(r.status_code, 200, r.data)
        self.s.refresh_from_db()
        self.assertEqual((self.s.verificacion, self.s.intentos_clave), ('CLAVE_PORTAL', 0))

    def test_la_clave_de_otra_persona_con_el_mismo_rut_no_sirve(self):
        # Cuenta del mismo RUT que verificó otro correo (p. ej. una ficha creada por otro empleador).
        self._cuenta_con_clave(correo='otro@example.com', clave='Otra-Clave-2026')
        self.assertFalse(self.client.get(f'{self.base}/').data['clave_disponible'])
        self.assertEqual(self._con_clave('Otra-Clave-2026').status_code, 400)

    def test_tope_de_intentos_con_la_clave(self):
        self._cuenta_con_clave()
        for _ in range(5):
            self._con_clave('mala')
        self.assertEqual(self._con_clave().status_code, 429)
        SolicitudFirma.objects.filter(pk=self.s.pk).update(
            ultimo_intento_clave=timezone.now() - timezone.timedelta(hours=2))
        self.assertEqual(self._con_clave().status_code, 200)

    @patch('core.views.firma_publica._enviar_emails_firma_completada')
    @patch('core.b2_client.eliminar_documento')
    @patch('core.b2_client.subir_documento')
    @patch('core.b2_client.descargar_documento')
    def test_firmar_exige_aceptacion_y_el_certificado_dice_como_se_verifico(self, descargar, subir, _e, _m):
        import io
        from pypdf import PdfReader
        from reportlab.pdfgen import canvas
        buf = io.BytesIO()
        c = canvas.Canvas(buf)
        c.drawString(100, 700, 'Contrato')
        c.save()
        descargar.return_value = buf.getvalue()
        self._cuenta_con_clave()
        sesion = self._con_clave().data['sesion_token']
        r = self.client.post(f'{self.base}/firmar/', {'sesion_token': sesion, 'firma_trabajador': self.FIRMA},
                             format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('aceptar el contenido', r.data['error'])
        r = self.client.post(f'{self.base}/firmar/', {'sesion_token': sesion, 'firma_trabajador': self.FIRMA,
                                                      'acepto': True}, format='json')
        self.assertEqual((r.status_code, r.data['verificacion']), (200, 'CLAVE_PORTAL'))
        texto = PdfReader(io.BytesIO(subir.call_args[0][0])).pages[-1].extract_text()
        for frase in ('IDENTIDAD VERIFICADA CON', 'Clave personal del portal del trabajador', 'ACTO DE FIRMA',
                      'expresa del contenido y trazo de firma del trabajador', 'solo verifican la identidad'):
            self.assertIn(frase, texto)
        self.assertEqual(self.client.get(f'{self.base}/').data['verificacion'], 'CLAVE_PORTAL')


class DocumentoFirmadoTests(APITestCase):
    """Un documento firmado se descarga siempre en su versión firmada (la que vale ante la DT)."""

    def setUp(self):
        from ..models import Empleado, Empresa, Liquidacion
        self.user, _, _, self.empresa = crear_usuario_completo('firmado_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        confirmar_identidad(self.client, self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        Empleado.objects.filter(pk=self.emp.pk).update(email='t@correo.cl')
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA')
        self.liq = Liquidacion.objects.create(empleado=self.emp, mes=8, anio=2026, total_imponible=1000,
                                              sueldo_liquido=900, total_haberes=1000)

    @patch('core.b2_client.descargar_documento', return_value=b'%PDF-firmado')
    def test_liquidacion_firmada_se_descarga_firmada(self, _descargar):
        url = f'/api/liquidaciones/{self.liq.id}/generar_pdf/'
        r = self.client.get(url)
        self.assertEqual(r['X-Documento-Firmado'], '0')   # sin firma: la emitida
        SolicitudFirma.objects.create(empleado=self.emp, empresa=self.empresa, liquidacion=self.liq,
                                      tipo_documento='LIQUIDACION', estado='FIRMADO',
                                      b2_key_firmado='firmados/x.pdf', firmado_en=timezone.now())
        r = self.client.get(url)
        self.assertEqual((r.status_code, r.content, r['X-Documento-Firmado']), (200, b'%PDF-firmado', '1'))
        self.assertIn('_firmado.pdf', r['Content-Disposition'])

    @patch('core.b2_client.subir_documento')
    def test_carta_de_termino_se_envia_a_firma(self, *_):
        from ..models import DocumentoLegal, Plan
        Plan.objects.filter(pk=self.user.perfil_cliente.suscripcion_activa.plan_id).update(nivel=2)
        doc = DocumentoLegal.objects.create(empleado=self.emp, tipo='DESPIDO', causal_articulo='161_1',
                                            hechos='Reestructuración', fecha_ultimo_dia='2026-09-30',
                                            fecha_emision='2026-09-01')
        r = self.client.post('/api/firmas/solicitar/', {'empleado_id': self.emp.id, 'tipo_documento': 'DESPIDO',
                                                        'documento_legal_id': doc.id}, format='json')
        self.assertNotIn('attribute', str(getattr(r, 'data', '')))
        self.assertIn(r.status_code, (200, 201), getattr(r, 'data', None))


class EnvioMasivoLiquidacionesTests(APITestCase):
    """Remuneraciones envía a firma todas las liquidaciones del período de una vez."""

    def setUp(self):
        from ..models import Empleado, Empresa, Liquidacion
        self.user, _, _, self.empresa = crear_usuario_completo('masivo_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        confirmar_identidad(self.client, self.user)
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA')
        self.con_correo = crear_empleado(self.empresa, '12.345.678-5')
        self.sin_correo = crear_empleado(self.empresa, '9.876.543-3')
        Empleado.objects.filter(pk=self.con_correo.pk).update(email='t@correo.cl')
        for e in (self.con_correo, self.sin_correo):
            Liquidacion.objects.create(empleado=e, mes=8, anio=2026, total_imponible=1000, sueldo_liquido=900, total_haberes=1000)

    @patch('core.b2_client.subir_documento')
    def test_envia_las_pendientes_y_explica_las_omitidas(self, _subir):
        datos = {'empresa': self.empresa.id, 'mes': 8, 'anio': 2026}
        r = self.client.post('/api/firmas/solicitar_liquidaciones/', datos, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['enviadas'], 1)
        self.assertEqual(len(r.data['omitidas']), 1)
        self.assertIn('correo', r.data['omitidas'][0]['motivo'])
        # Repetir no duplica la que ya está pendiente.
        r = self.client.post('/api/firmas/solicitar_liquidaciones/', datos, format='json')
        self.assertEqual(r.data['enviadas'], 0)
        self.assertEqual(SolicitudFirma.objects.filter(tipo_documento='LIQUIDACION').count(), 1)

    @patch('core.b2_client.subir_documento')
    @patch('core.views.firmas.SolicitudFirmaViewSet._enviar_email_firma', side_effect=RuntimeError('Resend 403'))
    def test_informa_cuando_el_correo_no_sale(self, *_):
        """La solicitud queda creada (se puede reenviar), pero el panel sabe que el correo falló."""
        r = self.client.post('/api/firmas/solicitar_liquidaciones/',
                             {'empresa': self.empresa.id, 'mes': 8, 'anio': 2026}, format='json')
        self.assertEqual(r.data['enviadas'], 1)
        self.assertEqual(len(r.data['correo_fallido']), 1)
        self.assertEqual(SolicitudFirma.objects.get().estado, 'PENDIENTE')

    @patch('core.b2_client.subir_documento')
    @patch('core.views.firmas.SolicitudFirmaViewSet._enviar_email_firma')
    def test_envio_individual_informa_si_salio_el_correo(self, enviar, _subir):
        from ..models import Liquidacion
        liq = Liquidacion.objects.get(empleado=self.con_correo)
        datos = {'empleado_id': self.con_correo.id, 'tipo_documento': 'LIQUIDACION', 'liquidacion_id': liq.id}
        r = self.client.post('/api/firmas/solicitar/', datos, format='json')
        self.assertEqual((r.status_code, r.data['correo_enviado']), (201, True))
        SolicitudFirma.objects.all().update(estado='CANCELADO')
        enviar.side_effect = RuntimeError('Resend 403')
        r = self.client.post('/api/firmas/solicitar/', datos, format='json')
        self.assertEqual((r.status_code, r.data['correo_enviado']), (201, False))


class FirmaDelEmpleadorTests(APITestCase):
    """Cada envío a firma queda vinculado al empleador que confirmó su identidad con su clave."""

    def setUp(self):
        from ..models import Empleado, Empresa, Liquidacion
        self.user, _, _, self.empresa = crear_usuario_completo('emisor_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        Empleado.objects.filter(pk=self.emp.pk).update(email='t@correo.cl')
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA')
        self.liq = Liquidacion.objects.create(empleado=self.emp, mes=8, anio=2026, total_imponible=1000,
                                              sueldo_liquido=900, total_haberes=1000)

    def _enviar(self):
        return self.client.post('/api/firmas/solicitar/', {'empleado_id': self.emp.id, 'tipo_documento': 'LIQUIDACION',
                                                           'liquidacion_id': self.liq.id}, format='json')

    @patch('core.b2_client.subir_documento')
    @patch('core.views.firmas.SolicitudFirmaViewSet._enviar_email_firma')
    def test_sin_confirmar_pide_la_clave_y_con_ella_registra_al_emisor(self, *_):
        r = self._enviar()
        self.assertEqual((r.status_code, r.data['codigo']), (428, 'confirmar_identidad'))
        self.assertEqual(self.client.post('/api/firmas/solicitar_liquidaciones/',
                                          {'empresa': self.empresa.id, 'mes': 8, 'anio': 2026},
                                          format='json').status_code, 428)
        self.assertEqual(self.client.post('/api/firmas/confirmar_identidad/', {'clave': 'otra'},
                                          format='json').status_code, 400)
        r = self.client.post('/api/firmas/confirmar_identidad/', {'clave': 'pass1234'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('jornada40-confirmacion', r.cookies)
        r = self._enviar()
        self.assertEqual(r.status_code, 201, r.data)
        s = SolicitudFirma.objects.get(pk=r.data['id'])
        self.assertEqual((s.origen, s.emisor_id), ('PANEL', self.user.id))
        self.assertIsNotNone(s.emisor_confirmado_en)
        from ..views.firma_publica import filas_emision
        etiquetas = [e for e, _ in filas_emision(s)]
        self.assertEqual(etiquetas, ['EMITIDO POR EL EMPLEADOR', 'IDENTIDAD CONFIRMADA CON CLAVE'])

    def test_la_confirmacion_de_otro_usuario_no_sirve(self):
        otro, _, _, _ = crear_usuario_completo('emisor_otro', '11.111.111-1', '77.777.777-7')
        confirmar_identidad(self.client, otro)
        self.assertEqual(self._enviar().status_code, 428)

    def test_confirmacion_vencida(self):
        from django.core import signing
        from ..views.firmas import COOKIE_CONFIRMACION, _SAL_CONFIRMACION
        with patch('django.core.signing.time.time', return_value=0):
            valor = signing.dumps({'u': self.user.id, 'en': timezone.now().isoformat()}, salt=_SAL_CONFIRMACION)
        self.client.cookies[COOKIE_CONFIRMACION] = valor
        self.assertEqual(self._enviar().status_code, 428)
