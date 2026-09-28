"""Solicitud de documentos: el trabajador pide desde el portal y el empleador la atiende."""
from django.utils import timezone

from ..models import Empleado, Liquidacion, SolicitudDocumento, SolicitudFirma
from ..views.solicitudes_documento import _ultimo_mes_cerrado
from .test_portal_trabajador import PortalBase
from .utiles import crear_empleado, crear_usuario_completo


def _anterior(anio, mes):
    return (anio - 1, 12) if mes == 1 else (anio, mes - 1)


class SolicitudesTrabajadorTests(PortalBase):
    def setUp(self):
        super().setUp()
        self._entrar()
        self.anio, self.mes = _ultimo_mes_cerrado()

    def _opciones(self):
        return self.client.get('/api/trabajador/solicitudes/').data['opciones'][0]

    def _pedir(self, **datos):
        return self.client.post('/api/trabajador/solicitudes/', {'empleo': self.ficha.id, **datos}, format='json')

    def test_meses_disponibles_excluyen_emitidos_y_mes_en_curso(self):
        Liquidacion.objects.create(empleado=self.ficha, mes=self.mes, anio=self.anio, total_haberes=1, sueldo_liquido=1)
        meses = [(m['anio'], m['mes']) for m in self._opciones()['meses']]
        hoy = timezone.localdate()
        self.assertNotIn((self.anio, self.mes), meses)                 # ya emitida
        self.assertNotIn((hoy.year, hoy.month), meses)                 # mes en curso
        self.assertEqual(meses[0], _anterior(self.anio, self.mes))
        self.assertEqual(len(meses), 23)                               # 24 hacia atrás menos la emitida
        self.assertFalse(self._opciones()['finiquito'])                # sigue trabajando

    def test_pedir_liquidacion_y_no_repetirla(self):
        r = self._pedir(tipo='LIQUIDACION', mes=self.mes, anio=self.anio)
        self.assertEqual((r.status_code, r.data['estado']), (201, 'PENDIENTE'), r.data)
        self.assertNotIn((self.anio, self.mes), [(m['anio'], m['mes']) for m in self._opciones()['meses']])
        r = self._pedir(tipo='LIQUIDACION', mes=self.mes, anio=self.anio)
        self.assertEqual(r.status_code, 400)
        hoy = timezone.localdate()
        self.assertEqual(self._pedir(tipo='LIQUIDACION', mes=hoy.month, anio=hoy.year).status_code, 400)
        self.assertEqual(self._pedir(tipo='LIQUIDACION', mes=1, anio=2023).status_code, 400)  # antes del contrato

    def test_otro_documento_pide_detalle_y_finiquito_solo_desvinculado(self):
        self.assertEqual(self._pedir(tipo='OTRO', detalle='').status_code, 400)
        self.assertEqual(self._pedir(tipo='OTRO', detalle='Certificado de antigüedad').status_code, 201)
        self.assertEqual(self._pedir(tipo='FINIQUITO').status_code, 400)
        Empleado.objects.filter(pk=self.ficha.pk).update(activo=False, fecha_desvinculacion=timezone.localdate())
        self.assertTrue(self._opciones()['finiquito'])
        self.assertEqual(self._pedir(tipo='FINIQUITO').status_code, 201)
        self.assertFalse(self._opciones()['finiquito'])

    def test_se_resuelve_sola_al_enviar_la_liquidacion_a_firma(self):
        self._pedir(tipo='LIQUIDACION', mes=self.mes, anio=self.anio)
        liq = Liquidacion.objects.create(empleado=self.ficha, mes=self.mes, anio=self.anio, total_haberes=1,
                                         sueldo_liquido=1)
        SolicitudFirma.objects.create(empleado=self.ficha, empresa=self.empresa, liquidacion=liq,
                                      tipo_documento='LIQUIDACION', estado='PENDIENTE')
        s = self.client.get('/api/trabajador/solicitudes/').data['solicitudes'][0]
        self.assertEqual(s['estado'], 'RESUELTA')

    def test_no_puede_pedir_por_una_ficha_ajena(self):
        _, _, _, otra = crear_usuario_completo('sol_b', '11.111.111-1', '77.777.777-7')
        ajena = crear_empleado(otra, '9.876.543-3')
        r = self.client.post('/api/trabajador/solicitudes/', {'empleo': ajena.id, 'tipo': 'OTRO',
                                                               'detalle': 'Certificado'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_sin_sesion_no_hay_acceso(self):
        self.client.post('/api/trabajador/salir/', {}, format='json')
        self.assertEqual(self.client.get('/api/trabajador/solicitudes/').status_code, 403)


class SolicitudesEmpleadorTests(PortalBase):
    def setUp(self):
        super().setUp()
        self.solicitud = SolicitudDocumento.objects.create(empleado=self.ficha, tipo='OTRO', detalle='Certificado')
        self.client.force_authenticate(self.jefe)

    def test_lista_resuelve_y_descarta(self):
        r = self.client.get('/api/solicitudes-documento/', {'empresa': self.empresa.id, 'estado': 'PENDIENTE'})
        self.assertEqual([s['id'] for s in r.data], [self.solicitud.id])
        self.assertEqual(r.data[0]['empleado']['nombre'], 'Ana Rojas')
        r = self.client.post(f'/api/solicitudes-documento/{self.solicitud.id}/resolver/')
        self.assertEqual(r.data['estado'], 'RESUELTA')
        self.assertEqual(self.client.post(f'/api/solicitudes-documento/{self.solicitud.id}/resolver/').status_code, 404)

        otra = SolicitudDocumento.objects.create(empleado=self.ficha, tipo='OTRO', detalle='Carta')
        url = f'/api/solicitudes-documento/{otra.id}/descartar/'
        self.assertEqual(self.client.post(url, {'motivo': ''}, format='json').status_code, 400)
        r = self.client.post(url, {'motivo': 'Se entregó en papel'}, format='json')
        self.assertEqual((r.data['estado'], r.data['motivo']), ('DESCARTADA', 'Se entregó en papel'))

    def test_otro_empleador_no_ve_ni_atiende(self):
        otro, _, _, _ = crear_usuario_completo('sol_c', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get('/api/solicitudes-documento/').data, [])
        r = self.client.post(f'/api/solicitudes-documento/{self.solicitud.id}/resolver/')
        self.assertEqual(r.status_code, 404)
