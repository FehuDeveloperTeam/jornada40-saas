"""Feriado: calendario, acumulación (Art. 70) y progresivo (Art. 68)."""
from rest_framework.test import APITestCase
import datetime  # noqa: E402  (usado por las pruebas de jornada)

from .utiles import crear_empleado, crear_usuario_completo


class AcumulacionFeriadoYTopeAniosTests(APITestCase):
    """Art. 70 (acumulación de feriado, solo aviso) y contratos anteriores al 14-08-1981 (sin tope de 11 años)."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('art70_owner', '21.000.000-3', '76.000.555-2')
        self.client.force_authenticate(self.user)
        self.emp = crear_empleado(self.empresa, '12.345.678-5')

    def _saldo(self, ingreso, hasta):
        from core.views import calcular_saldo_vacaciones
        self.emp.fecha_ingreso = ingreso
        self.emp.save()
        return calcular_saldo_vacaciones(self.emp, hasta=hasta)

    def test_dos_periodos_avisa_el_plazo_para_el_primero(self, *_):
        s = self._saldo(datetime.date(2024, 3, 1), datetime.date(2026, 9, 1))
        self.assertEqual(s['dias_disponibles'], 30)
        self.assertIn('antes del 01-03-2027', s['aviso_acumulacion'])

    def test_mas_de_dos_periodos_avisa_sin_descontar(self, *_):
        s = self._saldo(datetime.date(2023, 3, 1), datetime.date(2026, 9, 1))
        self.assertEqual(s['dias_disponibles'], 45)   # no se pierden
        self.assertIn('más de dos períodos', s['aviso_acumulacion'])

    def test_un_periodo_sin_aviso(self, *_):
        self.assertNotIn('aviso_acumulacion', self._saldo(datetime.date(2025, 3, 1), datetime.date(2026, 9, 1)))

    def test_progresivo_se_acumula_anio_a_anio(self, *_):
        # 16 años: aniversarios 13, 14 y 15 dan 1 día cada uno y el 16 da 2 → 5 días.
        s = self._saldo(datetime.date(2010, 3, 1), datetime.date(2026, 9, 1))
        self.assertEqual((s['anos_servicio'], s['dias_progresivos'], s['dias_progresivos_anuales']), (16, 5, 2))
        self.assertEqual(s['dias_devengados'], 16 * 15 + 5)

    def test_anios_con_empleadores_anteriores_hasta_diez(self, *_):
        from core.views import calcular_saldo_vacaciones
        self.emp.anios_previos_feriado = 10
        self.emp.fecha_ingreso = datetime.date(2022, 3, 1)
        self.emp.save()
        s = calcular_saldo_vacaciones(self.emp, hasta=datetime.date(2026, 9, 1))
        # 10 previos + 4 con la empresa = 14: el aniversario 3 (13) y el 4 (14) dan 1 cada uno.
        self.assertEqual((s['dias_progresivos'], s['dias_progresivos_anuales']), (2, 1))
        r = self.client.patch(f'/api/empleados/{self.emp.id}/', {'anios_previos_feriado': 11}, format='json')
        self.assertEqual(r.status_code, 400)   # la ley permite hacer valer hasta 10

    def test_contrato_anterior_a_1981_sin_tope_de_anios(self, *_):
        from core.views import _anios_indemnizacion
        self.assertEqual(_anios_indemnizacion(datetime.date(1980, 1, 1), datetime.date(2026, 9, 15)), 47)
        self.assertEqual(_anios_indemnizacion(datetime.date(1981, 8, 14), datetime.date(2026, 9, 15)), 11)


class FeriadoCalendarioTests(APITestCase):
    """Art. 69: el sábado es siempre inhábil para el feriado; feriados reales de Chile."""

    def test_semana_normal_son_cinco_dias(self):
        from core.views import _calcular_dias_habiles_vacacion as h
        d = datetime.date
        self.assertEqual(h(d(2026, 8, 31), d(2026, 9, 6)), 5)   # lun 31-08 a dom 06-09: el sábado no cuenta

    def test_viernes_santo(self):
        from core.views import _calcular_dias_habiles_vacacion as h
        d = datetime.date
        self.assertEqual(h(d(2026, 3, 30), d(2026, 4, 3)), 4)   # el 03-04-2026 es Viernes Santo

    def test_conversion_a_corridos(self):
        from core.views import _dias_corridos_de_feriado as c
        d = datetime.date
        self.assertEqual(c(d(2026, 9, 11), 3), 5)      # vie → lun, mar, mié: + sáb y dom
        self.assertEqual(c(d(2026, 9, 16), 3), 6)      # 18 y 19 son feriados
        self.assertEqual(c(d(2026, 9, 11), 3.5), 5.5)  # la fracción se paga tal cual
