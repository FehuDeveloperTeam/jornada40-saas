"""Horas extra compensadas con días de descanso (Art. 32 inc. 4°, Ley 21.561)."""
import datetime

from ..models import ConceptoRemuneracion, Liquidacion
from ..views.finiquitos import _calcular_finiquito
from ..views.horas_compensatorias import bolsa, tope_horas
from .test_documentos_laborales import DocumentosBase
from unittest.mock import patch

# Contrato de 42 h en 5 días: 8,4 h por día; valor hora = 1.000.000 / 30 × 7 / 42.
VALOR_HORA = 1_000_000 / 30 * 7 / 42


class HorasCompensatoriasTests(DocumentosBase):
    def setUp(self):
        super().setUp()
        self.concepto = ConceptoRemuneracion.objects.get(codigo='HORA_EXTRA_50', empresa=None)
        for nombre, valor in (('obtener_uf', 41057.20), ('obtener_utm', 71721.0)):
            p = patch(f'core.views.finiquitos.{nombre}', return_value=valor)
            p.start()
            self.addCleanup(p.stop)

    def _pacto(self, compensacion, desde='2026-03-01'):
        r = self._crear('HORAS_EXTRA', desde=desde, meses=1, horas_diarias=2, motivo='DEMANDA', compensacion=compensacion)
        self.assertEqual(r.status_code, 201, r.data)
        self._firmar(r.data['id'])
        return r.data

    def _liquidar(self, mes, anio, horas=0):
        items = [{'concepto': self.concepto.id, 'naturaleza': 'HORA_EXTRA', 'glosa': 'HE', 'horas': horas,
                  'recargo': 50}] if horas else []
        r = self.client.post('/api/liquidaciones/', {'empleado': self.emp.id, 'mes': mes, 'anio': anio,
                                                     'dias_trabajados': 30, 'detalle_items': items}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        return Liquidacion.objects.get(pk=r.data['id'])

    def _he(self, liq):
        return [i for i in liq.detalle_items if i.get('naturaleza') == 'HORA_EXTRA']

    def test_pacto_con_dias_libres_y_clausulas(self):
        doc = self._pacto('FERIADO')
        self.assertIn('días libres', doc['resumen'])
        pdf = self.client.get(f"/api/documentos-laborales/{doc['id']}/generar_pdf/")
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        opciones = self.client.get('/api/documentos-laborales/opciones/', {'empleado': self.emp.id}).data
        self.assertEqual(len(opciones['compensaciones_horas_extra']), 3)
        self.assertEqual(self._crear('HORAS_EXTRA', desde='2026-06-01', meses=1, horas_diarias=2, motivo='DEMANDA',
                                     compensacion='OTRA').status_code, 400)

    def test_starter_solo_pago(self):
        self.plan.nivel = 2
        self.plan.save()
        r = self._crear('HORAS_EXTRA', desde='2026-03-01', meses=1, horas_diarias=2, motivo='DEMANDA',
                        compensacion='FERIADO')
        self.assertEqual(r.status_code, 400)
        opciones = self.client.get('/api/documentos-laborales/opciones/', {'empleado': self.emp.id}).data
        self.assertEqual([o['valor'] for o in opciones['compensaciones_horas_extra']], ['PAGO'])

    def test_todas_a_descanso_uso_y_vencimiento(self):
        self._pacto('FERIADO')
        marzo = self._liquidar(3, 2026, horas=10)
        he = self._he(marzo)[0]
        self.assertEqual((he['horas_compensadas'], he['horas_feriado'], he['valor']), (10, 15, 0))
        self.assertIn('10 h compensadas con 15 h de descanso', he['nota_compensacion'])
        self.assertEqual(bolsa(self.emp, hasta=datetime.date(2026, 4, 1))['disponibles'], 15)

        # Un día libre (lunes 6 de abril) descuenta la jornada del día: 8,4 h.
        dia = {'empleado': self.emp.id, 'empresa': self.empresa.id, 'tipo': 'DIA_COMPENSATORIO',
               'fecha_inicio': '2026-04-06', 'fecha_fin': '2026-04-06', 'estado': 'APROBADO'}
        r = self.client.post('/api/vacaciones/', dia, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(float(r.data['horas_compensatorias']), 8.4)
        self.assertTrue(r.data['avisos'])                                 # aviso de 48 h (fecha pasada)
        r = self.client.post('/api/vacaciones/', {**dia, 'fecha_inicio': '2026-04-07', 'fecha_fin': '2026-04-07'},
                             format='json')
        self.assertEqual(r.status_code, 400)                              # quedan 6,6 h: no alcanza un día
        sab = self.client.post('/api/vacaciones/', {**dia, 'fecha_inicio': '2026-04-11', 'fecha_fin': '2026-04-11'},
                               format='json')
        self.assertEqual(sab.status_code, 400)                            # sábado sin jornada
        comp = self.client.get('/api/vacaciones/compensatorias/', {'empleado': self.emp.id}).data
        self.assertEqual(comp['tope_horas'], 42)

        # Las 6,6 h que quedaron vencen el 30-09-2026: se pagan en la liquidación de septiembre.
        septiembre = self._liquidar(9, 2026)
        pago = [i for i in self._he(septiembre) if i.get('lotes_compensatorios')][0]
        self.assertEqual(pago['lotes_compensatorios'], {'2026-03': 6.6})
        self.assertEqual(pago['valor'], round(VALOR_HORA * 6.6))
        self.assertEqual(bolsa(self.emp, hasta=datetime.date(2026, 10, 1))['vencidas_sin_pagar'], 0)
        # Recalcularla no duplica el pago.
        r = self.client.patch(f'/api/liquidaciones/{septiembre.id}/', {'detalle_items': septiembre.detalle_items},
                              format='json')
        self.assertEqual(r.status_code, 200, r.data)
        septiembre.refresh_from_db()
        self.assertEqual(len([i for i in self._he(septiembre) if i.get('lotes_compensatorios')]), 1)

    def test_mitad_y_tope_anual(self):
        self._pacto('MIXTO')
        he = self._he(self._liquidar(3, 2026, horas=10))[0]
        self.assertEqual((he['horas_compensadas'], he['horas_feriado']), (5, 7.5))
        self.assertEqual(he['valor'], round(VALOR_HORA * 1.5 * 5))
        self.assertEqual(tope_horas(self.contrato), 42)
        # Otro pacto en abril, todo a descanso: 40 h darían 60 h, pero quedan 34,5 h del tope.
        self._pacto('FERIADO', desde='2026-04-01')
        datos = {'empleado': self.emp.id, 'mes': 4, 'anio': 2026, 'dias_trabajados': 30, 'detalle_items': [
            {'concepto': self.concepto.id, 'naturaleza': 'HORA_EXTRA', 'glosa': 'HE', 'horas': 40, 'recargo': 50}]}
        sim = self.client.post('/api/liquidaciones/simular/', datos, format='json').data
        he = [i for i in sim['detalle_items'] if i.get('naturaleza') == 'HORA_EXTRA'][0]
        self.assertEqual((he['horas_feriado'], he['horas_compensadas']), (34.5, 23))
        self.assertEqual(he['valor'], round(VALOR_HORA * 1.5 * 17))
        self.assertTrue(any('tope' in a for a in sim['avisos_documentos']))

    def test_pendientes_se_pagan_en_el_finiquito(self):
        self._pacto('FERIADO')
        self._liquidar(3, 2026, horas=10)
        self.emp.refresh_from_db()
        _, detalle = _calcular_finiquito(self.emp, datetime.date(2026, 4, 30), 30, '161')
        self.assertEqual(detalle['horas_compensatorias'], 15)
        self.assertEqual(detalle['monto_horas_compensatorias'], round(VALOR_HORA * 15))
