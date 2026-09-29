"""Certificados que el trabajador genera desde su portal, sin intervención del empleador.

Cada certificado se arma solo con datos firmes del sistema (contrato, liquidaciones
firmadas, saldo de feriado calculado) y lleva la firma que el empleador configuró,
un folio y un código de verificación. `CertificadoEmitido.datos` guarda lo que el
certificado afirma: el PDF se reconstruye desde ahí y la página pública
/verificar/<código> lo muestra, para que un tercero confirme que es auténtico.
Sin firma del empleador, o sin los datos necesarios, no se emite y se explica por qué.
"""
import base64
import io
import logging
import secrets

from django.conf import settings
from django.template.loader import get_template
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from ..jornada import horas_por_dia
from ..models import CertificadoEmitido, Contrato, Empleado, Finiquito, Liquidacion, SolicitudFirma, VacacionEmpleado
from ..rut import formatear_rut
from .base import _html_a_pdf_bytes, respuesta_pdf
from .portal_trabajador import _con_sesion, _nombre, fichas_accesibles

logger = logging.getLogger(__name__)

_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
          'noviembre', 'diciembre']
_DIAS = [('lunes', 'Lunes'), ('martes', 'Martes'), ('miercoles', 'Miércoles'), ('jueves', 'Jueves'),
         ('viernes', 'Viernes'), ('sabado', 'Sábado'), ('domingo', 'Domingo')]
OPCIONES_MESES = [('3', 'Últimos 3 meses'), ('6', 'Últimos 6 meses'), ('12', 'Últimos 12 meses')]
_TEXTO_TIPO = dict(CertificadoEmitido.TIPOS)
_ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'   # sin 0/O ni 1/I: se copia a mano


SIN_FIRMA = 'Tu empleador aún no configura su firma electrónica, sin la cual no se emiten certificados.'


class NoDisponible(Exception):
    """El certificado no se puede emitir; el mensaje se muestra al trabajador."""


# ── Formatos ─────────────────────────────────────────────────────────────────

def _fecha(d):
    return f'{d.day} de {_MESES[d.month - 1]} de {d.year}' if d else '—'


def _pesos(n):
    return '$' + f'{int(n or 0):,}'.replace(',', '.')


def _periodo(anio, mes):
    return f'{_MESES[mes - 1].capitalize()} {anio}'


def _duracion(desde, hasta):
    meses = (hasta.year - desde.year) * 12 + hasta.month - desde.month - (hasta.day < desde.day)
    anios, meses = divmod(max(meses, 0), 12)
    partes = ([f'{anios} año{"s" if anios != 1 else ""}'] if anios else []) + \
             ([f'{meses} mes{"es" if meses != 1 else ""}'] if meses or not anios else [])
    return ' y '.join(partes)


def _rut_oculto(rut):
    """12.345.678-5 → ••.•••.678-5: basta para cotejar con el carnet."""
    r = formatear_rut(rut)
    cuerpo, _, dv = r.rpartition('-')
    visibles = cuerpo[-3:]
    return ''.join('•' if c.isdigit() else c for c in cuerpo[:-3]) + visibles + '-' + dv


def _horas(h):
    h = float(h or 0)
    return f'{h:g}'.replace('.', ',')


def _nuevo_codigo():
    crudo = ''.join(secrets.choice(_ALFABETO) for _ in range(12))
    return f'{crudo[:4]}-{crudo[4:8]}-{crudo[8:]}'


def url_verificacion(codigo):
    return f"{getattr(settings, 'SITIO_URL', 'https://jornada40.cl').rstrip('/')}/verificar/{codigo}"


# ── Datos del trabajador ─────────────────────────────────────────────────────

def _contrato(emp):
    return Contrato.objects.filter(empleado=emp).first()


def _liquidaciones_firmadas(emp):
    """{(anio, mes): liquidación} de meses cerrados con la liquidación firmada."""
    hoy = timezone.localdate()
    ids = set(SolicitudFirma.objects.filter(empleado=emp, tipo_documento='LIQUIDACION', estado='FIRMADO')
              .values_list('liquidacion_id', flat=True))
    return {(l.anio, l.mes): l for l in Liquidacion.objects.filter(empleado=emp, id__in=ids)
            if (l.anio, l.mes) < (hoy.year, hoy.month)}


