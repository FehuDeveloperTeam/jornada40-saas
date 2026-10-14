"""Parámetros previsionales, topes, indicadores y lector de Previred."""
from unittest.mock import patch
from django.core.cache import cache
from rest_framework.test import APITestCase


class TopeImponibleTests(APITestCase):
    """El tope imponible limita la base de cotización (Ley 21.735 y DL 3.500).

    Lo que excede el tope no cotiza: sin este límite, una renta alta produce
    descuentos de AFP, salud y cesantía mayores a los que corresponden.
    """

    def setUp(self):
        from core.models import ParametroPrevisional, TasaAFP
        import datetime
        # Se fijan valores conocidos para no depender del seed ni de la UF real.
        # Se vacía el histórico cargado por migraciones: estas pruebas son sobre
        # cómo se aplica un tope, no sobre qué tope regía en marzo de 2025.
        ParametroPrevisional.objects.all().delete()
        TasaAFP.objects.all().delete()
        ParametroPrevisional.objects.update_or_create(
            vigente_desde=datetime.date(2025, 1, 1),
            defaults={
                'tope_imponible_afp_uf': '87.80',
                'tope_imponible_afc_uf': '131.90',
                'ingreso_minimo_mensual': 529000,
                'factor_gratificacion': '4.75',
            },
        )
        TasaAFP.objects.update_or_create(
            nombre='MODELO', vigente_desde=datetime.date(2025, 1, 1),
            defaults={'tasa': '0.10580'},
        )
        self.uf = 39000.0
        self.tope_afp = int(87.80 * self.uf)
        self.tope_afc = int(131.90 * self.uf)

    def _liquidar(self, sueldo_base, valor_uf=None):
        """Calcula una liquidación con UF fija y sin tocar la BD de contratos."""
        from core.views import _calcular_liquidacion

        class ContratoFalso:
            tipo_contrato = 'INDEFINIDO'
            gratificacion_legal = 'MENSUAL'
            tiene_quincena = False
            monto_quincena = 0
            comisiones_config = []

        class EmpleadoFalso:
            afp = 'MODELO'
            sistema_salud = 'FONASA'
            plan_isapre_uf = 0

        contrato = ContratoFalso()
        contrato.sueldo_base = sueldo_base
        terminos = {
            'sueldo_base_contrato': sueldo_base,
            'gratificacion_legal': 'MENSUAL',
            'tipo_contrato': 'INDEFINIDO',
            'anticipo_quincena': 0,
            'valor_uf': valor_uf or self.uf,
            'porcentajes_comision': {},
        }
        return _calcular_liquidacion(
            contrato, EmpleadoFalso(),
            {'mes': 3, 'anio': 2025, 'dias_trabajados': 30},
            terminos=terminos,
        )

    def test_renta_bajo_el_tope_cotiza_sobre_el_total(self):
        resultado = self._liquidar(1_000_000)
        self.assertLess(resultado['total_imponible'], self.tope_afp)
        self.assertEqual(resultado['afp_monto'], int(resultado['total_imponible'] * 0.1058))

    def test_renta_sobre_el_tope_cotiza_solo_hasta_el_tope(self):
        resultado = self._liquidar(6_000_000)
        self.assertGreater(resultado['total_imponible'], self.tope_afp)
        # La cotización se congela en el tope, no crece con la renta
        self.assertEqual(resultado['afp_monto'], int(self.tope_afp * 0.1058))
        self.assertEqual(resultado['salud_monto'], int(self.tope_afp * 0.07))

    def test_cesantia_usa_su_propio_tope_mas_alto(self):
        # Renta entre ambos topes: AFP topa, cesantía todavía no
        resultado = self._liquidar(4_000_000)
        imponible = resultado['total_imponible']
        self.assertGreater(imponible, self.tope_afp)
        self.assertLess(imponible, self.tope_afc)
        self.assertEqual(resultado['afp_monto'], int(self.tope_afp * 0.1058))
        self.assertEqual(resultado['seguro_cesantia'], int(imponible * 0.006))

    def test_subir_la_renta_sobre_el_tope_no_aumenta_la_cotizacion(self):
        alta = self._liquidar(6_000_000)
        mas_alta = self._liquidar(9_000_000)
        self.assertEqual(alta['afp_monto'], mas_alta['afp_monto'])
        self.assertEqual(alta['salud_monto'], mas_alta['salud_monto'])

    def test_tope_de_gratificacion_sale_del_sueldo_minimo(self):
        # 4,75 × 529.000 / 12 = 209.395, no el valor fijo de 200.000 anterior
        resultado = self._liquidar(6_000_000)
        self.assertEqual(resultado['gratificacion'], int(4.75 * 529000 / 12))

    def test_parametros_se_resuelven_por_periodo_liquidado(self):
        """Un período anterior al primer registro usa el más antiguo disponible."""
        from core.views import _parametros_previsionales
        antiguo = _parametros_previsionales(1, 2020)
        self.assertEqual(antiguo['ingreso_minimo_mensual'], 529000)

    def test_valor_uf_queda_congelado_en_la_liquidacion(self):
        resultado = self._liquidar(1_000_000, valor_uf=38500.0)
        self.assertEqual(float(resultado['valor_uf']), 38500.0)


