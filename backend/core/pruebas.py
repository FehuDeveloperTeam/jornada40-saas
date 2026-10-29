"""Códigos de prueba: un plan pagado gratis por unos meses (p. ej. Pyme por 3).

Jornada40 los genera en el admin (Códigos de prueba → Generar) y los entrega a
quien probará el sistema, en el enlace de registro (`/register?codigo=…`) o
para escribirlo al crear la cuenta. El código sirve una sola vez: al crear la
cuenta queda usado y la cuenta nace con el plan del código, en estado TRIAL,
hasta `Suscripcion.prueba_hasta` (inclusive). Se guarda solo su huella (HMAC
con SECRET_KEY): el código completo se ve una vez, al generarlo.

Al terminar, la cuenta pasa al plan gratuito sin borrar nada: rigen sus
límites y funciones hasta que contrate. El comando diario `enviar_resumenes`
llama a `procesar_pruebas`, que avisa por correo 15 y 3 días antes y el día en
que termina. Si ese proceso no corriera, `_plan_activo` igual deja de dar el
plan de la prueba desde el día siguiente al término (`Suscripcion.prueba_vencida`).
Pagar un plan durante la prueba la termina: rige lo pagado.
"""
import calendar
import datetime
import hashlib
import hmac
import logging
import re
import secrets
from dataclasses import dataclass

from decouple import config
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone

from .models import CodigoPrueba, Plan, Suscripcion

logger = logging.getLogger(__name__)

# Sin 0/O ni 1/I/L: se dictan y se copian sin confundirse (como los de la extensión).
ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
LARGO = 12          # caracteres al azar, en tres grupos de 4 (unos 59 bits)
MESES_POR_DEFECTO = 3
DIAS_VALIDEZ_POR_DEFECTO = 30
MAXIMO_POR_VEZ = 50
# Avisos por correo antes del término, en días restantes.
AVISOS = (15, 3)
MENSAJE_NO_VALIDO = ('El código de prueba no es válido, ya se usó o venció. Revisa que esté bien escrito '
                     'o pide uno nuevo.')


class CodigoNoValido(Exception):
    pass


@dataclass
class Prueba:
    plan: Plan
    hasta: datetime.date


def normalizar(codigo):
    """Mayúsculas y solo letras y números: se acepta con o sin guiones o espacios."""
    return re.sub(r'[^A-Z0-9]', '', str(codigo or '').upper())


def _parte_secreta(codigo):
    """Los últimos 12 caracteres: el prefijo (PYME) solo orienta y puede omitirse."""
    texto = normalizar(codigo)
    return texto[-LARGO:] if len(texto) >= LARGO else ''


def huella(parte_secreta):
    return hmac.new(settings.SECRET_KEY.encode(), f'prueba:{parte_secreta}'.encode(), hashlib.sha256).hexdigest()


def prefijo_de(plan):
    """"Plan Pyme" → PYME: dice de qué plan es el código a quien lo lee."""
    nombre = re.sub(r'^PLAN\s+', '', plan.nombre.strip().upper())
    return (re.sub(r'[^A-Z]', '', nombre) or 'J40')[:10]


def sumar_meses(fecha, meses):
    """El mismo día `meses` después; si ese mes es más corto, su último día (30-11 + 3 = 28-02)."""
    total = fecha.month - 1 + meses
    anio, mes = fecha.year + total // 12, total % 12 + 1
    return fecha.replace(year=anio, month=mes, day=min(fecha.day, calendar.monthrange(anio, mes)[1]))