def _inicio_relacion(emp, contrato):
    fechas = [f for f in (emp.fecha_ingreso, contrato.fecha_inicio if contrato else None) if f]
    return min(fechas) if fechas else None


def _ventana(emp, n):
    """Las n liquidaciones firmadas consecutivas más recientes, de la más antigua a la más nueva."""
    firmadas = _liquidaciones_firmadas(emp)
    if not firmadas:
        raise NoDisponible('Aún no tienes liquidaciones firmadas. Fírmalas en Inicio o pídelas en Solicitudes.')
    anio, mes = max(firmadas)
    meses = []
    for _ in range(n):
        meses.append((anio, mes))
        anio, mes = (anio - 1, 12) if mes == 1 else (anio, mes - 1)
    inicio = _inicio_relacion(emp, _contrato(emp))
    if inicio and meses[-1] < (inicio.year, inicio.month):
        raise NoDisponible(f'Tu relación laboral no alcanza {n} meses con liquidación.')
    faltan = [m for m in meses if m not in firmadas]
    if faltan:
        texto = ', '.join(_periodo(a, m).lower() for a, m in sorted(faltan))
        raise NoDisponible(f'Faltan liquidaciones firmadas de {texto}. Fírmalas en Inicio o pídelas en Solicitudes.')
    return [firmadas[m] for m in reversed(meses)]


def _meses_opcion(opcion):
    if opcion not in dict(OPCIONES_MESES):
        raise NoDisponible('Elige el período del certificado.')
    return int(opcion)


# ── Contenido de cada certificado ────────────────────────────────────────────

def _base(emp, tipo):
    empresa = emp.empresa
    if not empresa.firma_imagen:
        raise NoDisponible(SIN_FIRMA)
    hoy = timezone.localdate()
    return {
        'tipo': tipo, 'titulo': _TEXTO_TIPO[tipo], 'emitido': _fecha(hoy), 'emitido_iso': hoy.isoformat(),
        'ciudad': str(empresa.ciudad or empresa.comuna or 'Santiago').strip().title(),
        'empresa': {'nombre': empresa.nombre_legal.upper(), 'rut': formatear_rut(empresa.rut),
                    'direccion': ', '.join(p for p in (empresa.direccion, empresa.comuna) if p)},
        'trabajador': {'nombre': _nombre(emp), 'rut': formatear_rut(emp.rut)},
        'firmante': {'nombre': (empresa.firma_firmante_nombre or empresa.representante_legal or '').title(),
                     'cargo': empresa.firma_firmante_cargo or 'Representante legal'},
        'cuerpo': [], 'filas': [], 'tabla': None, 'nota': '',
    }


def _intro(d, texto):
    t = d['trabajador']
    d['cuerpo'].append(f"{d['empresa']['nombre']}, RUT {d['empresa']['rut']}, certifica que "
                       f"don(ña) {t['nombre']}, RUT {t['rut']}, {texto}")


def _cierre(d):
    d['cuerpo'].append('Se extiende el presente certificado a petición del interesado, para los fines que estime '
                       'convenientes.')


def _cert_antiguedad(emp, opcion):
    contrato = _contrato(emp)
    if not emp.activo or not contrato:
        raise NoDisponible('Se emite solo con una relación laboral vigente y un contrato registrado.')
    d = _base(emp, 'ANTIGUEDAD')
    hoy = timezone.localdate()
    ingreso = emp.fecha_ingreso or contrato.fecha_inicio
    tipo = contrato.get_tipo_contrato_display()
    _intro(d, f'presta servicios en esta empresa desde el {_fecha(ingreso)} hasta la fecha, desempeñando el cargo '
              f'de {(contrato.cargo or emp.cargo or "").title()}.')
    d['filas'] = [['Fecha de ingreso', _fecha(ingreso)], ['Antigüedad', _duracion(ingreso, hoy)],
                  ['Cargo', (contrato.cargo or emp.cargo or '').title()], ['Tipo de contrato', tipo]]
    if contrato.tipo_contrato == 'PLAZO_FIJO' and contrato.fecha_fin:
        d['filas'].append(['Vencimiento del contrato', _fecha(contrato.fecha_fin)])
    if contrato.tipo_jornada == 'ART_22':
        d['filas'].append(['Jornada', 'Excluida del límite de jornada (Art. 22 inciso 2°)'])
    else:
        d['filas'].append(['Jornada', f'{_horas(contrato.horas_semanales)} horas semanales'])
    _cierre(d)
    return d


