"""Certificado N°6 del SII: columnas, factores, numeración correlativa, reemplazo, resumen DJ 1887 y portal."""
import io
import re
import zipfile

from django.core import mail
from rest_framework.test import APITestCase

from ..models import CertificadoSueldos, Contrato, Empleado, FactorActualizacionSII, Liquidacion
from .utiles import crear_empleado, crear_usuario_completo


class CertificadoSueldosTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('cert6', '21.000.000-3', '76.000.555-K')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana', apellido='Rojas')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2024-01-01',
                                sueldo_base=1_000_000, horas_semanales=42)
        # Enero: 1.000.000 imponible, 100.000 AFP, 70.000 salud, 6.000 AFC, 20.000 impuesto, 60.000 no imponible.
        self.enero = Liquidacion.objects.create(empleado=self.emp, mes=1, anio=2025, total_imponible=1_000_000,
                                                total_haberes=1_060_000, afp_monto=100_000, salud_monto=70_000,
                                                seguro_cesantia=6_000, impuesto_unico=20_000, sueldo_liquido=1)
        Liquidacion.objects.create(empleado=self.emp, mes=12, anio=2025, total_imponible=1_000_000,
                                   total_haberes=1_000_000, afp_monto=100_000, salud_monto=70_000, seguro_cesantia=6_000,
                                   impuesto_unico=20_000, sueldo_liquido=1)

    def _emitir(self, anio=2025):
        return self.client.post('/api/certificados-sueldos/emitir/', {'empresa': self.empresa.id, 'anio': anio},
                                format='json')

    def test_columnas_y_actualizacion(self):
        self.assertEqual(self._emitir().data, {'creados': 1, 'sin_cambios': 0})
        c = CertificadoSueldos.objects.get()
        enero = c.datos['filas'][0]
        self.assertEqual((enero['renta_bruta'], enero['cotizaciones'], enero['renta_afecta'], enero['renta_no_gravada']),
                         (1_000_000, 176_000, 824_000, 60_000))
        self.assertEqual(enero['renta_afecta_act'], 853_664)          # 824.000 × 1,036
        self.assertEqual(enero['impuesto_act'], 20_720)               # 20.000 × 1,036
        self.assertTrue(c.datos['filas'][1]['vacio'])                 # febrero sin liquidación
        self.assertEqual(c.datos['totales']['renta_afecta_act'], 853_664 + 824_000)   # diciembre: factor 1,000
        self.assertEqual(c.datos['horas_diciembre'], 42)

    def test_sin_factores_o_anio_abierto_no_se_emite(self):
        FactorActualizacionSII.objects.filter(anio=2025, mes=12).delete()
        r = self._emitir()
        self.assertEqual(r.status_code, 400)
        self.assertIn('factores', r.data['error'])
        self.assertEqual(self._emitir(anio=2030).status_code, 400)

    def test_numeracion_y_reemplazo(self):
        self._emitir()
        self.assertEqual(self._emitir().data, {'creados': 0, 'sin_cambios': 1})    # mismos datos: se conserva
        otro = crear_empleado(self.empresa, '9.876.543-3')
        Liquidacion.objects.create(empleado=otro, mes=3, anio=2025, total_imponible=500_000, total_haberes=500_000,
                                   sueldo_liquido=1)
        Liquidacion.objects.filter(pk=self.enero.pk).update(impuesto_unico=25_000)   # corrección
        self.assertEqual(self._emitir().data['creados'], 2)
        numeros = sorted(CertificadoSueldos.objects.values_list('numero', flat=True))
        self.assertEqual(numeros, [1, 2, 3])
        nuevo = CertificadoSueldos.objects.filter(empleado=self.emp).order_by('-numero').first()
        self.assertEqual(nuevo.reemplaza.numero, 1)
        estado = self.client.get('/api/certificados-sueldos/', {'empresa': self.empresa.id, 'anio': 2025}).data
        self.assertEqual(sorted(c['numero'] for c in estado['certificados']), [2, 3])   # solo los vigentes
        self.assertEqual(estado['plazo_certificados'], '14-03-2026')

    def test_pdf_zip_y_resumen_dj1887(self):
        self._emitir()
        c = CertificadoSueldos.objects.get()
        pdf = self.client.get(f'/api/certificados-sueldos/{c.id}/pdf/')
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        z = self.client.get('/api/certificados-sueldos/zip/', {'empresa': self.empresa.id, 'anio': 2025})
        self.assertEqual(len(zipfile.ZipFile(io.BytesIO(z.content)).namelist()), 1)
        import openpyxl
        x = self.client.get('/api/certificados-sueldos/resumen-dj1887/', {'empresa': self.empresa.id, 'anio': 2025})
        hoja = openpyxl.load_workbook(io.BytesIO(x.content)).active
        fila = [celda.value for celda in hoja[3]]
        self.assertEqual((fila[1], fila[3]), ('12.345.678-5', 853_664 + 824_000))
        self.assertEqual(fila[9 + 12], 'C')                           # período de enero: jornada completa
        self.assertEqual(fila[-2:], [1, 42])

    def test_otro_empleador_no_ve_ni_emite(self):
        self._emitir()
        otro, _, _, _ = crear_usuario_completo('cert6_b', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        c = CertificadoSueldos.objects.get()
        self.assertEqual(self.client.get(f'/api/certificados-sueldos/{c.id}/pdf/').status_code, 404)
        self.assertEqual(self._emitir().status_code, 400)

    def test_el_trabajador_lo_descarga_en_su_portal(self):
        self._emitir()
        Empleado.objects.filter(pk=self.emp.pk).update(email='ana@correo.cl')
        self.client.force_authenticate(None)
        self.client.post('/api/trabajador/ingreso/', {'rut': '12.345.678-5'}, format='json')
        codigo = re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)
        self.client.post('/api/trabajador/codigo/verificar/', {'rut': '12.345.678-5', 'codigo': codigo}, format='json')
        sii = self.client.get('/api/trabajador/certificados/').data['sueldos_sii']
        self.assertEqual([(s['anio'], s['numero']) for s in sii], [(2025, 1)])
        pdf = self.client.get('/api/trabajador/descargar/', {'tipo': 'certificado_sii', 'id': sii[0]['id']})
        self.assertTrue(pdf.content.startswith(b'%PDF'))
