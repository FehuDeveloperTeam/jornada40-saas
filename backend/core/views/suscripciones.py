"""Planes, suscripción y pasarela de pagos (Reveniu)."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from ..models import Plan, Suscripcion, Cliente, EventoPasarela
from ..serializers import PlanSerializer
from django.conf import settings
from django.utils import timezone
import datetime
import re
from decouple import config
import hmac
import urllib.parse
from django.core.mail import EmailMultiAlternatives

from .base import _plan_activo, _trabajadores_vigentes, logger


# Endpoint para listar los planes activos en la BD
class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.filter(activo=True)
    serializer_class = PlanSerializer
    permission_classes = [AllowAny] 

# Endpoint específico para el dashboard del cliente
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def mi_suscripcion(request):
    cliente = getattr(request.user, 'perfil_cliente', None)
    if not cliente:
        return Response({'error': 'Perfil de cliente no encontrado'}, status=status.HTTP_404_NOT_FOUND)

    # 1. Buscar o crear suscripción 
    try:
        suscripcion = cliente.suscripcion_activa
    except Suscripcion.DoesNotExist:
        plan_asignado = cliente.plan or Plan.objects.filter(activo=True, nivel=1).order_by('precio', 'id').first()
        suscripcion = Suscripcion.objects.create(
            cliente=cliente,
            plan=plan_asignado,
            estado='ACTIVE' if plan_asignado else 'TRIAL'
        )

    # 2. Calcular uso real (trabajadores en TODAS las empresas del usuario)
    trabajadores_actuales = _trabajadores_vigentes(request.user)

    # 3. Armar la respuesta exacta que espera Suscripcion.tsx
    # El plan que se informa es el mismo con que el backend decide funciones
    # y límites (_plan_activo), con su nivel: así el panel no depende de
    # encontrarlo en la lista de planes a la venta.
    plan = _plan_activo(request.user) or suscripcion.plan
    data = {
        'estado': suscripcion.estado,
        'plan': {
            'id': plan.id,
            'nombre': plan.nombre,
            'precio': plan.precio,
            'limite_trabajadores': plan.limite_trabajadores,
            'max_empresas': plan.max_empresas,
            'nivel': plan.nivel,
            'descripcion': plan.descripcion,
        },
        'trabajadores_actuales': trabajadores_actuales,
        'fecha_proximo_cobro': suscripcion.fecha_proximo_cobro.strftime('%Y-%m-%d') if suscripcion.fecha_proximo_cobro else None,
        'metodo_pago_glosa': suscripcion.metodo_pago_glosa,
        # Canceló la renovación en Reveniu: conserva el plan hasta el fin del período pagado.
        'renovacion_cancelada': suscripcion.estado == 'ACTIVE' and suscripcion.fecha_cancelacion is not None,
        'pagos': [
            {'id': e.id, 'fecha': e.fecha_pago.isoformat() if e.fecha_pago else None, 'monto': e.monto,
             'plan': e.plan.nombre if e.plan else None, 'orden': e.orden_compra}
            for e in cliente.eventos_pasarela.filter(evento__in=_EVENTOS_PAGO, monto__gt=0)
                .select_related('plan').order_by('-fecha_pago', '-id')[:24]
        ],
    }

    return Response(data, status=status.HTTP_200_OK)

# ==========================================
# PASARELA DE PAGOS (REVENIU)
# ==========================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def crear_checkout_reveniu(request):
    plan_id = str(request.data.get('plan_id'))
    ciclo = request.data.get('ciclo', 'mensual')  # 'mensual' o 'anual'

    try:
        plan = Plan.objects.get(id=plan_id)
        cliente = getattr(request.user, 'perfil_cliente', None)

        # REVENIU_LINK_<PLAN>_<CICLO>, p. ej. REVENIU_LINK_PYME_MENSUAL. Se
        # normaliza el nombre ("Plan Pyme" → PYME) para no depender de cómo
        # se escribió en el admin.
        nombre_plan = re.sub(r'^PLAN\s+', '', plan.nombre.strip().upper())
        nombre_plan = re.sub(r'\W+', '_', nombre_plan).strip('_')
        ciclo_upper = str(ciclo).upper()
        env_key = f'REVENIU_LINK_{nombre_plan}_{ciclo_upper}'
        link_base = config(env_key, default=None)

        if not link_base:
            return Response(
                {'error': f'Link de pago no configurado para este plan ({env_key} no definido).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nombre_url = urllib.parse.quote(f"{request.user.first_name} {request.user.last_name}".strip())
        url_pago = f"{link_base}?email={request.user.email}&name={nombre_url}&custom_reference={cliente.id}_{plan.id}"

        return Response({'url': url_pago}, status=status.HTTP_200_OK)

    except Plan.DoesNotExist:
        return Response({'error': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

# Nombres de evento que documenta Reveniu, más los que esperaba la primera
# versión de esta integración (se siguen aceptando).
_EVENTOS_ACTIVACION = {'subscription_activated', 'subscription_created'}
_EVENTOS_PAGO = {'subscription_payment_succeeded', 'payment_succeeded'}
_EVENTO_RENOVACION_CANCELADA = 'subscription_renewal_cancelled'
_EVENTO_DESACTIVADA = 'subscription_deactivated'


def _referencia_cliente_plan(referencia):
    """(cliente, plan) desde una referencia "<cliente_id>_<plan_id>", o (None, None)."""
    try:
        cliente_id, plan_id = str(referencia or '').split('_', 1)
        return Cliente.objects.get(id=int(cliente_id)), Plan.objects.get(id=int(plan_id))
    except (ValueError, Cliente.DoesNotExist, Plan.DoesNotExist):
        return None, None


def _plan_base():
    """Plan al que vuelve una cuenta cuya suscripción pagada terminó (Semilla)."""
    return Plan.objects.filter(activo=True).order_by('nivel', 'precio', 'id').first()


def _avisar_pagos(asunto, cuerpo):
    """Correo a Jornada40 por algo de la pasarela que requiere acción manual."""
    destino = config('ALERTAS_PAGOS_EMAIL', default='contacto.jornada40@gmail.com')
    try:
        EmailMultiAlternatives(subject=f'[Jornada40 pagos] {asunto}', body=cuerpo,
                               from_email=settings.DEFAULT_FROM_EMAIL, to=[destino]).send()
    except Exception:
        logger.exception('No se pudo enviar el aviso de pagos: %s', asunto)


def aplicar_evento_pasarela(evento):
    """Refleja un EventoPasarela ya asociado (cliente y, si activa, plan) en la suscripción.

    Lo usa el webhook y también el admin, al asociar a mano un aviso que llegó
    sin referencia. Devuelve True si cambió algo.
    """
    if evento.aplicado or not evento.cliente_id:
        return False
    cliente = evento.cliente
    suscripcion = Suscripcion.objects.filter(cliente=cliente).first()
    id_pasarela = evento.gateway_subscription_id
    # Un aviso de otra suscripción de Reveniu (la anterior a un cambio de
    # plan) no debe bajar ni cambiar la vigente.
    es_la_vigente = not suscripcion or not suscripcion.gateway_subscription_id or \
        not id_pasarela or suscripcion.gateway_subscription_id == id_pasarela

    if evento.evento in _EVENTOS_ACTIVACION | _EVENTOS_PAGO:
        plan = evento.plan or (suscripcion.plan if suscripcion and es_la_vigente else None)
        if not plan:
            return False
        if suscripcion and suscripcion.gateway_subscription_id and id_pasarela and not es_la_vigente:
            # Cambio de plan: Reveniu abrió otra suscripción y la anterior
            # sigue cobrando hasta que alguien la cancele.
            _avisar_pagos(
                f'Cancelar la suscripción anterior de {cliente.rut}',
                f'La cuenta {cliente.rut} pagó el plan {plan.nombre} con la suscripción de Reveniu '
                f'{id_pasarela}. La suscripción anterior ({suscripcion.gateway_subscription_id}, plan '
                f'{suscripcion.plan.nombre}) sigue activa en Reveniu: cancélala allí para no cobrar dos veces.')
        if not suscripcion:
            # Cuentas anteriores al cambio pueden no tener suscripción: un
            # pago válido no puede perderse por eso.
            suscripcion = Suscripcion(cliente=cliente, plan=plan)
        suscripcion.plan = plan
        suscripcion.estado = 'ACTIVE'
        suscripcion.fecha_cancelacion = None
        if id_pasarela:
            suscripcion.gateway_subscription_id = id_pasarela
        suscripcion.save()
        # cliente.plan manda en los límites y los PDF: se sincroniza.
        cliente.plan = plan
        cliente.save(update_fields=['plan'])
        if not evento.plan_id:
            evento.plan = plan
    elif evento.evento == _EVENTO_RENOVACION_CANCELADA:
        # No se renovará, pero el período pagado se respeta: el acceso sigue
        # hasta que Reveniu avise que la suscripción terminó.
        if suscripcion and es_la_vigente:
            suscripcion.fecha_cancelacion = timezone.now()
            suscripcion.save(update_fields=['fecha_cancelacion'])
    elif evento.evento == _EVENTO_DESACTIVADA:
        if suscripcion and es_la_vigente:
            base = _plan_base()
            suscripcion.estado = 'CANCELED'
            suscripcion.fecha_cancelacion = suscripcion.fecha_cancelacion or timezone.now()
            suscripcion.save(update_fields=['estado', 'fecha_cancelacion'])
            # Vuelve al plan gratuito: no se borra nada, solo rigen sus límites.
            cliente.plan = base
            cliente.save(update_fields=['plan'])
    else:
        return False
    evento.aplicado = True
    evento.save()
    return True


@api_view(['POST'])
@permission_classes([AllowAny])
def webhook_reveniu(request):
    webhook_secret = config('REVENIU_WEBHOOK_SECRET', default=None)

    # Secret obligatorio. Sin él, rechazamos todo (fail closed).
    if not webhook_secret:
        return Response({'error': 'Webhook no configurado'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    # Reveniu envía el secreto en Reveniu-Secret-Key; X-Webhook-Token es el
    # encabezado que usaba la primera versión y se sigue aceptando.
    token_recibido = request.headers.get('Reveniu-Secret-Key') or request.headers.get('X-Webhook-Token', '')

    if not hmac.compare_digest(str(token_recibido), webhook_secret):
        return Response({'error': 'Unauthorized'}, status=status.HTTP_401_UNAUTHORIZED)

    cuerpo = request.data if isinstance(request.data, dict) else {}
    evento_nombre = str(cuerpo.get('event') or '')
    # Reveniu anida los datos en "data"; la primera versión los esperaba planos.
    data = cuerpo.get('data') if isinstance(cuerpo.get('data'), dict) else cuerpo
    conocidos = _EVENTOS_ACTIVACION | _EVENTOS_PAGO | {_EVENTO_RENOVACION_CANCELADA, _EVENTO_DESACTIVADA}
    if evento_nombre not in conocidos:
        return Response(status=status.HTTP_200_OK)

    id_pasarela = str(data.get('subscription_id') or '')
    orden = str(data.get('buy_order') or '')
    # Reveniu reintenta los avisos: un pago ya registrado no se procesa dos veces.
    if orden and EventoPasarela.objects.filter(evento=evento_nombre, orden_compra=orden).exists():
        return Response(status=status.HTTP_200_OK)

    cliente, plan = _referencia_cliente_plan(data.get('subscription_external_id') or data.get('custom_reference'))
    if not cliente and id_pasarela:
        conocida = Suscripcion.objects.filter(gateway_subscription_id=id_pasarela).select_related('cliente').first()
        cliente = conocida.cliente if conocida else None

    try:
        monto = int(round(float(data.get('amount') or 0)))
    except (TypeError, ValueError):
        monto = 0
    try:
        fecha_pago = datetime.datetime.strptime(str(data.get('issued_on')), '%d/%m/%Y').date()
    except ValueError:
        fecha_pago = timezone.localdate() if evento_nombre in _EVENTOS_PAGO else None

    evento = EventoPasarela.objects.create(
        evento=evento_nombre, cliente=cliente, plan=plan, gateway_subscription_id=id_pasarela,
        orden_compra=orden, monto=monto, fecha_pago=fecha_pago, datos=cuerpo)

    if not cliente:
        _avisar_pagos(
            f'Aviso de Reveniu sin cuenta asociada ({evento_nombre})',
            f'Llegó "{evento_nombre}" de la suscripción de Reveniu {id_pasarela or "(sin id)"}'
            f'{f" por ${monto:,}".replace(",", ".") if monto else ""} y no se pudo asociar a una cuenta.\n\n'
            f'Asócialo en el admin: Eventos de la pasarela → evento #{evento.id} → elige cliente y plan y guarda. '
            f'Desde ahí la suscripción queda vinculada y los próximos avisos se aplican solos.')
        return Response({'estado': 'sin_asociar'}, status=status.HTTP_200_OK)

    aplicar_evento_pasarela(evento)
    return Response(status=status.HTTP_200_OK)