def _cert_renta(emp, opcion):
    n = _meses_opcion(opcion)
    liqs = _ventana(emp, n)
    d = _base(emp, 'RENTA')
    primero, ultimo = liqs[0], liqs[-1]
    _intro(d, f'percibió en esta empresa, entre {_periodo(primero.anio, primero.mes).lower()} y '
              f'{_periodo(ultimo.anio, ultimo.mes).lower()}, las remuneraciones que se detallan, según sus '
              'liquidaciones de sueldo firmadas.')
    d['tabla'] = {'columnas': ['Mes', 'Total imponible', 'Total haberes', 'Líquido a pagar'],
                  'filas': [[_periodo(l.anio, l.mes), _pesos(l.total_imponible), _pesos(l.total_haberes),
                             _pesos(l.sueldo_liquido)] for l in liqs],
                  'pie': ['Promedio', _pesos(sum(l.total_imponible for l in liqs) / n),
                          _pesos(sum(l.total_haberes for l in liqs) / n), _pesos(sum(l.sueldo_liquido for l in liqs) / n)]}
    _cierre(d)
    return d


def _cert_cotizaciones(emp, opcion):
    n = _meses_opcion(opcion)
    liqs = _ventana(emp, n)
    d = _base(emp, 'COTIZACIONES')
    _intro(d, 'registra en sus liquidaciones de sueldo firmadas los siguientes descuentos previsionales, '
              'declarados por el empleador.')
    d['tabla'] = {'columnas': ['Mes', 'Imponible', 'AFP', 'Salud', 'Seguro de cesantía'],
                  'filas': [[_periodo(l.anio, l.mes), _pesos(l.total_imponible),
                             f'{_pesos(l.afp_monto)} ({(l.afp_nombre or "—").title()})',
                             f'{_pesos(l.salud_monto)} ({(l.salud_nombre or "—").title()})',
                             _pesos(l.seguro_cesantia)] for l in liqs],
                  'pie': None}
    d['nota'] = ('Este certificado informa las cotizaciones descontadas y declaradas en las liquidaciones de sueldo. '
                 'No acredita su pago: el pago lo certifican la AFP, la institución de salud o Previred.')
    _cierre(d)
    return d


def _cert_vacaciones(emp, opcion):
    from .feriado import calcular_saldo_vacaciones
    if not _contrato(emp):
        raise NoDisponible('Se emite con un contrato registrado.')
    try:
        saldo = calcular_saldo_vacaciones(emp)
    except Exception:
        logger.exception('Certificado de vacaciones, ficha %s', emp.id)
        raise NoDisponible('No pudimos calcular tu saldo de vacaciones. Pídele a tu empleador que revise tu ficha.')
    d = _base(emp, 'VACACIONES')
    hoy = timezone.localdate()
    _intro(d, f'registra al {_fecha(hoy)} el siguiente estado de su feriado anual (Arts. 67 y siguientes del '
              'Código del Trabajo).')
    d['filas'] = [['Días ganados', str(saldo['dias_devengados'])], ['Días usados', str(saldo['dias_usados'])],
                  ['Saldo disponible', f"{saldo['dias_disponibles']} días hábiles"]]
    if saldo.get('dias_progresivos_anuales'):
        d['filas'].insert(1, ['Feriado progresivo del año', f"{saldo['dias_progresivos_anuales']} días"])
    tomadas = VacacionEmpleado.objects.filter(
        empleado=emp, estado='APROBADO', tipo__in=['VACACION_LEGAL', 'VACACION_PROGRESIVA'],
        fecha_inicio__gte=hoy.replace(year=hoy.year - 2, day=1)).order_by('fecha_inicio')
    if tomadas:
        d['tabla'] = {'columnas': ['Desde', 'Hasta', 'Días hábiles', 'Tipo'],
                      'filas': [[_fecha(v.fecha_inicio), _fecha(v.fecha_fin), str(v.dias_habiles),
                                 v.get_tipo_display()] for v in tomadas], 'pie': None}
    _cierre(d)
    return d


