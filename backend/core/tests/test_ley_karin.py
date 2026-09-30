"""Ley Karin: canal interno y aviso semestral de canales de denuncia con constancia firmada."""
import datetime
from unittest.mock import patch

from rest_framework.test import APITestCase

from ..models import DocumentoLaboral, Empleado, Empresa, SolicitudFirma
from ..views.ley_karin import semestre
from .utiles import confirmar_identidad, crear_empleado, crear_usuario_completo


class LeyKarinTests(APITestCase):
    def setUp(self):
        self.user, _, self.plan, self.empresa = crear_usuario_completo('karin', '21.000.000-3', '76.000.555-K')
        self.client.force_authenticate(self.user)
        self.ana = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana', apellido='Rojas')
        Empleado.objects.filter(pk=self.ana.pk).update(email='ana@correo.cl')
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA', mutual='01')

    def test_semestres(self):
        self.assertEqual(semestre(datetime.date(2026, 6, 30))[0], '2026-1')
        self.assertEqual(semestre(datetime.date(2026, 7, 1))[1], '2° semestre de 2026')

    def test_canal_valida_datos(self):
        url = '/api/ley-karin/canal/'
        self.assertEqual(self.client.post(url, {'empresa': self.empresa.id, 'responsable': 'Gerencia',
                                                'correo': 'no-es-correo'}, format='json').status_code, 400)
        r = self.client.post(url, {'empresa': self.empresa.id, 'responsable': 'Jefa de personas',
                                   'correo': 'Denuncias@Empresa.cl'}, format='json')
        self.assertEqual(r.data['correo'], 'denuncias@empresa.cl')

    @patch('core.b2_client.subir_documento')
    def test_informar_semestre(self, subir):
        url = '/api/ley-karin/informar/'
        self.assertEqual(self.client.post(url, {'empresa': self.empresa.id}, format='json').status_code, 400)
        self.client.post('/api/ley-karin/canal/', {'empresa': self.empresa.id, 'responsable': 'Jefa de personas',
                                                   'correo': 'denuncias@empresa.cl'}, format='json')
        self.assertEqual(self.client.post(url, {'empresa': self.empresa.id}, format='json').status_code, 428)
        confirmar_identidad(self.client, self.user)
        self.assertEqual(self.client.post(url, {'empresa': self.empresa.id}, format='json').data['enviadas'], 1)
        self.assertEqual(self.client.post(url, {'empresa': self.empresa.id}, format='json').data['enviadas'], 0)
        doc = DocumentoLaboral.objects.get(tipo='CANALES_DENUNCIA')
        texto = ' '.join(doc.datos['clausulas'])
        self.assertIn('denuncias@empresa.cl', texto)
        self.assertIn('Asociación Chilena de Seguridad', texto)
        self.assertEqual(SolicitudFirma.objects.get().tipo_documento, 'CANALES_DENUNCIA')
        estado = self.client.get('/api/ley-karin/', {'empresa': self.empresa.id}).data
        self.assertEqual((estado['avance']['enviados'], estado['avance']['total']), (1, 1))

    def test_starter_no_puede(self):
        self.plan.nivel = 2
        self.plan.save()
        confirmar_identidad(self.client, self.user)
        self.assertEqual(self.client.post('/api/ley-karin/informar/', {'empresa': self.empresa.id},
                                          format='json').status_code, 403)
