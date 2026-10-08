"""Reglamento interno: plantilla por rubro, versiones, plazos, remisión y constancias de recepción."""
import datetime
import io
import re
import shutil
import tempfile
import zipfile
from unittest.mock import patch

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from pypdf import PdfReader
from rest_framework.test import APITestCase

from ..models import Contrato, DocumentoLaboral, Empleado, Empresa, ReglamentoInterno, SolicitudFirma
from ..reglamento_plantilla import RUBROS
from ..views.base import _html_a_pdf_bytes
from .utiles import confirmar_identidad, crear_empleado, crear_usuario_completo

MEDIA = tempfile.mkdtemp()


def _pdf(texto='Reglamento de prueba'):
    return _html_a_pdf_bytes(f'<p>{texto}</p>', 'prueba')


@override_settings(MEDIA_ROOT=MEDIA)
class ReglamentoTests(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.user, _, self.plan, self.empresa = crear_usuario_completo('regl', '21.000.000-3', '76.000.555-K')
        self.client.force_authenticate(self.user)
        self.ana = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana', apellido='Rojas')
        self.luis = crear_empleado(self.empresa, '9.876.543-3', nombres='Luis', apellido='Soto')
        Empleado.objects.filter(pk=self.ana.pk).update(email='ana@correo.cl')

    def _subir(self, **extra):
        datos = {'empresa': self.empresa.id, 'tipo': 'RIHS',
                 'archivo': SimpleUploadedFile('r.pdf', _pdf(), content_type='application/pdf'), **extra}
        return self.client.post('/api/reglamentos/', datos, format='multipart')

    def test_plantillas_de_todos_los_rubros(self):
        for rubro in RUBROS:
            r = self.client.get('/api/reglamentos/plantilla/', {'empresa': self.empresa.id, 'rubro': rubro})
            self.assertEqual(r.status_code, 200, rubro)
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                texto = z.read('word/document.xml').decode()
            self.assertIn('HIGIENE Y SEGURIDAD', texto)
            self.assertIn('GUÍA', texto)
            self.assertIn('LEY 21.643', texto)
            self.assertIn('w:highlight', texto)                    # los [COMPLETAR] van en amarillo
        pdf = self.client.get('/api/reglamentos/plantilla/', {'empresa': self.empresa.id, 'rubro': 'CONSTRUCCION',
                                                              'formato': 'pdf'})
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        self.assertEqual(self.client.get('/api/reglamentos/plantilla/', {'empresa': self.empresa.id,
                                                                         'rubro': 'OTRO'}).status_code, 400)

    def test_con_diez_trabajadores_es_riohs(self):
        for n in range(8):
            crear_empleado(self.empresa, f'{10_000_000 + n}-{"0123456789K"[0]}')
        r = self.client.get('/api/reglamentos/plantilla/', {'empresa': self.empresa.id, 'rubro': 'COMERCIO'})
        with zipfile.ZipFile(io.BytesIO(r.content)) as z:
            texto = z.read('word/document.xml').decode()
        self.assertIn('REGLAMENTO INTERNO DE ORDEN, HIGIENE Y SEGURIDAD', texto)
        self.assertIn('Art. 32 inc. 4°', texto)                     # compensación de horas extra en el RIOHS
        estado = self.client.get('/api/reglamentos/', {'empresa': self.empresa.id}).data
        self.assertEqual(estado['tipo_sugerido'], 'RIOHS')
        self.assertTrue(any('Orden, Higiene y Seguridad' in a for a in estado['avisos']))

    def test_versiones_plazos_y_remision(self):
        hace_40 = timezone.localdate() - datetime.timedelta(days=40)
        r = self._subir(publicado_en=hace_40.isoformat())
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['vigente_desde'], (hace_40 + datetime.timedelta(days=30)).isoformat())
        estado = self.client.get('/api/reglamentos/', {'empresa': self.empresa.id}).data
        self.assertTrue(any('Venció el plazo' in a for a in estado['avisos']))
        self.client.post(f"/api/reglamentos/{r.data['id']}/remision/", {'destino': 'DT'}, format='json')
        self.client.post(f"/api/reglamentos/{r.data['id']}/remision/", {'destino': 'SALUD'}, format='json')
        estado = self.client.get('/api/reglamentos/', {'empresa': self.empresa.id}).data
        self.assertFalse(any('Venció el plazo' in a for a in estado['avisos']))
        segunda = self._subir()
        self.assertEqual(segunda.data['version'], 2)
        self.assertEqual(ReglamentoInterno.objects.filter(activo=True).count(), 1)
        pdf = self.client.get(f"/api/reglamentos/{segunda.data['id']}/pdf/")
        self.assertTrue(pdf.content.startswith(b'%PDF'))

    def test_validaciones_y_plan(self):
        falso = SimpleUploadedFile('r.pdf', b'no es pdf', content_type='application/pdf')
        r = self.client.post('/api/reglamentos/', {'empresa': self.empresa.id, 'tipo': 'RIHS', 'archivo': falso},
                             format='multipart')
        self.assertEqual(r.status_code, 400)
        roto = SimpleUploadedFile('r.pdf', b'%PDF-1.4 roto', content_type='application/pdf')
        r = self.client.post('/api/reglamentos/', {'empresa': self.empresa.id, 'tipo': 'RIHS', 'archivo': roto},
                             format='multipart')
        self.assertIn('No pudimos leer el PDF', r.data['error'])
        manana = (timezone.localdate() + datetime.timedelta(days=1)).isoformat()
        self.assertEqual(self._subir(publicado_en=manana).status_code, 400)
        self.plan.nivel = 2
        self.plan.save()
        self.assertEqual(self._subir().status_code, 403)
        otro, _, _, _ = crear_usuario_completo('regl_b', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get('/api/reglamentos/', {'empresa': self.empresa.id}).status_code, 404)

    @patch('core.b2_client.subir_documento')
    def test_entrega_con_constancia_y_reglamento_adjunto(self, subir):
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA')
        reg = self._subir().data
        url = f"/api/reglamentos/{reg['id']}/entregar/"
        self.assertEqual(self.client.post(url, {}, format='json').status_code, 428)     # confirmar identidad
        confirmar_identidad(self.client, self.user)
        r = self.client.post(url, {}, format='json')
        self.assertEqual(r.data['enviadas'], 1)
        self.assertEqual([o['nombre'] for o in r.data['omitidas']], ['Luis Soto'])        # sin correo
        solicitud = SolicitudFirma.objects.get(tipo_documento='REGLAMENTO')
        pdf = subir.call_args[0][0]
        paginas = PdfReader(io.BytesIO(pdf)).pages
        self.assertEqual(len(paginas), 2)                          # constancia + reglamento
        self.assertIn('Reglamento de prueba', paginas[-1].extract_text())
        self.assertEqual(solicitud.documento_laboral.reglamento_id, reg['id'])
        # Reenviar no duplica lo que ya está en curso.
        self.assertEqual(self.client.post(url, {}, format='json').data['enviadas'], 0)
        SolicitudFirma.objects.filter(pk=solicitud.pk).update(estado='FIRMADO', firmado_en=timezone.now())
        estado = self.client.get('/api/reglamentos/', {'empresa': self.empresa.id}).data
        self.assertEqual((estado['entrega']['firmados'], estado['entrega']['total']), (1, 2))
        self.assertEqual(DocumentoLaboral.objects.filter(tipo='REGLAMENTO').count(), 1)

    def test_el_trabajador_lo_ve_en_su_portal(self):
        cache.clear()   # límite de intentos del portal (misma IP en todas las pruebas)
        reg = self._subir().data
        self.client.force_authenticate(None)
        self.client.post('/api/trabajador/ingreso/', {'rut': '12.345.678-5'}, format='json')
        codigo = re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)
        self.client.post('/api/trabajador/codigo/verificar/', {'rut': '12.345.678-5', 'codigo': codigo}, format='json')
        docs = self.client.get('/api/trabajador/documentos/').data
        fila = next(d for d in docs if d['tipo'] == 'reglamento')
        self.assertEqual(fila['id'], reg['id'])
        pdf = self.client.get('/api/trabajador/descargar/', {'tipo': 'reglamento', 'id': reg['id']})
        self.assertTrue(pdf.content.startswith(b'%PDF'))

    @patch('core.b2_client.subir_documento')
    def test_se_envia_junto_con_el_contrato(self, _):
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA')
        Contrato.objects.create(empleado=self.ana, tipo_contrato='INDEFINIDO', cargo='Vendedora',
                                fecha_inicio='2026-09-01', sueldo_base=600_000, horas_semanales=42)
        confirmar_identidad(self.client, self.user)
        datos = {'empleado_id': self.ana.id, 'tipo_documento': 'CONTRATO'}
        # Sin reglamento subido, solo va el contrato.
        r = self.client.post('/api/firmas/solicitar/', datos, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(SolicitudFirma.objects.filter(tipo_documento='REGLAMENTO').count(), 0)
        SolicitudFirma.objects.filter(tipo_documento='CONTRATO').update(estado='CANCELADO')
        self._subir()
        self.assertEqual(self.client.post('/api/firmas/solicitar/', datos, format='json').status_code, 201)
        self.assertEqual(SolicitudFirma.objects.filter(tipo_documento='REGLAMENTO', empleado=self.ana).count(), 1)
        # Reenviar el contrato no duplica la constancia del reglamento.
        SolicitudFirma.objects.filter(tipo_documento='CONTRATO').update(estado='CANCELADO')
        self.client.post('/api/firmas/solicitar/', datos, format='json')
        self.assertEqual(SolicitudFirma.objects.filter(tipo_documento='REGLAMENTO', empleado=self.ana).count(), 1)
