"""Revisión del panel (septiembre 2026): aislamiento entre clientes, estados de
firma, acceso al documento público, cupos y prorrateo de la liquidación."""
import uuid
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import Contrato, Empleado, Empresa, Plan, SolicitudFirma
from .utiles import crear_empleado, crear_usuario_completo, indicadores_fijos


class FirmaAislamientoTests(APITestCase):
    def setUp(self):
        self.user_a, _, _, self.empresa_a = crear_usuario_completo('rev_a', '21.000.000-3', '76.000.555-2')
        self.user_b, _, _, self.empresa_b = crear_usuario_completo('rev_b', '11.111.111-1', '77.777.777-7')
        Empresa.objects.filter(pk=self.empresa_a.pk).update(firma_imagen='data:image/png;base64,AAAA')
        self.emp_a = crear_empleado(self.empresa_a, '12.345.678-5')
        Empleado.objects.filter(pk=self.emp_a.pk).update(email='a@correo.cl')
        self.emp_b = crear_empleado(self.empresa_b, '9.876.543-3')
        Contrato.objects.create(empleado=self.emp_a, tipo_contrato='INDEFINIDO', fecha_inicio='2024-01-01',
                                sueldo_base=600_000, cargo='Analista')
        self.contrato_b = Contrato.objects.create(empleado=self.emp_b, tipo_contrato='INDEFINIDO',
                                                  fecha_inicio='2024-01-01', sueldo_base=3_000_000, cargo='Gerente')
        self.client.force_authenticate(self.user_a)

    @patch('core.b2_client.subir_documento')
    def test_no_se_puede_enviar_a_firma_el_contrato_de_otro_cliente(self, subir):
        r = self.client.post('/api/firmas/solicitar/', {
            'empleado_id': self.emp_a.id, 'tipo_documento': 'CONTRATO', 'contrato_id': self.contrato_b.id,
        }, format='json')
        self.assertEqual(r.status_code, 400)
        subir.assert_not_called()
        self.assertFalse(SolicitudFirma.objects.exists())

    @patch('core.b2_client.subir_documento')
    def test_un_documento_no_tiene_dos_firmas_vivas(self, _subir):
        datos = {'empleado_id': self.emp_a.id, 'tipo_documento': 'CONTRATO'}
        self.assertEqual(self.client.post('/api/firmas/solicitar/', datos, format='json').status_code, 201)
        r = self.client.post('/api/firmas/solicitar/', datos, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('en curso', r.data['error'])
        # Vencida, sí se puede enviar de nuevo.
        SolicitudFirma.objects.update(expira_en=timezone.now() - timezone.timedelta(hours=1))
        self.assertEqual(self.client.post('/api/firmas/solicitar/', datos, format='json').status_code, 201)
        self.assertEqual(SolicitudFirma.objects.filter(estado='EXPIRADO').count(), 1)

    @patch('core.b2_client.subir_documento')
    def test_contrato_firmado_se_cambia_con_anexo(self, _subir):
        contrato = Contrato.objects.get(empleado=self.emp_a)
        SolicitudFirma.objects.create(empleado=self.emp_a, empresa=self.empresa_a, contrato=contrato,
                                      tipo_documento='CONTRATO', estado='FIRMADO')
        r = self.client.patch(f'/api/contratos/{contrato.id}/', {'sueldo_base': 900_000}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('anexo', r.data['error'])
        contrato.refresh_from_db()
        self.assertEqual(contrato.sueldo_base, 600_000)


class EstadosFirmaTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('rev_estados', '21.000.000-3', '76.000.555-2')
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        self.client.force_authenticate(self.user)

    def _solicitud(self, **extra):
        datos = {'empleado': self.emp, 'empresa': self.empresa, 'tipo_documento': 'CONTRATO',
                 'expira_en': timezone.now() + timezone.timedelta(days=1), **extra}
        return SolicitudFirma.objects.create(**datos)

    def test_listado_marca_vencidas_y_libera_procesando_colgadas(self):
        vencida = self._solicitud(expira_en=timezone.now() - timezone.timedelta(minutes=1))
        colgada = self._solicitud(estado='PROCESANDO')
        SolicitudFirma.objects.filter(pk=colgada.pk).update(
            actualizado_en=timezone.now() - timezone.timedelta(minutes=30))
        en_curso = self._solicitud(estado='PROCESANDO')
        self.client.get('/api/firmas/')
        estados = dict(SolicitudFirma.objects.values_list('pk', 'estado'))
        self.assertEqual(estados[vencida.pk], 'EXPIRADO')
        self.assertEqual(estados[colgada.pk], 'PENDIENTE')
        self.assertEqual(estados[en_curso.pk], 'PROCESANDO')

    def test_no_se_reenvia_una_vencida(self):
        s = self._solicitud(expira_en=timezone.now() - timezone.timedelta(minutes=1))
        r = self.client.post(f'/api/firmas/{s.id}/reenviar/')
        self.assertEqual(r.status_code, 400)
        self.assertIn('venció', r.data['error'])


class DocumentoPublicoTests(APITestCase):
    def setUp(self):
        _, _, _, empresa = crear_usuario_completo('rev_doc', '21.000.000-3', '76.000.555-2')
        emp = crear_empleado(empresa, '12.345.678-5')
        self.sesion = uuid.uuid4()
        self.solicitud = SolicitudFirma.objects.create(
            empleado=emp, empresa=empresa, tipo_documento='LIQUIDACION', b2_key_temporal='pendientes/x.pdf',
            sesion_token_trabajador=self.sesion, expira_en=timezone.now() + timezone.timedelta(days=1))
        self.url = f'/api/firma-publica/{self.solicitud.token}/documento/'

    @patch('core.b2_client.descargar_documento', return_value=b'%PDF-x')
    def test_el_enlace_solo_no_muestra_el_documento(self, descargar):
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.get(self.url, {'sesion': str(uuid.uuid4())}).status_code, 403)
        descargar.assert_not_called()
        r = self.client.get(self.url, {'sesion': str(self.sesion)})
        self.assertEqual((r.status_code, r.content), (200, b'%PDF-x'))

    def test_limite_por_enlace_y_no_por_ip(self):
        """Muchos trabajadores de un mismo local firman desde la misma IP."""
        _, _, _, empresa = crear_usuario_completo('rev_doc2', '11.111.111-1', '77.777.777-7')
        for i in range(30):
            emp = crear_empleado(empresa, f'{10_000_000 + i}-0')
            s = SolicitudFirma.objects.create(empleado=emp, empresa=empresa, tipo_documento='CONTRATO',
                                              expira_en=timezone.now() + timezone.timedelta(days=1))
            for _ in range(4):
                self.assertEqual(self.client.get(f'/api/firma-publica/{s.token}/').status_code, 200)


class CupoEmpresasTests(APITestCase):
    def test_reactivar_respeta_el_maximo_de_empresas(self):
        user, _, plan, empresa = crear_usuario_completo('rev_cupo', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(user)
        Plan.objects.filter(pk=plan.pk).update(max_empresas=1)
        otra = Empresa.objects.create(owner=user, rut='77.777.777-7', nombre_legal='OTRA', activo=False)
        r = self.client.post(f'/api/empresas/{otra.id}/reactivar/')
        self.assertEqual(r.status_code, 400)
        Empresa.objects.filter(pk=empresa.pk).update(activo=False)
        self.assertEqual(self.client.post(f'/api/empresas/{otra.id}/reactivar/').status_code, 200)


@indicadores_fijos
class ProrrateoIngresoTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('rev_pro', '21.000.000-3', '76.000.555-2')
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        Empleado.objects.filter(pk=self.emp.pk).update(fecha_ingreso='2026-08-15')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2026-08-15',
                                sueldo_base=900_000, cargo='Analista')
        self.client.force_authenticate(self.user)

    def _simular(self, mes):
        return self.client.post('/api/liquidaciones/simular/', {
            'empleado': self.emp.id, 'mes': mes, 'anio': 2026, 'dias_trabajados': 30}, format='json')

    def test_ingreso_a_mitad_de_mes_no_paga_30_dias(self, *_):
        r = self._simular(8)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data['dias_no_contratados'], r.data['dias_trabajados']), (14, 16))
        self.assertEqual(self._simular(9).data['dias_no_contratados'], 0)

    def test_periodo_anterior_al_ingreso_se_rechaza(self, *_):
        r = self._simular(7)
        self.assertEqual(r.status_code, 400)
        self.assertIn('empieza', r.data['error'])


