"""Firma electrónica: concurrencia, folio y comprobante."""
import uuid
from unittest.mock import patch
from django.utils import timezone
from rest_framework.test import APITestCase
from ..models import SolicitudFirma

from .utiles import crear_empleado, crear_usuario_completo


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
            o = OTPFirma.objects.create(solicitud=s, codigo='000000', email_destino='x@example.com')
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
                                 {'sesion_token': str(tok), 'firma_trabajador': firma}, format='json')
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


class DocumentoFirmadoTests(APITestCase):
    """Un documento firmado se descarga siempre en su versión firmada (la que vale ante la DT)."""

    def setUp(self):
        from ..models import Empleado, Empresa, Liquidacion
        self.user, _, _, self.empresa = crear_usuario_completo('firmado_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
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