class PropuestaParametrosTests(APITestCase):
    """Una propuesta automática no debe alterar cálculos por su cuenta.

    Leer mal un tope imponible desde una página web y aplicarlo en silencio
    sería peor que quedarse con el valor anterior: por eso las filas de origen
    PREVIRED solo entran al cálculo una vez confirmadas por una persona.
    """

    def setUp(self):
        import datetime
        from core.models import ParametroPrevisional, TasaAFP
        self.enero = datetime.date(2025, 1, 1)
        self.junio = datetime.date(2025, 6, 1)
        # Igual que arriba: el histórico real haría que el período de prueba
        # resolviera a otra fila y estas pruebas son sobre confirmado/origen.
        ParametroPrevisional.objects.all().delete()
        TasaAFP.objects.all().delete()
        ParametroPrevisional.objects.update_or_create(
            vigente_desde=self.enero,
            defaults={'tope_imponible_afp_uf': '87.80', 'ingreso_minimo_mensual': 529000,
                      'origen': 'MANUAL', 'confirmado': True},
        )
        TasaAFP.objects.update_or_create(
            nombre='MODELO', vigente_desde=self.enero,
            defaults={'tasa': '0.10580', 'origen': 'MANUAL', 'confirmado': True},
        )

    def _crear_propuesta(self):
        from core.models import ParametroPrevisional, TasaAFP
        ParametroPrevisional.objects.create(
            vigente_desde=self.junio, tope_imponible_afp_uf='99.99',
            ingreso_minimo_mensual=999000, origen='PREVIRED', confirmado=False,
        )
        TasaAFP.objects.create(
            nombre='MODELO', vigente_desde=self.junio, tasa='0.15000',
            origen='PREVIRED', confirmado=False,
        )

    def test_propuesta_sin_confirmar_no_cambia_los_parametros(self):
        from core.views import _parametros_previsionales
        self._crear_propuesta()
        vigentes = _parametros_previsionales(8, 2025)
        self.assertEqual(vigentes['tope_imponible_afp_uf'], 87.80)
        self.assertEqual(vigentes['ingreso_minimo_mensual'], 529000)

    def test_propuesta_sin_confirmar_no_cambia_las_tasas_afp(self):
        from core.views import _tasas_afp
        self._crear_propuesta()
        self.assertEqual(_tasas_afp(8, 2025)['MODELO'], 0.1058)

    def test_al_confirmarla_si_entra_en_vigencia(self):
        from core.models import ParametroPrevisional, TasaAFP
        from core.views import _parametros_previsionales, _tasas_afp
        self._crear_propuesta()
        ParametroPrevisional.objects.filter(vigente_desde=self.junio).update(confirmado=True)
        TasaAFP.objects.filter(vigente_desde=self.junio).update(confirmado=True)

        self.assertEqual(_parametros_previsionales(8, 2025)['tope_imponible_afp_uf'], 99.99)
        self.assertEqual(_tasas_afp(8, 2025)['MODELO'], 0.15)

    def test_carga_manual_rige_sin_necesidad_de_confirmar(self):
        """Editar a mano en el admin debe surtir efecto de inmediato."""
        from core.models import ParametroPrevisional
        from core.views import _parametros_previsionales
        ParametroPrevisional.objects.create(
            vigente_desde=self.junio, tope_imponible_afp_uf='90.00',
            ingreso_minimo_mensual=550000, origen='MANUAL', confirmado=False,
        )
        self.assertEqual(_parametros_previsionales(8, 2025)['tope_imponible_afp_uf'], 90.00)

    def test_advierte_cuando_los_parametros_no_estan_confirmados(self):
        from core.models import ParametroPrevisional
        from core.views import advertencias_parametros
        ParametroPrevisional.objects.filter(vigente_desde=self.enero).update(confirmado=False)
        self.assertTrue(any('no han sido confirmados' in a
                            for a in advertencias_parametros(3, 2025)))

    def test_advierte_cuando_los_parametros_quedaron_viejos(self):
        from core.views import advertencias_parametros
        # Liquidar 2027 con parámetros de enero 2025: los topes se reajustan cada enero
        self.assertTrue(any('antigüedad' in a for a in advertencias_parametros(6, 2027)))

    def test_sin_advertencias_cuando_todo_esta_al_dia(self):
        from core.views import advertencias_parametros
        self.assertEqual(advertencias_parametros(3, 2025), [])


