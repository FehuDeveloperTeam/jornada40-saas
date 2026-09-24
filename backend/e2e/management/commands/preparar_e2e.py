"""Prepara la base de las pruebas de navegador.

    python manage.py preparar_e2e          # crea la base desde cero y guarda una plantilla
    python manage.py preparar_e2e --reset  # restaura la plantilla (rápido, entre pruebas)

Solo funciona con config.settings_e2e: se niega a correr contra otra base.
Las fechas son relativas a hoy (liquidaciones de los meses anteriores, firmas
por vencer), así las pruebas no dependen del día en que se ejecutan.
"""
import datetime
import os
import shutil

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.utils import timezone

USUARIO_RUT = '12.345.678-5'
CLAVE = 'Clave-Segura-2026'


def rut(cuerpo: int) -> str:
    s, m = 0, 2
    for d in reversed(str(cuerpo)):
        s += int(d) * m
        m = 2 if m == 7 else m + 1
    x = 11 - s % 11
    return f'{cuerpo:,}'.replace(',', '.') + '-' + ('0' if x == 11 else 'K' if x == 10 else str(x))


def meses_anteriores(n: int):
    """Los n meses previos al actual, del más antiguo al más reciente: [(mes, anio), …]."""
    hoy = timezone.localdate()
    resultado = []
    mes, anio = hoy.month, hoy.year
    for _ in range(n):
        mes, anio = (12, anio - 1) if mes == 1 else (mes - 1, anio)
        resultado.append((mes, anio))
    return list(reversed(resultado))