def _cert_jornada(emp, opcion):
    contrato = _contrato(emp)
    if not emp.activo or not contrato:
        raise NoDisponible('Se emite solo con una relación laboral vigente y un contrato registrado.')
    d = _base(emp, 'JORNADA')
    if contrato.tipo_jornada == 'ART_22':
        _intro(d, 'presta servicios excluido(a) del límite de jornada, conforme al Art. 22 inciso 2° del Código '
                  'del Trabajo, sin horario fijo de entrada ni de salida.')
        d['filas'] = [['Tipo de jornada', contrato.get_tipo_jornada_display()]]
        _cierre(d)
        return d
    _intro(d, f'presta servicios con una jornada ordinaria de {_horas(contrato.horas_semanales)} horas semanales, '
              'distribuida como se indica.')
    d['filas'] = [['Tipo de jornada', contrato.get_tipo_jornada_display()],
                  ['Horas semanales', _horas(contrato.horas_semanales)],
                  ['Días de trabajo a la semana', str(contrato.distribucion_dias)]]
    horario = contrato.distribucion_horario or {}
    netas = horas_por_dia(horario)
    filas = [[nombre, horario[clave].get('entrada', ''), horario[clave].get('salida', ''),
              f"{int(horario[clave].get('colacion') or 0)} min", _horas(netas[clave])]
             for clave, nombre in _DIAS if clave in netas]
    if filas:
        d['tabla'] = {'columnas': ['Día', 'Entrada', 'Salida', 'Colación', 'Horas'], 'filas': filas, 'pie': None}
    _cierre(d)
    return d


def _cert_termino(emp, opcion):
    if emp.activo or not emp.fecha_desvinculacion:
        raise NoDisponible('Se emite cuando la relación laboral terminó.')
    contrato = _contrato(emp)
    finiquito = Finiquito.objects.filter(empleado=emp).order_by('-fecha_termino').first()
    termino = finiquito.fecha_termino if finiquito else emp.fecha_desvinculacion
    inicio = emp.fecha_ingreso or (contrato.fecha_inicio if contrato else None)
    cargo = ((contrato.cargo if contrato else '') or emp.cargo or '').title()
    d = _base(emp, 'TERMINO')
    # Sin causal a propósito: el certificado no debe perjudicar al trabajador al buscar empleo.
    _intro(d, f'prestó servicios en esta empresa entre el {_fecha(inicio)} y el {_fecha(termino)}, desempeñando '
              f'el cargo de {cargo}.')
    d['filas'] = [['Fecha de ingreso', _fecha(inicio)], ['Fecha de término', _fecha(termino)],
                  ['Período trabajado', _duracion(inicio, termino) if inicio else '—'], ['Cargo', cargo]]
    _cierre(d)
    return d


_CONSTRUCTORES = {'ANTIGUEDAD': _cert_antiguedad, 'RENTA': _cert_renta, 'VACACIONES': _cert_vacaciones,
                  'JORNADA': _cert_jornada, 'TERMINO': _cert_termino, 'COTIZACIONES': _cert_cotizaciones}
_CON_OPCIONES = {'RENTA', 'COTIZACIONES'}


def contenido(emp, tipo, opcion=''):
    """Lo que el certificado afirma hoy; lanza NoDisponible con el motivo."""
    return _CONSTRUCTORES[tipo](emp, opcion)


# ── PDF ──────────────────────────────────────────────────────────────────────

