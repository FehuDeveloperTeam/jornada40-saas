"""RUT chileno: limpieza, formato, dígito verificador y tipo de persona.

Vive aparte de views.py para que también lo usen los serializadores (que
views.py importa) sin crear una importación circular.
"""
import re


def limpiar_rut(rut):
    return re.sub(r'[^0-9kK]', '', str(rut)).upper()

def formatear_rut(rut):
    rut_limpio = limpiar_rut(rut)
    if len(rut_limpio) < 2:
        return rut
    cuerpo = rut_limpio[:-1]
    dv = rut_limpio[-1]
    try:
        cuerpo_con_puntos = "{:,}".format(int(cuerpo)).replace(',', '.')
    except ValueError:
        return rut
    return f"{cuerpo_con_puntos}-{dv}"

# Los RUT de personas naturales (incluidos los RUN de extranjeros) están bajo
# 50.000.000; los de personas jurídicas parten en 50 millones (en la práctica,
# 60 a 99 millones). La cuenta es siempre de la persona titular.
LIMITE_RUT_PERSONA = 50_000_000


def es_rut_de_persona(rut) -> bool:
    cuerpo = limpiar_rut(rut)[:-1]
    return cuerpo.isdigit() and int(cuerpo) < LIMITE_RUT_PERSONA


def validar_rut(rut):
    rut_limpio = limpiar_rut(rut)
    if len(rut_limpio) < 2:
        return False
    cuerpo = rut_limpio[:-1]
    dv_ingresado = rut_limpio[-1]

    try:
        int(cuerpo)
    except ValueError:
        return False

    suma = 0
    multiplo = 2
    for d in reversed(cuerpo):
        suma += int(d) * multiplo
        multiplo += 1
        if multiplo == 8:
            multiplo = 2
    
    resto = suma % 11
    dv_esperado = 11 - resto
    
    if dv_esperado == 11:
        dv_calculado = '0'
    elif dv_esperado == 10:
        dv_calculado = 'K'
    else:
        dv_calculado = str(dv_esperado)
        
    return dv_ingresado == dv_calculado


def normalizar_rut_usuario(valor):
    """Formatea un RUT válido como se guarda (12.345.678-5); otro valor queda igual.

    El usuario de Django es el RUT formateado. Normalizar evita que
    "123456785" y "12.345.678-5" se traten como cuentas distintas, tanto al
    iniciar sesión como en los límites de intentos. Un valor que no es RUT
    (p. ej. el usuario "admin" del panel de administración) no se toca.
    """
    valor = (valor or '').strip()
    return formatear_rut(valor) if validar_rut(valor) else valor