class Command(BaseCommand):
    help = 'Crea o restaura la base de datos de las pruebas de navegador.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Restaura la plantilla en vez de crear la base.')

    def handle(self, *args, **opciones):
        if 'e2e' not in settings.INSTALLED_APPS:
            raise CommandError('Usa DJANGO_SETTINGS_MODULE=config.settings_e2e.')
        base = settings.DATABASES['default']['NAME']
        plantilla = base + '.plantilla'
        if opciones['reset'] and os.path.exists(plantilla):
            connections.close_all()
            shutil.copyfile(plantilla, base)
            shutil.rmtree(settings.E2E_ARCHIVOS_DIR, ignore_errors=True)
            self.stdout.write('Base e2e restaurada.')
            return

        connections.close_all()
        for f in (base, plantilla):
            if os.path.exists(f):
                os.remove(f)
        shutil.rmtree(settings.E2E_ARCHIVOS_DIR, ignore_errors=True)
        call_command('migrate', verbosity=0)
        self._sembrar()
        connections.close_all()
        shutil.copyfile(base, plantilla)
        self.stdout.write(self.style.SUCCESS('Base e2e creada.'))

    def _sembrar(self):
        from django.contrib.auth.models import User
        from rest_framework.test import APIClient
        from core.models import (Cliente, Contrato, DocumentoLegal, Empleado, Empresa, Plan, SolicitudFirma,
                                 Suscripcion)

        pyme = Plan.objects.get(nombre='Pyme')
        u = User.objects.create_user(username=USUARIO_RUT, password=CLAVE, email='titular@example.com', first_name='Andrea')
        c = Cliente.objects.create(usuario=u, plan=pyme, rut=USUARIO_RUT, nombres='Andrea', apellido_paterno='Rojas',
                                   correo='titular@example.com')
        Suscripcion.objects.create(cliente=c, plan=pyme, estado='ACTIVE')
        emp = Empresa.objects.create(owner=u, nombre_legal='COMERCIAL LOS ANDES SPA', rut=rut(76123456), comuna='Providencia',
                                     representante_legal='Andrea Rojas', rut_representante=USUARIO_RUT)
        Empresa.objects.create(owner=u, nombre_legal='SERVICIOS DEL SUR LTDA', rut=rut(77222333))

        api = APIClient(SERVER_NAME='localhost')
        api.force_authenticate(u)
        horario = {d: {'activo': True, 'entrada': '08:30', 'salida': '18:00' if d != 'viernes' else '17:00', 'colacion': 60}
                   for d in ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']}
        horario.update({d: {'activo': False, 'entrada': '09:00', 'salida': '18:00', 'colacion': 60} for d in ['sabado', 'domingo']})
        personas = [
            (rut(11111112), 'MATÍAS IGNACIO', 'SOTO', 'MUÑOZ', 'ANALISTA CONTABLE', 1_250_000, 44, 'ORDINARIA', '2019-03-01', 'matias@example.com'),
            (rut(13444555), 'CARLA ANDREA', 'PÉREZ', 'LAGOS', 'JEFA DE VENTAS', 2_100_000, 20, 'ART_22', '2021-07-15', 'carla@example.com'),
            (rut(16777888), 'PEDRO', 'GONZÁLEZ', 'VERA', 'BODEGUERO', 620_000, 42, 'ORDINARIA', '2024-01-10', ''),
            (rut(18222333), 'JAVIERA', 'ARAYA', None, 'VENDEDORA', 540_000, 24, 'PARCIAL', '2025-05-02', 'javiera@example.com'),
        ]
        ids = []
        for r, nom, ap, am, cargo, sueldo, horas, jornada, ingreso, mail in personas:
            resp = api.post('/api/empleados/', {
                'empresa': emp.id, 'rut': r, 'nombres': nom, 'apellido_paterno': ap, 'apellido_materno': am,
                'cargo': cargo, 'fecha_ingreso': ingreso, 'sueldo_base': sueldo, 'email': mail or None,
                'afp': 'HABITAT', 'sistema_salud': 'FONASA', 'numero_telefono': '+56 9 1234 5678',
                'direccion': 'AV. PROVIDENCIA 1234', 'comuna': 'PROVIDENCIA', 'nacionalidad': 'CHILENA'}, format='json')
            assert resp.status_code == 201, resp.data
            ids.append(resp.data['id'])
            resp = api.post('/api/contratos/', {
                'empleado': ids[-1], 'tipo_contrato': 'INDEFINIDO', 'cargo': cargo, 'fecha_inicio': ingreso,
                'sueldo_base': sueldo, 'tipo_jornada': jornada, 'horas_semanales': horas,
                'distribucion_horario': horario if jornada == 'ORDINARIA' else {}, 'dia_pago': 30,
                'gratificacion_legal': 'MENSUAL'}, format='json')
            assert resp.status_code == 201, resp.data

        # Seis meses de liquidaciones para Matías y dos para Pedro, los anteriores al mes en curso.
        ultima = None
        for mes, anio in meses_anteriores(6):
            resp = api.post('/api/liquidaciones/', {'empleado': ids[0], 'mes': mes, 'anio': anio, 'dias_trabajados': 30}, format='json')
            assert resp.status_code == 201, resp.data
            ultima = resp.data['id']
        for mes, anio in meses_anteriores(2):
            resp = api.post('/api/liquidaciones/', {'empleado': ids[2], 'mes': mes, 'anio': anio, 'dias_trabajados': 30}, format='json')
            assert resp.status_code == 201, resp.data

        matias = Empleado.objects.get(id=ids[0])
        ahora = timezone.now()
        doc = DocumentoLegal.objects.create(empleado=matias, tipo='AMONESTACION', fecha_emision=timezone.localdate() - datetime.timedelta(days=20),
                                            hechos='Atrasos reiterados')
        SolicitudFirma.objects.create(empleado=matias, empresa=emp, liquidacion_id=ultima, tipo_documento='LIQUIDACION',
                                      estado='FIRMADO', email_firmante=matias.email, firmado_en=ahora,
                                      expira_en=ahora + datetime.timedelta(days=5))
        SolicitudFirma.objects.create(empleado=matias, empresa=emp, documento_legal=doc, tipo_documento='AMONESTACION',
                                      estado='RECHAZADO', motivo_rechazo='No estoy de acuerdo con los hechos',
                                      expira_en=ahora + datetime.timedelta(days=5))
        SolicitudFirma.objects.create(empleado=matias, empresa=emp, contrato=Contrato.objects.get(empleado=matias),
                                      tipo_documento='CONTRATO', estado='PENDIENTE', expira_en=ahora + datetime.timedelta(days=2))
