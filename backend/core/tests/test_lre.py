"""Libro de Remuneraciones Electrónico: plantilla oficial, conceptos y totales."""
from rest_framework.test import APITestCase

from .. import lre
from ..models import ConceptoRemuneracion, Contrato, Empleado, Empresa, Finiquito
from .utiles import crear_empleado, crear_usuario_completo, indicadores_fijos


@indicadores_fijos
class LreTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('lre_owner', '21.000.000-3', '76.000.555-2')
        Empresa.objects.filter(pk=self.empresa.pk).update(comuna='Providencia', mutual='01', ccaf='02')
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        Empleado.objects.filter(pk=self.emp.pk).update(afp='HABITAT', sistema_salud='FONASA', sexo='M')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', cargo='Analista', fecha_inicio='2024-01-01',
                                sueldo_base=900_000, gratificacion_legal='MENSUAL', tipo_jornada='ORDINARIA',
                                horas_semanales=42)
        self.client.force_authenticate(self.user)
        colacion = ConceptoRemuneracion.objects.get(codigo='COLACION', empresa__isnull=True)
        hora_extra = ConceptoRemuneracion.objects.get(codigo='HORA_EXTRA_50', empresa__isnull=True)
        self.propio = ConceptoRemuneracion.objects.create(codigo='BONO_ESPECIAL', nombre='Bono especial',
                                                          tipo='HABER_IMPONIBLE', empresa=self.empresa)
        r = self.client.post('/api/liquidaciones/', {
            'empleado': self.emp.id, 'mes': 8, 'anio': 2026, 'dias_trabajados': 30,
            'detalle_items': [{'concepto': colacion.id, 'valor': 50_000},
                              {'concepto': hora_extra.id, 'valor': 30_000, 'horas': 4},
                              {'concepto': self.propio.id, 'valor': 20_000}]}, format='json')
        assert r.status_code == 201, r.data
        self.liq = r.data

    def _params(self):
        return {'empresa': self.empresa.id, 'mes': 8, 'anio': 2026}

    def _fila(self, *_):
        r = self.client.get('/api/liquidaciones/exportar_lre/', self._params())
        self.assertEqual(r.status_code, 200, getattr(r, 'data', None))
        self.assertEqual(r['Content-Disposition'], 'attachment; filename="76000555-2_202608.csv"')
        lineas = r.content.decode('cp1252').split('\r\n')
        plantilla = [h for h, _ in lre.columnas()]
        self.assertEqual(lineas[0].split(';'), plantilla)      # encabezados exactos de la plantilla de Mi DT
        return dict(zip([c for _, c in lre.columnas()], lineas[1].split(';')))

    def test_archivo_con_la_plantilla_oficial_y_totales_cuadrados(self, *_):
        f = self._fila()
        self.assertEqual((f[1101], f[1102], f[1105], f[1106]), ('12345678-5', '01/01/2024', '13', '13123'))
        self.assertEqual((f[1107], f[1141], f[1143], f[1110], f[1152]), ('101', '14', '102', '2', '1'))
        self.assertEqual(f[2101], str(self.liq['sueldo_base']))
        self.assertEqual((f[2301], f[2102], f[2111]), ('50000', '30000', '20000'))   # colación, sobresueldo, bono
        self.assertEqual(f[2103], '')                  # opcional sin monto: vacío
        self.assertEqual(f[3141], str(self.liq['afp_monto']))
        self.assertEqual(f[5201], str(self.liq['total_haberes']))
        self.assertEqual(f[5501], str(self.liq['sueldo_liquido']))
        self.assertEqual(int(f[5210]) + int(f[5230]), int(f[5201]))
        self.assertEqual(int(f[5341]) + int(f[5361]) + int(f[5302]), int(f[5301]))
        self.assertGreater(int(f[4155]), 0)            # SIS + Seguro Social (reforma)
        self.assertGreater(int(f[4157]), 0)            # 0,1 % empleador a la cuenta individual
        self.assertEqual(int(f[5410]), sum(int(f[c] or 0) for c in (4151, 4152, 4131, 4154, 4155, 4157)))

    def test_revision_avisa_conceptos_sin_codigo_y_bloquea_faltantes(self, *_):
        r = self.client.get('/api/liquidaciones/revisar_lre/', self._params())
        self.assertEqual((r.status_code, r.data['trabajadores'], r.data['faltan']), (200, 1, []))
        self.assertIn('Bono especial', ' '.join(r.data['avisos']))
        # Con código asignado, el aviso desaparece.
        ConceptoRemuneracion.objects.filter(pk=self.propio.pk).update(codigo_lre='2111')
        self.assertEqual(self.client.get('/api/liquidaciones/revisar_lre/', self._params()).data['avisos'], [])
        # Un trabajador con contrato y sin liquidación impide declarar.
        otro = crear_empleado(self.empresa, '9.876.543-3', nombres='Ana')
        Contrato.objects.create(empleado=otro, tipo_contrato='INDEFINIDO', cargo='Analista', fecha_inicio='2024-01-01',
                                sueldo_base=600_000)
        r = self.client.get('/api/liquidaciones/exportar_lre/', self._params())
        self.assertEqual(r.status_code, 400)
        self.assertIn('Ana', r.data['error'])

    def test_termino_en_el_mes_informa_fecha_y_causal(self, *_):
        Finiquito.objects.create(empleado=self.emp, causal_articulo='161_1', fecha_termino='2026-08-31',
                                 fecha_emision='2026-08-31', sueldo_base=900_000)
        f = self._fila()
        self.assertEqual((f[1103], f[1104]), ('31/08/2026', '18'))

    def test_region_nueva_con_codigo_antiguo_de_comuna(self, *_):
        self.assertEqual(lre.region_de_comuna(lre.codigo_comuna('Chillán')), 16)
        self.assertEqual(lre.region_de_comuna(lre.codigo_comuna('Valdivia')), 14)
        self.assertEqual(lre.region_de_comuna(lre.codigo_comuna('Putre')), 15)
        self.assertEqual(lre.region_de_comuna(lre.codigo_comuna('Temuco')), 9)

    def test_solo_desde_pyme(self, *_):
        from django.contrib.auth.models import User
        from ..models import Plan
        Plan.objects.update(nivel=2)
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        self.assertEqual(self.client.get('/api/liquidaciones/exportar_lre/', self._params()).status_code, 403)


class CodigoLreConceptoTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('lre_cod', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)

    def test_codigo_lre_valido_segun_naturaleza(self):
        r = self.client.get('/api/conceptos/codigos_lre/', {'tipo': 'HABER_NO_IMPONIBLE'})
        codigos = {c['codigo'] for c in r.data}
        self.assertIn('2301', codigos)
        self.assertNotIn('2111', codigos)          # imponible: no corresponde
        r = self.client.post('/api/conceptos/', {'codigo': 'BONO_X', 'nombre': 'Bono X', 'tipo': 'HABER_IMPONIBLE',
                                                 'empresa': self.empresa.id, 'codigo_lre': '2301'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.post('/api/conceptos/', {'codigo': 'BONO_X', 'nombre': 'Bono X', 'tipo': 'HABER_IMPONIBLE',
                                                 'empresa': self.empresa.id, 'codigo_lre': '2113'}, format='json')
        self.assertEqual((r.status_code, r.data['codigo_lre']), (201, '2113'))
        r = self.client.patch(f"/api/conceptos/{r.data['id']}/", {'codigo_lre': '3141'}, format='json')
        self.assertEqual(r.status_code, 400)       # la cotización AFP la calcula el sistema