class RespaldoIndicadoresTests(APITestCase):
    """Calcular con la UF de respaldo no debe pasar inadvertido."""

    def setUp(self):
        cache.clear()

    def test_sin_respaldo_activo_no_hay_advertencias(self):
        from core.indicadores import estado_indicadores
        self.assertEqual(estado_indicadores(), [])

    def test_caer_en_respaldo_queda_registrado_y_se_advierte(self):
        from core.indicadores import estado_indicadores, obtener_uf, UF_FALLBACK
        with patch('core.indicadores.requests.get', side_effect=Exception('sin red')):
            self.assertEqual(obtener_uf(), UF_FALLBACK)
        advertencias = estado_indicadores()
        self.assertTrue(any('UF' in a for a in advertencias))

    def test_al_recuperarse_la_api_deja_de_advertir(self):
        from core.indicadores import estado_indicadores, obtener_uf
        with patch('core.indicadores.requests.get', side_effect=Exception('sin red')):
            obtener_uf()
        self.assertTrue(estado_indicadores())

        cache.delete('indicador_uf')  # forzar nueva consulta
        respuesta = type('R', (), {
            'raise_for_status': lambda self: None,
            'json': lambda self: {'serie': [{'valor': 41000.0}]},
        })()
        with patch('core.indicadores.requests.get', return_value=respuesta):
            self.assertEqual(obtener_uf(), 41000.0)
        self.assertEqual(estado_indicadores(), [])


