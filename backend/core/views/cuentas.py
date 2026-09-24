"""Cuenta del cliente: login, registro, recuperación por RUT, perfil y diagnóstico de red."""
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import AnonRateThrottle
from django.contrib.auth.models import User
from django.db import transaction, IntegrityError
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from ..models import Plan, Suscripcion, Cliente
from django.contrib.auth.forms import PasswordResetForm
from django.conf import settings
from ..rut import es_rut_de_persona, formatear_rut, normalizar_rut_usuario, validar_rut
from decouple import config
from dj_rest_auth.views import LoginView as DjRestLoginView

from .base import LoginAccountRateThrottle, LoginRateThrottle, PasswordResetAccountRateThrottle, PasswordResetRateThrottle, RegisterAccountRateThrottle, RegisterRateThrottle, _plan_activo


# ==========================================
# LOGIN CON RATE LIMITING
# ==========================================

class ThrottledLoginView(DjRestLoginView):
    throttle_classes = [LoginRateThrottle, LoginAccountRateThrottle]


@api_view(['GET'])
@permission_classes([AllowAny])
def diagnostico_red(request):
    """Muestra la cadena de proxies con que llega una solicitud. Apagado por defecto.

    El límite de intentos identifica al cliente por IP. Sin NUM_PROXIES, DRF
    usa el encabezado X-Forwarded-For completo, que el cliente puede escribir:
    cambiándolo en cada intento se esquiva el límite por IP. Para fijar
    NUM_PROXIES hay que saber cuántos proxies agregan su IP en producción
    (Vercel → Railway), y un valor mal puesto haría que todos los usuarios
    compartan un mismo límite.

    Se enciende con DIAGNOSTICO_RED=1 en Railway, se consulta una vez y se
    apaga. Solo devuelve los encabezados del propio solicitante.
    """
    if config('DIAGNOSTICO_RED', default='0') != '1':
        return Response(status=status.HTTP_404_NOT_FOUND)
    return Response({
        'remote_addr': request.META.get('REMOTE_ADDR'),
        'x_forwarded_for': request.headers.get('x-forwarded-for'),
        'x_real_ip': request.headers.get('x-real-ip'),
        'x_vercel_forwarded_for': request.headers.get('x-vercel-forwarded-for'),
        # Cloudflare (proxy delante de api.jornada40.cl) informa aquí la IP del visitante.
        'cf_connecting_ip': request.headers.get('cf-connecting-ip'),
        'true_client_ip': request.headers.get('true-client-ip'),
        'cf_ray': request.headers.get('cf-ray'),
        'host': request.get_host(),
        'ident_actual_drf': AnonRateThrottle().get_ident(request),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def recuperacion_por_correo_cerrada(request):
    """La recuperación por correo quedó cerrada: se recupera solo por RUT.

    El correo no identifica a una cuenta (puede repetirse entre cuentas).
    Se responde 410 en vez de dejar activa la ruta de dj-rest-auth.
    """
    return Response({'error': 'La recuperación de contraseña es solo por RUT: usa /api/auth/recuperar-por-rut/.'},
                    status=status.HTTP_410_GONE)


# ==========================================
# REGISTRO DE NUEVOS CLIENTES
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle, RegisterAccountRateThrottle])
def registrar_cliente(request):
    rut = (request.data.get('rut') or '').strip()
    password = request.data.get('password')
    # Atrapamos el correo (por si React lo manda como 'email' o como 'correo')
    email = request.data.get('email') or request.data.get('correo')
    nombres=request.data.get('nombres', '')
    apellido_paterno = request.data.get('apellido_paterno', '')
    apellido_materno = request.data.get('apellido_materno', '')
    # El modelo ya tenía estos campos pero el registro los descartaba: el
    # formulario enviaba tipo_cliente y siempre quedaba PERSONA.
    tipo_cliente = request.data.get('tipo_cliente', 'PERSONA')
    if tipo_cliente not in dict(Cliente.TIPO_CLIENTE_CHOICES):
        tipo_cliente = 'PERSONA'
    razon_social = (request.data.get('razon_social') or '').strip() if tipo_cliente == 'EMPRESA' else ''
    telefono = (request.data.get('telefono') or '').strip()[:20]

    # Validaciones básicas
    # La razón social se exige en el formulario, no aquí: el registro anterior
    # envía EMPRESA por defecto sin razón social, y Railway y Vercel despliegan
    # por separado. Exigirla aquí rompería el registro mientras conviven.
    if not rut or not password or not email:
        return Response({'error': 'Faltan datos obligatorios (RUT, contraseña o correo)'}, status=400)

    # El servidor valida lo mismo que el formulario: nada impide llamar a la
    # API directamente, y el RUT es el usuario con que se inicia sesión.
    if not validar_rut(rut):
        return Response({'error': 'El RUT no es válido: revisa el dígito verificador.'}, status=400)
    # Un solo formato guardado (12.345.678-5): es el que busca el login.
    rut = formatear_rut(rut)
    if not es_rut_de_persona(rut):
        return Response({'error': (
            'Ese RUT corresponde a una empresa. Regístrate con tu RUT personal: '
            'las empresas se agregan después, desde tu cuenta.'
        )}, status=400)
    try:
        validate_email(email)
    except DjangoValidationError:
        return Response({'error': 'El correo no es válido.'}, status=400)
    try:
        validate_password(password, user=User(username=rut, email=email, first_name=nombres))
    except DjangoValidationError as exc:
        return Response({'error': ' '.join(exc.messages)}, status=400)

    try:
        with transaction.atomic():
            # 1. Creamos el acceso en la tabla core_users (User de Django)
            user = User.objects.create_user(
                username=rut, 
                password=password,
                email=email
            )

            plan_semilla, creado = Plan.objects.get_or_create(
                nombre='Semilla',
                defaults={
                    'max_empresas': 1,
                    'limite_trabajadores': 3,
                    'precio': 0,
                    'nivel': 1,
                    'activo': True,
                }
            )
            if not creado and plan_semilla.nivel != 1:
                plan_semilla.nivel = 1
                plan_semilla.save(update_fields=['nivel'])
            
            # 2. Creamos el perfil en core_cliente 
            cliente = Cliente.objects.create(
                usuario=user,
                rut=rut,
                correo=email,
                nombres=nombres,
                apellido_paterno=apellido_paterno,
                apellido_materno=apellido_materno,
                tipo_cliente=tipo_cliente,
                razon_social=razon_social or None,
                telefono=telefono or None,
                plan=plan_semilla  # Asignamos el plan "Semilla" por defecto (usando el objeto obtenido o creado arriba
            )
            user.first_name = nombres
            user.last_name = f"{apellido_paterno} {apellido_materno}".strip()
            user.save(update_fields=['first_name', 'last_name'])

            # La suscripción nace con la cuenta. Antes solo se creaba al abrir
            # la página de suscripción, y el webhook de Reveniu (que actualiza
            # una suscripción existente) fallaba si el pago llegaba antes.
            Suscripcion.objects.create(cliente=cliente, plan=plan_semilla, estado='ACTIVE')
            
           
        return Response({'mensaje': 'Cliente creado con éxito'}, status=201)
        
    except IntegrityError:
        return Response({'error': 'Este RUT ya está registrado en el sistema.'}, status=400)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([PasswordResetRateThrottle, PasswordResetAccountRateThrottle])
