"""Registro electrónico laboral (Mi DT) y consentimiento para la documentación electrónica."""
import datetime
import io
import uuid
import zipfile
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from .. import registro_dt as dt
from ..models import AnexoContrato, Contrato, Empleado, Empresa, Finiquito, RegistroDT, SolicitudFirma
from ..views.feriado import es_feriado_cl
from .utiles import crear_empleado, crear_usuario_completo


class PlazosTests(APITestCase):
    def test_dias_habiles_saltan_fines_de_semana_y_feriados(self):
        # Viernes 11-09-2026 + 3 hábiles: lunes 14, martes 15, miércoles 16 (el 18 y 19 son feriados).
        self.assertEqual(dt.sumar_dias_habiles(datetime.date(2026, 9, 11), 3, es_feriado_cl), datetime.date(2026, 9, 16))
        # Desde el martes 15: miércoles 16, jueves 17, lunes 21 (18 y 19 feriados, 20 domingo).
        self.assertEqual(dt.sumar_dias_habiles(datetime.date(2026, 9, 15), 3, es_feriado_cl), datetime.date(2026, 9, 21))

    def test_plazo_de_termino_segun_causal(self):
        self.assertEqual([dt.plazo_termino(c) for c in ('159_2', '159_4', '159_6', '160_3', '161_1', '163bis')],
                         [10, 3, 6, 3, 0, 6])

    def test_separar_direccion(self):
        self.assertEqual(dt.separar_direccion('Av. 5 de Abril 1020 depto 34'), ('Av. 5 de Abril', '1020', '34'))
        self.assertEqual(dt.separar_direccion('Merced N° 280'), ('Merced', '280', ''))
        self.assertEqual(dt.separar_direccion('Parcela sin número')[1], '')


class RegistroTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('dt_owner', '21.000.000-3', '76.000.555-2')
        Empresa.objects.filter(pk=self.empresa.pk).update(comuna='PROVIDENCIA')
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        Empleado.objects.filter(pk=self.emp.pk).update(
            comuna='Ñuñoa', direccion='Av. Irarrázaval 2401 depto 5', afp='HABITAT', sistema_salud='FONASA',
            email='t@correo.cl', numero_telefono='+56 9 1234 5678')
        horario = {d: {'activo': True, 'entrada': '09:00', 'salida': '18:00', 'colacion': 60}
                   for d in ('lunes', 'martes', 'miercoles', 'jueves', 'viernes')}
        self.contrato = Contrato.objects.create(
            empleado=self.emp, tipo_contrato='INDEFINIDO', cargo='Analista', fecha_inicio='2026-09-01',
            sueldo_base=900_000, tipo_jornada='ORDINARIA', horas_semanales=40, distribucion_horario=horario,
            dia_pago=30, gratificacion_legal='MENSUAL')
        self.client.force_authenticate(self.user)

    def _listar(self):
        r = self.client.get('/api/registro-dt/', {'empresa': self.empresa.id})
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def test_contrato_vence_a_los_15_dias_habiles_y_se_marca(self):
        datos = self._listar()
        item = next(i for i in datos['items'] if i['tipo'] == 'CONTRATO')
        self.assertEqual(item['vence'], '2026-09-23')   # martes 01-09 + 15 hábiles (el 18 es feriado)
        clave = item['clave']
        r = self.client.post('/api/registro-dt/marcar/', {'empresa': self.empresa.id, 'claves': [clave],
                                                          'fecha': '2026-09-10'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        item = next(i for i in self._listar()['items'] if i['clave'] == clave)
        self.assertEqual((item['estado'], item['registrado_en']), ('REGISTRADO', '2026-09-10'))
        self.client.post('/api/registro-dt/desmarcar/', {'empresa': self.empresa.id, 'claves': [clave]}, format='json')
        self.assertFalse(RegistroDT.objects.exists())

    def test_no_se_marcan_claves_de_otra_empresa(self):
        otro, _, _, ajena = crear_usuario_completo('dt_otro', '11.111.111-1', '77.777.777-7')
        r = self.client.post('/api/registro-dt/marcar/', {'empresa': ajena.id, 'claves': ['CONTRATO:1']}, format='json')
        self.assertEqual(r.status_code, 404)
        r = self.client.post('/api/registro-dt/marcar/', {'empresa': self.empresa.id, 'claves': ['CONTRATO:999']},
                             format='json')
        self.assertEqual(r.status_code, 400)

    def test_termino_por_renuncia_y_articulo_161(self):
        Empleado.objects.filter(pk=self.emp.pk).update(activo=False, fecha_desvinculacion='2026-09-30')
        Finiquito.objects.create(empleado=self.emp, causal_articulo='159_2', fecha_termino='2026-09-30',
                                 fecha_emision='2026-09-30', sueldo_base=900_000)
        termino = next(i for i in self._listar()['items'] if i['tipo'] == 'TERMINO')
        self.assertEqual(termino['vence'], '2026-10-15')     # 10 hábiles; el lunes 12-10 es feriado
        Finiquito.objects.update(causal_articulo='161_1')
        termino = next(i for i in self._listar()['items'] if i['tipo'] == 'TERMINO')
        self.assertEqual(termino['vence'], '2026-09-30')     # junto con la carta de aviso

    def test_anexo_firmado_se_registra(self):
        anexo = AnexoContrato.objects.create(contrato=self.contrato, titulo='Aumento', fecha_emision='2026-09-20')
        self.assertFalse([i for i in self._listar()['items'] if i['tipo'] == 'ANEXO'])   # sin firmar no existe
        SolicitudFirma.objects.create(empleado=self.emp, empresa=self.empresa, anexo_contrato=anexo,
                                      tipo_documento='ANEXO_CONTRATO', estado='FIRMADO',
                                      firmado_en=timezone.make_aware(datetime.datetime(2026, 9, 22, 10)))
        anexo_item = next(i for i in self._listar()['items'] if i['tipo'] == 'ANEXO')
        self.assertEqual(anexo_item['fecha'], '2026-09-22')

    def test_csv_para_mi_dt(self):
        r = self.client.get('/api/registro-dt/csv/', {'empresa': self.empresa.id})
        self.assertEqual(r.status_code, 200, getattr(r, 'data', None))
        z = zipfile.ZipFile(io.BytesIO(r.content))
        nombres = z.namelist()
        csv = next(n for n in nombres if n.endswith('.csv'))
        self.assertEqual(csv, f'analista/76000555-2_{timezone.localdate():%Y%m}.csv')
        lineas = z.read(csv).decode('cp1252').split('\r\n')
        cabecera, fila = lineas[0].split(';'), dict(zip(lineas[0].split(';'), lineas[1].split(';')))
        self.assertEqual(cabecera, dt.COLUMNAS)
        self.assertEqual(fila['RUT_TRABAJADOR'], '12345678-5')
        self.assertEqual((fila['COMUNA'], fila['COMUNA_CELEBRACION']),
                         (str(dt.codigo_comuna('Ñuñoa')), str(dt.codigo_comuna('Providencia'))))
        self.assertEqual((fila['CALLE'], fila['NUMERO'], fila['DPTO']), ('Av. Irarrázaval', '2401', '5'))
        self.assertEqual((fila['REM_AFP'], fila['REM_SALUD'], fila['TELEFONO']), ('14', '102', '912345678'))
        self.assertEqual((fila['TIPO_JORNADA'], fila['DURACION_JORNADA'], fila['LUNES_HORA_INICIO'],
                          fila['TIEMPO_COLACION'], fila['T_COLACION_NO_IMP']), ('1', '40', '09:00', '60', '60'))
        self.assertEqual((fila['GRAT_FORMA_PAGO'], fila['FECHA_INI_RELABORAL']), ('4', '01/09/2026'))
        self.assertGreater(int(fila['MONTO_IMPONIBLE']), 900_000)   # sueldo + gratificación mensual
        self.assertIn('LEEME.txt', nombres)

    def test_ficha_del_contrato_sigue_las_4_etapas_de_mi_dt(self):
        clave = next(i['clave'] for i in self._listar()['items'] if i['tipo'] == 'CONTRATO')
        r = self.client.get('/api/registro-dt/ficha/', {'empresa': self.empresa.id, 'clave': clave})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual([s['titulo'].split(' · ')[0] for s in r.data['secciones']],
                         ['Etapa 1', 'Etapa 2', 'Etapa 3', 'Etapa 4'])
        campos = {c['etiqueta']: c for s in r.data['secciones'] for c in s['campos']}
        self.assertEqual((campos['Calle']['valor'], campos['Número']['valor']), ('Av. Irarrázaval', '2401'))
        self.assertEqual(campos['Lunes']['valor'], '09:00 a 18:00')
        # Las cláusulas que Mi DT pide copiar salen del texto del contrato.
        self.assertIn('Sueldo Base', campos['Remuneraciones y asignaciones (cláusula del contrato)']['valor'])
        self.assertIn('40', campos['Distribución de jornada (cláusula del contrato)']['valor'])
        self.assertIn('documentación laboral', campos['Otras estipulaciones']['valor'])
        self.assertTrue(campos['Otras estipulaciones']['copiar'])

    def test_ficha_de_termino_y_de_anexo(self):
        Empleado.objects.filter(pk=self.emp.pk).update(activo=False, fecha_desvinculacion='2026-09-30')
        Finiquito.objects.create(empleado=self.emp, causal_articulo='159_2', fecha_termino='2026-09-30',
                                 fecha_emision='2026-09-30', sueldo_base=900_000)
        anexo = AnexoContrato.objects.create(contrato=self.contrato, titulo='Aumento', descripcion='Sube el sueldo.',
                                             fecha_emision='2026-09-20', aplicado=True,
                                             aplicado_en=timezone.make_aware(datetime.datetime(2026, 9, 21, 10)))
        items = {i['tipo']: i['clave'] for i in self._listar()['items']}
        r = self.client.get('/api/registro-dt/ficha/', {'empresa': self.empresa.id, 'clave': items['TERMINO']})
        self.assertIn('Renuncia', str(r.data['secciones']))
        r = self.client.get('/api/registro-dt/ficha/', {'empresa': self.empresa.id, 'clave': f'ANEXO:{anexo.id}'})
        self.assertIn('Sube el sueldo.', str(r.data['secciones']))
        r = self.client.get('/api/registro-dt/ficha/', {'empresa': self.empresa.id, 'clave': 'CONTRATO:9999'})
        self.assertEqual(r.status_code, 404)

    def test_csv_solo_desde_pyme(self):
        from ..models import Plan
        from django.contrib.auth.models import User
        Plan.objects.update(nivel=2)
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))   # sin el plan en caché
        r = self.client.get('/api/registro-dt/csv/', {'empresa': self.empresa.id})
        self.assertEqual(r.status_code, 403)


