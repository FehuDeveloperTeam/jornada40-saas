"""Extensión "Jornada40 para Mi DT": conexión con código, token propio y acotado, registro y levantamiento."""
import json
from datetime import timedelta

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import (CodigoExtension, Contrato, DispositivoExtension, Empresa, LevantamientoMiDT, RegistroBitacora,
                      RegistroDT, UsuarioEquipo)
from .utiles import crear_empleado, crear_usuario_completo

CLAVE_EQUIPO = 'Clave-Equipo-2026'


class ExtensionTests(APITestCase):
    def setUp(self):
        cache.clear()   # límites de intentos de otras pruebas (misma IP)
        self.user, _, self.plan, self.empresa = crear_usuario_completo('ext', '21.000.000-3', '76.000.555-K')
        self.plan.max_empresas = 3
        self.plan.save()
        self.otra = Empresa.objects.create(owner=self.user, nombre_legal='Empresa B', rut='77.777.777-7')
        self.emp = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana')
        self.contrato = Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', cargo='Analista',
                                                fecha_inicio=timezone.localdate(), sueldo_base=600_000,
                                                horas_semanales=42)
        self.clave = f'CONTRATO:{self.contrato.id}'
        self.panel = APIClient()
        self.panel.force_authenticate(self.user)

    def _vincular(self, codigo, nombre='Chrome de la oficina'):
        return APIClient().post('/api/extension/v1/vincular/', {'codigo': codigo, 'nombre': nombre}, format='json')

    def _conectar(self, panel=None):
        codigo = (panel or self.panel).post('/api/extension/codigo/').data['codigo']
        r = self._vincular(codigo.lower())     # se acepta en minúsculas
        self.assertEqual(r.status_code, 201, r.data)
        ext = APIClient()
        ext.credentials(HTTP_AUTHORIZATION=f'Extension {r.data["token"]}')
        return ext, r.data

    def _equipo(self, permisos, empresas, rut='11.111.111-1'):
        u = User.objects.create_user(f'equipo:{self.user.pk}:{rut}', password=CLAVE_EQUIPO)
        ue = UsuarioEquipo.objects.create(cuenta=self.user, usuario=u, rut=rut, nombres='Carla', apellidos='Díaz',
                                          correo='c@x.cl', permisos=permisos, estado='ACTIVO')
        ue.empresas.set(empresas)
        c = APIClient()
        self.assertEqual(c.post('/api/auth/equipo/ingresar/', {'rut': rut, 'clave': CLAVE_EQUIPO},
                                format='json').status_code, 200)
        return c, ue

    def test_conectar_con_un_codigo_de_un_solo_uso(self):
        r = self.panel.post('/api/extension/codigo/')
        self.assertEqual(r.status_code, 201)
        codigo = r.data['codigo']
        self.assertRegex(codigo, r'^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$')
        self.assertNotIn(codigo.replace('-', ''), CodigoExtension.objects.get().codigo_hash)
        r = self._vincular(codigo)
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['token'].startswith('j40e_'))
        self.assertEqual(sorted(e['id'] for e in r.data['empresas']), sorted([self.empresa.id, self.otra.id]))
        self.assertEqual(self._vincular(codigo).status_code, 400)          # ya se usó
        d = DispositivoExtension.objects.get()
        self.assertEqual((len(d.token_hash), d.nombre), (64, 'Chrome de la oficina'))
        self.assertNotIn(r.data['token'], d.token_hash)
        self.assertTrue(RegistroBitacora.objects.filter(cuenta=self.user, accion='EXTENSION',
                                                        descripcion__contains='Conectó la extensión').exists())
        self.assertEqual([x['nombre'] for x in self.panel.get('/api/extension/dispositivos/').data],
                         ['Chrome de la oficina'])

    def test_codigo_vencido_o_inventado(self):
        codigo = self.panel.post('/api/extension/codigo/').data['codigo']
        CodigoExtension.objects.update(expira_en=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self._vincular(codigo).status_code, 400)
        self.assertEqual(self._vincular('ABCD-EFGH').status_code, 400)
        # Un código nuevo anula el anterior de la misma persona.
        viejo = self.panel.post('/api/extension/codigo/').data['codigo']
        nuevo = self.panel.post('/api/extension/codigo/').data['codigo']
        self.assertEqual(self._vincular(viejo).status_code, 400)
        self.assertEqual(self._vincular(nuevo).status_code, 201)

    def test_lista_ficha_y_marcar_registrado(self):
        ext, _ = self._conectar()
        r = ext.get('/api/extension/v1/registro/', {'empresa': self.empresa.id})
        self.assertEqual(r.status_code, 200)
        self.assertIn(self.clave, [i['clave'] for i in r.data['items']])
        ficha = ext.get('/api/extension/v1/registro/ficha/', {'empresa': self.empresa.id, 'clave': self.clave}).data
        campos = {c['clave']: c for s in ficha['secciones'] for c in s['campos']}
        self.assertEqual((ficha['tipo'], campos['rut-del-trabajador']['valor']), ('CONTRATO', '12.345.678-5'))
        self.assertEqual(campos['cargo']['valor'], 'Analista')
        r = ext.post('/api/extension/v1/registro/marcar/', {'empresa': self.empresa.id, 'claves': [self.clave],
                                                           'comprobante': ' N° 12345 '}, format='json')
        self.assertEqual(r.data, {'marcados': 1})
        reg = RegistroDT.objects.get(clave=self.clave)
        self.assertEqual((reg.via, reg.comprobante, reg.registrado_por), ('EXTENSION', 'N° 12345', self.user))
        self.assertTrue(RegistroBitacora.objects.filter(accion='REGISTRO_DT',
                                                        descripcion='Marcó como registrado en Mi DT con la extensión')
                        .exists())
        # Lo que no es de la empresa no se marca.
        r = ext.post('/api/extension/v1/registro/marcar/', {'empresa': self.otra.id, 'claves': [self.clave]},
                     format='json')
        self.assertEqual(r.status_code, 400)

    def test_marcar_en_el_panel_queda_como_manual(self):
        r = self.panel.post('/api/registro-dt/marcar/', {'empresa': self.empresa.id, 'claves': [self.clave]},
                            format='json')
        self.assertEqual(r.status_code, 200, r.data)
        reg = RegistroDT.objects.get(clave=self.clave)
        self.assertEqual((reg.via, reg.registrado_por), ('MANUAL', self.user))

    def test_el_token_solo_abre_la_extension_y_la_sesion_del_panel_no_abre_la_extension(self):
        ext, _ = self._conectar()
        self.assertIn(ext.get('/api/empleados/').status_code, (401, 403))
        self.assertIn(ext.get('/api/extension/dispositivos/').status_code, (401, 403))
        self.assertEqual(APIClient().get('/api/extension/v1/yo/').status_code, 401)
        jwt = APIClient()
        jwt.cookies['jornada40-auth'] = str(RefreshToken.for_user(self.user).access_token)
        self.assertEqual(jwt.get('/api/empleados/').status_code, 200)
        self.assertEqual(jwt.get('/api/extension/v1/yo/').status_code, 401)
        malo = APIClient()
        malo.credentials(HTTP_AUTHORIZATION='Extension j40e_inventado')
        self.assertEqual(malo.get('/api/extension/v1/yo/').status_code, 401)

    def test_desconectar_salir_y_noventa_dias_sin_uso(self):
        ext, _ = self._conectar()
        d = DispositivoExtension.objects.get()
        self.assertEqual(self.panel.post(f'/api/extension/dispositivos/{d.id}/desconectar/').status_code, 200)
        self.assertEqual(ext.get('/api/extension/v1/yo/').status_code, 401)
        self.assertEqual(self.panel.get('/api/extension/dispositivos/').data, [])
        ext, _ = self._conectar()
        self.assertEqual(ext.post('/api/extension/v1/salir/', {}, format='json').status_code, 200)
        self.assertEqual(ext.get('/api/extension/v1/yo/').status_code, 401)
        ext, _ = self._conectar()
        DispositivoExtension.objects.filter(revocado_en__isnull=True).update(
            ultimo_uso=timezone.now() - timedelta(days=91))
        self.assertEqual(ext.get('/api/extension/v1/yo/').status_code, 401)

    def test_usuario_del_equipo(self):
        # Con "solo ver": conecta su navegador, lee solo sus empresas y no marca.
        panel, ue = self._equipo({'DIRECCION_TRABAJO': 'VER'}, [self.empresa])
        ext, datos = self._conectar(panel)
        self.assertEqual([e['id'] for e in datos['empresas']], [self.empresa.id])
        self.assertEqual(datos['persona'], 'Carla Díaz')
        self.assertEqual(ext.get('/api/extension/v1/registro/', {'empresa': self.empresa.id}).status_code, 200)
        self.assertEqual(ext.get('/api/extension/v1/registro/', {'empresa': self.otra.id}).status_code, 404)
        r = ext.post('/api/extension/v1/registro/marcar/', {'empresa': self.empresa.id, 'claves': [self.clave]},
                     format='json')
        self.assertEqual(r.status_code, 403)
        # Solo ve y desconecta sus propios navegadores.
        titular_ext, _ = self._conectar()
        self.assertEqual([d['persona'] for d in panel.get('/api/extension/dispositivos/').data], ['Carla Díaz'])
        ajeno = DispositivoExtension.objects.get(persona=self.user)
        self.assertEqual(panel.post(f'/api/extension/dispositivos/{ajeno.id}/desconectar/').status_code, 404)
        # Si sale del equipo, su navegador queda fuera al tiro (el del titular sigue).
        UsuarioEquipo.objects.filter(pk=ue.pk).update(estado='ELIMINADO')
        self.assertEqual(ext.get('/api/extension/v1/yo/').status_code, 401)
        self.assertEqual(titular_ext.get('/api/extension/v1/yo/').status_code, 200)

    def test_usuario_del_equipo_con_gestionar_marca_y_sin_el_modulo_no_conecta(self):
        panel, _ = self._equipo({'DIRECCION_TRABAJO': 'GESTIONAR'}, [self.empresa])
        ext, _ = self._conectar(panel)
        r = ext.post('/api/extension/v1/registro/marcar/', {'empresa': self.empresa.id, 'claves': [self.clave]},
                     format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(RegistroDT.objects.get(clave=self.clave).registrado_por.usuario_equipo.nombres, 'Carla')
        sin_modulo, _ = self._equipo({'REMUNERACIONES': 'GESTIONAR'}, [self.empresa], rut='22.222.222-2')
        self.assertEqual(sin_modulo.post('/api/extension/codigo/').status_code, 403)

    def test_levantamiento_sin_valores_ni_datos_personales(self):
        ext, _ = self._conectar()
        estructura = {'campos': [
            {'etiqueta': 'RUT del trabajador (12.345.678-5)', 'id': 'rut', 'tipo': 'text', 'valor': '12.345.678-5'},
            {'etiqueta': 'Representante', 'id': 'rep', 'tipo': 'select',
             'opciones': [{'texto': 'Juan Pérez · juan@empresa.cl', 'value': '9.876.543-3'}]},
        ]}
        r = ext.post('/api/extension/v1/levantamiento/', {
            'ruta': '/empleador/registro-electronico-laboral/registroContratoTrabajo', 'titulo': 'Registro',
            'version': '0.1.0', 'estructura': estructura}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        guardado = json.dumps(LevantamientoMiDT.objects.get().estructura, ensure_ascii=False)
        for dato in ('12.345.678-5', '9.876.543-3', 'juan@empresa.cl', '"valor"', '"value"'):
            self.assertNotIn(dato, guardado)
        self.assertIn('Juan Pérez', guardado)        # las opciones (catálogos) sí se guardan
        grande = {'campos': [{'etiqueta': 'x' * 400}] * 2000}
        r = ext.post('/api/extension/v1/levantamiento/', {'ruta': '/x', 'estructura': grande}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_mapeos(self):
        ext, _ = self._conectar()
        r = ext.get('/api/extension/v1/mapeos/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('version', r.data)
        self.assertIn('pantallas', r.data)

    def test_admin_descarga_los_levantamientos_en_json(self):
        ext, _ = self._conectar()
        r = ext.post('/api/extension/v1/levantamiento/', {
            'ruta': '/empleador/lre', 'titulo': 'LRE', 'version': '0.1.0',
            'estructura': {'campos': [{'etiqueta': 'Archivo del libro', 'tipo': 'file'}]}}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        admin = User.objects.create_superuser('admin-ext', 'admin@x.cl', 'Clave-Admin-2026')
        self.client.force_login(admin)
        r = self.client.post('/admin/core/levantamientomidt/',
                             {'action': 'descargar_json', '_selected_action': [LevantamientoMiDT.objects.get().id]})
        self.assertEqual(r.status_code, 200)
        self.assertIn('levantamiento_mi_dt.json', r['Content-Disposition'])
        datos = json.loads(r.content)
        self.assertEqual((datos[0]['ruta'], datos[0]['estructura']['campos'][0]['etiqueta']), ('/empleador/lre', 'Archivo del libro'))

    def test_los_mapeos_piden_datos_que_existen_en_las_fichas(self):
        """Una clave mal escrita en un mapeo dejaría un campo sin llenar sin que nadie lo note."""
        from pathlib import Path
        from django.conf import settings
        from ..models import AnexoContrato, Empleado, Finiquito
        hoy = timezone.localdate()
        anexo = AnexoContrato.objects.create(contrato=self.contrato, titulo='Aumento', descripcion='Sube el sueldo.',
                                             fecha_emision=hoy, aplicado=True, aplicado_en=timezone.now())
        Empleado.objects.filter(pk=self.emp.pk).update(activo=False, fecha_desvinculacion=hoy)
        Finiquito.objects.create(empleado=self.emp, causal_articulo='159_2', fecha_termino=hoy, fecha_emision=hoy,
                                 sueldo_base=600_000)
        items = self.panel.get('/api/registro-dt/', {'empresa': self.empresa.id}).data['items']
        termino = next(i['clave'] for i in items if i['tipo'] == 'TERMINO')
        claves = {}
        for clave in (self.clave, f'ANEXO:{anexo.id}', termino):
            r = self.panel.get('/api/registro-dt/ficha/', {'empresa': self.empresa.id, 'clave': clave})
            self.assertEqual(r.status_code, 200, r.data)
            claves[r.data['tipo']] = {c['clave'] for s in r.data['secciones'] for c in s['campos']}
            self.assertIn('nombre-del-trabajador', claves[r.data['tipo']])
        base = Path(settings.BASE_DIR)
        for archivo in (base / 'core' / 'datos' / 'mapeos_midt.json', base / 'e2e' / 'mapeos_midt_e2e.json'):
            mapeos = json.loads(archivo.read_text(encoding='utf-8'))
            self.assertLessEqual(set(mapeos['pantallas']), {'CONTRATO', 'ANEXO', 'TERMINO'}, archivo.name)
            for tipo, pantalla in mapeos['pantallas'].items():
                self.assertTrue(pantalla['ruta'].startswith('/empleador/'), f'{archivo.name} {tipo}')
                for etapa in pantalla['etapas']:
                    pedidas = {c['ficha'] for c in etapa['campos']} | {v['ficha'] for v in etapa.get('verificar', [])}
                    self.assertEqual(pedidas - claves[tipo], set(), f'{archivo.name} {tipo} · {etapa["titulo"]}')
