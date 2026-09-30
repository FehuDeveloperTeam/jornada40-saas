"""Usuarios del equipo: alta por el titular, cupos, invitación, ingreso aparte, cerco y eliminación."""
import re

from django.core import mail
from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from ..models import Empresa, RegistroBitacora, UsuarioEquipo
from .utiles import crear_usuario_completo

CLAVE = 'Clave-Equipo-2026'


class EquipoTests(APITestCase):
    def setUp(self):
        cache.clear()   # límites de intentos de otras pruebas
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('eq', '21.000.000-3', '76.000.555-K')
        self.client.force_authenticate(self.user)

    def _crear(self, rut='12.345.678-5', **extra):
        datos = {'rut': rut, 'nombres': 'Ana', 'apellidos': 'Rojas', 'correo': 'ana@empresa.cl',
                 'permisos': {'REMUNERACIONES': 'GESTIONAR', 'TRABAJADORES': 'VER'}, 'empresas': [self.empresa.id],
                 **extra}
        return self.client.post('/api/equipo/', datos, format='json')

    def _activar(self, correo_idx=-1, clave=CLAVE):
        enlace = re.search(r'/equipo/clave/(\S+)/(\S+)', mail.outbox[correo_idx].body)
        return APIClient().post('/api/auth/equipo/clave/', {'uid': enlace.group(1), 'token': enlace.group(2),
                                                            'clave': clave}, format='json')

    def test_alta_invitacion_clave_e_ingreso(self):
        r = self._crear()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data['estado'], r.data['rut']), ('INVITADO', '12.345.678-5'))
        self.assertEqual(mail.outbox[-1].to, ['ana@empresa.cl'])
        self.assertEqual(self._activar(clave='12345678').status_code, 400)             # clave débil
        self.assertEqual(self._activar().status_code, 200)
        self.assertEqual(self._activar().status_code, 400)                             # el enlace vale una vez
        self.assertEqual(UsuarioEquipo.objects.get().estado, 'ACTIVO')

        equipo = APIClient()
        self.assertEqual(equipo.post('/api/auth/equipo/ingresar/', {'rut': '123456785', 'clave': 'mala'},
                                     format='json').status_code, 400)
        r = equipo.post('/api/auth/equipo/ingresar/', {'rut': '123456785', 'clave': CLAVE}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        sesion = equipo.get('/api/auth/sesion/').data
        self.assertEqual((sesion['tipo'], sesion['permisos']['REMUNERACIONES']), ('EQUIPO', 'GESTIONAR'))
        acciones = list(RegistroBitacora.objects.filter(cuenta=self.user).values_list('accion', 'actor_tipo'))
        self.assertIn(('INGRESO_FALLIDO', 'SISTEMA'), acciones)
        self.assertIn(('INGRESO', 'EQUIPO'), acciones)

    def test_cerco_y_eliminacion(self):
        self._crear()
        self._activar()
        equipo = APIClient()
        equipo.post('/api/auth/equipo/ingresar/', {'rut': '12.345.678-5', 'clave': CLAVE}, format='json')
        self.assertEqual(equipo.get('/api/empleados/').status_code, 200)     # sus módulos le abren las fichas
        self.assertEqual(equipo.post('/api/empresas/', {'nombre_legal': 'X', 'rut': '77.777.777-7'},
                                     format='json').status_code, 403)
        self.assertEqual(equipo.get('/api/equipo/').status_code, 403)       # el equipo lo administra el titular
        self.assertEqual(equipo.get('/api/bitacora/').status_code, 403)
        self.assertEqual(Empresa.objects.count(), 1)
        # Tampoco entra por la puerta del titular con su usuario interno.
        ue = UsuarioEquipo.objects.get()
        self.assertEqual(APIClient().post('/api/auth/login/', {'username': ue.usuario.username, 'password': CLAVE},
                                          format='json').status_code, 400)
        ue = UsuarioEquipo.objects.get()
        self.assertEqual(self.client.post(f'/api/equipo/{ue.id}/eliminar/').status_code, 200)
        # La sesión abierta deja de valer de inmediato y ya no puede volver a entrar.
        self.assertEqual(equipo.get('/api/auth/sesion/').status_code, 401)
        self.assertEqual(APIClient().post('/api/auth/equipo/ingresar/', {'rut': '12.345.678-5', 'clave': CLAVE},
                                          format='json').status_code, 400)
        self.assertEqual(self.client.get('/api/equipo/').data['usados'], 0)   # libera el cupo

    def test_cupos_y_validaciones(self):
        # Pyme de prueba con 1 empresa: 2 usuarios.
        self.assertEqual(self._crear().status_code, 201)
        self.assertEqual(self._crear().status_code, 400)                      # ya está en el equipo
        self.assertEqual(self._crear(rut='9.876.543-3').status_code, 201)
        r = self._crear(rut='11.111.111-1')
        self.assertIn('ya los usaste', r.data['error'])
        self.cliente.usuarios_adicionales = 1
        self.cliente.save()
        self.assertEqual(self._crear(rut='11.111.111-1').status_code, 201)
        self.assertEqual(self._crear(rut='22.222.222-2', permisos={'OTRO': 'VER'}).status_code, 400)
        otro, _, _, ajena = crear_usuario_completo('eq_b', '33.333.333-3', '77.777.777-7')
        self.cliente.usuarios_adicionales = 5
        self.cliente.save()
        self.assertEqual(self._crear(rut='22.222.222-2', empresas=[ajena.id]).status_code, 400)
        self.plan.nivel = 1
        self.plan.save()
        self.assertEqual(self._crear(rut='22.222.222-2').status_code, 400)    # Semilla: solo el titular

    def test_misma_persona_en_dos_cuentas_elige_con_cual_entrar(self):
        self._crear()
        self._activar()
        otro, _, _, empresa_b = crear_usuario_completo('eq_c', '33.333.333-3', '77.777.777-7')
        self.client.force_authenticate(otro)
        self._crear(empresas=[empresa_b.id])
        self._activar()
        r = APIClient().post('/api/auth/equipo/ingresar/', {'rut': '12.345.678-5', 'clave': CLAVE}, format='json')
        self.assertEqual(len(r.data['elegir_cuenta']), 2)
        elegida = r.data['elegir_cuenta'][1]['cuenta']
        c = APIClient()
        r = c.post('/api/auth/equipo/ingresar/', {'rut': '12.345.678-5', 'clave': CLAVE, 'cuenta': elegida},
                   format='json')
        self.assertEqual(r.data['tipo'], 'EQUIPO')

    def test_recuperar_responde_igual(self):
        self._crear()
        self._activar()
        n = len(mail.outbox)
        a = APIClient().post('/api/auth/equipo/recuperar/', {'rut': '12.345.678-5'}, format='json').data
        b = APIClient().post('/api/auth/equipo/recuperar/', {'rut': '9.876.543-3'}, format='json').data
        self.assertEqual(a, b)
        self.assertEqual(len(mail.outbox), n + 1)
        self.assertEqual(self._activar(clave='Otra-Clave-2027').status_code, 200)
        self.assertEqual(APIClient().post('/api/auth/equipo/ingresar/', {'rut': '12.345.678-5',
                                                                         'clave': 'Otra-Clave-2027'},
                                          format='json').status_code, 200)