def generar(plan, *, nota, meses=MESES_POR_DEFECTO, valido_hasta=None, cantidad=1, creado_por=None):
    """Crea `cantidad` códigos y devuelve [(CodigoPrueba, código completo)].

    El código completo no se guarda en ninguna parte: hay que mostrarlo en ese
    momento y entregarlo a quien lo usará."""
    if not 1 <= cantidad <= MAXIMO_POR_VEZ:
        raise ValueError(f'Se generan entre 1 y {MAXIMO_POR_VEZ} códigos por vez.')
    valido_hasta = valido_hasta or timezone.localdate() + datetime.timedelta(days=DIAS_VALIDEZ_POR_DEFECTO)
    prefijo = prefijo_de(plan)
    creados = []
    with transaction.atomic():
        for _ in range(cantidad):
            while True:
                parte = ''.join(secrets.choice(ALFABETO) for _ in range(LARGO))
                if not CodigoPrueba.objects.filter(codigo_hash=huella(parte)).exists():
                    break
            codigo = CodigoPrueba.objects.create(
                codigo_hash=huella(parte), prefijo=prefijo, sufijo=parte[-4:], plan=plan, meses=meses, nota=nota,
                valido_hasta=valido_hasta, creado_por=creado_por)
            creados.append((codigo, '-'.join([prefijo, parte[:4], parte[4:8], parte[8:]])))
    return creados


def vigente(codigo, *, bloquear=False):
    """El CodigoPrueba disponible para ese texto (sin usar, no anulado ni vencido), o None."""
    parte = _parte_secreta(codigo)
    if not parte:
        return None
    consulta = CodigoPrueba.objects.select_related('plan')
    if bloquear:
        consulta = consulta.select_for_update(of=('self',))
    encontrado = consulta.filter(codigo_hash=huella(parte)).first()
    if encontrado is None or encontrado.estado() != 'DISPONIBLE' or not encontrado.plan.activo:
        return None
    return encontrado


def canjear(codigo, cliente):
    """Usa el código para la cuenta recién creada: le da el plan de la prueba
    hasta su término y deja el código usado. Va dentro de la transacción del
    registro: si algo falla, no queda ni la cuenta ni el código gastado.
    Lanza CodigoNoValido."""
    encontrado = vigente(codigo, bloquear=True)
    if encontrado is None:
        raise CodigoNoValido(MENSAJE_NO_VALIDO)
    # Condicional además del bloqueo: dos registros simultáneos no lo usan dos veces.
    usado = CodigoPrueba.objects.filter(pk=encontrado.pk, usado_en__isnull=True, activo=True) \
        .update(usado_en=timezone.now(), usado_por=cliente)
    if not usado:
        raise CodigoNoValido(MENSAJE_NO_VALIDO)
    prueba = Prueba(plan=encontrado.plan, hasta=sumar_meses(timezone.localdate(), encontrado.meses))
    cliente.plan = prueba.plan
    cliente.save(update_fields=['plan'])
    Suscripcion.objects.update_or_create(cliente=cliente, defaults={
        'plan': prueba.plan, 'estado': 'TRIAL', 'prueba_hasta': prueba.hasta, 'prueba_aviso': None,
        'prueba_terminada_en': None})
    transaction.on_commit(lambda: _avisar_equipo(encontrado, cliente, prueba))
    return prueba


def _avisar_equipo(codigo, cliente, prueba):
    """Correo a Jornada40: quien recibió el código ya creó su cuenta."""
    destino = config('ALERTAS_PAGOS_EMAIL', default='contacto.jornada40@gmail.com')
    try:
        EmailMultiAlternatives(
            subject=f'[Jornada40] Se usó el código de prueba {codigo.visible}',
            body=(f'Con el código {codigo.visible} ({codigo.nota}) se creó la cuenta {cliente.rut}. Tiene el plan '
                  f'{prueba.plan.nombre} gratis hasta el {prueba.hasta:%d-%m-%Y}.'),
            from_email=settings.DEFAULT_FROM_EMAIL, to=[destino]).send()
    except Exception:
        logger.exception('No se pudo avisar el uso del código de prueba %s', codigo.id)


