"""Portal de fiscalización (Dictamen 0789/15): ingreso del inspector, acceso sin restricciones, descarga,
ratificación en terreno y bitácora para el empleador."""
import base64
import io
import re

from django.core import mail
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from ..models import (Contrato, DocumentoLegal, Empleado, Liquidacion, RatificacionInspeccion, RegistroInspeccion,
                      SolicitudFirma)
from ..views.inspeccion import COOKIE
from .utiles import crear_empleado, crear_usuario_completo

RUT_EMPRESA = '76.000.555-K'
CORREO = 'jperez@dt.gob.cl'


def _png():
    salida = io.BytesIO()
    Image.new('RGB', (40, 16), 'white').save(salida, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(salida.getvalue()).decode()


class InspeccionBase(APITestCase):
    def setUp(self):
        self.jefe, _, self.plan, self.empresa = crear_usuario_completo('insp_a', '21.000.000-3', RUT_EMPRESA)
        self.activo = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana', apellido='Rojas')
        self.contrato = Contrato.objects.create(empleado=self.activo, tipo_contrato='INDEFINIDO', cargo='Analista',
                                                fecha_inicio='2024-01-01', sueldo_base=900_000)
        self.desvinculado = crear_empleado(self.empresa, '9.876.543-3', nombres='Luis', apellido='Soto')
        Empleado.objects.filter(pk=self.desvinculado.pk).update(activo=False, fecha_desvinculacion='2025-03-31')
        self.liq_antigua = Liquidacion.objects.create(empleado=self.desvinculado, mes=1, anio=2023,
                                                      total_haberes=1, sueldo_liquido=1)
        DocumentoLegal.objects.create(empleado=self.activo, tipo='AMONESTACION', fecha_emision='2026-05-01',
                                      hechos='Atrasos reiterados')

    def _pedir(self, **extra):
        datos = {'rut_empresa': RUT_EMPRESA, 'correo': CORREO, 'nombre': 'Juan Pérez Inspector', 'rut': '11.111.111-1',
                 **extra}
        return self.client.post('/api/inspeccion/ingreso/', datos, format='json')

    def _entrar(self):
        self.assertEqual(self._pedir().status_code, 200)
        codigo = re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)
        r = self.client.post('/api/inspeccion/verificar/', {'rut_empresa': RUT_EMPRESA, 'correo': CORREO,
                                                             'codigo': codigo}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return r


class IngresoTests(InspeccionBase):
    def test_solo_correo_institucional(self):
        r = self._pedir(correo='juan@gmail.com')
        self.assertEqual(r.status_code, 400)
        self.assertIn('@dt.gob.cl', r.data['error'])
        self.assertEqual(len(mail.outbox), 0)

    def test_empresa_inexistente_responde_igual_sin_enviar(self):
        r = self._pedir(rut_empresa='77.777.777-7')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(r.data['mensaje'], self._pedir().data['mensaje'])

    def test_ingreso_con_codigo_y_bitacora(self):
        r = self._entrar()
        self.assertIn(COOKIE, r.cookies)
        self.assertEqual(r.data['empresa']['rut'], RUT_EMPRESA)
        self.assertEqual(self.client.get('/api/inspeccion/yo/').data['inspector']['correo'], CORREO)
        self.assertEqual(RegistroInspeccion.objects.get().accion, 'INGRESO')

    def test_codigo_incorrecto_y_limite(self):
        self._pedir()
        for _ in range(3):
            r = self.client.post('/api/inspeccion/verificar/', {'rut_empresa': RUT_EMPRESA, 'correo': CORREO,
                                                                 'codigo': '000000'}, format='json')
        self.assertEqual(r.status_code, 400)
        codigo = re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)
        r = self.client.post('/api/inspeccion/verificar/', {'rut_empresa': RUT_EMPRESA, 'correo': CORREO,
                                                             'codigo': codigo}, format='json')
        self.assertIn('intentos', r.data['error'])

    def test_sin_sesion_no_hay_acceso_y_el_empleador_no_es_inspector(self):
        self.assertEqual(self.client.get('/api/inspeccion/documentos/').status_code, 403)
        self.client.force_authenticate(self.jefe)
        self.assertEqual(self.client.get('/api/inspeccion/documentos/').status_code, 403)


