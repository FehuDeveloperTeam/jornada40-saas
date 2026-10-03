"""Peticiones desde el portal del trabajador: vacaciones, permisos legales y conciliación (Ley 21.645)."""
import datetime

from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from ..models import DocumentoLaboral, Empleado, SolicitudConciliacion, SolicitudPermiso, VacacionEmpleado
from .test_portal_trabajador import PortalBase


class PeticionesPortalTests(PortalBase):

    def setUp(self):
        super().setUp()
        Empleado.objects.filter(pk=self.ficha.pk).update(fecha_ingreso=datetime.date(2022, 1, 3))
        self._entrar()
        self.jefe_cliente = APIClient()
        self.jefe_cliente.force_authenticate(self.jefe)
        self.hoy = timezone.localdate()

    def _lunes(self, semanas=4):
        d = self.hoy + datetime.timedelta(weeks=semanas)
        return d - datetime.timedelta(days=d.weekday())

    def test_vacaciones_pedidas_aprobadas_y_avisadas(self):
        desde = self._lunes()
        hasta = desde + datetime.timedelta(days=4)
        datos = {'empleo': self.ficha.id, 'tipo': 'VACACION_LEGAL', 'desde': desde.isoformat(), 'hasta': hasta.isoformat()}
        from ..views.feriado import _calcular_dias_habiles_vacacion
        habiles = _calcular_dias_habiles_vacacion(desde, hasta)   # 5 salvo que caiga un feriado
        r = self.client.post('/api/trabajador/peticiones/calcular/', datos, format='json')
        self.assertEqual((r.status_code, r.data['dias']), (200, habiles), r.data)
        r = self.client.post('/api/trabajador/peticiones/vacaciones/', datos, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        v = VacacionEmpleado.objects.get()
        self.assertEqual((v.estado, v.origen, v.dias_habiles), ('PENDIENTE', 'PORTAL', habiles))

        pendientes = self.jefe_cliente.get(f'/api/peticiones-portal/?empresa={self.empresa.id}').data
        self.assertEqual(len(pendientes['vacaciones']), 1)
        enviados = len(mail.outbox)
        r = self.jefe_cliente.post(f'/api/vacaciones/{v.id}/responder/', {'aprobar': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(VacacionEmpleado.objects.get().estado, 'APROBADO')
        self.assertEqual(mail.outbox[-1].to, ['ana@correo.cl'])
        self.assertGreater(len(mail.outbox), enviados)
        estado = self.client.get('/api/trabajador/peticiones/').data[0]['vacaciones'][0]
        self.assertEqual(estado['estado_texto'], 'Aprobada')

    def test_reglas_de_fechas_y_limite(self):
        base = {'empleo': self.ficha.id, 'tipo': 'VACACION_LEGAL'}
        ayer = self.hoy - datetime.timedelta(days=1)
        r = self.client.post('/api/trabajador/peticiones/vacaciones/', {**base, 'desde': ayer.isoformat(),
                                                                         'hasta': ayer.isoformat()}, format='json')
        self.assertEqual(r.status_code, 400)
        lejos = self.hoy + datetime.timedelta(days=400)
        r = self.client.post('/api/trabajador/peticiones/vacaciones/', {**base, 'desde': lejos.isoformat(),
                                                                         'hasta': lejos.isoformat()}, format='json')
        self.assertIn('12 meses', r.data['error'])
        for i in range(5):
            d = self._lunes(4 + i)
            self.assertEqual(self.client.post('/api/trabajador/peticiones/vacaciones/', {
                **base, 'desde': d.isoformat(), 'hasta': d.isoformat()}, format='json').status_code, 201)
        d = self._lunes(10)
        r = self.client.post('/api/trabajador/peticiones/vacaciones/', {**base, 'desde': d.isoformat(),
                                                                         'hasta': d.isoformat()}, format='json')
        self.assertIn('esperando respuesta', r.data['error'])

    def test_rechazo_exige_motivo(self):
        d = self._lunes()
        self.client.post('/api/trabajador/peticiones/vacaciones/', {'empleo': self.ficha.id, 'tipo': 'PERMISO_SIN_GOCE',
                                                                    'desde': d.isoformat(), 'hasta': d.isoformat()},
                         format='json')
        v = VacacionEmpleado.objects.get()
        self.assertEqual(self.jefe_cliente.post(f'/api/vacaciones/{v.id}/responder/', {'aprobar': False},
                                                format='json').status_code, 400)
        r = self.jefe_cliente.post(f'/api/vacaciones/{v.id}/responder/', {'aprobar': False, 'motivo': 'OTRAS_FECHAS'},
                                   format='json')
        self.assertEqual(r.status_code, 200)
        dato = self.client.get('/api/trabajador/peticiones/').data[0]['vacaciones'][0]
        self.assertEqual((dato['estado_texto'], dato['motivo']), ('Rechazada', 'Conversemos otras fechas'))

    def test_permiso_legal_aprobado_crea_la_constancia(self):
        hecho = self.hoy - datetime.timedelta(days=1)
        r = self.client.post('/api/trabajador/peticiones/permisos/', {
            'empleo': self.ficha.id, 'permiso': 'FALLECIMIENTO_PADRES', 'fecha_hecho': hecho.isoformat()}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        s = SolicitudPermiso.objects.get()
        r = self.jefe_cliente.post(f'/api/solicitudes-permiso/{s.id}/responder/', {'aprobar': True}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        doc = DocumentoLaboral.objects.get(pk=r.data['documento'])
        self.assertEqual((doc.tipo, doc.empleado_id), ('PERMISO_LEGAL', self.ficha.id))
        self.assertEqual(SolicitudPermiso.objects.get().estado, 'APROBADA')

    def test_permiso_invalido_se_explica(self):
        r = self.client.post('/api/trabajador/peticiones/permisos/', {
            'empleo': self.ficha.id, 'permiso': 'INVENTADO', 'fecha_hecho': self.hoy.isoformat()}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_conciliacion_desde_el_portal_declara_cuidado(self):
        r = self.client.post('/api/trabajador/peticiones/conciliacion/', {'empleo': self.ficha.id, 'tipo': 'TELETRABAJO'},
                             format='json')
        self.assertIn('a quién cuidas', r.data['error'])
        r = self.client.post('/api/trabajador/peticiones/conciliacion/', {
            'empleo': self.ficha.id, 'tipo': 'TELETRABAJO', 'cuidado': 'MENOR_14'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        s = SolicitudConciliacion.objects.get()
        self.assertEqual((s.origen, s.presentada_el, s.vence_el), ('PORTAL', self.hoy, self.hoy + datetime.timedelta(days=15)))
        r = self.jefe_cliente.post(f'/api/solicitudes-conciliacion/{s.id}/responder/', {'estado': 'ACEPTADA'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Empleado.objects.get(pk=self.ficha.pk).cuidado_de, 'MENOR_14')
        self.assertEqual(mail.outbox[-1].to, ['ana@correo.cl'])

    def test_cambio_de_jornada_solo_para_quien_cuida_menores(self):
        d = self._lunes(6)
        datos = {'empleo': self.ficha.id, 'tipo': 'CAMBIO_JORNADA', 'cuidado': 'DEPENDENCIA',
                 'desde': d.isoformat(), 'hasta': (d + datetime.timedelta(days=13)).isoformat()}
        self.assertEqual(self.client.post('/api/trabajador/peticiones/conciliacion/', datos, format='json').status_code, 400)
        r = self.client.post('/api/trabajador/peticiones/conciliacion/', {**datos, 'cuidado': 'MENOR_14'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)

    def test_otro_empleador_no_ve_ni_responde(self):
        from .utiles import crear_usuario_completo
        otro, *_ = crear_usuario_completo('otro_jefe', '22.222.222-2', '76.111.111-6')
        d = self._lunes()
        self.client.post('/api/trabajador/peticiones/vacaciones/', {'empleo': self.ficha.id, 'tipo': 'VACACION_LEGAL',
                                                                    'desde': d.isoformat(), 'hasta': d.isoformat()},
                         format='json')
        cliente = APIClient()
        cliente.force_authenticate(otro)
        self.assertEqual(cliente.get('/api/peticiones-portal/').data['vacaciones'], [])
        v = VacacionEmpleado.objects.get()
        self.assertEqual(cliente.post(f'/api/vacaciones/{v.id}/responder/', {'aprobar': True}, format='json').status_code, 404)
