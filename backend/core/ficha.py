"""Datos que faltan para que el contrato salga completo (y para enviarlo a firma).

El alta rápida del trabajador pide lo mínimo; el resto se completa después en la
ficha. Esta lista dice qué falta, en palabras simples y con la pestaña donde se
completa: la carpeta, el editor de contrato y el envío a firma la muestran.
Es un aviso: nunca impide guardar ni emitir.
"""

CON_HORARIO = ('ORDINARIA', 'PARCIAL')


def faltantes_contrato(emp):
    """[{campo, texto, pestana}] de lo que falta para un contrato completo."""
    lista = []

    def falta(campo, texto, pestana='personal'):
        lista.append({'campo': campo, 'texto': texto, 'pestana': pestana})

    if not emp.fecha_nacimiento:
        falta('fecha_nacimiento', 'Fecha de nacimiento')
    if not (emp.nacionalidad or '').strip():
        falta('nacionalidad', 'Nacionalidad')
    if not (emp.estado_civil or '').strip():
        falta('estado_civil', 'Estado civil')
    if not (emp.direccion or '').strip():
        falta('direccion', 'Dirección (calle y número)')
    if not (emp.comuna or '').strip():
        falta('comuna', 'Comuna')
    if not (emp.email or '').strip():
        falta('email', 'Correo personal (para enviarle el contrato a firma)')
    if not (emp.afp or '').strip():
        falta('afp', 'AFP')
    if not (emp.sistema_salud or '').strip():
        falta('sistema_salud', 'Salud (Fonasa o Isapre)')
    from .models import Contrato
    try:
        contrato = emp.contrato_activo
    except Contrato.DoesNotExist:
        contrato = None
    if contrato is None:
        falta('contrato', 'Contrato de trabajo', 'contrato')
        return lista
    if contrato.tipo_jornada in CON_HORARIO and not any(
            (d or {}).get('activo') for d in (contrato.distribucion_horario or {}).values()):
        falta('distribucion_horario', 'Horario de trabajo (días y horas de entrada y salida)', 'contrato')
    if contrato.tipo_jornada == 'OTRO' and not (contrato.jornada_personalizada or '').strip():
        falta('jornada_personalizada', 'Descripción de la jornada', 'contrato')
    return lista
