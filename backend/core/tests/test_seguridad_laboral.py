"""EPP (todos los planes) e información de riesgos del Art. 15 del DS 44 (Pyme)."""
import datetime
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import Contrato, DocumentoLaboral, Empleado, Empresa, SolicitudFirma
from .utiles import confirmar_identidad, crear_empleado, crear_usuario_completo


class SeguridadLaboralTests(APITestCase):
    def setUp(self):
        self.user, _, self.plan, self.empresa = crear_usuario_completo('segu', '21.000.000-3', '76.000.555-K')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana', apellido='Rojas', cargo='Maestra')
        Empleado.objects.filter(pk=self.emp.pk).update(email='ana@correo.cl')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', cargo='Maestra',
                                fecha_inicio='2024-01-01', sueldo_base=700_000, horas_semanales=42)
        self.hoy = timezone.localdate().isoformat()

    def _crear(self, tipo, **datos):
        return self.client.post('/api/documentos-laborales/', {'empleado': self.emp.id, 'tipo': tipo, 'datos': datos},
                                format='json')

    def _firmar(self, doc_id):
        doc = DocumentoLaboral.objects.get(pk=doc_id)
        SolicitudFirma.objects.create(empleado=self.emp, empresa=self.empresa, documento_laboral=doc,
                                      tipo_documento=doc.tipo, estado='FIRMADO', firmado_en=timezone.now())

    def test_entrega_epp_en_plan_semilla(self):
        self.plan.nivel = 1
        self.plan.save()
        r = self._crear('ENTREGA_EPP', items=[{'codigo': 'CASCO', 'cantidad': 1}, {'codigo': 'GUANTES', 'cantidad': 2}],
                        motivo='INGRESO', fecha=self.hoy)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['avisos'])                          # falta la capacitación de 1 hora
        doc = DocumentoLaboral.objects.get(pk=r.data['id'])
        self.assertIn('1 × casco de seguridad, 2 × guantes de trabajo', doc.datos['clausulas'][0])
        pdf = self.client.get(f"/api/documentos-laborales/{r.data['id']}/generar_pdf/")
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        # Otros pactos siguen siendo desde Starter, y la información de riesgos desde Pyme.
        self.assertEqual(self._crear('PERMISO_LEGAL', permiso='NACIMIENTO').status_code, 403)
        self.assertEqual(self._crear('INFORMACION_RIESGOS').status_code, 403)

    def test_validaciones_epp(self):
        self.assertEqual(self._crear('ENTREGA_EPP', items=[], motivo='INGRESO', fecha=self.hoy).status_code, 400)
        self.assertEqual(self._crear('ENTREGA_EPP', items=[{'codigo': 'OTRO', 'cantidad': 1}], motivo='INGRESO',
                                     fecha=self.hoy).status_code, 400)
        manana = (timezone.localdate() + datetime.timedelta(days=1)).isoformat()
        self.assertEqual(self._crear('ENTREGA_EPP', items=[{'codigo': 'CASCO', 'cantidad': 1}], motivo='INGRESO',
                                     fecha=manana).status_code, 400)

    def test_refuerzo_anual_de_la_capacitacion(self):
        hace_14_meses = (timezone.localdate() - datetime.timedelta(days=430)).isoformat()
        r = self._crear('ENTREGA_EPP', items=[{'codigo': 'CASCO', 'cantidad': 1}], motivo='INGRESO',
                        fecha=hace_14_meses, capacitacion='SI', fecha_capacitacion=hace_14_meses)
        self.assertEqual(r.data['avisos'], [])
        self._firmar(r.data['id'])
        avisos = self.client.get('/api/documentos-laborales/opciones/', {'empleado': self.emp.id}).data['avisos']
        self.assertTrue(any('capacitación en el uso' in a for a in avisos))

    def test_informacion_de_riesgos(self):
        opciones = self.client.get('/api/documentos-laborales/opciones/', {'empleado': self.emp.id}).data
        self.assertTrue(any('riesgos de su trabajo' in a for a in opciones['avisos']))
        sugeridos = opciones['riesgos_por_rubro']['CONSTRUCCION']
        r = self._crear('INFORMACION_RIESGOS', rubro='CONSTRUCCION', riesgos=sugeridos[:2] + ['NO_EXISTE'],
                        motivo='INGRESO', fecha_capacitacion=self.hoy)
        self.assertEqual(r.status_code, 201, r.data)
        doc = DocumentoLaboral.objects.get(pk=r.data['id'])
        self.assertEqual(len(doc.datos['riesgos']), 2)
        self.assertIn('Caídas de altura', ' '.join(doc.datos['clausulas']))
        self.assertIn('presencial', ' '.join(doc.datos['clausulas']))
        self.assertEqual(Empresa.objects.get(pk=self.empresa.pk).rubro, 'CONSTRUCCION')
        self._firmar(doc.id)
        avisos = self.client.get('/api/documentos-laborales/opciones/', {'empleado': self.emp.id}).data['avisos']
        self.assertFalse(any('riesgos' in a for a in avisos))
        Empleado.objects.filter(pk=self.emp.pk).update(cargo='Capataz')
        avisos = self.client.get('/api/documentos-laborales/opciones/', {'empleado': self.emp.id}).data['avisos']
        self.assertTrue(any('Cambió de cargo' in a for a in avisos))

    @patch('core.b2_client.subir_documento')
    def test_informar_riesgos_a_todos(self, _):
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA')
        crear_empleado(self.empresa, '9.876.543-3', nombres='Luis', apellido='Soto')
        url = '/api/reglamentos/informar_riesgos/'
        datos = {'empresa': self.empresa.id, 'rubro': 'COMERCIO', 'riesgos': ['COMERCIO_0', 'COMUN_EMERGENCIAS'],
                 'fecha_capacitacion': self.hoy}
        self.assertEqual(self.client.post(url, {**datos, 'riesgos': []}, format='json').status_code, 400)
        self.assertEqual(self.client.post(url, datos, format='json').status_code, 428)
        confirmar_identidad(self.client, self.user)
        r = self.client.post(url, datos, format='json')
        self.assertEqual(r.data['enviadas'], 1)
        self.assertEqual([o['nombre'] for o in r.data['omitidas']], ['Luis Soto'])
        estado = self.client.get('/api/reglamentos/', {'empresa': self.empresa.id}).data['riesgos']
        self.assertEqual(estado['rubro'], 'COMERCIO')
        self.assertEqual(self.client.post(url, datos, format='json').data['enviadas'], 0)
