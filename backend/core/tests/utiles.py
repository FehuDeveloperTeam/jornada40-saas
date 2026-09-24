"""Ayudantes compartidos por las pruebas (usuarios, empleados, planillas, indicadores fijos)."""
import io
from unittest.mock import patch
import openpyxl
from django.contrib.auth.models import User
from ..models import Cliente, Empleado, Empresa, Plan, Suscripcion


# ─── Helpers ──────────────────────────────────────────────────────────────────

def crear_excel_bytes(filas=1):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['rut', 'nombres', 'apellido_paterno', 'cargo', 'fecha_ingreso',
               'sueldo_base', 'horas_laborales'])
    for i in range(filas):
        ws.append([f'1234567{i % 10}-{i % 10}', 'Test', 'Apellido',
                   'Cargo', '2024-01-01', 500000, 40])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    buf.name = 'test.xlsx'
    return buf



def indicadores_fijos(objetivo):
    """UF y UTM fijas en todos los módulos de vistas que las consultan."""
    for modulo in ('calculo_liquidacion', 'finiquitos', 'liquidaciones', 'parametros', 'previred'):
        objetivo = patch(f'core.views.{modulo}.obtener_uf', return_value=41057.20)(objetivo)
    for modulo in ('calculo_liquidacion', 'finiquitos', 'parametros'):
        objetivo = patch(f'core.views.{modulo}.obtener_utm', return_value=71721.0)(objetivo)
    return objetivo

def crear_usuario_completo(username, rut_cliente, rut_empresa, plan_semilla=False):
    """Crea user + Cliente + Plan + Suscripcion + Empresa listos para tests."""
    user = User.objects.create_user(
        username=username, password='pass1234',
        email=f'{username}@test.com'
    )
    plan = Plan.objects.create(
        nombre='Semilla' if plan_semilla else 'PYME',
        precio=0 if plan_semilla else 29990,
        limite_trabajadores=3 if plan_semilla else 100,
        max_empresas=1,
        nivel=1 if plan_semilla else 3,
    )
    cliente = Cliente.objects.create(
        usuario=user, rut=rut_cliente, nombres='Usuario Test'
    )
    Suscripcion.objects.create(
        cliente=cliente, plan=plan,
        estado='TRIAL' if plan_semilla else 'ACTIVE'
    )
    empresa = Empresa.objects.create(
        owner=user, nombre_legal='Empresa Test SA', rut=rut_empresa
    )
    return user, cliente, plan, empresa


def crear_empleado(empresa, rut, nombres='Juan', apellido='Pérez', cargo='Analista'):
    return Empleado.objects.create(
        empresa=empresa, rut=rut,
        nombres=nombres, apellido_paterno=apellido,
        cargo=cargo, fecha_ingreso='2024-01-01',
    )


# ─── A4: Seguridad del webhook ────────────────────────────────────────────────

def _mock_config(secret):
    """Devuelve un side_effect para config() que retorna `secret` para REVENIU_WEBHOOK_SECRET."""
    def _side_effect(key, **kwargs):
        if key == 'REVENIU_WEBHOOK_SECRET':
            return secret
        return kwargs.get('default')
    return _side_effect