def recuperar_password_por_rut(request):
    """Envía el enlace de recuperación al correo registrado del titular.

    Responde exactamente lo mismo exista o no el RUT, y no muestra el correo
    (ni enmascarado): antes el 404 frente al 200 con "and***@dominio" dejaba
    averiguar qué RUT tienen cuenta y parte de su correo con solo probar RUT.
    """
    respuesta = Response({'mensaje': 'Si el RUT está registrado, enviamos un enlace al correo asociado.'},
                         status=200)
    rut = normalizar_rut_usuario(request.data.get('rut'))
    if not validar_rut(rut):
        return Response({'error': 'El RUT no es válido: revisa el dígito verificador.'}, status=400)

    cliente = Cliente.objects.filter(rut=rut).select_related('usuario').first()
    if not cliente or not cliente.correo:
        return respuesta
    user = cliente.usuario
    if user.email != cliente.correo:
        user.email = cliente.correo
        user.save(update_fields=['email'])

    # Se arma el correo para este usuario puntual: PasswordResetForm buscaría
    # por correo y, con correos repetidos entre cuentas, mandaría enlaces de
    # todas ellas.
    form = PasswordResetForm({'email': user.email})
    if form.is_valid():
        form.get_users = lambda email: [user]
        form.save(
            request=request,
            use_https=True,
            from_email=settings.DEFAULT_FROM_EMAIL,
            email_template_name='registration/password_reset_email.html',
            html_email_template_name='registration/password_reset_email.html',
        )
    return respuesta

@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def perfil_usuario(request):
    """Datos del titular de la cuenta. El RUT no se cambia: es el usuario de ingreso."""
    cliente = getattr(request.user, 'perfil_cliente', None)
    if not cliente:
        return Response({'error': 'Perfil no encontrado en la tabla Cliente'}, status=404)

    def datos():
        plan = _plan_activo(request.user)
        return {
            'rut': cliente.rut,
            'tipo_cliente': cliente.tipo_cliente,
            'nombres': cliente.nombres or '',
            'apellido_paterno': cliente.apellido_paterno or '',
            'apellido_materno': cliente.apellido_materno or '',
            'razon_social': cliente.razon_social or '',
            'email': request.user.email or cliente.correo or '',
            'telefono': cliente.telefono or '',
            'direccion': cliente.direccion or '',
            'plan_nombre': plan.nombre if plan else '',
        }

    if request.method == 'GET':
        return Response(datos())

    d = request.data
    tipo = d.get('tipo_cliente', cliente.tipo_cliente)
    if tipo not in dict(Cliente.TIPO_CLIENTE_CHOICES):
        return Response({'error': 'Tipo de cliente inválido.'}, status=400)
    nombres = str(d.get('nombres', cliente.nombres) or '').strip()
    if not nombres:
        return Response({'error': 'Ingresa el nombre del titular.'}, status=400)
    razon_social = str(d.get('razon_social', cliente.razon_social) or '').strip()
    if tipo == 'EMPRESA' and not razon_social:
        return Response({'error': 'Ingresa la razón social.'}, status=400)
    email = str(d.get('email', request.user.email) or '').strip().lower()
    if email:
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({'error': 'El correo no es válido.'}, status=400)

    cliente.tipo_cliente = tipo
    cliente.nombres = nombres
    for campo in ('apellido_paterno', 'apellido_materno', 'telefono', 'direccion'):
        if campo in d:
            setattr(cliente, campo, str(d.get(campo) or '').strip())
    cliente.razon_social = razon_social
    cliente.correo = email or cliente.correo
    cliente.save()

    # El usuario de Django guarda una copia para el correo de recuperación.
    request.user.first_name = nombres
    request.user.last_name = f"{cliente.apellido_paterno or ''} {cliente.apellido_materno or ''}".strip()
    if email:
        request.user.email = email
    request.user.save()
    return Response({'mensaje': 'Perfil actualizado.', **datos()})
