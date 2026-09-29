"""Certificados del portal: disponibilidad, contenido, PDF, verificación pública y vista del empleador."""
import base64
import io

from django.utils import timezone
from PIL import Image

from ..models import CertificadoEmitido, Contrato, Empleado, Empresa, Liquidacion, SolicitudFirma, VacacionEmpleado
from ..views.certificados import _rut_oculto
from .test_portal_trabajador import PortalBase
from .utiles import crear_usuario_completo


def _png():
    salida = io.BytesIO()
    Image.new('RGB', (40, 16), 'white').save(salida, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(salida.getvalue()).decode()


def _meses_atras(n):
    hoy = timezone.localdate()
    anio, mes = hoy.year, hoy.month
    salida = []
    for _ in range(n):
        anio, mes = (anio - 1, 12) if mes == 1 else (anio, mes - 1)
        salida.append((anio, mes))
    return salida      # del más reciente al más antiguo, solo meses cerrados


class CertificadosBase(PortalBase):
    def setUp(self):
        super().setUp()
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen=_png(), firma_firmante_nombre='Pedro Soto',
                                                          firma_firmante_cargo='Gerente')
        Contrato.objects.filter(empleado=self.ficha).update(distribucion_horario={
            'lunes': {'activo': True, 'entrada': '09:00', 'salida': '18:00', 'colacion': 60}})
        self._entrar()

    def _liquidacion(self, anio, mes, firmada=True, imponible=1_000_000):
        liq = Liquidacion.objects.create(empleado=self.ficha, mes=mes, anio=anio, total_imponible=imponible,
                                         total_haberes=imponible + 50_000, sueldo_liquido=800_000, afp_monto=100_000,
                                         afp_nombre='HABITAT', salud_monto=70_000, salud_nombre='FONASA',
                                         seguro_cesantia=6_000)
        if firmada:
            SolicitudFirma.objects.create(empleado=self.ficha, empresa=self.empresa, liquidacion=liq,
                                          tipo_documento='LIQUIDACION', estado='FIRMADO', firmado_en=timezone.now())
        return liq

    def _opciones(self):
        datos = self.client.get('/api/trabajador/certificados/').data
        return {c['tipo']: c for c in datos['opciones'][0]['certificados']}

    def _emitir(self, tipo, opcion=''):
        return self.client.post('/api/trabajador/certificados/', {'empleo': self.ficha.id, 'tipo': tipo,
                                                                  'opcion': opcion}, format='json')


