"""Asignación familiar calculada desde el tramo y las cargas (DFL 150, tablas SUSESO)."""
from rest_framework.test import APITestCase

from ..models import ConceptoRemuneracion, Contrato, Empleado
from .utiles import crear_empleado, crear_usuario_completo, indicadores_fijos


@indicadores_fijos
class AsignacionFamiliarTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('af_owner', '21.000.000-3', '76.000.555-2')
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        Empleado.objects.filter(pk=self.emp.pk).update(tramo_asignacion_familiar='A', cargas_simples=2,
                                                       cargas_invalidas=1, afp='HABITAT', sistema_salud='FONASA')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', cargo='Operario', fecha_inicio='2024-01-01',
                                sueldo_base=600_000, gratificacion_legal='MENSUAL')
        self.af = ConceptoRemuneracion.objects.get(codigo='ASIGNACION_FAMILIAR', empresa__isnull=True)
        self.client.force_authenticate(self.user)

    def _simular(self, mes=9, anio=2026, **datos):
        r = self.client.post('/api/liquidaciones/simular/', {'empleado': self.emp.id, 'mes': mes, 'anio': anio,
                                                             'dias_trabajados': 30, **datos}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def _asignacion(self, datos):
        return sum(int(i['valor']) for i in datos['detalle_items'] if i.get('concepto') == self.af.id)

    def test_monto_por_tramo_con_cargas_invalidas_al_doble(self, *_):
        datos = self._simular()
        self.assertEqual(self._asignacion(datos), 22_601 * (2 + 2))     # 2 simples + 1 inválida (doble)
        item = next(i for i in datos['detalle_items'] if i.get('concepto') == self.af.id)
        self.assertEqual((item['tramo'], item['monto_carga'], item['calculado']), ('A', 22_601, True))

    def test_valores_del_periodo(self, *_):
        self.assertEqual(self._asignacion(self._simular(mes=3, anio=2026)), 22_007 * 4)   # antes de la Ley 21.830

    def test_licencia_cuenta_y_menos_de_25_dias_es_proporcional(self, *_):
        self.assertEqual(self._asignacion(self._simular(dias_licencia=10, dias_trabajados=20)), 22_601 * 4)
        self.assertEqual(self._asignacion(self._simular(dias_ausencia=10, dias_trabajados=20)), 22_601 * 4 * 20 // 30)

    def test_el_monto_manual_se_reemplaza_por_el_legal(self, *_):
        datos = self._simular(detalle_items=[{'concepto': self.af.id, 'valor': 999_999}])
        self.assertEqual(self._asignacion(datos), 22_601 * 4)
        Empleado.objects.filter(pk=self.emp.pk).update(tramo_asignacion_familiar='D')
        self.assertEqual(self._asignacion(self._simular(detalle_items=[{'concepto': self.af.id, 'valor': 5_000}])), 0)

    def test_sin_tabla_para_el_periodo_se_conserva_lo_ingresado(self, *_):
        datos = self._simular(mes=3, anio=2025, detalle_items=[{'concepto': self.af.id, 'valor': 40_000}])
        self.assertEqual(self._asignacion(datos), 40_000)

    def test_no_es_imponible_y_llega_a_previred(self, *_):
        sin = self._simular()
        Empleado.objects.filter(pk=self.emp.pk).update(tramo_asignacion_familiar='D')
        con_d = self._simular()
        self.assertEqual(sin['total_imponible'], con_d['total_imponible'])
        self.assertEqual(sin['total_haberes'] - con_d['total_haberes'], 22_601 * 4)