class ParserPreviredTests(APITestCase):
    """El lector de Previred debe interpretar bien o no interpretar nada.

    Es la pieza más frágil del flujo: depende del maquetado de una página
    ajena. Preferimos que falle en voz alta a que proponga un tope inventado.
    """

    HTML = """
    <html><body><table>
    <tr><td>Renta Tope Imponible AFP</td><td>87,8 UF</td></tr>
    <tr><td>Renta Tope Imponible Seguro de Cesant&iacute;a</td><td>131,9 UF</td></tr>
    <tr><td>Ingreso M&iacute;nimo Mensual</td><td>$529.000</td></tr>
    </table>
    <table><tr><th>AFP</th><th>Tasa</th></tr>
    <tr><td>CAPITAL</td><td>11,44%</td></tr>
    <tr><td>MODELO</td><td>10,58%</td></tr>
    </table></body></html>
    """

    def setUp(self):
        from core.management.commands import sincronizar_previred as sp
        self.sp = sp
        self.texto = sp._texto_plano(self.HTML)

    def test_numeros_en_formato_chileno(self):
        self.assertEqual(self.sp._a_numero('87,8'), 87.8)
        self.assertEqual(self.sp._a_numero('$529.000'), 529000.0)
        self.assertEqual(self.sp._a_numero('1.234,56'), 1234.56)

    def test_lee_los_topes_y_el_sueldo_minimo(self):
        self.assertEqual(
            self.sp._buscar(self.texto, r'tope\s+imponible[^.]{0,60}?([\d.,]+)\s*UF',
                            'tope_imponible_afp_uf'), 87.8)
        self.assertEqual(
            self.sp._buscar(self.texto, r'(?:cesant[íi]a)[^.]{0,60}?([\d.,]+)\s*UF',
                            'tope_imponible_afc_uf'), 131.9)
        self.assertEqual(
            self.sp._buscar(self.texto, r'ingreso\s+m[íi]nimo[^.]{0,80}?\$?\s*([\d.,]+)',
                            'ingreso_minimo_mensual'), 529000.0)

    def test_lee_las_tasas_afp_como_porcentaje(self):
        """El rango valida el porcentaje leído, no la fracción resultante."""
        for afp, esperado in (('CAPITAL', 11.44), ('MODELO', 10.58)):
            leido = self.sp._buscar(self.texto, rf'{afp}[^%]{{0,40}}?([\d.,]+)\s*%',
                                    'tasa_afp_pct')
            self.assertEqual(leido, esperado)
            self.assertEqual(round(leido / 100, 5), round(esperado / 100, 5))

    def test_descarta_valores_fuera_de_rango_plausible(self):
        absurdo = self.sp._buscar('Tope Imponible 9999 UF',
                                  r'tope\s+imponible[^.]{0,60}?([\d.,]+)\s*UF',
                                  'tope_imponible_afp_uf')
        self.assertIsNone(absurdo)

    def test_pagina_irreconocible_no_devuelve_nada(self):
        otro = self.sp._texto_plano('<html><body>Sitio en mantención</body></html>')
        self.assertIsNone(self.sp._buscar(
            otro, r'tope\s+imponible[^.]{0,60}?([\d.,]+)\s*UF', 'tope_imponible_afp_uf'))


