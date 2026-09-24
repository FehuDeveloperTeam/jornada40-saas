"""Jornada máxima (Ley 21.561) y avisos de jornada y sueldo."""
from rest_framework.test import APITestCase
import datetime  # noqa: E402  (usado por las pruebas de jornada)


class JornadaMaximaTests(APITestCase):
    """Calendario de la Ley 21.561 y avisos de jornada.

    Criterio de producto: el sistema avisa, nunca bloquea. Estas pruebas fijan
    qué se avisa y que guardar un contrato que incumple siga permitido.
    """
    HOY = datetime.date(2026, 9, 23)

    def _horario(self, dias, entrada='09:00', salida='18:00', colacion=60):
        return {d: {'activo': True, 'entrada': entrada, 'salida': salida, 'colacion': colacion} for d in dias}

    def _codigos(self, *args, **kwargs):
        from core.jornada import avisos_jornada
        return [a['codigo'] for a in avisos_jornada(*args, fecha=kwargs.pop('fecha', self.HOY), **kwargs)]

    SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']

    def test_calendario_en_los_dias_de_cambio(self):
        from core.jornada import jornada_maxima_vigente as m
        self.assertEqual(m(datetime.date(2024, 4, 25)), 45)
        self.assertEqual(m(datetime.date(2024, 4, 26)), 44)
        self.assertEqual(m(datetime.date(2026, 4, 25)), 44)
        self.assertEqual(m(datetime.date(2026, 4, 26)), 42)
        self.assertEqual(m(datetime.date(2028, 4, 26)), 40)

    def test_44_horas_excede_el_maximo_de_42(self):
        self.assertIn('EXCEDE_MAXIMO', self._codigos('ORDINARIA', 44, {}))

    def test_42_horas_cumple(self):
        # 5 días × 8,4 h = 42 h exactas.
        horario = self._horario(self.SEMANA, '09:00', '18:24', 60)
        self.assertEqual(self._codigos('ORDINARIA', 42, horario), [])

    def test_horario_que_suma_mas_que_lo_pactado(self):
        # El caso real: se pactan 20 h pero el horario suma 40.
        horario = self._horario(self.SEMANA)  # 8 h × 5
        self.assertIn('HORARIO_SUPERA_PACTADO', self._codigos('ORDINARIA', 20, horario))

    def test_articulo_22_con_horario_fijo(self):
        horario = self._horario(self.SEMANA)
        self.assertIn('ART22_CON_HORARIO', self._codigos('ART_22', 42, horario))

    def test_articulo_22_con_20_horas_pactadas(self):
        # El caso real: se registran 20 h "para pagar menos" en un Art. 22.
        self.assertEqual(self._codigos('ART_22', 20, {}), ['ART22_CON_HORAS'])

    def test_articulo_22_sin_horario_ni_horas_bajo_el_maximo_no_avisa(self):
        self.assertEqual(self._codigos('ART_22', 42, {}), [])
        # Las horas no rigen en un Art. 22: 44 no es "exceso".
        self.assertEqual(self._codigos('ART_22', 44, {}), [])

    def test_dia_de_mas_de_10_horas(self):
        horario = self._horario(['lunes'], '08:00', '20:00', 60)  # 11 h netas
        self.assertIn('DIA_SUPERA_10H', self._codigos('ORDINARIA', 42, horario))

    def test_turnos_no_aplica_el_tope_diario(self):
        horario = self._horario(['lunes'], '08:00', '20:00', 60)
        self.assertNotIn('DIA_SUPERA_10H', self._codigos('TURNOS', 42, horario))

    def test_jornada_parcial_sobre_dos_tercios(self):
        # Con máximo 42 h, parcial es hasta 28 h.
        self.assertIn('PARCIAL_SOBRE_TOPE', self._codigos('PARCIAL', 30, {}))
        self.assertNotIn('PARCIAL_SOBRE_TOPE', self._codigos('PARCIAL', 28, {}))

    def test_aviso_de_la_proxima_reduccion_solo_cerca_de_la_fecha(self):
        # 42 h cumple hoy; la baja a 40 h es el 26-04-2028.
        lejos = self._codigos('ORDINARIA', 42, {}, fecha=datetime.date(2026, 9, 23))
        cerca = self._codigos('ORDINARIA', 42, {}, fecha=datetime.date(2028, 1, 10))
        self.assertNotIn('PROXIMA_REDUCCION', lejos)
        self.assertIn('PROXIMA_REDUCCION', cerca)

    def test_colacion_no_cuenta_como_jornada(self):
        from core.jornada import horas_por_dia
        self.assertEqual(horas_por_dia(self._horario(['lunes']))['lunes'], 8)


