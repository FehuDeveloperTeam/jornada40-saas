"""Archivo Previred de 105 campos."""
from rest_framework.test import APITestCase
from ..models import Contrato, Empleado, Empresa, Liquidacion
import datetime  # noqa: E402  (usado por las pruebas de jornada)

from .utiles import crear_empleado, crear_usuario_completo


class ArchivoPreviredTests(APITestCase):
    """Archivo de 105 campos según el formato de largo variable de Previred (versión 100, sept. 2026)."""
    URL = '/api/liquidaciones/exportar_previred/?mes=9&anio=2026'

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('prev_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5', nombres='Matías Ñuñez', apellido='Peña')
        Empleado.objects.filter(pk=self.emp.pk).update(sexo='M', afp='MODELO', sistema_salud='FONASA',
                                                      apellido_materno='Gómez', centro_costo='Ventas')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2024-01-01',
                                sueldo_base=1_000_000)
        self.liq = Liquidacion.objects.create(
            empleado=self.emp, mes=9, anio=2026, dias_trabajados=30, total_imponible=1_000_000,
            afp_nombre='MODELO', afp_monto=105_800, salud_nombre='FONASA', salud_monto=70_000,
            seguro_cesantia=6_000, valor_uf=39_000)

    def _campos(self):
        r = self.client.get(self.URL)
        self.assertEqual(r.status_code, 200, getattr(r, 'data', r.content[:300]))
        texto = r.content.decode('latin-1')
        self.assertTrue(texto.endswith('\r\n'))
        campos = texto.strip('\r\n').split(';')
        self.assertEqual(len(campos), 105)
        return {n + 1: v for n, v in enumerate(campos)}

    def test_fonasa_isl_sin_caja(self, *_):
        c = self._campos()
        self.assertEqual([c[1], c[2], c[3], c[4], c[5]], ['12345678', '5', 'PEÑA', 'GOMEZ', 'MATIAS ÑUÑEZ'])
        self.assertEqual([c[6], c[7], c[8], c[9], c[11], c[12], c[13], c[14], c[15]],
                         ['M', '0', '01', '092026', 'AFP', '0', '30', '00', '0'])
        self.assertEqual(c[18], 'D')
        # AFP Modelo = 34 (tabla 10); obligatoria + 0,1 % del empleador; SIS 1,78 %
        self.assertEqual([c[26], c[27], c[28], c[29]], ['34', '1000000', str(105_800 + 1_000), '17800'])
        # Fonasa 7 % en el campo 70 con su renta en el 64; ISL 0,93 % en el 71
        self.assertEqual([c[64], c[70], c[71], c[75]], ['1000000', '70000', '9300', '07'])
        self.assertEqual([c[83], c[84], c[90], c[93], c[94], c[95], c[96], c[97], c[98]],
                         ['00', '0', '0', '1', '7200', '9000', '00', '0', '0'])
        self.assertEqual([c[100], c[101], c[102], c[105]], ['1000000', '6000', '24000', 'VENTAS'])

    def test_isapre_con_mutual_y_caja(self, *_):
        from decimal import Decimal
        Empresa.objects.filter(pk=self.empresa.pk).update(mutual='01', tasa_accidentes=Decimal('0.0193'),
                                                          sucursal_mutual='1', ccaf='02')
        Empleado.objects.filter(pk=self.emp.pk).update(sistema_salud='ISAPRE', isapre='04', numero_fun='FUN123')
        Liquidacion.objects.filter(pk=self.liq.pk).update(salud_nombre='ISAPRE', salud_monto=150_000,
                                                          isapre_cotizacion_uf=Decimal('3.85'))
        c = self._campos()
        self.assertEqual([c[64], c[70], c[71]], ['0', '0', '0'])
        self.assertEqual([c[75], c[76], c[77], c[78], c[79], c[80], c[81]],
                         ['04', 'FUN123', '1000000', '2', '3,85', '70000', '80000'])
        self.assertEqual([c[83], c[84], c[90]], ['02', '1000000', '0'])
        self.assertEqual([c[96], c[97], c[98], c[99]], ['01', '1000000', '19300', '1'])

    def test_fonasa_con_caja_reparte_el_siete(self, *_):
        Empresa.objects.filter(pk=self.empresa.pk).update(ccaf='01', mutual='02')
        c = self._campos()
        self.assertEqual([c[70], c[90], c[64]], ['64000', '6000', '1000000'])

    def test_ingreso_en_el_mes_informa_movimiento(self, *_):
        Empleado.objects.filter(pk=self.emp.pk).update(fecha_ingreso=datetime.date(2026, 9, 10))
        Liquidacion.objects.filter(pk=self.liq.pk).update(dias_trabajados=21)
        c = self._campos()
        self.assertEqual([c[13], c[15], c[16], c[17]], ['21', '1', '10-09-2026', ''])

    def test_asignacion_familiar_va_al_ips_sin_caja(self, *_):
        from core.models import ConceptoRemuneracion
        af = ConceptoRemuneracion.objects.get(codigo='ASIGNACION_FAMILIAR', empresa=None)
        Empleado.objects.filter(pk=self.emp.pk).update(tramo_asignacion_familiar='B', cargas_simples=2)
        Liquidacion.objects.filter(pk=self.liq.pk).update(detalle_items=[
            {'concepto': af.id, 'glosa': 'Asignación familiar', 'naturaleza': 'HABER_NO_IMPONIBLE', 'valor': 26_000}])
        c = self._campos()
        self.assertEqual([c[18], c[19], c[22], c[73], c[91]], ['B', '2', '26000', '26000', '0'])

    def test_datos_que_faltan_no_generan_el_archivo(self, *_):
        Empleado.objects.filter(pk=self.emp.pk).update(sexo=None, sistema_salud='ISAPRE', isapre='')
        r = self.client.get(self.URL)
        self.assertEqual(r.status_code, 400)
        self.assertIn('sexo', r.data['error'])
        self.assertIn('Isapre', r.data['error'])