class PreviredFormatoActualTests(APITestCase):
    """Formato de la página a octubre de 2026 y tasas de la reforma de pensiones.

    El HTML reproduce el texto de la página (sin copiarla entera): «TOPES IMPONIBLES Para
    afiliados a una AFP (90 UF)», «Rentas mínimas imponibles», el bloque «Seguro social» y la
    columna «Cargo del Empleador» de las tasas AFP.
    """

    HTML_ACTUAL = """
    <html><body>
    <h3>RENTAS TOPES IMPONIBLES</h3>
    <p>Para afiliados a una AFP (90 UF): $ 3.695.148</p>
    <p>Para afiliados al IPS (ex INP) (60 UF): $ 2.452.426</p>
    <p>Para Seguro de Cesant&iacute;a (135,2 UF): $ 5.550.933</p>
    <h3>RENTAS M&Iacute;NIMAS IMPONIBLES</h3>
    <p>Trab. Dependientes e Independientes: $ 553.553</p>
    <p>Menores de 18 y Mayores de 65: $ 412.938</p>
    <h3>SEGURO SOCIAL</h3>
    <table><tr><td>Rentabilidad Protegida</td><td>0.90%</td></tr>
    <tr><td>Expectativa de Vida</td><td>0.72%</td></tr>
    <tr><td>Seguro de Invalidez y Sobrevivencia (SIS) (*)</td><td>1,78%</td></tr></table>
    <h3>AFP</h3>
    <table><tr><th>TASA COTIZACI&Oacute;N AFP</th><th>Cargo del Trabajador (*)</th><th>Cargo del Empleador</th>
    <th>Total a Pagar (**)</th></tr>
    <tr><td>Capital</td><td>11,44%</td><td>0,1%</td><td>11,54%</td></tr>
    <tr><td>Modelo</td><td>10,58%</td><td>0,1%</td><td>10,68%</td></tr></table>
    <h3>SEGURO DE CESANT&Iacute;A (AFC)</h3>
    <table><tr><td>Plazo Indefinido</td><td>2,4% R.I.</td><td>0,6% R.I.</td></tr>
    <tr><td>Plazo Fijo</td><td>3,0% R.I.</td><td>&#8211;</td></tr>
    <tr><td>Plazo Indefinido 11 a&ntilde;os o m&aacute;s (*)</td><td>0,8% R.I.</td><td>&#8211;</td></tr></table>
    </body></html>
    """

    def setUp(self):
        from core.management.commands import sincronizar_previred as sp
        self.sp = sp

    def test_numeros_con_punto_decimal(self):
        self.assertEqual(self.sp._a_numero('0.90'), 0.9)
        self.assertEqual(self.sp._a_numero('1.000'), 1000.0)

    def test_lee_topes_sueldo_minimo_y_tasas_del_formato_actual(self):
        leido, tasas, opcionales = self.sp.leer_indicadores(self.sp._texto_plano(self.HTML_ACTUAL))
        self.assertEqual(leido, {'tope_imponible_afp_uf': 90.0, 'tope_imponible_afc_uf': 135.2,
                                 'ingreso_minimo_mensual': 553553.0})
        self.assertEqual(tasas, {'CAPITAL': 0.1144, 'MODELO': 0.1058})
        self.assertEqual(opcionales, {'tasa_rentabilidad_protegida': 0.009, 'tasa_expectativa_vida': 0.0072,
                                      'tasa_sis': 0.0178, 'tasa_afp_empleador': 0.001,
                                      'tasa_afc_empleador_11_anios': 0.008})

    def _ejecutar(self, html):
        import io
        from django.core.management import call_command
        respuesta = type('R', (), {'raise_for_status': lambda self: None, 'text': html})()
        with patch('core.management.commands.sincronizar_previred.requests.get', return_value=respuesta):
            call_command('sincronizar_previred', '--crear-propuesta', '--vigente-desde', '2099-01-01',
                         stdout=io.StringIO())
        from core.models import ParametroPrevisional
        return ParametroPrevisional.objects.get(vigente_desde='2099-01-01')

    def test_la_propuesta_trae_las_tasas_de_la_reforma_leidas(self):
        from core.models import ParametroPrevisional
        vigente = ParametroPrevisional.objects.order_by('-vigente_desde').first()
        ParametroPrevisional.objects.filter(pk=vigente.pk).update(   # distintas de las de la página
            tasa_rentabilidad_protegida=0.0123, tasa_afp_empleador=0.0045, tasa_afc_empleador_11_anios=0.0077,
            tasa_sis=0.0149)
        propuesta = self._ejecutar(self.HTML_ACTUAL)
        self.assertFalse(propuesta.confirmado)
        self.assertEqual((float(propuesta.tasa_rentabilidad_protegida), float(propuesta.tasa_afp_empleador),
                          float(propuesta.tasa_afc_empleador_11_anios), float(propuesta.tasa_sis)),
                         (0.009, 0.001, 0.008, 0.0178))

    def test_sin_leerlas_conserva_las_vigentes_y_no_los_valores_por_omision(self):
        """Antes, las tres tasas de la reforma quedaban con los valores por omisión del modelo."""
        from core.models import ParametroPrevisional
        vigente = ParametroPrevisional.objects.order_by('-vigente_desde').first()
        ParametroPrevisional.objects.filter(pk=vigente.pk).update(
            tasa_rentabilidad_protegida=0.0123, tasa_afp_empleador=0.0045, tasa_afc_empleador_11_anios=0.0077)
        html_antiguo = ParserPreviredTests.HTML.replace('87,8 UF', '95,5 UF')   # sin bloque de seguro social
        propuesta = self._ejecutar(html_antiguo)
        self.assertEqual(float(propuesta.tope_imponible_afp_uf), 95.5)
        self.assertEqual((float(propuesta.tasa_rentabilidad_protegida), float(propuesta.tasa_afp_empleador),
                          float(propuesta.tasa_afc_empleador_11_anios)), (0.0123, 0.0045, 0.0077))
        self.assertEqual(propuesta.tasa_salud, vigente.tasa_salud)


