"""Cálculo de la liquidación, conceptos, comisiones, horas extra y AFC."""
from django.core.files.base import ContentFile
from rest_framework import status
from rest_framework.test import APITestCase
from ..models import Contrato, Liquidacion
import datetime  # noqa: E402  (usado por las pruebas de jornada)

from .utiles import crear_empleado, crear_usuario_completo


class ImpuestoUnicoTests(APITestCase):
    """Verifica la tabla de Impuesto Único de Segunda Categoría contra valores oficiales del SII."""

    def test_bajo_tramo_exento_no_paga_impuesto(self):
        from core.indicadores import calcular_impuesto_unico
        self.assertEqual(calcular_impuesto_unico(800_000, 71506.0), 0)

    def test_tramo_8_por_ciento_coincide_con_tabla_sii(self):
        # Ejemplo oficial: renta líquida $3.000.000, UTM $71.506 → $115.579,56 (redondeado 115.580)
        from core.indicadores import calcular_impuesto_unico
        self.assertEqual(calcular_impuesto_unico(3_000_000, 71506.0), 115580)

    def test_base_tributable_cero_no_paga_impuesto(self):
        from core.indicadores import calcular_impuesto_unico
        self.assertEqual(calcular_impuesto_unico(0, 71506.0), 0)

class LiquidacionRecalculoTests(APITestCase):
    """Verifica que editar una liquidación existente recalcule los totales,
    en vez de dejarlos congelados con los valores de la creación original."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo(
            'liquidacion_owner', '55.555.555-5', '88.888.888-8'
        )
        self.empleado = crear_empleado(self.empresa, '66.666.666-6')
        self.contrato = Contrato.objects.create(
            empleado=self.empleado, tipo_contrato='INDEFINIDO',
            fecha_inicio='2024-01-01', sueldo_base=1_000_000,
            gratificacion_legal='MENSUAL',
        )
        self.client.force_authenticate(user=self.user)

    def test_editar_dias_ausencia_recalcula_totales(self):
        resp_crear = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 1, 'anio': 2026,
            'dias_ausencia': 0,
        }, format='json')
        self.assertEqual(resp_crear.status_code, 201)
        liquidacion_id = resp_crear.data['id']
        sueldo_base_sin_ausencias = resp_crear.data['sueldo_base']
        liquido_sin_ausencias = resp_crear.data['sueldo_liquido']

        resp_editar = self.client.patch(f'/api/liquidaciones/{liquidacion_id}/', {
            'dias_ausencia': 10,
        }, format='json')
        self.assertEqual(resp_editar.status_code, 200)

        # Con 10 días de ausencia, el sueldo base proporcional y el líquido
        # deben ser menores — si quedaran "congelados", serían idénticos.
        self.assertLess(resp_editar.data['sueldo_base'], sueldo_base_sin_ausencias)
        self.assertLess(resp_editar.data['sueldo_liquido'], liquido_sin_ausencias)
        self.assertEqual(resp_editar.data['dias_ausencia'], 10)

    def test_editar_liquidacion_limpia_pdf_generado(self):
        resp_crear = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 2, 'anio': 2026,
        }, format='json')
        liquidacion_id = resp_crear.data['id']

        liquidacion = Liquidacion.objects.get(id=liquidacion_id)
        liquidacion.archivo_pdf.save('test.pdf', ContentFile(b'%PDF-fake'), save=True)
        self.assertTrue(liquidacion.archivo_pdf)

        self.client.patch(f'/api/liquidaciones/{liquidacion_id}/', {'dias_ausencia': 5}, format='json')

        liquidacion.refresh_from_db()
        self.assertFalse(liquidacion.archivo_pdf)


class CatalogoConceptosTests(APITestCase):
    """El catálogo reemplaza la glosa libre y define la naturaleza del haber."""

    def setUp(self):
        from core.models import ConceptoRemuneracion
        self.user, _, _, self.empresa = crear_usuario_completo(
            'cat_user', '19000000-1', '76900001-1')
        self.otro_user, _, _, self.otra_empresa = crear_usuario_completo(
            'cat_otro', '19000000-2', '76900001-2')
        self.client.force_authenticate(user=self.user)
        self.colacion = ConceptoRemuneracion.objects.get(codigo='COLACION', empresa=None)
        self.bono = ConceptoRemuneracion.objects.get(codigo='BONO_PRODUCCION', empresa=None)

    # ── Naturaleza derivada del tipo ────────────────────────────────────────

    def test_la_naturaleza_la_fija_el_tipo_y_no_quien_lo_crea(self):
        """Un concepto no imponible no puede nacer marcado como imponible."""
        from core.models import ConceptoRemuneracion
        concepto = ConceptoRemuneracion.objects.create(
            codigo='BONO_RARO', nombre='Bono raro', tipo='HABER_NO_IMPONIBLE',
            empresa=self.empresa, es_imponible=True, afecta_gratificacion=True,
        )
        concepto.refresh_from_db()
        self.assertFalse(concepto.es_imponible)
        self.assertFalse(concepto.afecta_gratificacion)

    def test_comision_afecta_semana_corrida_y_hora_extra_no(self):
        """Art. 32 inciso final: las horas extras se excluyen de semana corrida."""
        from core.models import ConceptoRemuneracion
        comision = ConceptoRemuneracion.objects.create(
            codigo='COM_X', nombre='Comisión X', tipo='COMISION', empresa=self.empresa)
        hora = ConceptoRemuneracion.objects.get(codigo='HORA_EXTRA_50', empresa=None)
        self.assertTrue(comision.afecta_semana_corrida)
        self.assertFalse(hora.afecta_semana_corrida)

    # ── Endpoint ────────────────────────────────────────────────────────────

    def test_lista_incluye_catalogo_del_sistema(self):
        resp = self.client.get('/api/conceptos/?tipo=HABER_NO_IMPONIBLE')
        codigos = [c['codigo'] for c in resp.data]
        self.assertIn('COLACION', codigos)
        self.assertIn('MOVILIZACION', codigos)

    def test_no_se_ven_conceptos_propios_de_otra_empresa(self):
        from core.models import ConceptoRemuneracion
        ajeno = ConceptoRemuneracion.objects.create(
            codigo='AJENO', nombre='Bono ajeno', tipo='HABER_IMPONIBLE',
            empresa=self.otra_empresa)
        resp = self.client.get('/api/conceptos/')
        self.assertNotIn(ajeno.id, [c['id'] for c in resp.data])

    def test_no_se_puede_modificar_un_concepto_del_sistema(self):
        resp = self.client.patch(f'/api/conceptos/{self.colacion.id}/',
                                 {'nombre': 'Secuestrado'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_eliminar_un_concepto_propio_lo_desactiva(self):
        """Las liquidaciones emitidas lo referencian: no se borra, se oculta."""
        from core.models import ConceptoRemuneracion
        propio = ConceptoRemuneracion.objects.create(
            codigo='PROPIO', nombre='Bono propio', tipo='HABER_IMPONIBLE',
            empresa=self.empresa)
        resp = self.client.delete(f'/api/conceptos/{propio.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        propio.refresh_from_db()
        self.assertFalse(propio.activo)

    # ── Efecto en el cálculo ────────────────────────────────────────────────

    def _liquidar(self, **listas):
        from core.views import _calcular_liquidacion

        class ContratoFalso:
            sueldo_base = 1_000_000
            tipo_contrato = 'INDEFINIDO'
            gratificacion_legal = 'MENSUAL'
            tiene_quincena = False
            monto_quincena = 0
            comisiones_config = []

        class EmpleadoFalso:
            afp = 'MODELO'
            sistema_salud = 'FONASA'
            plan_isapre_uf = 0

        datos = {'mes': 3, 'anio': 2025, 'dias_trabajados': 30, **listas}
        return _calcular_liquidacion(ContratoFalso(), EmpleadoFalso(), datos)

    def test_haber_no_imponible_no_entra_a_la_base_de_cotizacion(self):
        sin = self._liquidar()
        con = self._liquidar(detalle_haberes_no_imponibles=[
            {'concepto': self.colacion.id, 'glosa': 'x', 'valor': 100_000}])
        self.assertEqual(sin['total_imponible'], con['total_imponible'])
        self.assertEqual(con['total_haberes'], sin['total_haberes'] + 100_000)

    def test_haber_imponible_si_entra_a_la_base(self):
        sin = self._liquidar()
        con = self._liquidar(detalle_haberes_imponibles=[
            {'concepto': self.bono.id, 'glosa': 'x', 'valor': 100_000}])
        self.assertGreater(con['total_imponible'], sin['total_imponible'])
        self.assertGreater(con['afp_monto'], sin['afp_monto'])

    def test_la_glosa_se_congela_desde_el_concepto(self):
        """Lo que el cliente mande como glosa no manda: la fija el catálogo."""
        resultado = self._liquidar(detalle_haberes_no_imponibles=[
            {'concepto': self.colacion.id, 'glosa': 'lo que sea', 'valor': 50_000}])
        self.assertEqual(resultado['detalle_items'][0]['glosa'], self.colacion.nombre)

    def test_item_sin_concepto_conserva_el_comportamiento_anterior(self):
        """Los datos previos al catálogo se siguen clasificando por su lista."""
        resultado = self._liquidar(detalle_haberes_imponibles=[
            {'glosa': 'Bono antiguo sin concepto', 'valor': 80_000}])
        base = self._liquidar()
        self.assertGreater(resultado['total_imponible'], base['total_imponible'])

    # ── Validación ──────────────────────────────────────────────────────────

    def test_rechaza_un_concepto_en_la_seccion_equivocada(self):
        empleado = crear_empleado(self.empresa, '11900001-1')
        Contrato.objects.create(empleado=empleado, sueldo_base=800_000,
                                fecha_inicio='2024-01-01', cargo='Analista')
        resp = self.client.post('/api/liquidaciones/', {
            'empleado': empleado.id, 'mes': 3, 'anio': 2025,
            'dias_trabajados': 30,
            # Colación es no imponible: no puede ir entre los imponibles
            'detalle_haberes_imponibles': [
                {'concepto': self.colacion.id, 'glosa': 'x', 'valor': 50_000}],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rechaza_un_concepto_de_otra_empresa(self):
        from core.models import ConceptoRemuneracion
        ajeno = ConceptoRemuneracion.objects.create(
            codigo='AJENO2', nombre='Bono ajeno', tipo='HABER_IMPONIBLE',
            empresa=self.otra_empresa)
        empleado = crear_empleado(self.empresa, '11900002-2')
        Contrato.objects.create(empleado=empleado, sueldo_base=800_000,
                                fecha_inicio='2024-01-01', cargo='Analista')
        resp = self.client.post('/api/liquidaciones/', {
            'empleado': empleado.id, 'mes': 4, 'anio': 2025, 'dias_trabajados': 30,
            'detalle_haberes_imponibles': [
                {'concepto': ajeno.id, 'glosa': 'x', 'valor': 50_000}],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class ComportamientoListasDetalleTests(APITestCase):
    """Fija el comportamiento actual de las listas de detalle antes de unificarlas.

    No prueban código nuevo: existen para que, al pasar de cuatro listas a una
    sola, cualquier diferencia en los montos, en los PDF o en el Libro de
    Remuneraciones salte de inmediato. Son la red de seguridad del refactor.
    """

    def setUp(self):
        from core.models import ConceptoRemuneracion
        self.user, _, _, self.empresa = crear_usuario_completo(
            'det_user', '17000000-1', '76700001-1')
        self.client.force_authenticate(user=self.user)
        self.empleado = crear_empleado(self.empresa, '11700001-1')
        self.contrato = Contrato.objects.create(
            empleado=self.empleado, sueldo_base=1_000_000,
            fecha_inicio='2024-01-01', cargo='Vendedor',
            es_comisionista=True,
            comisiones_config=[{'glosa': 'Carrocería', 'porcentaje': 0.5}],
        )
        self.bono = ConceptoRemuneracion.objects.get(codigo='BONO_PRODUCCION', empresa=None)
        self.colacion = ConceptoRemuneracion.objects.get(codigo='COLACION', empresa=None)
        self.hora50 = ConceptoRemuneracion.objects.get(codigo='HORA_EXTRA_50', empresa=None)
        self.anticipo = ConceptoRemuneracion.objects.get(codigo='ANTICIPO', empresa=None)

    def _payload(self, **extra):
        return {
            'empleado': self.empleado.id, 'mes': 5, 'anio': 2025,
            'dias_trabajados': 30,
            'detalle_haberes_imponibles': [
                {'concepto': self.bono.id, 'glosa': 'Bono', 'valor': 200_000}],
            'detalle_horas_extras': [
                {'concepto': self.hora50.id, 'glosa': 'HE', 'horas': 10,
                 'recargo': 50, 'valor': 80_000}],
            'detalle_haberes_no_imponibles': [
                {'concepto': self.colacion.id, 'glosa': 'Colación', 'valor': 60_000}],
            'detalle_otros_descuentos': [
                {'concepto': self.anticipo.id, 'glosa': 'Anticipo', 'valor': 50_000}],
            'detalle_comisiones': [
                {'glosa': 'Carrocería', 'monto_vendido': 4_000_000}],
            **extra,
        }

    def _crear(self, **extra):
        resp = self.client.post('/api/liquidaciones/', self._payload(**extra), format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        return resp.data

    @staticmethod
    def _items(liq, naturaleza):
        """Ítems de una naturaleza en la respuesta del API."""
        return [i for i in liq['detalle_items'] if i.get('naturaleza') == naturaleza]

    # ── Montos ──────────────────────────────────────────────────────────────

    def test_cada_lista_aporta_a_los_totales_que_le_corresponden(self):
        liq = self._crear()
        # Imponible incluye sueldo, bono, horas extras, comisión y semana corrida
        self.assertGreater(liq['total_imponible'], 1_000_000 + 200_000 + 80_000)
        # La colación suma a haberes pero no a imponible
        self.assertEqual(liq['total_haberes'], liq['total_imponible'] + 60_000)
        # El anticipo suma a los descuentos
        self.assertIn(50_000, [d['valor'] for d in self._items(liq, 'DESCUENTO')])

    def test_la_comision_se_calcula_con_el_porcentaje_del_contrato(self):
        liq = self._crear()
        # 4.000.000 x 0,5% = 20.000
        comision = self._items(liq, 'COMISION')[0]
        self.assertEqual(comision['valor'], 20_000)
        self.assertEqual(comision['porcentaje'], 0.5)

    def test_la_comision_genera_semana_corrida_y_las_horas_extras_no(self):
        con_comision = self._crear()
        self.assertGreater(con_comision['semana_corrida'], 0)

        sin_comision = self.client.post('/api/liquidaciones/', self._payload(
            mes=6, detalle_comisiones=[]), format='json').data
        self.assertEqual(sin_comision['semana_corrida'], 0)

    # ── Recálculo con términos congelados ───────────────────────────────────

    def test_editar_conserva_el_porcentaje_historico_de_la_comision(self):
        """El riesgo más sutil: recalcular no debe perder la comisión."""
        liq = self._crear()
        liq_id = liq['id']

        # Cambia la tasa pactada después de emitida
        self.contrato.comisiones_config = [{'glosa': 'Carrocería', 'porcentaje': 9.9}]
        self.contrato.save(update_fields=['comisiones_config'])

        resp = self.client.patch(f'/api/liquidaciones/{liq_id}/',
                                 {'dias_ausencia': 1}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        # Sigue usando el 0,5% con que se emitió, no el 9,9% nuevo
        comision = self._items(resp.data, 'COMISION')[0]
        self.assertEqual(comision['porcentaje'], 0.5)
        self.assertEqual(comision['valor'], 20_000)

    def test_editar_conserva_todas_las_listas(self):
        liq = self._crear()
        resp = self.client.patch(f'/api/liquidaciones/{liq["id"]}/',
                                 {'dias_ausencia': 2}, format='json')
        for naturaleza in ('HABER_IMPONIBLE', 'HORA_EXTRA', 'HABER_NO_IMPONIBLE',
                           'DESCUENTO', 'COMISION'):
            self.assertEqual(len(self._items(resp.data, naturaleza)), 1,
                             f'{naturaleza} se perdió al editar')

    # ── Salidas: PDF y Libro de Remuneraciones ──────────────────────────────

    def test_el_pdf_de_la_liquidacion_se_genera(self):
        liq = self._crear()
        resp = self.client.get(f'/api/liquidaciones/{liq["id"]}/generar_pdf/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp['Content-Type'], 'application/pdf')
        self.assertGreater(len(resp.content), 1000)

    def test_el_libro_cuadra_las_columnas_con_el_total(self):
        """Otros imponibles debe cubrir bono, horas extras, comisión y semana corrida."""
        liq = self._crear()
        resp = self.client.get(
            f'/api/liquidaciones/libro_remuneraciones/?mes=5&anio=2025'
            f'&empresa={self.empresa.id}&formato=excel')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        registro = Liquidacion.objects.get(id=liq['id'])
        # La hora extra la calcula el backend desde horas, recargo y contrato:
        # los $80.000 del payload ya no se toman tal cual.
        otros_imp = (200_000
                     + registro.items_de('HORA_EXTRA')[0]['valor']
                     + registro.items_de('COMISION')[0]['valor']
                     + registro.semana_corrida)
        self.assertEqual(
            registro.sueldo_base + registro.gratificacion + otros_imp,
            registro.total_imponible)


class DetalleUnificadoTests(APITestCase):
    """La lista única reemplaza a las cuatro anteriores."""

    def setUp(self):
        from core.models import ConceptoRemuneracion
        self.user, _, _, self.empresa = crear_usuario_completo(
            'uni_user', '18000000-1', '76800001-1')
        self.client.force_authenticate(user=self.user)
        self.empleado = crear_empleado(self.empresa, '11800001-1')
        Contrato.objects.create(
            empleado=self.empleado, sueldo_base=1_000_000,
            fecha_inicio='2024-01-01', cargo='Analista')
        self.bono = ConceptoRemuneracion.objects.get(codigo='BONO_PRODUCCION', empresa=None)
        self.colacion = ConceptoRemuneracion.objects.get(codigo='COLACION', empresa=None)

    def test_acepta_el_formato_nuevo_de_lista_unica(self):
        resp = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 7, 'anio': 2025,
            'dias_trabajados': 30,
            'detalle_items': [
                {'concepto': self.bono.id, 'naturaleza': 'HABER_IMPONIBLE',
                 'glosa': 'x', 'valor': 150_000},
                {'concepto': self.colacion.id, 'naturaleza': 'HABER_NO_IMPONIBLE',
                 'glosa': 'x', 'valor': 40_000},
            ],
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        self.assertEqual(len(resp.data['detalle_items']), 2)
        # La colación no cotiza pero sí suma a haberes
        self.assertEqual(resp.data['total_haberes'], resp.data['total_imponible'] + 40_000)

    def test_los_dos_formatos_dan_el_mismo_resultado(self):
        """Compatibilidad: un cliente sin actualizar debe calcular igual."""
        viejo = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 8, 'anio': 2025, 'dias_trabajados': 30,
            'detalle_haberes_imponibles': [
                {'concepto': self.bono.id, 'glosa': 'x', 'valor': 150_000}],
            'detalle_haberes_no_imponibles': [
                {'concepto': self.colacion.id, 'glosa': 'x', 'valor': 40_000}],
        }, format='json').data

        nuevo = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 9, 'anio': 2025, 'dias_trabajados': 30,
            'detalle_items': [
                {'concepto': self.bono.id, 'naturaleza': 'HABER_IMPONIBLE',
                 'glosa': 'x', 'valor': 150_000},
                {'concepto': self.colacion.id, 'naturaleza': 'HABER_NO_IMPONIBLE',
                 'glosa': 'x', 'valor': 40_000},
            ],
        }, format='json').data

        for campo in ('total_imponible', 'total_haberes', 'total_descuentos',
                      'sueldo_liquido', 'afp_monto', 'salud_monto'):
            self.assertEqual(viejo[campo], nuevo[campo], f'{campo} difiere entre formatos')

    def test_items_agrupados_separa_por_naturaleza(self):
        resp = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 10, 'anio': 2025, 'dias_trabajados': 30,
            'detalle_items': [
                {'concepto': self.bono.id, 'naturaleza': 'HABER_IMPONIBLE',
                 'glosa': 'x', 'valor': 100_000},
                {'concepto': self.colacion.id, 'naturaleza': 'HABER_NO_IMPONIBLE',
                 'glosa': 'x', 'valor': 30_000},
            ],
        }, format='json')
        registro = Liquidacion.objects.get(id=resp.data['id'])
        agrupados = registro.items_agrupados
        self.assertEqual(len(agrupados['imponibles']), 1)
        self.assertEqual(len(agrupados['no_imponibles']), 1)
        self.assertEqual(agrupados['descuentos'], [])


class ComisionesCatalogoTests(APITestCase):
    """Las categorías de comisión se identifican por concepto, no por glosa.

    Identificarlas por nombre significaba que renombrar una categoría dejaba
    huérfanas las liquidaciones ya emitidas y su comisión se recalculaba en
    cero. El id del concepto no cambia al renombrar.
    """

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo(
            'com_user', '16000000-1', '76600001-1')
        self.client.force_authenticate(user=self.user)
        self.empleado = crear_empleado(self.empresa, '11600001-1')

    def _crear_contrato(self, categorias):
        resp = self.client.post('/api/contratos/', {
            'empleado': self.empleado.id, 'sueldo_base': 1_000_000,
            'fecha_inicio': '2024-01-01', 'cargo': 'Vendedor',
            'es_comisionista': True, 'comisiones_config': categorias,
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED, resp.data)
        return Contrato.objects.get(id=resp.data['id'])

    def test_guardar_el_contrato_crea_el_concepto_de_la_categoria(self):
        from core.models import ConceptoRemuneracion
        contrato = self._crear_contrato([{'glosa': 'Carrocería', 'porcentaje': 0.5}])

        concepto = ConceptoRemuneracion.objects.get(
            empresa=self.empresa, tipo='COMISION', nombre='Carrocería')
        self.assertTrue(concepto.afecta_semana_corrida)
        self.assertEqual(contrato.comisiones_config,
                         [{'concepto': concepto.id, 'porcentaje': 0.5}])

    def test_la_misma_categoria_no_se_duplica(self):
        from core.models import ConceptoRemuneracion
        self._crear_contrato([{'glosa': 'Carrocería', 'porcentaje': 0.5}])
        otro = crear_empleado(self.empresa, '11600002-2')
        self.client.post('/api/contratos/', {
            'empleado': otro.id, 'sueldo_base': 900_000,
            'fecha_inicio': '2024-01-01', 'cargo': 'Vendedor',
            'es_comisionista': True,
            'comisiones_config': [{'glosa': 'carrocería', 'porcentaje': 0.7}],
        }, format='json')

        self.assertEqual(ConceptoRemuneracion.objects.filter(
            empresa=self.empresa, tipo='COMISION').count(), 1)

    def test_renombrar_la_categoria_no_rompe_la_liquidacion_emitida(self):
        """El caso que motivó el cambio."""
        from core.models import ConceptoRemuneracion
        contrato = self._crear_contrato([{'glosa': 'Carrocería', 'porcentaje': 0.5}])
        concepto = ConceptoRemuneracion.objects.get(
            empresa=self.empresa, tipo='COMISION', nombre='Carrocería')

        liq = self.client.post('/api/liquidaciones/', {
            'empleado': self.empleado.id, 'mes': 4, 'anio': 2025,
            'dias_trabajados': 30,
            'detalle_items': [{
                'concepto': concepto.id, 'naturaleza': 'COMISION',
                'glosa': 'Carrocería', 'monto_vendido': 4_000_000,
            }],
        }, format='json').data
        comision = [i for i in liq['detalle_items'] if i['naturaleza'] == 'COMISION'][0]
        self.assertEqual(comision['valor'], 20_000)

        # Se renombra el concepto en el catálogo
        concepto.nombre = 'Carrocería Pesada'
        concepto.save(update_fields=['nombre'])

        resp = self.client.patch(f'/api/liquidaciones/{liq["id"]}/',
                                 {'dias_ausencia': 1}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK, resp.data)
        recalculada = [i for i in resp.data['detalle_items']
                       if i['naturaleza'] == 'COMISION'][0]
        # Antes esto daba 0 porque la glosa ya no calzaba con la del contrato
        self.assertEqual(recalculada['porcentaje'], 0.5)
        self.assertEqual(recalculada['valor'], 20_000)

    def test_una_liquidacion_previa_al_catalogo_sigue_resolviendo_por_glosa(self):
        """Compatibilidad con lo emitido antes de que existieran los conceptos."""
        from core.views import _terminos_congelados
        contrato = self._crear_contrato([{'glosa': 'Carrocería', 'porcentaje': 0.5}])
        liq = Liquidacion.objects.create(
            empleado=self.empleado, mes=1, anio=2025, sueldo_base_contrato=1_000_000,
            detalle_items=[{'naturaleza': 'COMISION', 'glosa': 'Carrocería',
                            'monto_vendido': 2_000_000, 'porcentaje': 0.5,
                            'valor': 10_000}],
        )
        porcentajes = _terminos_congelados(liq, contrato)['porcentajes_comision']
        self.assertEqual(porcentajes.get('Carrocería'), 0.5)


class HorasExtraEnServidorTests(APITestCase):
    """El valor de las horas extra lo calcula el backend con los datos del contrato."""

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Cliente, Empresa, Empleado, Plan, Contrato
        u = User.objects.create_user(username='12.345.678-5', password='x')
        plan = Plan.objects.create(nombre='Pyme', precio=0, max_empresas=3, limite_trabajadores=75, nivel=3)
        Cliente.objects.create(usuario=u, rut='12.345.678-5', nombres='A', plan=plan)
        empresa = Empresa.objects.create(owner=u, nombre_legal='E', rut='76.123.456-0')
        # Ficha con 44 h (dato viejo) y contrato con 42 h: manda el contrato.
        self.empleado = Empleado.objects.create(empresa=empresa, rut='9.876.543-3', nombres='T',
            apellido_paterno='P', cargo='C', fecha_ingreso='2026-01-01', horas_laborales=44)
        self.contrato = Contrato.objects.create(empleado=self.empleado, fecha_inicio='2026-01-01',
            sueldo_base=840000, horas_semanales=42)

    def _calcular(self, items):
        from core.views import _calcular_liquidacion, _terminos_vigentes
        terminos = {**_terminos_vigentes(self.contrato), 'valor_uf': 40000.0}
        return _calcular_liquidacion(self.contrato, self.empleado,
                                     {'mes': 9, 'anio': 2026, 'dias_trabajados': 30, 'detalle_items': items},
                                     terminos=terminos)

    def test_valor_con_las_horas_del_contrato(self):
        # 840.000 / 30 × 7 / 42 = 4.666,67 la hora; con 50 % = 7.000; × 10 h = 70.000.
        r = self._calcular([{'naturaleza': 'HORA_EXTRA', 'glosa': 'Horas extra', 'horas': 10,
                             'recargo': 50, 'valor': 1}])
        extra = [i for i in r['detalle_items'] if i['naturaleza'] == 'HORA_EXTRA'][0]
        self.assertEqual(extra['valor'], 70000)  # el "1" del navegador se ignora
        self.assertEqual(float(r['horas_semanales_contrato']), 42.0)

    def test_sin_recargo_usa_el_minimo_legal(self):
        r = self._calcular([{'naturaleza': 'HORA_EXTRA', 'glosa': 'HE', 'horas': 10, 'valor': 0}])
        extra = [i for i in r['detalle_items'] if i['naturaleza'] == 'HORA_EXTRA'][0]
        self.assertEqual((extra['recargo'], extra['valor']), (50.0, 70000))

    def test_item_sin_horas_conserva_su_valor(self):
        r = self._calcular([{'naturaleza': 'HORA_EXTRA', 'glosa': 'HE antigua', 'valor': 12345}])
        extra = [i for i in r['detalle_items'] if i['naturaleza'] == 'HORA_EXTRA'][0]
        self.assertEqual(extra['valor'], 12345)

    def test_la_ficha_refleja_las_horas_del_contrato(self):
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.horas_laborales, 42)
        self.contrato.horas_semanales = 40
        self.contrato.save()
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.horas_laborales, 40)


class AfcOnceAniosTests(APITestCase):
    """Desde el año 11 de un contrato indefinido el trabajador no cotiza cesantía."""

    def _liquidar(self, fecha_ingreso, tipo='INDEFINIDO'):
        from core.views import _calcular_liquidacion

        class C:
            sueldo_base = 1_000_000; tipo_contrato = tipo; gratificacion_legal = 'MENSUAL'
            tiene_quincena = False; monto_quincena = 0; comisiones_config = []; horas_semanales = 42
            fecha_inicio = None

        class E:
            afp = 'MODELO'; sistema_salud = 'FONASA'; plan_isapre_uf = 0

        e = E(); e.fecha_ingreso = fecha_ingreso
        return _calcular_liquidacion(C(), e, {'mes': 9, 'anio': 2026, 'dias_trabajados': 30})

    def test_diez_anios_cotiza(self):
        self.assertGreater(self._liquidar(datetime.date(2016, 1, 1))['seguro_cesantia'], 0)

    def test_once_anios_no_cotiza(self):
        self.assertEqual(self._liquidar(datetime.date(2015, 1, 1))['seguro_cesantia'], 0)

    def test_borde_del_aniversario(self):
        from core.views import _anios_de_servicio

        class E: pass
        e = E()
        e.fecha_ingreso = datetime.date(2015, 9, 30)
        self.assertEqual(_anios_de_servicio(e, None, 9, 2026), 11)   # cumple el 30-09-2026
        e.fecha_ingreso = datetime.date(2015, 10, 1)
        self.assertEqual(_anios_de_servicio(e, None, 9, 2026), 10)

    def test_tasa_del_empleador(self):
        from core.views import _parametros_previsionales, _tasas_afc
        p = _parametros_previsionales(9, 2026)
        self.assertEqual(_tasas_afc(p, 'INDEFINIDO', 11), (0.0, 0.008))
        self.assertEqual(_tasas_afc(p, 'INDEFINIDO', 3), (0.006, 0.024))
        self.assertEqual(_tasas_afc(p, 'PLAZO_FIJO', 20), (0.0, 0.03))


class RemuneracionesPeriodoTests(APITestCase):
    """Vista previa, filtros por período y ZIP de liquidaciones (paso B del panel)."""

    def _usuario(self, nivel, sufijo='1'):
        from django.contrib.auth.models import User
        from core.models import Cliente, Contrato, Empresa, Empleado, Plan, Suscripcion
        plan = Plan.objects.create(nombre=f'P{nivel}{sufijo}', precio=0, max_empresas=10, limite_trabajadores=250, nivel=nivel)
        u = User.objects.create_user(username=f'{nivel}{sufijo}.111.111-1', password='x')
        c = Cliente.objects.create(usuario=u, rut=f'{nivel}{sufijo}.111.111-1', nombres='A', plan=plan)
        Suscripcion.objects.create(cliente=c, plan=plan, estado='ACTIVE')
        e = Empresa.objects.create(owner=u, nombre_legal='E', rut=f'7{nivel}.{sufijo}00.001-1')
        emp = Empleado.objects.create(empresa=e, rut=f'{nivel}.{sufijo}33.333-3', nombres='V', apellido_paterno='V',
                                      cargo='C', fecha_ingreso='2020-01-01', afp='HABITAT', sistema_salud='FONASA')
        Contrato.objects.create(empleado=emp, tipo_contrato='INDEFINIDO', fecha_inicio='2020-01-01',
                                sueldo_base=900_000, gratificacion_legal='MENSUAL')
        self.client.force_authenticate(u)
        return u, e, emp

    def test_simular_igual_a_emitir_y_no_guarda(self):
        from core.models import Liquidacion
        _, _, emp = self._usuario(3)
        datos = {'empleado': emp.id, 'mes': 9, 'anio': 2026, 'dias_trabajados': 30, 'dias_ausencia': 2}
        sim = self.client.post('/api/liquidaciones/simular/', datos, format='json')
        self.assertEqual(sim.status_code, 200, sim.data)
        self.assertEqual(Liquidacion.objects.count(), 0)
        real = self.client.post('/api/liquidaciones/', datos, format='json')
        self.assertEqual(real.status_code, 201)
        for campo in ('sueldo_base', 'gratificacion', 'afp_monto', 'salud_monto', 'seguro_cesantia',
                      'impuesto_unico', 'total_imponible', 'total_descuentos', 'sueldo_liquido'):
            self.assertEqual(sim.data[campo], real.data[campo], campo)

    def test_simular_trabajador_ajeno(self):
        _, _, ajeno = self._usuario(3, '2')
        self._usuario(3, '3')
        r = self.client.post('/api/liquidaciones/simular/', {'empleado': ajeno.id, 'mes': 9, 'anio': 2026}, format='json')
        self.assertEqual(r.status_code, 404)

    def test_filtro_por_empresa_y_periodo(self):
        _, e, emp = self._usuario(3)
        for mes in (8, 9):
            self.client.post('/api/liquidaciones/', {'empleado': emp.id, 'mes': mes, 'anio': 2026}, format='json')
        r = self.client.get(f'/api/liquidaciones/?empresa={e.id}&mes=9&anio=2026')
        datos = r.data['results'] if isinstance(r.data, dict) else r.data
        self.assertEqual([d['mes'] for d in datos], [9])

    def test_zip_periodo_pyme(self):
        import io, zipfile
        _, e, emp = self._usuario(3)
        self.client.post('/api/liquidaciones/', {'empleado': emp.id, 'mes': 9, 'anio': 2026}, format='json')
        r = self.client.get(f'/api/liquidaciones/zip_periodo/?empresa={e.id}&mes=9&anio=2026')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(zipfile.ZipFile(io.BytesIO(r.content)).namelist()), 1)

    def test_zip_periodo_requiere_pyme(self):
        _, e, _ = self._usuario(2)
        r = self.client.get(f'/api/liquidaciones/zip_periodo/?empresa={e.id}&mes=9&anio=2026')
        self.assertEqual(r.status_code, 403)

    def test_pdf_individual_sigue_funcionando(self):
        _, _, emp = self._usuario(1)
        liq = self.client.post('/api/liquidaciones/', {'empleado': emp.id, 'mes': 9, 'anio': 2026}, format='json')
        r = self.client.get(f"/api/liquidaciones/{liq.data['id']}/generar_pdf/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.content.startswith(b'%PDF'))


class ConceptosEdicionTests(APITestCase):
    """El catálogo en el panel nuevo: tipo y código fijos; código único por empresa."""

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Empresa
        self.u = User.objects.create_user(username='5.555.555-5', password='x')
        self.e = Empresa.objects.create(owner=self.u, nombre_legal='E', rut='76.555.555-5')
        self.client.force_authenticate(self.u)

    def _crear(self, codigo='bono-turno', tipo='HABER_IMPONIBLE'):
        return self.client.post('/api/conceptos/', {'empresa': self.e.id, 'codigo': codigo, 'nombre': 'Bono turno', 'tipo': tipo}, format='json')

    def test_crear_fija_naturaleza_por_tipo(self):
        r = self._crear()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['es_imponible'])
        self.assertFalse(r.data['es_del_sistema'])

    def test_no_se_cambia_tipo_ni_codigo(self):
        c = self._crear().data
        r = self.client.patch(f"/api/conceptos/{c['id']}/", {'tipo': 'DESCUENTO'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"/api/conceptos/{c['id']}/", {'codigo': 'otro'}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"/api/conceptos/{c['id']}/", {'nombre': 'Bono de turno noche'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_codigo_duplicado_da_400(self):
        self._crear()
        r = self._crear()
        self.assertEqual(r.status_code, 400)

    def test_desactivar_y_reactivar(self):
        c = self._crear().data
        self.assertEqual(self.client.patch(f"/api/conceptos/{c['id']}/", {'activo': False}, format='json').status_code, 200)
        activos = [x['id'] for x in self.client.get('/api/conceptos/').data]
        self.assertNotIn(c['id'], activos)
        todos = [x['id'] for x in self.client.get('/api/conceptos/?incluir_inactivos=true').data]
        self.assertIn(c['id'], todos)
        self.assertEqual(self.client.patch(f"/api/conceptos/{c['id']}/", {'activo': True}, format='json').status_code, 200)


class CajaLegalTests(APITestCase):
    """El tratamiento legal del cálculo base no se puede alterar."""

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Contrato, Empresa, Empleado
        self.u = User.objects.create_user(username='6.666.666-6', password='x')
        self.e = Empresa.objects.create(owner=self.u, nombre_legal='E', rut='76.666.666-6')
        self.emp = Empleado.objects.create(empresa=self.e, rut='7.777.777-7', nombres='V', apellido_paterno='V',
                                           cargo='C', fecha_ingreso='2020-01-01', afp='HABITAT', sistema_salud='FONASA')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2020-01-01',
                                sueldo_base=900_000, gratificacion_legal='MENSUAL')
        self.client.force_authenticate(self.u)

    def test_concepto_de_empresa_no_cambia_naturaleza_ni_desde_el_admin(self):
        from core.models import ConceptoRemuneracion
        c = ConceptoRemuneracion.objects.create(empresa=self.e, codigo='BONO_X', nombre='Bono X', tipo='HABER_IMPONIBLE')
        c.es_imponible = False  # como si se editara en el admin
        c.save()
        c.refresh_from_db()
        self.assertTrue(c.es_imponible)

    def test_concepto_del_sistema_admite_excepcion_en_el_admin(self):
        from core.models import ConceptoRemuneracion
        c = ConceptoRemuneracion.objects.create(codigo='SISTEMA_X', nombre='X', tipo='HABER_IMPONIBLE')
        c.afecta_gratificacion = False
        c.save()
        c.refresh_from_db()
        self.assertFalse(c.afecta_gratificacion)

    def _hora_extra(self, recargo):
        return self.client.post('/api/liquidaciones/simular/', {
            'empleado': self.emp.id, 'mes': 9, 'anio': 2026,
            'detalle_items': [{'glosa': 'HE', 'naturaleza': 'HORA_EXTRA', 'horas': 5, 'recargo': recargo}]}, format='json')

    def test_recargo_menor_al_legal_rechazado(self):
        r = self._hora_extra(30)
        self.assertEqual(r.status_code, 400)
        self.assertIn('50 %', r.data['error'])
        r = self.client.post('/api/liquidaciones/', {
            'empleado': self.emp.id, 'mes': 9, 'anio': 2026,
            'detalle_items': [{'glosa': 'HE', 'naturaleza': 'HORA_EXTRA', 'horas': 5, 'recargo': 30}]}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_recargo_legal_o_mayor_aceptado(self):
        self.assertEqual(self._hora_extra(50).status_code, 200)
        self.assertEqual(self._hora_extra(100).status_code, 200)
