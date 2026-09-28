"""Solicitud de documentos: el trabajador pide desde el portal (lista cerrada) y el empleador la atiende."""
import datetime

from django.utils import timezone

from ..models import Contrato, Empleado, Liquidacion, SolicitudDocumento, SolicitudFirma, VacacionEmpleado
from ..views.solicitudes_documento import _ultimo_mes_cerrado
from .test_portal_trabajador import PortalBase
from .utiles import crear_empleado, crear_usuario_completo


def _anterior(anio, mes):
    return (anio - 1, 12) if mes == 1 else (anio, mes - 1)


class SolicitudesTrabajadorTests(PortalBase):
    def setUp(self):
        super().setUp()
        self.contrato = Contrato.objects.get(empleado=self.ficha)
        self._entrar()
        self.anio, self.mes = _ultimo_mes_cerrado()

    def _documentos(self):
        return {d['tipo']: d for d in self.client.get('/api/trabajador/solicitudes/').data['opciones'][0]['documentos']}

    def _pedir(self, **datos):
        return self.client.post('/api/trabajador/solicitudes/', {'empleo': self.ficha.id, **datos}, format='json')

    def test_meses_disponibles_excluyen_emitidos_y_mes_en_curso(self):
        Liquidacion.objects.create(empleado=self.ficha, mes=self.mes, anio=self.anio, total_haberes=1, sueldo_liquido=1)
        liq = self._documentos()['LIQUIDACION']
        valores = [o['valor'] for o in liq['opciones']]
        hoy = timezone.localdate()
        self.assertEqual(liq['etiqueta_opcion'], 'Mes y año')
        self.assertNotIn(f'{self.anio}-{self.mes}', valores)             # ya emitida
        self.assertNotIn(f'{hoy.year}-{hoy.month}', valores)             # mes en curso
        self.assertEqual(valores[0], '%d-%d' % _anterior(self.anio, self.mes))
        self.assertEqual(len(valores), 23)                                # 24 hacia atrás menos la emitida

    def test_pedir_liquidacion_y_no_repetirla(self):
        opcion = f'{self.anio}-{self.mes}'
        r = self._pedir(tipo='LIQUIDACION', opcion=opcion)
        self.assertEqual((r.status_code, r.data['estado'], r.data['referencia']), (201, 'PENDIENTE', r.data['referencia']))
        self.assertNotIn(opcion, [o['valor'] for o in self._documentos()['LIQUIDACION']['opciones']])
        self.assertEqual(self._pedir(tipo='LIQUIDACION', opcion=opcion).status_code, 400)
        hoy = timezone.localdate()
        self.assertEqual(self._pedir(tipo='LIQUIDACION', opcion=f'{hoy.year}-{hoy.month}').status_code, 400)
        self.assertEqual(self._pedir(tipo='LIQUIDACION', opcion='2023-1').status_code, 400)   # antes del contrato
        self.assertEqual(self._pedir(tipo='LIQUIDACION').status_code, 400)                    # sin opción

    def test_no_hay_tipos_libres(self):
        self.assertEqual(self._pedir(tipo='OTRO', detalle='Certificado').status_code, 400)
        self.assertFalse(hasattr(SolicitudDocumento, 'detalle'))

    def test_contrato_solo_si_no_esta_firmado_ni_subido(self):
        self.assertIn('CONTRATO', self._documentos())
        SolicitudFirma.objects.create(empleado=self.ficha, empresa=self.empresa, contrato=self.contrato,
                                      tipo_documento='CONTRATO', estado='PENDIENTE')
        self.assertNotIn('CONTRATO', self._documentos())
        SolicitudFirma.objects.all().delete()
        Contrato.objects.filter(pk=self.contrato.pk).update(archivo_contrato='contratos/firmado.pdf')
        self.assertNotIn('CONTRATO', self._documentos())

    def test_anexo_40h_solo_si_la_jornada_excede_el_maximo(self):
        Contrato.objects.filter(pk=self.contrato.pk).update(horas_semanales=40)
        self.assertNotIn('ANEXO_40H', self._documentos())
        Contrato.objects.filter(pk=self.contrato.pk).update(horas_semanales=45)
        self.assertIn('ANEXO_40H', self._documentos())
        self.assertEqual(self._pedir(tipo='ANEXO_40H').status_code, 201)
        self.assertNotIn('ANEXO_40H', self._documentos())

    def test_comprobante_de_una_vacacion_aprobada(self):
        hoy = timezone.localdate()
        vac = VacacionEmpleado.objects.create(empleado=self.ficha, empresa=self.empresa, estado='APROBADO',
                                              fecha_inicio=hoy - datetime.timedelta(days=40),
                                              fecha_fin=hoy - datetime.timedelta(days=30), dias_habiles=8)
        VacacionEmpleado.objects.create(empleado=self.ficha, empresa=self.empresa, estado='RECHAZADO',
                                        fecha_inicio=hoy, fecha_fin=hoy, dias_habiles=1)
        opciones = self._documentos()['VACACION']['opciones']
        self.assertEqual([o['valor'] for o in opciones], [str(vac.id)])
        r = self._pedir(tipo='VACACION', opcion=str(vac.id))
        self.assertIn('8 días hábiles', r.data['referencia'])
        self.assertNotIn('VACACION', self._documentos())
        SolicitudFirma.objects.create(empleado=self.ficha, empresa=self.empresa, vacacion=vac,
                                      tipo_documento='VACACION', estado='PENDIENTE')
        self.assertEqual(SolicitudDocumento.objects.get().estado, 'PENDIENTE')
        self.client.get('/api/trabajador/solicitudes/')
        self.assertEqual(SolicitudDocumento.objects.get().estado, 'RESUELTA')

    def test_finiquito_solo_desvinculado(self):
        self.assertNotIn('FINIQUITO', self._documentos())
        self.assertEqual(self._pedir(tipo='FINIQUITO').status_code, 400)
        Empleado.objects.filter(pk=self.ficha.pk).update(activo=False, fecha_desvinculacion=timezone.localdate())
        self.assertEqual(self._pedir(tipo='FINIQUITO').status_code, 201)
        self.assertNotIn('FINIQUITO', self._documentos())

    def test_se_resuelve_sola_al_enviar_la_liquidacion_a_firma(self):
        self._pedir(tipo='LIQUIDACION', opcion=f'{self.anio}-{self.mes}')
        liq = Liquidacion.objects.create(empleado=self.ficha, mes=self.mes, anio=self.anio, total_haberes=1,
                                         sueldo_liquido=1)
        SolicitudFirma.objects.create(empleado=self.ficha, empresa=self.empresa, liquidacion=liq,
                                      tipo_documento='LIQUIDACION', estado='PENDIENTE')
        s = self.client.get('/api/trabajador/solicitudes/').data['solicitudes'][0]
        self.assertEqual(s['estado'], 'RESUELTA')

    def test_no_puede_pedir_por_una_ficha_ajena(self):
        _, _, _, otra = crear_usuario_completo('sol_b', '11.111.111-1', '77.777.777-7')
        ajena = crear_empleado(otra, '9.876.543-3')
        r = self.client.post('/api/trabajador/solicitudes/', {'empleo': ajena.id, 'tipo': 'CONTRATO'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_sin_sesion_no_hay_acceso(self):
        self.client.post('/api/trabajador/salir/', {}, format='json')
        self.assertEqual(self.client.get('/api/trabajador/solicitudes/').status_code, 403)


class SolicitudesEmpleadorTests(PortalBase):
    def setUp(self):
        super().setUp()
        self.solicitud = SolicitudDocumento.objects.create(empleado=self.ficha, tipo='LIQUIDACION', mes=1, anio=2026)
        self.client.force_authenticate(self.jefe)

    def test_lista_y_descarta_con_motivo_de_la_lista(self):
        r = self.client.get('/api/solicitudes-documento/', {'empresa': self.empresa.id, 'estado': 'PENDIENTE'})
        self.assertEqual([s['id'] for s in r.data], [self.solicitud.id])
        self.assertEqual((r.data[0]['empleado']['nombre'], r.data[0]['referencia']), ('Ana Rojas', 'Enero 2026'))
        self.assertIn('SIN_REMUNERACION', [m['valor'] for m in r.data[0]['motivos']])
        url = f'/api/solicitudes-documento/{self.solicitud.id}/descartar/'
        self.assertEqual(self.client.post(url, {'motivo': 'Texto libre'}, format='json').status_code, 400)
        r = self.client.post(url, {'motivo': 'SIN_REMUNERACION'}, format='json')
        self.assertEqual((r.data['estado'], r.data['motivo_texto']),
                         ('DESCARTADA', 'Ese mes no hubo remuneración que liquidar.'))
        self.assertEqual(self.client.post(url, {'motivo': 'SIN_REMUNERACION'}, format='json').status_code, 404)

    def test_motivos_segun_el_documento(self):
        contrato = SolicitudDocumento.objects.create(empleado=self.ficha, tipo='CONTRATO')
        r = self.client.post(f'/api/solicitudes-documento/{contrato.id}/descartar/', {'motivo': 'SIN_REMUNERACION'},
                             format='json')
        self.assertEqual(r.status_code, 400)
        datos = next(s for s in self.client.get('/api/solicitudes-documento/').data if s['id'] == contrato.id)
        self.assertEqual(datos['contrato'], Contrato.objects.get(empleado=self.ficha).id)

    def test_otro_empleador_no_ve_ni_atiende(self):
        otro, _, _, _ = crear_usuario_completo('sol_c', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get('/api/solicitudes-documento/').data, [])
        r = self.client.post(f'/api/solicitudes-documento/{self.solicitud.id}/descartar/',
                             {'motivo': 'ENTREGADO_PAPEL'}, format='json')
        self.assertEqual(r.status_code, 404)