class ConsentimientoTests(APITestCase):
    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo('cons_owner', '21.000.000-3', '76.000.555-2')
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA')
        self.emp = crear_empleado(self.empresa, '12.345.678-5')
        Empleado.objects.filter(pk=self.emp.pk).update(email='t@correo.cl')
        Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', cargo='Analista',
                                fecha_inicio='2026-01-01', sueldo_base=900_000)
        self.client.force_authenticate(self.user)

    @patch('core.b2_client.subir_documento')
    def test_anexo_de_consentimiento_se_crea_envia_y_al_firmar_queda_registrado(self, _subir):
        r = self.client.post('/api/registro-dt/anexos_consentimiento/', {'empresa': self.empresa.id, 'enviar': True},
                             format='json')
        self.assertEqual((r.status_code, r.data['creados'], r.data['enviados']), (200, 1, 1), r.data)
        anexo = AnexoContrato.objects.get()
        self.assertEqual(anexo.tipo, 'CONSENTIMIENTO_ELECTRONICO')
        solicitud = SolicitudFirma.objects.get()
        self.assertTrue(solicitud.incluye_consentimiento)
        # Repetir no duplica.
        r = self.client.post('/api/registro-dt/anexos_consentimiento/', {'empresa': self.empresa.id, 'enviar': True},
                             format='json')
        self.assertEqual((r.data['creados'], r.data['enviados']), (0, 0))

        sesion = uuid.uuid4()
        SolicitudFirma.objects.filter(pk=solicitud.pk).update(sesion_token_trabajador=sesion)
        with patch('core.b2_client.descargar_documento', return_value=b'%PDF'), \
                patch('core.pdf_firma.agregar_certificado_firma', return_value=b'%PDF-firmado'), \
                patch('core.b2_client.eliminar_documento'), \
                patch('core.views.firma_publica._enviar_emails_firma_completada'):
            r = self.client.post(f'/api/firma-publica/{solicitud.token}/firmar/', {
                'sesion_token': str(sesion), 'firma_trabajador': 'data:image/png;base64,aGVsbG8='}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.emp.refresh_from_db()
        self.assertEqual(self.emp.consentimiento_electronico_via, 'ANEXO')
        self.assertEqual(self.client.get('/api/registro-dt/', {'empresa': self.empresa.id}).data['consentimiento']['con'], 1)

    @patch('core.b2_client.subir_documento')
    def test_contrato_nuevo_incluye_la_clausula(self, _subir):
        r = self.client.post('/api/firmas/solicitar/', {'empleado_id': self.emp.id, 'tipo_documento': 'CONTRATO'},
                             format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(SolicitudFirma.objects.get().incluye_consentimiento)

    def test_contrato_pdf_tiene_la_clausula(self):
        from django.template.loader import render_to_string
        from ..views.base import _ctx_contrato
        html = render_to_string('contrato_trabajo.html', _ctx_contrato(Contrato.objects.get(), False))
        self.assertIn('Documentación laboral electrónica', html)
        self.assertIn('t@correo.cl', html)

    def test_consentimiento_en_papel_y_revocacion(self):
        url = f'/api/empleados/{self.emp.id}/consentimiento/'
        r = self.client.post(url, {'fecha': '2026-09-01'}, format='json')
        self.assertEqual((r.status_code, r.data['consentimiento_electronico_via']), (200, 'PAPEL'))
        r = self.client.post(url, {'revocar': True}, format='json')
        self.assertIsNone(r.data['consentimiento_electronico_en'])