class RevisarTopesImponiblesTests(APITestCase):
    """--aplicar no recalcula las liquidaciones firmadas ni las que están en firma."""

    def setUp(self):
        from core.models import Contrato
        from .utiles import crear_empleado, crear_usuario_completo
        self.user, _, _, self.empresa = crear_usuario_completo('topes', '21.000.000-3', '76.000.555-2')
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', cargo='Gerente',
                                fecha_inicio='2024-01-01', sueldo_base=9_000_000)

    def _liquidacion(self, mes):
        from core.models import Liquidacion
        return Liquidacion.objects.create(empleado=self.emp, mes=mes, anio=2026, total_imponible=9_000_000,
                                          total_haberes=9_000_000, sueldo_liquido=1, valor_uf=40000)

    def test_no_toca_las_firmadas_ni_las_en_firma(self):
        import io
        from django.core.management import call_command
        from core.models import SolicitudFirma
        libre, en_firma, firmada = self._liquidacion(6), self._liquidacion(7), self._liquidacion(8)
        for liq, estado in ((en_firma, 'PENDIENTE'), (firmada, 'FIRMADO')):
            SolicitudFirma.objects.create(empleado=self.emp, empresa=self.empresa, liquidacion=liq,
                                          tipo_documento='LIQUIDACION', estado=estado)
        salida = io.StringIO()
        call_command('revisar_topes_imponibles', '--aplicar', stdout=salida)
        for liq in (libre, en_firma, firmada):
            liq.refresh_from_db()
        self.assertNotEqual(libre.sueldo_liquido, 1)
        self.assertEqual((en_firma.sueldo_liquido, firmada.sueldo_liquido), (1, 1))
        self.assertIn('EN FIRMA', salida.getvalue())
        self.assertIn('FIRMADA', salida.getvalue())


class HistoricoParametrosTests(APITestCase):
    """El histórico cargado en migraciones debe resolver cada período con sus valores.

    Recalcular una liquidación antigua tiene que usar el sueldo mínimo y los
    topes que regían entonces: si el motor aplicara siempre los de hoy, corregir
    un error de 2025 lo convertiría en otro error distinto.
    """

    def _imm(self, mes, anio):
        from core.views import _parametros_previsionales
        return _parametros_previsionales(mes, anio)['ingreso_minimo_mensual']

    def _topes(self, mes, anio):
        from core.views import _parametros_previsionales
        par = _parametros_previsionales(mes, anio)
        return par['tope_imponible_afp_uf'], par['tope_imponible_afc_uf']

    def test_ingreso_minimo_vigente_hoy(self):
        # Ley 21.830: $553.553 desde las remuneraciones de mayo de 2026.
        self.assertEqual(self._imm(9, 2026), 553553)

    def test_cada_reajuste_del_ingreso_minimo_rige_desde_su_mes(self):
        self.assertEqual(self._imm(6, 2024), 460000)   # Ley 21.578
        self.assertEqual(self._imm(8, 2024), 500000)   # Ley 21.578
        self.assertEqual(self._imm(3, 2025), 510636)   # Decreto 3 de Hacienda
        self.assertEqual(self._imm(7, 2025), 529000)   # Ley 21.751
        self.assertEqual(self._imm(3, 2026), 539000)   # Ley 21.751
        self.assertEqual(self._imm(5, 2026), 553553)   # Ley 21.830

    def test_el_mes_anterior_a_un_reajuste_conserva_el_valor_viejo(self):
        self.assertEqual(self._imm(4, 2025), 510636)
        self.assertEqual(self._imm(4, 2026), 539000)

    def test_topes_imponibles_distinguen_provisional_y_definitivo(self):
        # La Superintendencia informa un valor provisional para las
        # remuneraciones de enero y el definitivo desde febrero.
        self.assertEqual(self._topes(1, 2026), (89.90, 135.10))
        self.assertEqual(self._topes(2, 2026), (90.00, 135.20))
        self.assertEqual(self._topes(1, 2025), (87.80, 131.80))
        self.assertEqual(self._topes(2, 2025), (87.80, 131.90))

    def test_tope_de_gratificacion_con_el_minimo_vigente(self):
        from core.views import _parametros_previsionales
        par = _parametros_previsionales(9, 2026)
        tope = int(par['factor_gratificacion'] * par['ingreso_minimo_mensual'] / 12)
        self.assertEqual(tope, 219114)

    def test_afp_uno_baja_su_comision_en_octubre_de_2025(self):
        from core.views import _tasas_afp
        # 10% obligatorio + comisión: 0,49% hasta septiembre, 0,46% desde octubre.
        self.assertEqual(_tasas_afp(9, 2025)['UNO'], 0.1049)
        self.assertEqual(_tasas_afp(10, 2025)['UNO'], 0.1046)
        # Las demás no se movieron con la licitación.
        self.assertEqual(_tasas_afp(10, 2025)['MODELO'], 0.1058)

    def test_el_historico_no_dispara_advertencias_de_antiguedad(self):
        from core.views import advertencias_parametros
        self.assertEqual(advertencias_parametros(9, 2026), [])


