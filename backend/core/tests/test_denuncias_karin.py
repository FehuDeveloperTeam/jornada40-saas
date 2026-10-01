"""Denuncias Ley Karin: registro, reserva, plazos del DS 21 y flujo completo (interna y derivada)."""
import datetime
from unittest.mock import patch

from django.contrib.auth.models import User
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from .. import denuncias_karin as dk
from ..cifrado import PREFIJO
from ..models import ArchivoKarin, DenunciaKarin, EncargadoKarin, Empresa, RegistroBitacora, RegistroKarin
from .utiles import crear_empleado, crear_usuario_completo

CLAVE = 'Clave-Karin-2026'


def _encargado(cuenta, empresas, rut='12.345.678-5'):
    u = User.objects.create(username=f'karin:{cuenta.pk}:{rut}')
    u.set_password(CLAVE)
    u.save()
    enc = EncargadoKarin.objects.create(cuenta=cuenta, usuario=u, rut=rut, nombres='Rosa', apellidos='Díaz',
                                        correo='rosa@x.cl', estado='ACTIVO')
    enc.empresas.set(empresas)
    return enc


def _sesion(rut='12.345.678-5'):
    c = APIClient()
    r = c.post('/api/karin/ingresar/', {'rut': rut, 'clave': CLAVE}, format='json')
    assert r.status_code == 200, r.data
    return c


DENUNCIA = {
    'tipo': 'ACOSO_LABORAL', 'canal': 'ESCRITA', 'recibida_en': '2026-09-28T10:00:00',
    'afectada': {'nombre': 'Ana Rojas', 'rut': '9.876.543-3', 'correo': 'ana@correo.cl', 'cargo': 'Vendedora'},
    'denunciados': [{'nombre': 'Luis Soto', 'cargo': 'Supervisor', 'vinculo': 'JEFATURA'}],
    'relato': 'Desde agosto me grita delante de los clientes.',
}


class DenunciasKarinTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user, _, _, self.empresa = crear_usuario_completo('dk', '21.000.000-3', '76.000.555-K')
        self.otra = Empresa.objects.create(owner=self.user, nombre_legal='Otra SpA', rut='77.111.111-1')
        self.enc = _encargado(self.user, [self.empresa])
        self.c = _sesion()

    def _crear(self, **extra):
        return self.c.post('/api/karin/denuncias/', {**DENUNCIA, 'empresa': self.empresa.id, **extra}, format='json')

    def test_registro_reservado_y_cifrado(self):
        r = self._crear()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['folio'], 'LK-2026-001')
        self.assertEqual(r.data['estado'], 'RECIBIDA')
        # En la base, los datos de las personas y el relato van cifrados.
        with connection.cursor() as cur:
            cur.execute('SELECT datos FROM core_denunciakarin')
            crudo = cur.fetchone()[0]
        self.assertTrue(crudo.startswith(PREFIJO))
        self.assertNotIn('Ana', crudo)
        # El panel (titular) no ve los expedientes.
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/karin/denuncias/').status_code, 403)
        # Otra empresa de la cuenta que no está a cargo del encargado: no se puede registrar.
        self.assertEqual(self._crear(empresa=self.otra.id).status_code, 400)
        acciones = list(RegistroKarin.objects.values_list('accion', flat=True))
        self.assertIn('DENUNCIA', acciones)
        self.assertNotIn('Ana', str(list(RegistroBitacora.objects.values_list('descripcion', flat=True))))

    def test_sin_denuncias_anonimas_y_datos_minimos(self):
        sin_rut = {**DENUNCIA['afectada'], 'rut': ''}
        self.assertEqual(self._crear(afectada=sin_rut).status_code, 400)
        self.assertEqual(self._crear(denunciados=[]).status_code, 400)
        self.assertEqual(self._crear(relato='').status_code, 400)
        self.assertEqual(self._crear(denunciados=[{'nombre': 'X', 'vinculo': 'OTRO'}]).status_code, 400)
        # Denuncia hecha por otra persona: debe indicar en qué calidad.
        otro = {'nombre': 'Juan Paz', 'rut': '11.111.111-1'}
        self.assertEqual(self._crear(denunciante=otro).status_code, 400)
        self.assertEqual(self._crear(denunciante=otro, representacion='SINDICATO').status_code, 201)

    def test_plazos_del_ds21(self):
        d = DenunciaKarin.objects.get(pk=self._crear().data['id'])
        hoy = datetime.date(2026, 9, 29)
        items = {i['clave']: i for i in dk.plazos(d, hoy)}
        self.assertEqual(items['resguardo']['estado'], 'VENCIDO')                # inmediato
        self.assertEqual(items['decision']['vence'], '2026-10-01')               # 3 días hábiles (L-V)
        self.assertEqual(items['decision']['estado'], 'POR_VENCER')
        d.hitos = {'decision': 'INTERNA', 'decision_en': '2026-10-07', 'informe_emitido_en': '2026-11-10',
                   'informe_enviado_dt_en': '2026-11-11'}
        items = {i['clave']: i for i in dk.plazos(d, datetime.date(2026, 11, 12))}
        self.assertEqual(items['informe']['vence'], dk.habiles(datetime.date(2026, 9, 28), 30).isoformat())
        self.assertEqual(items['envio_dt']['vence'], '2026-11-12')               # 2 días hábiles
        self.assertEqual(items['pronunciamiento']['estado'], 'ESPERA')
        self.assertNotIn('medidas', items)
        # Sin pronunciamiento de la DT: 15 días corridos desde que vencen sus 30 días.
        despues = dk.habiles(datetime.date(2026, 11, 11), 30) + datetime.timedelta(days=1)
        items = {i['clave']: i for i in dk.plazos(d, despues)}
        self.assertEqual(items['medidas']['vence'],
                         (dk.habiles(datetime.date(2026, 11, 11), 30) + datetime.timedelta(days=15)).isoformat())
        self.assertIn('notificar_partes', items)
        self.assertEqual(dk.estado_de(d, despues), 'MEDIDAS')

    def test_derivacion_obligatoria(self):
        r = self._crear(denunciados=[{'nombre': 'Gerente', 'vinculo': 'DIRECCION'}])
        pk = r.data['id']
        self.assertIn('Art. 4°', r.data['derivacion_obligatoria'])
        hoy = timezone.localdate().isoformat()
        self.assertEqual(self.c.post(f'/api/karin/denuncias/{pk}/decidir/', {'decision': 'INTERNA', 'fecha': hoy},
                                     format='json').status_code, 400)
        r = self.c.post(f'/api/karin/denuncias/{pk}/decidir/', {'decision': 'DT', 'fecha': hoy}, format='json')
        self.assertEqual(r.data['estado'], 'DERIVADA_DT')
        # Si quien denuncia lo pide, también.
        pk2 = self._crear(pide_derivar_dt=True).data['id']
        self.assertEqual(self.c.post(f'/api/karin/denuncias/{pk2}/decidir/', {'decision': 'INTERNA', 'fecha': hoy},
                                     format='json').status_code, 400)

    def test_flujo_interno_completo(self):
        pk = self._crear(recibida_en=timezone.localtime().replace(tzinfo=None).isoformat()).data['id']
        hoy = timezone.localdate().isoformat()
        url = f'/api/karin/denuncias/{pk}'
        r = self.c.post(f'{url}/resguardo/', {'medidas': [
            {'tipo': 'SEPARACION_ESPACIOS', 'aplica_a': 'DENUNCIADO', 'fecha': hoy},
            {'tipo': 'REDISTRIBUCION_JORNADA', 'aplica_a': 'DENUNCIANTE', 'fecha': hoy}]}, format='json')
        self.assertTrue(any('Art. 20' in a for a in r.data['avisos']))          # aviso, no bloqueo
        self.c.post(f'{url}/decidir/', {'decision': 'INTERNA', 'fecha': hoy}, format='json')
        self.assertEqual(self.c.post(f'{url}/marcar/', {'hito': 'informe_emitido_en', 'fecha': hoy},
                                     format='json').status_code, 400)          # falta informe e investigador
        for hito in ('denunciante_informado_en', 'inicio_informado_dt_en'):
            self.assertEqual(self.c.post(f'{url}/marcar/', {'hito': hito, 'fecha': hoy}, format='json').status_code, 200)
        r = self.c.post(f'{url}/investigador/', {'nombre': 'Ana Rojas', 'rut': '9.876.543-3', 'correo': 'a@x.cl'},
                        format='json')
        self.assertTrue(any('imparcialidad' in a for a in r.data['avisos']))   # es parte del caso
        self.c.post(f'{url}/investigador/', {'nombre': 'Pedro Lagos', 'rut': '11.111.111-1', 'correo': 'p@x.cl',
                                             'externo': True}, format='json')
        r = self.c.post(f'{url}/participantes/', {'nombre': 'Ana Rojas', 'rol': 'AFECTADA'}, format='json')
        pid = r.data['investigacion']['participantes'][0]['id']
        manana = (timezone.localdate() + datetime.timedelta(days=1)).isoformat()
        r = self.c.post(f'{url}/participantes/', {'id': pid, 'citacion': {'fecha': manana, 'hora': '10:30',
                                                                         'lugar': 'Sala de reuniones'}}, format='json')
        self.assertEqual(r.data['investigacion']['participantes'][0]['citacion']['hora'], '10:30')
        r = self.c.post(f'{url}/informe/', {'hechos': 'Se oyó a las partes.', 'fundamentos': 'Testigos coinciden.',
                                            'conclusion': 'ACREDITADO', 'medidas_correctivas': ['CAPACITACION'],
                                            'sanciones': [{'persona': 0, 'sancion': 'AMONESTACION_ESCRITA'}]},
                        format='json')
        self.assertEqual(r.status_code, 200, r.data)
        for hito in ('investigador_informado_en', 'informe_emitido_en', 'informe_enviado_dt_en'):
            r = self.c.post(f'{url}/marcar/', {'hito': hito, 'fecha': hoy}, format='json')
            self.assertEqual(r.status_code, 200, (hito, r.data))
        self.assertEqual(r.data['estado'], 'REVISION_DT')
        # Antes de 30 días no se puede dar por no pronunciada.
        self.assertEqual(self.c.post(f'{url}/pronunciamiento/', {'resultado': 'SIN_PRONUNCIAMIENTO'},
                                     format='json').status_code, 400)
        r = self.c.post(f'{url}/pronunciamiento/', {'resultado': 'SIN_OBSERVACIONES', 'fecha': hoy}, format='json')
        self.assertEqual(r.data['estado'], 'MEDIDAS')
        self.assertEqual(self.c.post(f'{url}/cerrar/', {'fecha': hoy}, format='json').status_code, 400)
        self.assertEqual(self.c.post(f'{url}/medidas/', {'sanciones': [], 'fecha': hoy}, format='json').status_code, 400)
        r = self.c.post(f'{url}/medidas/', {'sanciones': [{'persona': 0, 'sancion': 'AMONESTACION_ESCRITA'}],
                                            'correctivas': ['CAPACITACION'], 'fecha': hoy, 'informadas': True},
                        format='json')
        self.assertEqual(r.status_code, 200, r.data)
        r = self.c.post(f'{url}/cerrar/', {'fecha': hoy}, format='json')
        self.assertEqual(r.data['estado'], 'CERRADA')
        self.assertEqual(self.c.post(f'{url}/resguardo/', {'medidas': []}, format='json').status_code, 400)

    def test_flujo_derivado(self):
        pk = self._crear().data['id']
        hoy = timezone.localdate().isoformat()
        url = f'/api/karin/denuncias/{pk}'
        self.c.post(f'{url}/decidir/', {'decision': 'DT', 'fecha': hoy}, format='json')
        self.assertEqual(self.c.post(f'{url}/informe/', {}, format='json').status_code, 400)
        r = self.c.post(f'{url}/marcar/', {'hito': 'resultado_dt_en', 'fecha': hoy}, format='json')
        self.assertEqual(r.data['estado'], 'MEDIDAS')
        self.assertIn('medidas', [p['clave'] for p in r.data['plazos']])

    def test_otro_encargado_no_ve_expedientes_ajenos(self):
        pk = self._crear().data['id']
        otro_user, *_ , otra_emp = crear_usuario_completo('dk2', '21.000.001-1', '76.000.556-8')
        _encargado(otro_user, [otra_emp], rut='11.111.111-1')
        c2 = _sesion('11.111.111-1')
        self.assertEqual(c2.get(f'/api/karin/denuncias/{pk}/').status_code, 404)
        self.assertEqual(c2.get('/api/karin/denuncias/').data, [])

    def test_archivos_cifrados(self):
        pk = self._crear().data['id']
        guardado = {}

        def subir(datos, clave, content_type=None):
            guardado[clave] = datos
            return clave
        from django.core.files.uploadedfile import SimpleUploadedFile
        with patch('core.b2_client.subir_documento', side_effect=subir):
            r = self.c.post(f'/api/karin/denuncias/{pk}/archivos/', {
                'tipo': 'DENUNCIA_ESCRITA', 'archivo': SimpleUploadedFile('denuncia.pdf', b'%PDF-1.4 relato')},
                format='multipart')
        self.assertEqual(r.status_code, 201, r.data)
        crudo = next(iter(guardado.values()))
        self.assertNotIn(b'relato', crudo)                                        # cifrado antes de subir
        a = ArchivoKarin.objects.get()
        with patch('core.b2_client.descargar_documento', return_value=crudo):
            r = self.c.get(f'/api/karin/denuncias/{pk}/archivos/{a.id}/')
        self.assertEqual(r.content, b'%PDF-1.4 relato')
        with patch('core.b2_client.subir_documento', side_effect=subir):
            r = self.c.post(f'/api/karin/denuncias/{pk}/archivos/', {
                'tipo': 'DENUNCIA_ESCRITA', 'archivo': SimpleUploadedFile('x.exe', b'MZ')}, format='multipart')
        self.assertEqual(r.status_code, 400)

    def test_trabajador_de_otra_empresa(self):
        ajeno = crear_empleado(self.otra, '9.876.543-3')
        afectada = {**DENUNCIA['afectada'], 'empleado_id': ajeno.id}
        self.assertEqual(self._crear(afectada=afectada).status_code, 400)

    def test_documentos(self):
        pk = self._crear(canal='VERBAL').data['id']
        url = f'/api/karin/denuncias/{pk}'
        for tipo in ('RECEPCION', 'ACTA_VERBAL', 'RESGUARDO', 'ANTECEDENTES_DT'):
            r = self.c.get(f'{url}/documento/?tipo={tipo}')
            self.assertEqual(r.status_code, 200, tipo)
            self.assertTrue(r.content.startswith(b'%PDF'))
        self.assertEqual(self.c.get(f'{url}/documento/?tipo=INFORME').status_code, 400)       # aún no corresponde
        self.assertEqual(self.c.get(f'{url}/documento/?tipo=OTRO').status_code, 400)
        hoy = timezone.localdate().isoformat()
        self.c.post(f'{url}/decidir/', {'decision': 'INTERNA', 'fecha': hoy}, format='json')
        self.c.post(f'{url}/investigador/', {'nombre': 'Pedro Lagos', 'rut': '11.111.111-1', 'correo': 'p@x.cl'},
                    format='json')
        pid = self.c.post(f'{url}/participantes/', {'nombre': 'Testigo Uno', 'rol': 'TESTIGO'},
                          format='json').data['investigacion']['participantes'][0]['id']
        self.assertEqual(self.c.get(f'{url}/documento/?tipo=CITACION&participante={pid}').status_code, 400)
        manana = (timezone.localdate() + datetime.timedelta(days=1)).isoformat()
        self.c.post(f'{url}/participantes/', {'id': pid, 'citacion': {'fecha': manana, 'hora': '09:00', 'lugar': 'Sala'}},
                    format='json')
        for tipo in ('DECISION', 'CITACION', 'ACTA_DECLARACION'):
            self.assertEqual(self.c.get(f'{url}/documento/?tipo={tipo}&participante={pid}').status_code, 200, tipo)
        self.c.post(f'{url}/informe/', {'hechos': 'H', 'fundamentos': 'F', 'conclusion': 'NO_ACREDITADO'}, format='json')
        r = self.c.get(f'{url}/documento/?tipo=INFORME')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(RegistroKarin.objects.filter(accion='DESCARGA').count(), 8)


class ContadorYAvisosTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user, self.cliente, _, self.empresa = crear_usuario_completo('dka', '21.000.000-3', '76.000.555-K')
        self.enc = _encargado(self.user, [self.empresa])
        c = _sesion()
        # Recibida hace 10 días sin decisión: plazos vencidos.
        hace = (timezone.localtime() - datetime.timedelta(days=10)).replace(tzinfo=None).isoformat()
        c.post('/api/karin/denuncias/', {**DENUNCIA, 'empresa': self.empresa.id, 'recibida_en': hace}, format='json')

    def test_contador_del_titular_sin_contenido(self):
        self.client.force_authenticate(self.user)
        r = self.client.get('/api/encargados-karin/resumen/')
        fila = r.data['empresas'][0]
        self.assertEqual((fila['abiertas'], fila['vencidas']), (1, 1))
        self.assertNotIn('Ana', str(r.data))
        # Un usuario del equipo no ve ni las cifras.
        from ..models import UsuarioEquipo
        persona = User.objects.create(username='equipo:x:1')
        ue = UsuarioEquipo.objects.create(cuenta=self.user, usuario=persona, rut='11.111.111-1', nombres='Eva',
                                          correo='eva@x.cl', estado='ACTIVO', permisos={'SEGURIDAD': 'GESTIONAR'})
        ue.empresas.set([self.empresa])
        c = APIClient()
        c.force_authenticate(persona)
        self.assertEqual(c.get('/api/encargados-karin/resumen/').status_code, 403)

    def test_correos_solo_con_cifras(self):
        from django.core import mail
        from ..views.resumen import enviar, enviar_encargado_karin
        self.assertTrue(enviar_encargado_karin(self.enc))
        self.assertFalse(enviar_encargado_karin(self.enc))                       # una vez por día
        cuerpo = mail.outbox[-1].body
        self.assertIn('1 denuncia tiene un plazo vencido', cuerpo)
        self.assertNotIn('Ana', cuerpo)
        self.assertNotIn('LK-', cuerpo)
        self.assertTrue(enviar(self.cliente))
        cuerpo = mail.outbox[-1].body
        self.assertIn('Ley Karin: plazos de denuncias', cuerpo)
        self.assertNotIn('Ana', cuerpo)
