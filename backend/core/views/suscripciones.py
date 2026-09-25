"""Planes, suscripción y pasarela de pagos (Reveniu)."""
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from ..models import Cliente, EventoPasarela, IntentoPago, Plan, Suscripcion
from ..serializers import PlanSerializer
from django.conf import settings
from django.utils import timezone
import datetime
import re
from decouple import config
import hmac
import urllib.parse
from django.core.mail import EmailMultiAlternatives

from .. import reveniu
from .base import _plan_activo, _trabajadores_vigentes, logger


# Endpoint para listar los planes activos en la BD
class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.filter(activo=True).order_by('nivel', 'id')
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
            'precio_anual': plan.precio_anual,
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
        'ciclo': suscripcion.ciclo.lower(),
        # Bajada de plan programada para el próximo cobro.
        'cambio_programado': ({'plan': {'id': suscripcion.plan_programado.id, 'nombre': suscripcion.plan_programado.nombre},
                               'desde': suscripcion.fecha_proximo_cobro.strftime('%Y-%m-%d')
                               if suscripcion.fecha_proximo_cobro else None}
                              if suscripcion.plan_programado_id else None),
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
    ciclo = str(request.data.get('ciclo') or 'mensual').lower()
    if ciclo not in ('mensual', 'anual'):
        return Response({'error': 'El ciclo de pago debe ser mensual o anual.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        plan = Plan.objects.get(id=plan_id)
        cliente = getattr(request.user, 'perfil_cliente', None)
        if ciclo == 'anual' and not plan.precio_anual:
            return Response({'error': f'El plan {plan.nombre} no tiene pago anual.'}, status=status.HTTP_400_BAD_REQUEST)

        # REVENIU_LINK_<PLAN>_<CICLO>, p. ej. REVENIU_LINK_PYME_MENSUAL. Se
        # normaliza el nombre ("Plan Pyme" → PYME) para no depender de cómo
        # se escribió en el admin.
        nombre_plan = re.sub(r'^PLAN\s+', '', plan.nombre.strip().upper())
        nombre_plan = re.sub(r'\W+', '_', nombre_plan).strip('_')
        ciclo_upper = str(ciclo).upper()
        env_key = f'REVENIU_LINK_{nombre_plan}_{ciclo_upper}'
        link_base = config(env_key, default=None)

        if not link_base:
            logger.error('Falta la variable %s: no se puede cobrar ese plan', env_key)
            return Response(
                {'error': 'El pago de este plan no está disponible en este momento. Escríbenos y lo resolvemos.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        email = (getattr(cliente, 'correo', '') or request.user.email or '').strip()
        nombre = f"{getattr(cliente, 'nombres', '') or request.user.first_name} {getattr(cliente, 'apellido_paterno', '') or request.user.last_name}".strip()

        # 1) Por API: la suscripción nace con nuestro external_id (el intento),
        #    así el pago se asocia solo a la cuenta, el plan y el ciclo.
        intento = IntentoPago.objects.create(cliente=cliente, plan=plan, ciclo=ciclo.upper())
        try:
            plan_reveniu = reveniu.plan_desde_link(link_base)
            reveniu.exigir_frecuencia(plan_reveniu, ciclo)
            creada = reveniu.crear_suscripcion(plan_reveniu['id'], email, nombre, intento.id)
            intento.gateway_subscription_id = str(creada['id'])
            intento.save(update_fields=['gateway_subscription_id'])
            return Response({'completion_url': creada['completion_url'], 'security_token': creada.get('security_token', '')},
                            status=status.HTTP_200_OK)
        except reveniu.PlanMalConfigurado as e:
            # El link fijo apunta al mismo plan mal configurado: no se cobra.
            _avisar_pagos('Plan de Reveniu mal configurado', f'{e} Corrígelo en Reveniu; mientras, ese pago queda detenido.')
            return Response({'error': 'El pago de este plan no está disponible en este momento. Ya avisamos al equipo; '
                                      'intenta más tarde o escríbenos.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception:
            # Cualquier otra falla de la API (caída, respuesta inesperada) no
            # puede impedir el pago: se sigue con el link fijo.
            logger.exception('Checkout por API de Reveniu falló; se usa el link de pago')

        # 2) Respaldo: el link de pago fijo, con la referencia en la URL.
        nombre_url = urllib.parse.quote(nombre)
        url_pago = (f"{link_base}?email={urllib.parse.quote(email)}&name={nombre_url}"
                    f"&custom_reference={cliente.id}_{plan.id}_{ciclo}")
        return Response({'url': url_pago}, status=status.HTTP_200_OK)

    except Plan.DoesNotExist:
        return Response({'error': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    except Exception:
        logger.exception('No se pudo iniciar el pago')
        return Response({'error': 'No pudimos iniciar el pago. Intenta de nuevo en unos minutos.'},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Nombres de evento que documenta Reveniu, más los que esperaba la primera
# versión de esta integración (se siguen aceptando).
_EVENTOS_ACTIVACION = {'subscription_activated', 'subscription_created'}
_EVENTOS_PAGO = {'subscription_payment_succeeded', 'payment_succeeded'}
_EVENTO_RENOVACION_CANCELADA = 'subscription_renewal_cancelled'
_EVENTO_DESACTIVADA = 'subscription_deactivated'


def _intento_de(valor):
    """El IntentoPago cuyo id viaja como external_id, si la referencia es un número."""
    try:
        return IntentoPago.objects.select_related('cliente', 'plan').get(id=int(str(valor).strip()))
    except (TypeError, ValueError, IntentoPago.DoesNotExist):
        return None


def _referencia_cliente_plan(referencia):
    """(cliente, plan) desde el external_id de un intento, o una referencia
    "<cliente_id>_<plan_id>[_<ciclo>]" de los links de pago; si no, (None, None)."""
    intento = _intento_de(referencia) if '_' not in str(referencia or '') else None
    if intento:
        return intento.cliente, intento.plan
    try:
        cliente_id, plan_id = str(referencia or '').split('_')[:2]
        return Cliente.objects.get(id=int(cliente_id)), Plan.objects.get(id=int(plan_id))
    except (ValueError, Cliente.DoesNotExist, Plan.DoesNotExist):
        return None, None


def _ciclo_del_evento(evento, plan):
    """MENSUAL o ANUAL según la referencia del checkout o, si no viene, el monto pagado."""
    datos = evento.datos.get('data') if isinstance(evento.datos.get('data'), dict) else evento.datos
    referencia = datos.get('subscription_external_id') or datos.get('custom_reference') or ''
    intento = _intento_de(referencia) if '_' not in str(referencia) else None
    if intento is None and evento.gateway_subscription_id:
        intento = IntentoPago.objects.filter(gateway_subscription_id=evento.gateway_subscription_id).first()
    if intento:
        return intento.ciclo
    partes = str(referencia).split('_')
    if len(partes) >= 3 and partes[2].upper() in ('MENSUAL', 'ANUAL'):
        return partes[2].upper()
    if evento.monto and plan.precio_anual:
        return 'ANUAL' if evento.monto >= plan.precio_anual * 0.9 else 'MENSUAL'
    return None


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


def _cancelar_anterior(cliente, plan, evento, id_anterior, plan_anterior):
    """Quita la renovación a la suscripción anterior en Reveniu; si no se puede, avisa por correo."""
    ciclo = (_ciclo_del_evento(evento, plan) or '').lower() or 'ciclo sin informar'
    try:
        if reveniu.desactivar_renovacion(id_anterior):
            logger.info('Renovación desactivada en Reveniu: suscripción %s de %s', id_anterior, cliente.rut)
            return
        motivo = 'Reveniu no confirmó la operación.'
    except Exception as e:  # cualquier falla de la API termina en el correo de aviso
        motivo = str(e)
    _avisar_pagos(
        f'Cancelar la suscripción anterior de {cliente.rut}',
        f'La cuenta {cliente.rut} pagó el plan {plan.nombre} ({ciclo}) con la suscripción de Reveniu '
        f'{evento.gateway_subscription_id}. No se pudo quitar la renovación a la anterior ({id_anterior}, plan '
        f'{plan_anterior}) por la API ({motivo}): cancélala en Reveniu para no cobrar dos veces.')


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
        # Renovación de la misma suscripción de Reveniu: el plan no cambia (la
        # referencia del checkout original sigue diciendo el plan de entonces),
        # salvo una bajada programada, que rige justo desde este cobro.
        renovacion = bool(suscripcion and suscripcion.gateway_subscription_id and id_pasarela
                          and suscripcion.gateway_subscription_id == id_pasarela)
        if renovacion:
            plan = suscripcion.plan_programado or suscripcion.plan
            evento.plan = plan
        if not plan:
            return False
        if suscripcion and suscripcion.gateway_subscription_id and id_pasarela and not es_la_vigente:
            # Cambio de plan o de ciclo: Reveniu abrió otra suscripción y la
            # anterior seguiría cobrando. Se le quita la renovación (queda
            # activa hasta su próximo cobro, sin doble cobro); si la API
            # falla, se avisa por correo para hacerlo a mano.
            _cancelar_anterior(cliente, plan, evento, suscripcion.gateway_subscription_id, suscripcion.plan.nombre)
        if not suscripcion:
            # Cuentas anteriores al cambio pueden no tener suscripción: un
            # pago válido no puede perderse por eso.
            suscripcion = Suscripcion(cliente=cliente, plan=plan)
        suscripcion.plan = plan
        suscripcion.plan_programado = None  # aplicada, o reemplazada por un plan nuevo
        suscripcion.estado = 'ACTIVE'
        suscripcion.fecha_cancelacion = None
        suscripcion.ciclo = _ciclo_del_evento(evento, plan) or suscripcion.ciclo or 'MENSUAL'
        if id_pasarela:
            suscripcion.gateway_subscription_id = id_pasarela
        suscripcion.save()
        # cliente.plan manda en los límites y los PDF: se sincroniza.
        cliente.plan = plan
        cliente.save(update_fields=['plan'])
        if not evento.plan_id:
            evento.plan = plan
        if evento.evento in _EVENTOS_PAGO:
            _actualizar_proximo_cobro(suscripcion)
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
        # Suscripción creada por API: el intento guardó su id al crearla.
        intento = IntentoPago.objects.filter(gateway_subscription_id=id_pasarela).select_related('cliente', 'plan').first()
        if intento:
            cliente, plan = intento.cliente, intento.plan
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


# ==========================================
# BAJAR DE PLAN Y REANUDAR LA RENOVACIÓN
# ==========================================

def _actualizar_proximo_cobro(suscripcion):
    """Fecha del próximo cobro según Reveniu (no crítico: sin ella se muestra un texto genérico)."""
    if not suscripcion.gateway_subscription_id:
        return
    try:
        proximo = reveniu.obtener_suscripcion(suscripcion.gateway_subscription_id).get('next_due')
        fecha = datetime.datetime.fromisoformat(str(proximo).replace('Z', '+00:00')) if proximo else None
    except Exception:
        logger.exception('No se pudo leer el próximo cobro de la suscripción %s', suscripcion.gateway_subscription_id)
        return
    if fecha:
        suscripcion.fecha_proximo_cobro = fecha
        suscripcion.save(update_fields=['fecha_proximo_cobro'])


def _suscripcion_pagada(request):
    """(cliente, suscripción) de una cuenta con plan pagado vigente, o una Response de error."""
    cliente = getattr(request.user, 'perfil_cliente', None)
    suscripcion = Suscripcion.objects.filter(cliente=cliente).select_related('plan', 'plan_programado').first() \
        if cliente else None
    if not suscripcion or suscripcion.estado != 'ACTIVE' or not suscripcion.plan.precio:
        return None, Response({'error': 'Tu cuenta no tiene un plan pagado vigente.'}, status=status.HTTP_400_BAD_REQUEST)
    if not suscripcion.gateway_subscription_id:
        return None, Response({'error': 'No encontramos tu suscripción en Reveniu. Escríbenos y lo resolvemos.'},
                              status=status.HTTP_400_BAD_REQUEST)
    return cliente, suscripcion


def _precio_del_ciclo(plan, ciclo):
    return plan.precio_anual if ciclo == 'ANUAL' else plan.precio


def _excesos(user, plan):
    """Lo que la cuenta tiene por sobre los límites de un plan (textos), o []."""
    from ..models import Empresa
    excesos = []
    trabajadores = _trabajadores_vigentes(user)
    if plan.limite_trabajadores and trabajadores > plan.limite_trabajadores:
        excesos.append(f'{trabajadores} trabajadores vigentes (el plan {plan.nombre} permite {plan.limite_trabajadores})')
    empresas = Empresa.objects.filter(owner=user, activo=True).count()
    if plan.max_empresas and empresas > plan.max_empresas:
        excesos.append(f'{empresas} empresas activas (el plan {plan.nombre} permite {plan.max_empresas})')
    return excesos


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bajar_plan(request):
    """Programa el paso a un plan menor desde el próximo cobro.

    A un plan pagado: se baja el monto de la misma suscripción de Reveniu (sin
    otra tarjeta ni doble cobro) y el plan cambia al llegar el aviso de ese
    cobro. A Semilla: se quita la renovación; el plan pagado sigue hasta el
    fin del período y después la cuenta pasa a Semilla sin borrar nada.
    """
    cliente, suscripcion = _suscripcion_pagada(request)
    if not cliente:
        return suscripcion
    try:
        nuevo = Plan.objects.get(id=request.data.get('plan_id'), activo=True)
    except (Plan.DoesNotExist, ValueError, TypeError):
        return Response({'error': 'Plan no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    actual = suscripcion.plan
    if nuevo.nivel >= actual.nivel:
        return Response({'error': 'Para subir de plan, elígelo y paga desde Plan y facturación.'},
                        status=status.HTTP_400_BAD_REQUEST)
    if suscripcion.fecha_cancelacion:
        return Response({'error': 'Tu plan ya no se renovará. Reanúdalo antes de cambiarlo.'},
                        status=status.HTTP_400_BAD_REQUEST)

    if not nuevo.precio:
        try:
            if not reveniu.desactivar_renovacion(suscripcion.gateway_subscription_id):
                raise reveniu.ErrorReveniu('Reveniu no confirmó la operación.')
        except Exception:
            logger.exception('No se pudo quitar la renovación de %s', suscripcion.gateway_subscription_id)
            _avisar_pagos(f'Pasar a Semilla a {cliente.rut}',
                          f'La cuenta {cliente.rut} pidió pasar a Semilla. Quítale la renovación a su suscripción '
                          f'{suscripcion.gateway_subscription_id} en Reveniu.')
            return Response({'error': 'No pudimos registrar el cambio ahora. Ya avisamos al equipo: te escribiremos '
                                      'para confirmarlo.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        suscripcion.fecha_cancelacion = timezone.now()
        suscripcion.plan_programado = None
        suscripcion.save(update_fields=['fecha_cancelacion', 'plan_programado'])
        _actualizar_proximo_cobro(suscripcion)
        return Response({'mensaje': f'Tu plan {actual.nombre} sigue hasta el fin del período pagado; después pasas a {nuevo.nombre}.'})

    excesos = _excesos(request.user, nuevo)
    if excesos:
        return Response({'error': f'Antes de pasar a {nuevo.nombre} debes ajustar tu cuenta: tienes '
                                  f'{" y ".join(excesos)}. Desvincula trabajadores o desactiva empresas y vuelve a intentarlo.'},
                        status=status.HTTP_400_BAD_REQUEST)
    monto = _precio_del_ciclo(nuevo, suscripcion.ciclo)
    if not monto:
        return Response({'error': f'El plan {nuevo.nombre} no tiene pago {suscripcion.ciclo.lower()}.'},
                        status=status.HTTP_400_BAD_REQUEST)
    try:
        reveniu.cambiar_monto(suscripcion.gateway_subscription_id, monto)
    except Exception:
        logger.exception('No se pudo cambiar el monto de %s', suscripcion.gateway_subscription_id)
        return Response({'error': 'No pudimos programar el cambio en este momento. Intenta de nuevo en unos minutos '
                                  'o escríbenos.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    suscripcion.plan_programado = nuevo
    suscripcion.save(update_fields=['plan_programado'])
    _actualizar_proximo_cobro(suscripcion)
    return Response({'mensaje': f'Listo: desde el próximo cobro pasas al plan {nuevo.nombre}.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cancelar_cambio_plan(request):
    """Deshace una bajada programada: el próximo cobro vuelve al monto del plan actual."""
    cliente, suscripcion = _suscripcion_pagada(request)
    if not cliente:
        return suscripcion
    if not suscripcion.plan_programado_id:
        return Response({'error': 'No tienes un cambio de plan programado.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        reveniu.cambiar_monto(suscripcion.gateway_subscription_id,
                              _precio_del_ciclo(suscripcion.plan, suscripcion.ciclo))
    except Exception:
        logger.exception('No se pudo restaurar el monto de %s', suscripcion.gateway_subscription_id)
        return Response({'error': 'No pudimos deshacer el cambio en este momento. Intenta de nuevo en unos minutos.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    suscripcion.plan_programado = None
    suscripcion.save(update_fields=['plan_programado'])
    return Response({'mensaje': f'Sigues en el plan {suscripcion.plan.nombre}.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reanudar_renovacion(request):
    """Vuelve a renovar el plan a quien canceló la renovación, sin un cobro
    nuevo: la misma suscripción sigue cobrando en su fecha. Si Reveniu no lo
    confirma, se avisa al equipo para hacerlo a mano (nunca se abre otra
    suscripción, que cobraría de nuevo el período ya pagado)."""
    cliente, suscripcion = _suscripcion_pagada(request)
    if not cliente:
        return suscripcion
    if not suscripcion.fecha_cancelacion:
        return Response({'error': 'Tu plan ya se renueva automáticamente.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        reveniu.reactivar_renovacion(suscripcion.gateway_subscription_id)
    except Exception:
        logger.exception('No se pudo reactivar la renovación de %s', suscripcion.gateway_subscription_id)
        _avisar_pagos(f'Reanudar la renovación de {cliente.rut}',
                      f'La cuenta {cliente.rut} pidió reanudar su plan {suscripcion.plan.nombre} '
                      f'({suscripcion.ciclo.lower()}). La API no lo confirmó: reactiva la renovación de la '
                      f'suscripción {suscripcion.gateway_subscription_id} en Reveniu y quita la fecha de '
                      f'cancelación en el admin.')
        return Response({'error': 'No pudimos reanudarla automáticamente. Ya avisamos al equipo: la dejaremos '
                                  'renovándose sin cobrarte de nuevo y te confirmaremos por correo.'},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE)
    suscripcion.fecha_cancelacion = None
    suscripcion.save(update_fields=['fecha_cancelacion'])
    return Response({'mensaje': f'Tu plan {suscripcion.plan.nombre} vuelve a renovarse automáticamente.'})