class AvisosSueldoYDistribucionTests(APITestCase):
    """Sueldo bajo el mínimo de la jornada (Arts. 42 a y 44) y días de la distribución (Art. 28, 4x3)."""
    HOY = datetime.date(2026, 9, 23)   # máximo vigente: 42 h
    IMM = 553_553

    def _codigos(self, tipo, horas, dias=(), por_dia=8.0, sueldo=None, fecha=None):
        from core.jornada import avisos_jornada
        salida = f'{9 + int(por_dia) + 1:02d}:{int(round((por_dia % 1) * 60)):02d}'
        horario = {d: {'activo': True, 'entrada': '09:00', 'salida': salida, 'colacion': 60} for d in dias}
        return [a['codigo'] for a in avisos_jornada(tipo, horas, horario, fecha=fecha or self.HOY,
                                                     sueldo_base=sueldo, ingreso_minimo=self.IMM)]

    def test_sueldo_bajo_el_minimo_completo(self):
        self.assertIn('SUELDO_BAJO_MINIMO', self._codigos('ORDINARIA', 42, sueldo=500_000))
        self.assertNotIn('SUELDO_BAJO_MINIMO', self._codigos('ORDINARIA', 42, sueldo=553_553))

    def test_parcial_compara_con_el_minimo_proporcional(self):
        # 21 de 42 h → mínimo 276.776
        self.assertNotIn('SUELDO_BAJO_MINIMO', self._codigos('PARCIAL', 21, sueldo=280_000))
        self.assertIn('SUELDO_BAJO_MINIMO', self._codigos('PARCIAL', 21, sueldo=250_000))

    def test_art22_compara_con_el_minimo_completo(self):
        self.assertIn('SUELDO_BAJO_MINIMO', self._codigos('ART_22', 20, sueldo=300_000))

    def test_4x3_con_40_horas_se_permite_antes_de_2028(self):
        cuatro = ['lunes', 'martes', 'miercoles', 'jueves']
        self.assertNotIn('DIAS_BAJO_MINIMO', self._codigos('ORDINARIA', 40, cuatro, por_dia=10))
        # 42 h en 4 días: el 4x3 anticipado exige 40 h o menos.
        self.assertIn('DIAS_BAJO_MINIMO', self._codigos('ORDINARIA', 42, cuatro, por_dia=10.5))
        # Desde 2028 el máximo es 40 h y el 4x3 rige para todos.
        self.assertNotIn('DIAS_BAJO_MINIMO', self._codigos('ORDINARIA', 40, cuatro, por_dia=10,
                                                            fecha=datetime.date(2028, 5, 1)))

    def test_dias_fuera_de_rango(self):
        siete = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']
        self.assertIn('DIAS_SOBRE_6', self._codigos('ORDINARIA', 42, siete, por_dia=6))
        self.assertIn('DIAS_BAJO_MINIMO', self._codigos('ORDINARIA', 30, ['lunes', 'martes', 'miercoles'], por_dia=10))
        # La jornada parcial se reparte habitualmente en menos días: sin aviso.
        self.assertNotIn('DIAS_BAJO_MINIMO', self._codigos('PARCIAL', 24, ['lunes', 'martes', 'miercoles']))

    def test_api_evalua_el_sueldo_del_borrador(self):
        from django.contrib.auth.models import User
        self.client.force_authenticate(User.objects.create_user(username='x', password='x'))
        resp = self.client.post('/api/contratos/evaluar-jornada/', {
            'tipo_jornada': 'ORDINARIA', 'horas_semanales': 42, 'distribucion_horario': {}, 'sueldo_base': 400_000,
        }, format='json')
        self.assertIn('SUELDO_BAJO_MINIMO', [a['codigo'] for a in resp.data['avisos']])


class AvisosJornadaApiTests(APITestCase):
    """Los avisos llegan en la API y guardar un contrato que incumple sigue permitido."""

    def setUp(self):
        from django.contrib.auth.models import User
        from core.models import Cliente, Empresa, Empleado, Plan
        self.user = User.objects.create_user(username='12.345.678-5', password='x')
        plan = Plan.objects.create(nombre='Pyme', precio=0, max_empresas=3, limite_trabajadores=75, nivel=3)
        Cliente.objects.create(usuario=self.user, rut='12.345.678-5', nombres='A', plan=plan)
        empresa = Empresa.objects.create(owner=self.user, nombre_legal='E', rut='76.123.456-0')
        self.empleado = Empleado.objects.create(
            empresa=empresa, rut='9.876.543-3', nombres='T', apellido_paterno='P', cargo='C',
            fecha_ingreso='2026-01-01')
        self.client.force_authenticate(self.user)

    def test_contrato_de_44_se_guarda_y_trae_el_aviso(self):
        resp = self.client.post('/api/contratos/', {
            'empleado': self.empleado.id, 'tipo_contrato': 'INDEFINIDO', 'cargo': 'Soldador',
            'fecha_inicio': '2026-09-01', 'sueldo_base': 800000,
            'tipo_jornada': 'ORDINARIA', 'horas_semanales': '44.0',
        }, format='json')
        self.assertEqual(resp.status_code, 201)  # avisa, no bloquea
        self.assertEqual(resp.data['jornada_maxima_vigente'], 42)
        self.assertIn('EXCEDE_MAXIMO', [a['codigo'] for a in resp.data['avisos_jornada']])

    def test_contrato_nuevo_toma_el_maximo_vigente_por_defecto(self):
        from core.models import Contrato
        c = Contrato.objects.create(empleado=self.empleado, fecha_inicio='2026-09-01', sueldo_base=1)
        self.assertEqual(float(c.horas_semanales), 42.0)

    def test_evaluar_borrador_sin_guardar(self):
        resp = self.client.post('/api/contratos/evaluar-jornada/', {
            'tipo_jornada': 'ART_22', 'horas_semanales': 20,
            'distribucion_horario': {'lunes': {'activo': True, 'entrada': '09:00', 'salida': '18:00', 'colacion': 60}},
        }, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual([a['codigo'] for a in resp.data['avisos']], ['ART22_CON_HORARIO', 'ART22_CON_HORAS'])

    def test_anexo_40h_propone_el_maximo_vigente(self):
        from core.models import Contrato
        c = Contrato.objects.create(empleado=self.empleado, fecha_inicio='2026-09-01', sueldo_base=1,
                                    horas_semanales=44)
        self.assertEqual(c.horas_propuestas_anexo_40h, '42')
        c.horas_semanales = 40
        self.assertEqual(c.horas_propuestas_anexo_40h, '40')