def _qr_png(texto):
    """QR en PNG (data URI) con el codificador de reportlab y Pillow, sin dependencias nuevas."""
    from PIL import Image
    from reportlab.graphics.barcode import qr
    widget = qr.QrCodeWidget(texto, barLevel='M')
    widget.qr.make()
    modulos = widget.qr.modules
    n, borde, escala = len(modulos), 4, 6
    img = Image.new('1', (n + 2 * borde, n + 2 * borde), 1)
    for r, fila in enumerate(modulos):
        for c, oscuro in enumerate(fila):
            if oscuro:
                img.putpixel((c + borde, r + borde), 0)
    img = img.resize((img.width * escala, img.height * escala), Image.NEAREST)
    salida = io.BytesIO()
    img.save(salida, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(salida.getvalue()).decode()


def _firma_legible(data_uri):
    """La imagen de firma solo si se puede decodificar: una dañada no debe impedir el certificado."""
    from PIL import Image
    try:
        cabecera, _, datos = (data_uri or '').partition(',')
        if not cabecera.startswith('data:image/') or ';base64' not in cabecera:
            return ''
        Image.open(io.BytesIO(base64.b64decode(datos))).verify()
        return data_uri
    except Exception:
        logger.warning('Firma del empleador ilegible; el certificado sale sin la imagen')
        return ''


def pdf_certificado(cert):
    url = url_verificacion(cert.codigo)
    html = get_template('certificado.html').render({
        'd': cert.datos, 'folio': cert.folio, 'codigo': cert.codigo, 'url': url, 'qr': _qr_png(url),
        'firma': _firma_legible(cert.empleado.empresa.firma_imagen),
        'anulado': _fecha(timezone.localtime(cert.anulado_en).date()) if cert.anulado_en else '',
        'motivo_anulacion': cert.get_motivo_anulacion_display(),
    })
    return _html_a_pdf_bytes(html, cert.folio)


def emitir(emp, tipo, opcion, cuenta=None):
    """Crea el certificado (o devuelve el de hoy si afirma lo mismo)."""
    datos = contenido(emp, tipo, opcion)
    hoy = timezone.localdate()
    for previo in CertificadoEmitido.objects.filter(empleado=emp, tipo=tipo, opcion=opcion, anulado_en__isnull=True)[:5]:
        if timezone.localtime(previo.emitido_en).date() == hoy and previo.datos == datos:
            return previo
    for _ in range(5):
        codigo = _nuevo_codigo()
        if not CertificadoEmitido.objects.filter(codigo=codigo).exists():
            break
    return CertificadoEmitido.objects.create(empleado=emp, cuenta=cuenta, tipo=tipo, opcion=opcion,
                                             codigo=codigo, datos=datos)


def dato_certificado(c):
    return {'id': c.id, 'folio': c.folio, 'tipo': c.tipo, 'titulo': c.get_tipo_display(),
            'opcion': c.opcion, 'opcion_texto': dict(OPCIONES_MESES).get(c.opcion, ''),
            'codigo': c.codigo, 'emitido_en': c.emitido_en.isoformat(),
            'anulado_en': c.anulado_en.isoformat() if c.anulado_en else None,
            'motivo_anulacion': c.get_motivo_anulacion_display() if c.anulado_en else ''}


# ── Portal del trabajador ────────────────────────────────────────────────────

def _disponibilidad(emp, tipo, opcion=''):
    try:
        contenido(emp, tipo, opcion)
        return {'disponible': True, 'motivo': ''}
    except NoDisponible as e:
        return {'disponible': False, 'motivo': str(e)}


def _opciones_de(emp):
    salida = []
    for tipo, texto in CertificadoEmitido.TIPOS:
        if tipo == 'TERMINO' and emp.activo or tipo in ('ANTIGUEDAD', 'JORNADA') and not emp.activo:
            continue    # no aplica a su situación: ni se ofrece
        item = {'tipo': tipo, 'texto': texto}
        if tipo in _CON_OPCIONES:
            item['opciones'] = [{'valor': v, 'texto': t, **_disponibilidad(emp, tipo, v)} for v, t in OPCIONES_MESES]
            item['disponible'] = any(o['disponible'] for o in item['opciones'])
            item['motivo'] = '' if item['disponible'] else item['opciones'][0]['motivo']
        else:
            item.update(_disponibilidad(emp, tipo))
        salida.append(item)
    return salida


@api_view(['GET', 'POST'])
@_con_sesion
def certificados_trabajador(request):
    fichas = fichas_accesibles(request.user)
    if request.method == 'POST':
        emp = next((e for e in fichas if str(e.id) == str(request.data.get('empleo'))), None)
        tipo, opcion = request.data.get('tipo'), str(request.data.get('opcion') or '')
        if emp is None or tipo not in _CONSTRUCTORES:
            return Response({'error': 'Elige el empleo y el certificado.'}, status=status.HTTP_400_BAD_REQUEST)
        if tipo not in _CON_OPCIONES:
            opcion = ''
        try:
            cert = emitir(emp, tipo, opcion, request.user)
        except NoDisponible as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({**dato_certificado(cert), 'empresa': emp.empresa.nombre_legal.title()},
                        status=status.HTTP_201_CREATED)
    emitidos = CertificadoEmitido.objects.filter(empleado__in=fichas).select_related('empleado__empresa')[:50]
    from .certificado_sueldos import vigentes
    sii = []
    for e in fichas:
        for anio in sorted(set(e.certificados_sueldos.values_list('anio', flat=True)), reverse=True):
            sii += [{'id': c.id, 'numero': c.numero, 'anio': c.anio, 'empresa': e.empresa.nombre_legal.title()}
                    for c in vigentes(e.empresa, anio) if c.empleado_id == e.id]
    return Response({
        'sueldos_sii': sii,
        # Sin firma del empleador no se emite ninguno: se avisa una vez, no en cada certificado.
        'opciones': [{'empleo': e.id, 'empresa': e.empresa.nombre_legal.title(),
                      'aviso': '' if e.empresa.firma_imagen else SIN_FIRMA,
                      'certificados': _opciones_de(e) if e.empresa.firma_imagen else []} for e in fichas],
        'emitidos': [{**dato_certificado(c), 'empresa': c.empleado.empresa.nombre_legal.title()} for c in emitidos],
    })


# ── Verificación pública ─────────────────────────────────────────────────────

class VerificarCertificadoThrottle(AnonRateThrottle):
    scope = 'verificar_certificado'


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([VerificarCertificadoThrottle])
def verificar_certificado(request, codigo):
    cert = (CertificadoEmitido.objects.filter(codigo=str(codigo).strip().upper()).select_related('empleado').first())
    if cert is None:
        return Response({'valido': False, 'error': 'No existe un certificado con ese código.'},
                        status=status.HTTP_404_NOT_FOUND)
    d = cert.datos
    if cert.anulado_en:
        # Anulado: se informa que no es válido, sin repetir lo que afirmaba.
        return Response({
            'valido': False, 'anulado': True, 'folio': cert.folio, 'codigo': cert.codigo, 'titulo': d['titulo'],
            'emitido': d['emitido'], 'empresa': d['empresa'],
            'anulado_en': _fecha(timezone.localtime(cert.anulado_en).date()),
            'motivo_anulacion': cert.get_motivo_anulacion_display(),
        })
    return Response({
        'valido': True, 'anulado': False, 'folio': cert.folio, 'codigo': cert.codigo, 'titulo': d['titulo'],
        'emitido': d['emitido'], 'empresa': d['empresa'],
        'trabajador': {'nombre': d['trabajador']['nombre'], 'rut': _rut_oculto(d['trabajador']['rut'])},
        'filas': d['filas'], 'tabla': d['tabla'], 'nota': d['nota'],
    })


# ── Panel del empleador ──────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def certificados_empleado(request, empleado_id):
    """Certificados que el trabajador emitió desde su portal (solo lectura)."""
    emp = Empleado.objects.filter(pk=empleado_id, empresa__owner=request.user).first()
    if emp is None:
        return Response({'error': 'Trabajador no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    return Response([dato_certificado(c) for c in CertificadoEmitido.objects.filter(empleado=emp)[:100]])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def descargar_certificado_empleador(request, certificado_id):
    cert = CertificadoEmitido.objects.filter(pk=certificado_id, empleado__empresa__owner=request.user) \
        .select_related('empleado__empresa').first()
    if cert is None:
        return Response({'error': 'Certificado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    return respuesta_pdf(pdf_certificado(cert), f'{cert.folio}.pdf')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def anular_certificado(request, certificado_id):
    """El empleador anula un certificado (p. ej. con un dato ya corregido). No se borra:
    la verificación pública pasa a informarlo como no válido y el trabajador puede emitir otro."""
    cert = CertificadoEmitido.objects.filter(pk=certificado_id, empleado__empresa__owner=request.user,
                                             anulado_en__isnull=True).first()
    if cert is None:
        return Response({'error': 'Certificado no encontrado o ya anulado.'}, status=status.HTTP_404_NOT_FOUND)
    motivo = request.data.get('motivo')
    if motivo not in dict(CertificadoEmitido.MOTIVOS_ANULACION):
        return Response({'error': 'Elige el motivo de la anulación.'}, status=status.HTTP_400_BAD_REQUEST)
    cert.anulado_en, cert.motivo_anulacion = timezone.now(), motivo
    cert.save(update_fields=['anulado_en', 'motivo_anulacion'])
    return Response(dato_certificado(cert))


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def motivos_anulacion_certificado(request):
    return Response([{'valor': v, 'texto': t} for v, t in CertificadoEmitido.MOTIVOS_ANULACION])