class ExtractorContratoTests(APITestCase):
    """Lectura de contratos escaneados con Gemini (simulado)."""

    def _respuesta(self, texto):
        return type('R', (), {'text': texto})()

    def test_si_el_modelo_no_existe_usa_el_de_respaldo_y_valida_el_rut(self):
        from google.genai import errors
        from django.test import override_settings
        from ..extractor_contrato import extraer_campos_contrato
        llamadas = []

        def generar(model, **_):
            llamadas.append(model)
            if model == 'modelo-retirado':
                raise errors.ClientError(404, {'error': {'code': 404, 'message': 'no existe', 'status': 'NOT_FOUND'}})
            return self._respuesta('{"rut": "12345678-5", "sueldo_base": 900000, "extra": "x"}')

        with override_settings(GEMINI_API_KEY='k', GEMINI_MODEL='modelo-retirado'), \
                patch('core.extractor_contrato.genai.Client') as cliente:
            cliente.return_value.models.generate_content.side_effect = generar
            campos = extraer_campos_contrato(b'%PDF', 'application/pdf')
        self.assertEqual(llamadas, ['modelo-retirado', 'gemini-2.5-flash'])
        self.assertEqual((campos['rut'], campos['sueldo_base']), ('12.345.678-5', 900000))
        self.assertNotIn('extra', campos)

        with override_settings(GEMINI_API_KEY='k'), patch('core.extractor_contrato.genai.Client') as cliente:
            cliente.return_value.models.generate_content.return_value = self._respuesta('{"rut": "12345678-9"}')
            self.assertIsNone(extraer_campos_contrato(b'%PDF', 'application/pdf')['rut'])   # DV incorrecto

    def test_sin_clave_el_mensaje_no_es_tecnico(self):
        from django.test import override_settings
        user, _, _, empresa = crear_usuario_completo('rev_ia', '21.000.000-3', '76.000.555-2')
        emp = crear_empleado(empresa, '12.345.678-5')
        self.client.force_authenticate(user)
        from django.core.files.uploadedfile import SimpleUploadedFile
        archivo = SimpleUploadedFile('c.pdf', b'%PDF-1.4', content_type='application/pdf')
        with override_settings(GEMINI_API_KEY=None):
            r = self.client.post(f'/api/empleados/{emp.id}/digitalizar_contrato/', {'file': archivo}, format='multipart')
        self.assertEqual(r.status_code, 502)
        self.assertNotIn('GEMINI', r.data['error'])
