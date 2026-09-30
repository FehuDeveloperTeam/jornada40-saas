"""Indemnización a todo evento (Art. 164): aporte mensual, LRE, Previred y finiquito."""
import datetime
from unittest.mock import patch

from ..models import Contrato, Empleado, Liquidacion
from ..views.finiquitos import _calcular_finiquito
from ..views.lre import fila_lre
from ..views.previred import _linea_previred
from .test_documentos_laborales import DocumentosBase

UF = 41057.20


class IndemnizacionTodoEventoTests(DocumentosBase):
    def setUp(self):
        super().setUp()
        Empleado.objects.filter(pk=self.emp.pk).update(fecha_ingreso='2018-01-01', sexo='F', afp='HABITAT')
        Contrato.objects.filter(pk=self.contrato.pk).update(fecha_inicio='2018-01-01')
        for modulo in ('finiquitos', 'lre', 'previred'):
            for nombre, valor in (('obtener_uf', UF), ('obtener_utm', 71721.0)):
                try:
                    p = patch(f'core.views.{modulo}.{nombre}', return_value=valor)
                    p.start()
                    self.addCleanup(p.stop)
                except AttributeError:
                    pass

    def _pacto(self):
        r = self._crear('INDEMNIZACION', porcentaje='4.11', desde='2026-01-01')
        self.assertEqual(r.status_code, 201, r.data)
        return r.data

    def _liquidar(self, mes, anio):
        r = self.client.post('/api/liquidaciones/', {'empleado': self.emp.id, 'mes': mes, 'anio': anio,
                                                     'dias_trabajados': 30, 'detalle_items': []}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        return Liquidacion.objects.get(pk=r.data['id'])

    def test_aporte_solo_con_pacto_firmado_y_desde_su_inicio(self):
        doc = self._pacto()
        self.assertEqual(self._liquidar(1, 2026).aporte_indemnizacion, 0)            # aún sin firmar
        self._firmar(doc['id'])
        Liquidacion.objects.all().delete()
        self.assertEqual(self._liquidar(12, 2025).aporte_indemnizacion, 0)           # antes del inicio
        liq = self._liquidar(1, 2026)
        self.assertEqual(liq.aporte_indemnizacion, int(liq.total_imponible * 0.0411))
        self.assertEqual(float(liq.tasa_indemnizacion), 4.11)
        # El aporte no cambia el líquido: se calcula aparte.
        self.assertEqual(liq.sueldo_liquido, liq.total_haberes - liq.total_descuentos)

        v, _, _ = fila_lre(liq, {})
        self.assertEqual((v[1131], v[1132], v[4131]), (1, '4,11', liq.aporte_indemnizacion))
        self.assertIn(liq.aporte_indemnizacion, [v[k] for k in v if k == 4131])
        campos = _linea_previred(liq)[0]
        self.assertEqual(campos[31], '04,11')
        self.assertEqual(int(campos[32]), liq.aporte_indemnizacion)

    def test_finiquito_indemniza_solo_los_anios_antes_del_pacto(self):
        self.emp.refresh_from_db()
        termino = datetime.date(2026, 9, 30)
        _, sin_pacto = _calcular_finiquito(self.emp, termino, 30, '161_1')
        self.assertEqual(sin_pacto['anios_indemnizacion'], 9)
        self._firmar(self._pacto()['id'])
        _, con_pacto = _calcular_finiquito(self.emp, termino, 30, '161_1')
        self.assertEqual(con_pacto['anios_indemnizacion'], 8)                      # 01-01-2018 a 31-12-2025
        self.assertEqual(con_pacto['pacto_todo_evento']['porcentaje'], '4.11')