class AccesoTests(InspeccionBase):
    def test_ve_todo_sin_restricciones_incluidos_desvinculados(self):
        self._entrar()
        trabajadores = self.client.get('/api/inspeccion/trabajadores/').data
        self.assertEqual({t['rut'] for t in trabajadores}, {'12.345.678-5', '9.876.543-3'})
        docs = self.client.get('/api/inspeccion/documentos/').data
        claves = {d['clave'] for d in docs}
        self.assertIn(f'liquidacion:{self.liq_antigua.id}', claves)       # 2023, de un desvinculado
        self.assertIn(f'contrato:{self.contrato.id}', claves)
        solo = self.client.get('/api/inspeccion/documentos/', {'tipo': 'CARTA'}).data
        self.assertEqual([d['tipo'] for d in solo], ['CARTA'])

    def test_no_ve_otra_empresa(self):
        _, _, _, otra = crear_usuario_completo('insp_b', '11.111.111-1', '77.777.777-7')
        ajena = crear_empleado(otra, '5.555.555-5')
        liq = Liquidacion.objects.create(empleado=ajena, mes=2, anio=2026, total_haberes=1, sueldo_liquido=1)
        self._entrar()
        self.assertNotIn(f'liquidacion:{liq.id}', {d['clave'] for d in self.client.get('/api/inspeccion/documentos/').data})
        self.assertEqual(self.client.get('/api/inspeccion/descargar/', {'clave': f'liquidacion:{liq.id}'}).status_code,
                         404)

    def test_descarga_firmada_y_registrada(self):
        from unittest.mock import patch
        SolicitudFirma.objects.create(empleado=self.activo, empresa=self.empresa, contrato=self.contrato,
                                      tipo_documento='CONTRATO', estado='FIRMADO', b2_key_firmado='f/c.pdf',
                                      firmado_en=timezone.now())
        self._entrar()
        with patch('core.b2_client.descargar_documento', return_value=_pdf_minimo()):
            r = self.client.get('/api/inspeccion/descargar/', {'clave': f'contrato:{self.contrato.id}'})
        self.assertEqual((r.status_code, r['X-Documento-Firmado']), (200, '1'))
        self.assertTrue(RegistroInspeccion.objects.filter(accion='DESCARGA', detalle=f'contrato:{self.contrato.id}').exists())

    def test_ratificacion_en_terreno(self):
        self._entrar()
        clave = f'contrato:{self.contrato.id}'
        self.assertEqual(self.client.post('/api/inspeccion/ratificar/', {'clave': clave, 'firma': 'x'},
                                          format='json').status_code, 400)
        r = self.client.post('/api/inspeccion/ratificar/', {'clave': clave, 'firma': _png()}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        rat = RatificacionInspeccion.objects.get()
        self.assertEqual((rat.inspector_correo, rat.inspector_nombre), (CORREO, 'Juan Pérez Inspector'))
        doc = next(d for d in self.client.get('/api/inspeccion/documentos/').data if d['clave'] == clave)
        self.assertEqual(doc['ratificaciones'][0]['inspector'], 'Juan Pérez Inspector')
        pdf = self.client.get('/api/inspeccion/descargar/', {'clave': clave})
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        from pypdf import PdfReader
        paginas = PdfReader(io.BytesIO(pdf.content)).pages
        self.assertIn('RATIFICACIÓN DE INSPECTOR', paginas[-1].extract_text())


class BitacoraTests(InspeccionBase):
    def test_empleador_ve_la_bitacora_de_su_empresa(self):
        self._entrar()
        self.client.post('/api/inspeccion/salir/', {}, format='json')
        self.client.force_authenticate(self.jefe)
        r = self.client.get('/api/inspeccion/bitacora/', {'empresa': self.empresa.id})
        self.assertEqual([x['accion'] for x in r.data], ['SALIDA', 'INGRESO'])
        otro, _, _, _ = crear_usuario_completo('insp_c', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get('/api/inspeccion/bitacora/', {'empresa': self.empresa.id}).status_code, 404)


def _pdf_minimo():
    from reportlab.pdfgen import canvas
    buf = io.BytesIO()
    c = canvas.Canvas(buf)
    c.drawString(100, 750, 'Contrato firmado')
    c.save()
    return buf.getvalue()
