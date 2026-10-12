"""Ejemplos numéricos del documento técnico (docs/tecnico/03-requerimientos.md, sección 3.2).

Cada prueba reproduce un ejemplo del documento con el código real, con la UF y la
UTM fijas (@indicadores_fijos) y los parámetros previsionales que cargan las
migraciones para octubre de 2026. Si un cálculo cambia, la prueba falla: corrige
el código o actualiza el ejemplo del documento en el mismo commit.
"""
import datetime

from rest_framework.test import APITestCase

from ..denuncias_karin import PLAZO_DECISION, PLAZO_INVESTIGACION, habiles
from ..jornada import jornada_maxima_vigente
from ..models import ConceptoRemuneracion, Contrato
from ..registro_dt import PLAZO_CONTRATO, sumar_dias_habiles
from ..views.feriado import _calcular_dias_habiles_vacacion, calcular_saldo_vacaciones, es_feriado_cl
from ..views.finiquitos import _calcular_finiquito
from ..views.parametros import asignacion_familiar
from .utiles import crear_empleado, crear_usuario_completo, indicadores_fijos


class EjemplosDelDocumentoTests(APITestCase):

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('ejemplos', '11.111.111-1', '76.000.000-0')
        self.empleado = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana')
        self.empleado.afp = 'HABITAT'
        self.empleado.sistema_salud = 'FONASA'
        self.empleado.save()
        self.empleado.refresh_from_db()   # fecha_ingreso como fecha, no como texto
        Contrato.objects.create(empleado=self.empleado, tipo_contrato='INDEFINIDO', fecha_inicio='2024-01-01',
                                sueldo_base=1_500_000, horas_semanales=42, gratificacion_legal='MENSUAL')
        self.client.force_authenticate(user=self.user)

    @indicadores_fijos
    def test_ejemplo_liquidacion_mensual(self, *_):
        """RN-REM: sueldo $1.500.000, 42 h, 10 horas extra al 50 %, colación $50.000, octubre de 2026."""
        horas_extra = ConceptoRemuneracion.objects.get(empresa__isnull=True, codigo='HORA_EXTRA_50')
        colacion = ConceptoRemuneracion.objects.get(empresa__isnull=True, codigo='COLACION')
        resp = self.client.post('/api/liquidaciones/simular/', {
            'empleado': self.empleado.id, 'mes': 10, 'anio': 2026, 'dias_trabajados': 30,
            'detalle_items': [{'concepto': horas_extra.id, 'horas': 10, 'recargo': 50},
                              {'concepto': colacion.id, 'valor': 50_000}],
        }, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        r = resp.data
        valores = {i['glosa']: i['valor'] for i in r['detalle_items']}
        self.assertEqual(valores['Horas extras 50%'], 125_000)
        self.assertEqual((r['sueldo_base'], r['gratificacion'], r['total_imponible'], r['total_haberes']),
                         (1_500_000, 219_114, 1_844_114, 1_894_114))
        self.assertEqual((r['afp_monto'], r['salud_monto'], r['seguro_cesantia'], r['impuesto_unico']),
                         (207_831, 129_087, 11_064, 21_116))
        self.assertEqual((r['total_descuentos'], r['sueldo_liquido']), (369_098, 1_525_016))

    @indicadores_fijos
    def test_ejemplo_finiquito_necesidades_de_la_empresa(self, *_):
        """RN-FIN: mismo trabajador, término el 30-10-2026 por el Art. 161 inc. 1°, sin aviso previo."""
        montos, detalle = _calcular_finiquito(self.empleado, datetime.date(2026, 10, 30), 30, '161_1',
                                              aviso_previo_dado=False)
        self.assertEqual(detalle['anios_indemnizacion'], 3)
        self.assertEqual((detalle['base_indemnizacion'], detalle['tope_base_indemnizacion']), (1_719_114, 3_695_148))
        self.assertEqual((detalle['feriado_dias_saldo'], detalle['feriado_dias_proporcionales'],
                          detalle['feriado_dias_corridos']), (30, 12.46, 62.46))
        self.assertEqual((montos['gratificacion_proporcional'], montos['feriado_proporcional'],
                          montos['indemnizacion_anos_servicio'], montos['indemnizacion_sustitutiva_aviso']),
                         (219_114, 3_123_000, 5_157_342, 1_719_114))
        self.assertEqual((detalle['afp'], detalle['salud'], detalle['seguro_cesantia'], detalle['impuesto_unico']),
                         (193_744, 120_337, 10_314, 17_059))
        self.assertEqual((montos['descuentos_prevision'], montos['total_a_pagar']), (341_454, 11_377_116))

    def test_ejemplo_feriado_progresivo(self):
        """RN-VAC: 10 años acreditados con empleadores anteriores e ingreso el 01-03-2023."""
        otro = crear_empleado(self.empresa, '9.876.543-3', nombres='Luis')
        otro.fecha_ingreso = datetime.date(2023, 3, 1)
        otro.anios_previos_feriado = 10
        otro.save()
        saldo = calcular_saldo_vacaciones(otro, hasta=datetime.date(2026, 10, 31))
        self.assertEqual((saldo['anos_servicio'], saldo['dias_base'], saldo['dias_progresivos'],
                          saldo['dias_devengados']), (3, 45, 1, 46))
        self.assertIn('aviso_acumulacion', saldo)

    def test_ejemplo_dias_habiles_de_feriado(self):
        """RN-VAC: del lunes 14 al viernes 25 de septiembre de 2026 hay 9 días hábiles (el 18 es feriado)."""
        self.assertEqual(_calcular_dias_habiles_vacacion(datetime.date(2026, 9, 14), datetime.date(2026, 9, 25)), 9)

    def test_ejemplo_asignacion_familiar(self):
        """RN-REM: tramo A, dos cargas simples, octubre de 2026 (tabla vigente desde mayo de 2026)."""
        self.empleado.tramo_asignacion_familiar = 'A'
        self.empleado.cargas_simples = 2
        self.assertEqual(asignacion_familiar(self.empleado, 10, 2026, 30)[0], 45_202)
        self.assertEqual(asignacion_familiar(self.empleado, 10, 2026, 20)[0], 30_134)

    def test_ejemplo_plazos(self):
        """RN-DT y RN-KAR: plazos en días hábiles (lunes a viernes sin feriados)."""
        self.assertEqual(sumar_dias_habiles(datetime.date(2026, 9, 1), PLAZO_CONTRATO, es_feriado_cl),
                         datetime.date(2026, 9, 23))
        self.assertEqual(habiles(datetime.date(2026, 10, 5), PLAZO_DECISION), datetime.date(2026, 10, 8))
        self.assertEqual(habiles(datetime.date(2026, 10, 5), PLAZO_INVESTIGACION), datetime.date(2026, 11, 17))

    def test_ejemplo_jornada_maxima_por_fecha(self):
        """RN-CON: etapas de la Ley 21.561."""
        self.assertEqual([jornada_maxima_vigente(datetime.date.fromisoformat(f)) for f in
                          ('2026-04-25', '2026-04-26', '2028-04-25', '2028-04-26')], [44, 42, 42, 40])
