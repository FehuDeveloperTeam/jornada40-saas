"""Finiquito: indemnizaciones, base del Art. 172 y gratificación anual."""
from django.utils import timezone
from rest_framework.test import APITestCase
from ..models import Contrato, Liquidacion, SolicitudFirma
import datetime  # noqa: E402  (usado por las pruebas de jornada)

from .utiles import crear_empleado, crear_usuario_completo, indicadores_fijos


@indicadores_fijos
class FiniquitoLegalTests(APITestCase):
    """Finiquito según el Código del Trabajo; los montos legales no los fija el cliente."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('fin_owner', '18.888.888-8', '76.888.888-1')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        self.emp.fecha_ingreso = datetime.date(2019, 3, 1); self.emp.afp = 'HABITAT'; self.emp.sistema_salud = 'FONASA'
        self.emp.save()
        Contrato.objects.filter(empleado=self.emp).delete()
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2019-03-01',
                                sueldo_base=1_000_000, gratificacion_legal='MENSUAL')

    def _simular(self, **extra):
        datos = {'empleado': self.emp.id, 'fecha_termino': '2026-09-15', 'dias_trabajados_ultimo_mes': 15,
                 'causal_articulo': '161_1', **extra}
        return self.client.post('/api/finiquitos/simular/', datos, format='json')

    def test_anios_con_fraccion_superior_a_seis_meses(self, *_):
        from core.views import _anios_indemnizacion as a
        d = datetime.date
        self.assertEqual(a(d(2019, 3, 1), d(2026, 9, 15)), 8)   # 7 años, 6 meses y 14 días → 8
        self.assertEqual(a(d(2019, 3, 1), d(2026, 9, 1)), 7)    # 6 meses exactos no es "superior"
        self.assertEqual(a(d(2019, 3, 1), d(2026, 9, 2)), 8)    # 6 meses y 1 día
        self.assertEqual(a(d(2026, 1, 1), d(2026, 9, 1)), 0)    # menos de un año: no corresponde
        self.assertEqual(a(d(2000, 1, 1), d(2026, 9, 1)), 11)   # tope de 11 años

    def test_indemnizaciones_161_sin_aviso(self, *_):
        r = self._simular()
        self.assertEqual(r.status_code, 200, r.data)
        # Base Art. 172: sueldo + gratificación mensual con tope (4,75 × 553.553 / 12 = 219.114)
        self.assertEqual(r.data['detalle']['base_indemnizacion'], 1_219_114)
        self.assertEqual(r.data['detalle']['anios_indemnizacion'], 8)
        self.assertEqual(r.data['indemnizacion_anos_servicio'], 8 * 1_219_114)
        self.assertEqual(r.data['indemnizacion_sustitutiva_aviso'], 1_219_114)

    def test_con_aviso_previo_no_hay_sustitutiva(self, *_):
        self.assertEqual(self._simular(aviso_previo_dado=True).data['indemnizacion_sustitutiva_aviso'], 0)

    def test_renuncia_sin_indemnizacion(self, *_):
        r = self._simular(causal_articulo='159_2')
        self.assertEqual(r.data['indemnizacion_anos_servicio'], 0)
        self.assertEqual(r.data['indemnizacion_sustitutiva_aviso'], 0)
        self.assertGreater(r.data['feriado_proporcional'], 0)   # el feriado se paga igual

    def test_tope_90_uf_en_la_base(self, *_):
        Contrato.objects.filter(empleado=self.emp).update(sueldo_base=5_000_000)
        r = self._simular()
        self.assertEqual(r.data['detalle']['base_indemnizacion'], 3_695_148)   # 90 × 41.057,20
        self.assertTrue(r.data['detalle']['base_indemnizacion_topada'])

    def test_feriado_incluye_proporcional_del_anio_en_curso(self, *_):
        r = self._simular(causal_articulo='159_2')
        # 6 meses y 14 días desde el último aniversario: (6 + 14/30) × 1,25 = 8,08 hábiles
        self.assertAlmostEqual(r.data['detalle']['feriado_dias_proporcionales'], 8.08, places=2)
        self.assertGreater(r.data['detalle']['feriado_dias_corridos'], r.data['detalle']['feriado_dias_habiles'])

    def test_montos_legales_no_se_aceptan_del_cliente(self, *_):
        r = self.client.post('/api/finiquitos/', {
            'empleado': self.emp.id, 'fecha_termino': '2026-09-15', 'causal_articulo': '161_1',
            'indemnizacion_anos_servicio': 0, 'feriado_proporcional': 0, 'total_a_pagar': 1}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['indemnizacion_anos_servicio'], 8 * 1_219_114)
        self.assertGreater(r.data['total_a_pagar'], 1)
        r2 = self.client.patch(f"/api/finiquitos/{r.data['id']}/", {'indemnizacion_anos_servicio': 0, 'otros_haberes': 50_000}, format='json')
        self.assertEqual(r2.data['indemnizacion_anos_servicio'], 8 * 1_219_114)
        self.assertEqual(r2.data['otros_haberes'], 50_000)
        self.assertEqual(r2.data['total_a_pagar'], r.data['total_a_pagar'] + 50_000)

    def test_firmado_no_se_modifica(self, *_):
        r = self.client.post('/api/finiquitos/', {'empleado': self.emp.id, 'fecha_termino': '2026-09-15',
                                                  'causal_articulo': '159_2'}, format='json')
        SolicitudFirma.objects.create(empleado=self.emp, empresa=self.empresa, finiquito_id=r.data['id'],
                                      tipo_documento='FINIQUITO', estado='FIRMADO',
                                      expira_en=timezone.now() + timezone.timedelta(days=1))
        r2 = self.client.patch(f"/api/finiquitos/{r.data['id']}/", {'otros_haberes': 1}, format='json')
        self.assertEqual(r2.status_code, 403)


@indicadores_fijos
class CierreBackendTests(APITestCase):
    """Cierre del rediseño: PDF de contrato al día, montos de la carta y días de vacaciones del servidor."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('cierre_owner', '20.000.000-0', '76.000.123-5')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        self.emp.fecha_ingreso = datetime.date(2019, 3, 1); self.emp.save()
        Contrato.objects.filter(empleado=self.emp).delete()
        self.contrato = Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2019-03-01',
                                                sueldo_base=1_000_000, gratificacion_legal='MENSUAL')

    def test_descargar_contrato_lo_genera_y_editar_lo_renueva(self, *_):
        r = self.client.get(f'/api/contratos/{self.contrato.id}/descargar_contrato/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b'%PDF'))
        self.contrato.refresh_from_db(); self.assertTrue(self.contrato.archivo_contrato)
        self.client.patch(f'/api/contratos/{self.contrato.id}/', {'sueldo_base': 1_100_000}, format='json')
        self.contrato.refresh_from_db(); self.assertFalse(self.contrato.archivo_contrato)
        self.assertEqual(self.client.get(f'/api/contratos/{self.contrato.id}/descargar_anexo_40h/').status_code, 200)

    def test_carta_de_despido_calcula_montos(self, *_):
        r = self.client.post('/api/documentos_legales/', {
            'empleado': self.emp.id, 'tipo': 'DESPIDO', 'fecha_emision': '2026-09-01', 'hechos': 'x',
            'causal_articulo': '161_1', 'fecha_ultimo_dia': '2026-09-15', 'aviso_previo_dias': 0,
            'monto_indemnizacion_anos': 1, 'monto_indemnizacion_sustitutiva': 1}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        from core.models import DocumentoLegal
        doc = DocumentoLegal.objects.get(id=r.data["id"])
        self.assertEqual(doc.monto_indemnizacion_anos, 8 * 1_219_114)
        self.assertEqual(doc.monto_indemnizacion_sustitutiva, 1_219_114)
        r = self.client.patch(f'/api/documentos_legales/{doc.id}/', {'aviso_previo_dias': 30}, format='json')
        doc.refresh_from_db(); self.assertEqual(doc.monto_indemnizacion_sustitutiva, 0)

    def test_vacaciones_dias_del_servidor(self, *_):
        r = self.client.get('/api/vacaciones/dias_habiles/?inicio=2026-08-31&fin=2026-09-06')
        self.assertEqual(r.data['dias_habiles'], 5)
        r = self.client.post('/api/vacaciones/', {'empleado': self.emp.id, 'empresa': self.empresa.id, 'tipo': 'VACACION_LEGAL',
                                                  'fecha_inicio': '2026-08-31', 'fecha_fin': '2026-09-06', 'dias_habiles': 1,
                                                  'estado': 'APROBADO'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['dias_habiles'], 5)


@indicadores_fijos
class BaseIndemnizacionArt172Tests(APITestCase):
    """Base de las indemnizaciones: todo lo que se paga mes a mes, lo variable promediado (Art. 172)."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('art172_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        self.emp.fecha_ingreso = datetime.date(2019, 3, 1)
        self.emp.save()
        Contrato.objects.filter(empleado=self.emp).delete()
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2019-03-01',
                                sueldo_base=800_000, gratificacion_legal='MENSUAL')

    def _simular(self):
        r = self.client.post('/api/finiquitos/simular/', {
            'empleado': self.emp.id, 'fecha_termino': '2026-09-15', 'dias_trabajados_ultimo_mes': 15,
            'causal_articulo': '161_1'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return r

    def test_incluye_lo_mensual_y_promedia_lo_variable(self, *_):
        from core.models import ConceptoRemuneracion
        c = {k: ConceptoRemuneracion.objects.get(codigo=k, empresa=None).id for k in
             ('COLACION', 'BONO_RESPONSABILIDAD', 'BONO_METAS', 'ASIGNACION_FAMILIAR', 'HORA_EXTRA_50')}
        comisiones = {6: 60_000, 7: 90_000, 8: 150_000}
        for mes, comision in comisiones.items():
            items = [
                {'concepto': c['COLACION'], 'glosa': 'Colación', 'naturaleza': 'HABER_NO_IMPONIBLE', 'valor': 50_000},
                {'concepto': c['BONO_RESPONSABILIDAD'], 'glosa': 'Bono de responsabilidad', 'naturaleza': 'HABER_IMPONIBLE', 'valor': 100_000},
                {'concepto': c['ASIGNACION_FAMILIAR'], 'glosa': 'Asignación familiar', 'naturaleza': 'HABER_NO_IMPONIBLE', 'valor': 20_000},
                {'concepto': c['HORA_EXTRA_50'], 'glosa': 'Horas extras 50%', 'naturaleza': 'HORA_EXTRA', 'valor': 90_000},
                {'concepto': None, 'glosa': 'Comisión ventas', 'naturaleza': 'COMISION', 'valor': comision},
            ]
            if mes == 7:  # bono de un solo mes: esporádico
                items.append({'concepto': c['BONO_METAS'], 'glosa': 'Bono metas', 'naturaleza': 'HABER_IMPONIBLE', 'valor': 300_000})
            Liquidacion.objects.create(empleado=self.emp, mes=mes, anio=2026, sueldo_base=800_000,
                                       detalle_items=items, semana_corrida=30_000)
        d = self._simular().data['detalle']
        # 800.000 + colación 50.000 + bono 100.000 + comisiones 100.000 + semana corrida 30.000
        # + gratificación: 25 % de 1.030.000 = 257.500, tope 4,75 × 553.553 / 12 = 219.114
        self.assertEqual(d['base_indemnizacion'], 1_299_114)
        glosas = [l['glosa'] for l in d['base_indemnizacion_detalle']]
        self.assertIn('Colación', glosas)
        self.assertNotIn('Bono metas', glosas)
        self.assertFalse(any('familiar' in g or 'extras' in g for g in glosas))
        self.assertEqual(d['base_indemnizacion_meses'], 3)
        self.assertNotIn('aviso_base_indemnizacion', d)

    def test_sin_liquidaciones_usa_el_contrato_y_avisa(self, *_):
        d = self._simular().data['detalle']
        self.assertEqual(d['base_indemnizacion'], 800_000 + 200_000)
        self.assertIn('Sin liquidaciones', d['aviso_base_indemnizacion'])


class GratificacionAnualFiniquitoTests(APITestCase):
    """Contrato con gratificación anual: el finiquito paga la proporcional del año (Art. 52, modalidad Art. 50)."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('grat_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        self.emp.fecha_ingreso = datetime.date(2019, 3, 1); self.emp.afp = 'HABITAT'; self.emp.sistema_salud = 'FONASA'
        self.emp.save()
        Contrato.objects.filter(empleado=self.emp).delete()
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2019-03-01',
                                sueldo_base=1_000_000, gratificacion_legal='ANUAL')

    def _simular(self):
        return self.client.post('/api/finiquitos/simular/', {
            'empleado': self.emp.id, 'fecha_termino': '2026-09-15', 'dias_trabajados_ultimo_mes': 15,
            'causal_articulo': '159_2'}, format='json')

    def test_proporcional_con_tope(self, *_):
        r = self._simular()
        self.assertEqual(r.status_code, 200, r.data)
        # Devengado: 8 × 1.000.000 + 500.000 = 8.500.000 → 25 % = 2.125.000; tope 4,75 × 553.553 × 8,5 / 12 = 1.862.475
        self.assertEqual(r.data['detalle']['gratificacion_devengado_anio'], 8_500_000)
        self.assertEqual(r.data['gratificacion_proporcional'], 1_862_475)
        self.assertEqual(r.data['detalle']['gratificacion_modalidad'], 'ANUAL')
        self.assertIn('Art. 47', r.data['detalle']['aviso_gratificacion'])

    def test_impuesto_distribuido_no_en_un_solo_mes(self, *_):
        from core.indicadores import calcular_impuesto_unico
        r = self._simular()
        grat = r.data['gratificacion_proporcional']
        # Todo en el mes del término tributaría mucho más que repartido en los 9 meses devengados.
        de_golpe = calcular_impuesto_unico((500_000 + grat) * 0.82, 71721.0)
        self.assertLess(r.data['detalle']['impuesto_unico'], de_golpe)
        self.assertGreater(r.data['detalle']['afp'], 0)

    def test_usa_liquidaciones_del_anio(self, *_):
        for mes in (1, 2):
            Liquidacion.objects.create(empleado=self.emp, mes=mes, anio=2026, total_imponible=1_200_000, gratificacion=0,
                                       sueldo_base=1_000_000, total_haberes=1_200_000, sueldo_liquido=1)
        r = self._simular()
        self.assertEqual(r.data['detalle']['gratificacion_devengado_anio'], 8_500_000 + 2 * 200_000)

    def test_mensual_sin_cambios(self, *_):
        Contrato.objects.filter(empleado=self.emp).update(gratificacion_legal='MENSUAL')
        r = self._simular()
        self.assertEqual(r.data['gratificacion_proporcional'], 125_000)   # 25 % de 500.000
        self.assertNotIn('aviso_gratificacion', r.data['detalle'])