class TopeEnPesosTests(APITestCase):
    """El tope en pesos debe coincidir al peso con el que publica Previred."""

    def test_no_pierde_un_peso_por_el_punto_flotante(self):
        from core.views import _tope_en_pesos
        # 90 × 41.057,20 es exactamente 3.695.148, pero en float da
        # 3.695.147,9999... y truncar ahí devolvía un peso de menos.
        self.assertEqual(_tope_en_pesos(90.00, 41057.20), 3695148)
        self.assertEqual(_tope_en_pesos(135.20, 41057.20), 5550933)

    def test_trunca_los_decimales_reales(self):
        from core.views import _tope_en_pesos
        self.assertEqual(_tope_en_pesos(87.80, 41057.20), 3604822)

    def test_acepta_decimal_y_float_indistintamente(self):
        from decimal import Decimal
        from core.views import _tope_en_pesos
        self.assertEqual(_tope_en_pesos(Decimal('90.00'), Decimal('41057.20')),
                         _tope_en_pesos(90.00, 41057.20))


class PreviredSeptiembre2026Tests(APITestCase):
    """Parámetros verificados contra el PDF de Previred de septiembre 2026."""

    def test_valores_de_septiembre(self):
        from core.views import _parametros_previsionales, _tasas_afp
        p = _parametros_previsionales(9, 2026)
        self.assertEqual((p['tope_imponible_afp_uf'], p['tope_imponible_afc_uf']), (90.0, 135.2))
        self.assertEqual(p['ingreso_minimo_mensual'], 553553)
        self.assertEqual(p['tasa_sis'], 0.0178)
        self.assertEqual(p['tasa_expectativa_vida'], 0.0072)
        self.assertEqual(p['tasa_rentabilidad_protegida'], 0.009)
        self.assertEqual(p['tasa_afp_empleador'], 0.001)
        self.assertEqual(p['tasa_afc_empleador_11_anios'], 0.008)
        tasas = _tasas_afp(9, 2026)
        self.assertEqual(tasas, {**tasas, 'CAPITAL': 0.1144, 'CUPRUM': 0.1144, 'HABITAT': 0.1127,
                                 'PLANVITAL': 0.1116, 'PROVIDA': 0.1145, 'MODELO': 0.1058, 'UNO': 0.1046})

    def test_antes_de_la_reforma_no_hay_aportes_de_la_reforma(self):
        from core.views import _parametros_previsionales
        p = _parametros_previsionales(3, 2025)
        self.assertEqual((p['tasa_rentabilidad_protegida'], p['tasa_afp_empleador']), (0.0, 0.0))


class IndicadoresSinReintentoTests(APITestCase):
    """Si mindicador.cl falla, no se reintenta en cada solicitud."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def test_falla_se_cachea_un_rato(self):
        from unittest.mock import patch
        from core import indicadores
        with patch.object(indicadores.requests, 'get', side_effect=Exception('sin red')) as get:
            primero = indicadores.obtener_uf()
            segundo = indicadores.obtener_uf()
        self.assertEqual(primero, segundo)
        self.assertEqual(get.call_count, 1)
        self.assertTrue(indicadores.estado_indicadores())