def terminar(suscripcion):
    """Fin de la prueba: la cuenta pasa al plan gratuito sin borrar nada."""
    base = Plan.gratuito()
    suscripcion.plan = base
    suscripcion.estado = 'ACTIVE'
    suscripcion.prueba_terminada_en = timezone.now()
    suscripcion.save(update_fields=['plan', 'estado', 'prueba_terminada_en'])
    cliente = suscripcion.cliente
    cliente.plan = base
    cliente.save(update_fields=['plan'])


def terminar_por_pago(suscripcion):
    """Pagó un plan durante la prueba: termina sin avisos (rige lo pagado).
    Solo marca la suscripción; quien la guarda es el webhook."""
    if suscripcion.estado == 'TRIAL' and suscripcion.prueba_hasta:
        suscripcion.prueba_terminada_en = timezone.now()
        suscripcion.prueba_aviso = 0


def procesar_pruebas(hoy=None):
    """Avisos y término de las pruebas. Lo corre el comando diario y es seguro
    repetirlo el mismo día: cada aviso sale una vez. Devuelve los correos enviados."""
    hoy = hoy or timezone.localdate()
    enviados = 0
    pendientes = Suscripcion.objects.filter(estado='TRIAL', prueba_hasta__isnull=False) \
        .select_related('cliente__usuario', 'plan')
    for suscripcion in pendientes:
        try:
            enviados += _procesar(suscripcion, hoy)
        except Exception:
            logger.exception('Pruebas: falló la suscripción %s', suscripcion.id)
    return enviados


def _procesar(suscripcion, hoy):
    restantes = (suscripcion.prueba_hasta - hoy).days
    if restantes < 0:
        plan_prueba = suscripcion.plan
        if Plan.gratuito() is None:
            logger.error('Pruebas: no hay un plan gratuito activo al que pasar la suscripción %s', suscripcion.id)
            return 0
        with transaction.atomic():
            terminar(suscripcion)
        enviado = _avisar(suscripcion, plan_prueba, restantes, terminada=True)
        suscripcion.prueba_aviso = 0
        suscripcion.save(update_fields=['prueba_aviso'])
        return int(enviado)
    for dias in sorted(AVISOS):
        if restantes <= dias:
            if suscripcion.prueba_aviso is not None and suscripcion.prueba_aviso <= dias:
                return 0
            # Si el correo falla no se marca: se reintenta al día siguiente.
            if not _avisar(suscripcion, suscripcion.plan, restantes):
                return 0
            suscripcion.prueba_aviso = dias
            suscripcion.save(update_fields=['prueba_aviso'])
            return 1
    return 0


def _avisar(suscripcion, plan_prueba, restantes, terminada=False):
    """Correo al titular: la prueba termina pronto, o terminó. True si se envió."""
    cliente = suscripcion.cliente
    correo = cliente.correo or cliente.usuario.email
    if not correo:
        return False
    gratuito = Plan.gratuito()
    hasta = suscripcion.prueba_hasta.strftime('%d-%m-%Y')
    ctx = {
        'nombre': cliente.nombres, 'plan': plan_prueba.nombre, 'hasta': hasta, 'restantes': restantes,
        'terminada': terminada, 'gratuito': gratuito.nombre if gratuito else 'gratuito',
        'empresas': gratuito.max_empresas if gratuito else 1,
        'trabajadores': gratuito.limite_trabajadores if gratuito else 0,
        'sitio': settings.SITIO_URL.rstrip('/'),
    }
    asunto = (f'Jornada40: terminó tu prueba del plan {plan_prueba.nombre}' if terminada
              else f'Jornada40: tu prueba del plan {plan_prueba.nombre} termina el {hasta}')
    try:
        mensaje = EmailMultiAlternatives(asunto, render_to_string('prueba_aviso.txt', ctx),
                                         settings.DEFAULT_FROM_EMAIL, to=[correo])
        mensaje.attach_alternative(render_to_string('prueba_aviso.html', ctx), 'text/html')
        mensaje.send()
    except Exception:
        logger.exception('Pruebas: no se pudo enviar el aviso de la suscripción %s', suscripcion.id)
        return False
    return True