class DisponibilidadTests(CertificadosBase):
    def test_activo_ve_antiguedad_y_jornada_pero_no_termino(self):
        opciones = self._opciones()
        self.assertNotIn('TERMINO', opciones)
        self.assertTrue(opciones['ANTIGUEDAD']['disponible'])
        self.assertTrue(opciones['JORNADA']['disponible'])
        self.assertTrue(opciones['VACACIONES']['disponible'])
        self.assertFalse(opciones['RENTA']['disponible'])
        self.assertIn('firmadas', opciones['RENTA']['motivo'])

    def test_sin_firma_del_empleador_no_se_emite(self):
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='')
        empleo = self.client.get('/api/trabajador/certificados/').data['opciones'][0]
        self.assertEqual(empleo['certificados'], [])
        self.assertIn('firma', empleo['aviso'])
        r = self._emitir('ANTIGUEDAD')
        self.assertEqual(r.status_code, 400)
        self.assertIn('firma', r.data['error'])

    def test_renta_solo_con_liquidaciones_firmadas_consecutivas(self):
        meses = _meses_atras(3)
        for anio, mes in meses[:2]:
            self._liquidacion(anio, mes)
        self._liquidacion(*meses[2], firmada=False)
        r = self._emitir('RENTA', '3')
        self.assertEqual(r.status_code, 400)
        self.assertIn('Faltan liquidaciones firmadas', r.data['error'])
        SolicitudFirma.objects.create(empleado=self.ficha, empresa=self.empresa, estado='FIRMADO',
                                      liquidacion=Liquidacion.objects.get(anio=meses[2][0], mes=meses[2][1]),
                                      tipo_documento='LIQUIDACION', firmado_en=timezone.now())
        renta = self._opciones()['RENTA']
        self.assertEqual([o['disponible'] for o in renta['opciones']], [True, False, False])
        r = self._emitir('RENTA', '3')
        self.assertEqual(r.status_code, 201, r.data)
        cert = CertificadoEmitido.objects.get()
        self.assertEqual(cert.datos['tabla']['pie'][1], '$1.000.000')
        self.assertEqual(len(cert.datos['tabla']['filas']), 3)

    def test_termino_sin_causal_para_desvinculado(self):
        Empleado.objects.filter(pk=self.ficha.pk).update(activo=False, fecha_desvinculacion=timezone.localdate())
        opciones = self._opciones()
        self.assertNotIn('ANTIGUEDAD', opciones)
        r = self._emitir('TERMINO')
        self.assertEqual(r.status_code, 201, r.data)
        texto = ' '.join(CertificadoEmitido.objects.get().datos['cuerpo']).lower()
        self.assertNotIn('causal', texto)
        self.assertNotIn('art. 1', texto)

    def test_no_emite_para_ficha_ajena_ni_tipo_desconocido(self):
        _, _, _, otra = crear_usuario_completo('cert_b', '11.111.111-1', '77.777.777-7')
        from .utiles import crear_empleado
        ajena = crear_empleado(otra, '9.876.543-3')
        r = self.client.post('/api/trabajador/certificados/', {'empleo': ajena.id, 'tipo': 'ANTIGUEDAD'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self._emitir('OTRO').status_code, 400)


class EmisionTests(CertificadosBase):
    def test_todos_los_certificados_generan_pdf(self):
        for anio, mes in _meses_atras(3):
            self._liquidacion(anio, mes)
        VacacionEmpleado.objects.create(empleado=self.ficha, empresa=self.empresa, estado='APROBADO',
                                        fecha_inicio='2026-02-02', fecha_fin='2026-02-06', dias_habiles=5)
        for tipo, opcion in [('ANTIGUEDAD', ''), ('RENTA', '3'), ('COTIZACIONES', '3'), ('VACACIONES', ''),
                             ('JORNADA', '')]:
            r = self._emitir(tipo, opcion)
            self.assertEqual(r.status_code, 201, (tipo, r.data))
            pdf = self.client.get('/api/trabajador/descargar/', {'tipo': 'certificado', 'id': r.data['id']})
            self.assertEqual(pdf.status_code, 200, tipo)
            self.assertTrue(pdf.content.startswith(b'%PDF'), tipo)
        cot = CertificadoEmitido.objects.get(tipo='COTIZACIONES')
        self.assertIn('No acredita su pago', cot.datos['nota'])
        jornada = CertificadoEmitido.objects.get(tipo='JORNADA')
        self.assertEqual(jornada.datos['tabla']['filas'][0][0], 'Lunes')

    def test_mismo_dia_mismo_contenido_reutiliza_el_certificado(self):
        a = self._emitir('ANTIGUEDAD').data
        b = self._emitir('ANTIGUEDAD').data
        self.assertEqual(a['codigo'], b['codigo'])
        self.assertEqual(CertificadoEmitido.objects.count(), 1)

    def test_no_se_descarga_un_certificado_ajeno(self):
        _, _, _, otra = crear_usuario_completo('cert_c', '11.111.111-1', '77.777.777-7')
        from .utiles import crear_empleado
        ajena = crear_empleado(otra, '9.876.543-3')
        cert = CertificadoEmitido.objects.create(empleado=ajena, tipo='ANTIGUEDAD', codigo='AAAA-BBBB-CCCC',
                                                 datos={})
        r = self.client.get('/api/trabajador/descargar/', {'tipo': 'certificado', 'id': cert.id})
        self.assertEqual(r.status_code, 404)


class VerificacionTests(CertificadosBase):
    def test_verificacion_publica_con_rut_parcial(self):
        codigo = self._emitir('ANTIGUEDAD').data['codigo']
        self.client.post('/api/trabajador/salir/', {}, format='json')
        r = self.client.get(f'/api/certificados/verificar/{codigo.lower()}/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['valido'])
        self.assertEqual(r.data['trabajador']['nombre'], 'Ana Rojas')
        self.assertEqual(r.data['trabajador']['rut'], '••.•••.678-5')
        self.assertEqual(self.client.get('/api/certificados/verificar/ZZZZ-ZZZZ-ZZZZ/').status_code, 404)

    def test_rut_oculto(self):
        self.assertEqual(_rut_oculto('9.876.543-3'), '•.•••.543-3')


class EmpleadorTests(CertificadosBase):
    def test_empleador_ve_los_emitidos_de_su_trabajador(self):
        self._emitir('ANTIGUEDAD')
        self.client.force_authenticate(self.jefe)
        r = self.client.get(f'/api/empleados/{self.ficha.id}/certificados/')
        self.assertEqual([c['tipo'] for c in r.data], ['ANTIGUEDAD'])
        pdf = self.client.get(f"/api/certificados/{r.data[0]['id']}/pdf/")
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        otro, _, _, _ = crear_usuario_completo('cert_d', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get(f'/api/empleados/{self.ficha.id}/certificados/').status_code, 404)
        self.assertEqual(self.client.get(f"/api/certificados/{r.data[0]['id']}/pdf/").status_code, 404)


class FirmaDaniadaTests(CertificadosBase):
    def test_firma_ilegible_no_impide_el_pdf(self):
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,iVBORw0KGgo=')
        r = self._emitir('ANTIGUEDAD')
        pdf = self.client.get('/api/trabajador/descargar/', {'tipo': 'certificado', 'id': r.data['id']})
        self.assertTrue(pdf.content.startswith(b'%PDF'))


class AnulacionTests(CertificadosBase):
    def test_empleador_anula_y_la_verificacion_lo_informa(self):
        emitido = self._emitir('ANTIGUEDAD').data
        self.client.force_authenticate(self.jefe)
        url = f"/api/certificados/{emitido['id']}/anular/"
        self.assertEqual(self.client.post(url, {'motivo': 'otro'}, format='json').status_code, 400)
        r = self.client.post(url, {'motivo': 'DATO_ERRONEO'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['motivo_anulacion'], 'Contenía un dato erróneo, ya corregido')
        self.assertEqual(self.client.post(url, {'motivo': 'DATO_ERRONEO'}, format='json').status_code, 404)
        pdf = self.client.get(f"/api/certificados/{emitido['id']}/pdf/")        # copia del empleador, marcada
        self.assertTrue(pdf.content.startswith(b'%PDF'))
        self.client.force_authenticate(None)
        v = self.client.get(f"/api/certificados/verificar/{emitido['codigo']}/").data
        self.assertEqual((v['valido'], v['anulado']), (False, True))
        self.assertNotIn('filas', v)

    def test_trabajador_no_descarga_el_anulado_y_puede_emitir_otro(self):
        emitido = self._emitir('ANTIGUEDAD').data
        CertificadoEmitido.objects.filter(pk=emitido['id']).update(anulado_en=timezone.now(),
                                                                   motivo_anulacion='EMITIDO_POR_ERROR')
        r = self.client.get('/api/trabajador/descargar/', {'tipo': 'certificado', 'id': emitido['id']})
        self.assertEqual(r.status_code, 410)
        nuevo = self._emitir('ANTIGUEDAD').data
        self.assertNotEqual(nuevo['codigo'], emitido['codigo'])

    def test_otro_empleador_no_anula(self):
        emitido = self._emitir('ANTIGUEDAD').data
        otro, _, _, _ = crear_usuario_completo('cert_e', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        r = self.client.post(f"/api/certificados/{emitido['id']}/anular/", {'motivo': 'DATO_ERRONEO'}, format='json')
        self.assertEqual(r.status_code, 404)
