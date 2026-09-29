"""Certificado N°6 del SII (sueldos y otras rentas similares) y resumen para la DJ 1887.

Formato: instrucciones del SII para el Certificado N°6 (Art. 101 LIR) y la DJ 1887.
- Col. 1 mes; 2 renta bruta (sueldos y accesorias, sin exentas ni no gravadas);
  3 cotizaciones de cargo del trabajador (AFP, salud, seguro de cesantía); 4 = 2 − 3,
  renta afecta al Impuesto Único; 5 impuesto retenido; 6 mayor retención (Art. 88);
  7 renta exenta; 8 renta no gravada (no imponibles: colación, movilización, asignación
  familiar…); 9 rebaja zonas extremas (D.L. 889); 10 factor de actualización; 11–16 las
  columnas 4–9 multiplicadas por el factor.
- Jornada40 no registra mayor retención, rentas exentas ni D.L. 889: van en 0.
- Se numera correlativo por empresa; si cambian los datos se emite uno nuevo (otro número)
  que reemplaza al anterior. Emisión a más tardar el 14 de marzo; la DJ 1887 vence el 27 de
  marzo y sus totales deben coincidir con las columnas 11 a 16.
- Los factores del año se cargan en el admin (FactorActualizacionSII); sin los 12 meses no se emite.
"""
import io
import zipfile
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Max
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import CertificadoSueldos, Contrato, Empleado, Empresa, FactorActualizacionSII, Liquidacion
from ..rut import formatear_rut
from .base import _html_a_pdf_bytes, logger, respuesta_pdf

_MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre',
          'Noviembre', 'Diciembre']
COLUMNAS = ['renta_bruta', 'cotizaciones', 'renta_afecta', 'impuesto', 'mayor_retencion', 'renta_exenta',
            'renta_no_gravada', 'zonas_extremas']
ACTUALIZADAS = ['renta_afecta', 'impuesto', 'mayor_retencion', 'renta_exenta', 'renta_no_gravada', 'zonas_extremas']


def factores_del_anio(anio):
    """{mes: Decimal} si están los 12 meses; si no, None."""
    factores = {f.mes: f.factor for f in FactorActualizacionSII.objects.filter(anio=anio)}
    return factores if len(factores) == 12 else None


def _entero(valor):
    return int(Decimal(valor).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def filas_del_anio(emp, anio, factores):
    """Las 12 filas del certificado (meses sin liquidación en blanco) y los totales."""
    liqs = {l.mes: l for l in Liquidacion.objects.filter(empleado=emp, anio=anio)}
    filas, totales = [], {c: 0 for c in COLUMNAS + [f'{c}_act' for c in ACTUALIZADAS]}
    for mes in range(1, 13):
        liq = liqs.get(mes)
        if liq is None:
            filas.append({'mes': mes, 'nombre': _MESES[mes - 1], 'vacio': True})
            continue
        bruta = int(liq.total_imponible or 0)
        cotizaciones = int((liq.afp_monto or 0) + (liq.salud_monto or 0) + (liq.seguro_cesantia or 0))
        fila = {
            'mes': mes, 'nombre': _MESES[mes - 1], 'vacio': False,
            'renta_bruta': bruta, 'cotizaciones': cotizaciones, 'renta_afecta': max(bruta - cotizaciones, 0),
            'impuesto': int(liq.impuesto_unico or 0), 'mayor_retencion': 0, 'renta_exenta': 0,
            'renta_no_gravada': max(int(liq.total_haberes or 0) - bruta, 0), 'zonas_extremas': 0,
            'factor': str(factores[mes]),
        }
        for c in ACTUALIZADAS:
            fila[f'{c}_act'] = _entero(Decimal(fila[c]) * factores[mes])
        for c in totales:
            totales[c] += fila[c]
        filas.append(fila)
    return filas, totales


def _horas_diciembre(emp):
    contrato = Contrato.objects.filter(empleado=emp).first()
    if not contrato or contrato.tipo_jornada == 'ART_22':
        return 99      # excluido del límite de jornada o sin horas pactadas (instrucciones DJ 1887)
    return int(Decimal(contrato.horas_semanales or 0).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def datos_certificado(emp, anio, factores):
    empresa = emp.empresa
    filas, totales = filas_del_anio(emp, anio, factores)
    return {
        'anio': anio,
        'empresa': {'nombre': empresa.nombre_legal.upper(), 'rut': formatear_rut(empresa.rut),
                    'direccion': ', '.join(p for p in (empresa.direccion, empresa.comuna) if p),
                    'giro': empresa.giro or '', 'representante': empresa.representante_legal or '',
                    'rut_representante': formatear_rut(empresa.rut_representante) if empresa.rut_representante else ''},
        'trabajador': {'nombre': ' '.join(p for p in (emp.nombres, emp.apellido_paterno, emp.apellido_materno)
                                          if p).strip().title(), 'rut': formatear_rut(emp.rut)},
        'filas': filas, 'totales': totales, 'horas_diciembre': _horas_diciembre(emp),
        'jornada_parcial': Contrato.objects.filter(empleado=emp, tipo_jornada='PARCIAL').exists(),
    }


def anios_con_liquidaciones(empresa):
    hoy = timezone.localdate()
    return sorted({a for a in Liquidacion.objects.filter(empleado__empresa=empresa).values_list('anio', flat=True)
                   if a < hoy.year}, reverse=True)


def vigentes(empresa, anio):
    """El último certificado de cada trabajador para el año (los reemplazados quedan de historial)."""
    ultimo = {}
    for c in CertificadoSueldos.objects.filter(empresa=empresa, anio=anio).select_related('empleado').order_by('numero'):
        ultimo[c.empleado_id] = c
    return list(ultimo.values())


@transaction.atomic
def emitir(empresa, anio):
    """Emite los certificados del año; si un trabajador ya tiene uno con los mismos datos, se conserva."""
    factores = factores_del_anio(anio)
    Empresa.objects.select_for_update().get(pk=empresa.pk)    # numeración correlativa sin choques
    siguiente = (CertificadoSueldos.objects.filter(empresa=empresa).aggregate(m=Max('numero'))['m'] or 0) + 1
    actuales = {c.empleado_id: c for c in vigentes(empresa, anio)}
    creados, iguales = 0, 0
    ids = Liquidacion.objects.filter(empleado__empresa=empresa, anio=anio).values_list('empleado_id', flat=True)
    for emp in Empleado.objects.filter(id__in=set(ids)).select_related('empresa').order_by('apellido_paterno', 'nombres'):
        datos = datos_certificado(emp, anio, factores)
        previo = actuales.get(emp.id)
        if previo and previo.datos == datos:
            iguales += 1
            continue
        CertificadoSueldos.objects.create(empresa=empresa, empleado=emp, anio=anio, numero=siguiente, datos=datos,
                                          reemplaza=previo)
        siguiente += 1
        creados += 1
    return creados, iguales


def _formato_cl(datos):
    """Copia para imprimir: miles con punto y el factor con coma decimal."""
    def fmt(v, clave=''):
        if isinstance(v, bool):
            return v
        if isinstance(v, int) and clave not in ('mes', 'anio', 'horas_diciembre'):
            return f'{v:,}'.replace(',', '.')
        if clave == 'factor':
            return str(v).replace('.', ',')
        if isinstance(v, dict):
            return {k: fmt(x, k) for k, x in v.items()}
        if isinstance(v, list):
            return [fmt(x) for x in v]
        return v
    return fmt(datos)


def pdf_certificado_sueldos(cert):
    from .certificados import _firma_legible
    empresa = cert.empresa
    html = render_to_string('certificado_sueldos.html', {
        'd': _formato_cl(cert.datos), 'numero': cert.numero, 'firma': _firma_legible(empresa.firma_imagen),
        'firmante': (empresa.firma_firmante_nombre or empresa.representante_legal or '').title(),
        'cargo': empresa.firma_firmante_cargo or 'Representante legal',
        'ciudad': str(empresa.ciudad or empresa.comuna or 'Santiago').strip().title(),
        'fecha': timezone.localtime(cert.emitido_en).strftime('%d-%m-%Y'),
        'reemplaza': cert.reemplaza.numero if cert.reemplaza_id else None,
    })
    return _html_a_pdf_bytes(html, f'Certificado6_{cert.numero}')


def dato(cert):
    t = cert.datos.get('totales', {})
    return {'id': cert.id, 'numero': cert.numero, 'anio': cert.anio, 'empleado': cert.empleado_id,
            'trabajador': cert.datos.get('trabajador', {}).get('nombre', ''), 'rut': cert.datos.get('trabajador', {}).get('rut', ''),
            'renta_afecta_act': t.get('renta_afecta_act', 0), 'impuesto_act': t.get('impuesto_act', 0),
            'emitido_en': cert.emitido_en.isoformat(), 'reemplaza': cert.reemplaza.numero if cert.reemplaza_id else None}


# ── API del empleador ────────────────────────────────────────────────────────

def _empresa(request, valor):
    return Empresa.objects.filter(pk=valor or 0, owner=request.user).first()


def _anio(valor):
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def estado(request):
    empresa = _empresa(request, request.query_params.get('empresa'))
    if empresa is None:
        return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
    anios = anios_con_liquidaciones(empresa)
    anio = _anio(request.query_params.get('anio')) or (anios[0] if anios else timezone.localdate().year - 1)
    con_liq = set(Liquidacion.objects.filter(empleado__empresa=empresa, anio=anio).values_list('empleado_id', flat=True))
    emitidos = sorted(vigentes(empresa, anio), key=lambda c: c.numero)
    return Response({
        'anio': anio, 'anios': anios, 'factores_completos': factores_del_anio(anio) is not None,
        'anio_cerrado': anio < timezone.localdate().year,
        'plazo_certificados': f'14-03-{anio + 1}', 'plazo_dj1887': f'27-03-{anio + 1}',
        'trabajadores': len(con_liq), 'sin_certificado': len(con_liq - {c.empleado_id for c in emitidos}),
        'certificados': [dato(c) for c in emitidos],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def emitir_vista(request):
    empresa = _empresa(request, request.data.get('empresa'))
    anio = _anio(request.data.get('anio'))
    if empresa is None or anio is None:
        return Response({'error': 'Indica la empresa y el año.'}, status=status.HTTP_400_BAD_REQUEST)
    if anio >= timezone.localdate().year:
        return Response({'error': 'El certificado se emite cuando termina el año.'}, status=status.HTTP_400_BAD_REQUEST)
    if factores_del_anio(anio) is None:
        return Response({'error': f'Aún no están cargados los factores de actualización del SII para {anio}. '
                                  'Se publican en enero; te avisaremos cuando estén.'},
                        status=status.HTTP_400_BAD_REQUEST)
    creados, iguales = emitir(empresa, anio)
    return Response({'creados': creados, 'sin_cambios': iguales})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pdf_vista(request, certificado_id):
    cert = CertificadoSueldos.objects.filter(pk=certificado_id, empresa__owner=request.user).select_related(
        'empresa', 'reemplaza').first()
    if cert is None:
        return Response({'error': 'Certificado no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    return respuesta_pdf(pdf_certificado_sueldos(cert), f'Certificado6_{cert.anio}_{cert.numero}.pdf')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def zip_vista(request):
    empresa = _empresa(request, request.query_params.get('empresa'))
    anio = _anio(request.query_params.get('anio'))
    if empresa is None or anio is None:
        return Response({'error': 'Indica la empresa y el año.'}, status=status.HTTP_400_BAD_REQUEST)
    certs = vigentes(empresa, anio)
    if not certs:
        return Response({'error': 'Aún no hay certificados emitidos para ese año.'}, status=status.HTTP_404_NOT_FOUND)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        for c in certs:
            try:
                z.writestr(f"Certificado6_{anio}_{c.numero}_{c.datos['trabajador']['rut']}.pdf", pdf_certificado_sueldos(c))
            except Exception:
                logger.exception('Certificado N°6 %s: no se pudo generar el PDF', c.pk)
    respuesta = HttpResponse(buf.getvalue(), content_type='application/zip')
    respuesta['Content-Disposition'] = f'attachment; filename="Certificados6_{anio}.zip"'
    respuesta['Access-Control-Expose-Headers'] = 'Content-Disposition'
    return respuesta


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def resumen_dj1887(request):
    """Planilla de apoyo para llenar la DJ 1887 (no es el archivo de carga del SII)."""
    import openpyxl
    from openpyxl.styles import Font
    empresa = _empresa(request, request.query_params.get('empresa'))
    anio = _anio(request.query_params.get('anio'))
    if empresa is None or anio is None:
        return Response({'error': 'Indica la empresa y el año.'}, status=status.HTTP_400_BAD_REQUEST)
    certs = sorted(vigentes(empresa, anio), key=lambda c: c.numero)
    if not certs:
        return Response({'error': 'Emite primero los certificados del año.'}, status=status.HTTP_404_NOT_FOUND)
    libro = openpyxl.Workbook()
    hoja = libro.active
    hoja.title = f'DJ1887 {anio}'
    hoja.append([f'Resumen para la Declaración Jurada 1887 · {empresa.nombre_legal} · RUT {formatear_rut(empresa.rut)} · '
                 f'año comercial {anio} (vence el 27-03-{anio + 1})'])
    encabezado = (['N°', 'RUT trabajador', 'Nombre', 'Renta total neta pagada (act.)', 'Impuesto único retenido (act.)',
                   'Mayor retención (act.)', 'Renta total no gravada (act.)', 'Renta total exenta (act.)',
                   'Rebaja zonas extremas (act.)'] + [f'{m} (sin actualizar)' for m in _MESES] +
                  [f'Período {m}' for m in _MESES] + ['N° certificado', 'Horas semanales a diciembre'])
    hoja.append(encabezado)
    for celda in hoja[2]:
        celda.font = Font(bold=True)
    finiquitados = {e.id: e.fecha_desvinculacion for e in Empleado.objects.filter(id__in=[c.empleado_id for c in certs])}
    for n, c in enumerate(certs, start=1):
        d, t = c.datos, c.datos['totales']
        horas = d.get('horas_diciembre', 99)
        siglas, montos = [], []
        fin = finiquitados.get(c.empleado_id)
        for f in d['filas']:
            montos.append('' if f['vacio'] else f['renta_afecta'] + f['zonas_extremas'])
            if f['vacio']:
                siglas.append('')
            elif fin and fin.year == anio and fin.month == f['mes']:
                siglas.append('F')
            else:
                siglas.append('P' if d.get('jornada_parcial') else 'C')   # no agrícola: parcial o completa
        hoja.append([n, d['trabajador']['rut'], d['trabajador']['nombre'], t['renta_afecta_act'], t['impuesto_act'],
                     t['mayor_retencion_act'], t['renta_no_gravada_act'], t['renta_exenta_act'], t['zonas_extremas_act']]
                    + montos + siglas + [c.numero, horas])
    hoja.append([])
    hoja.append(['Totales', '', '', sum(c.datos['totales']['renta_afecta_act'] for c in certs),
                 sum(c.datos['totales']['impuesto_act'] for c in certs)])
    hoja.append(['Nota: planilla de apoyo generada por Jornada40 con las liquidaciones emitidas. Revísala y cárgala en el '
                 'formulario 1887 del SII; no es el archivo de importación oficial.'])
    buf = io.BytesIO()
    libro.save(buf)
    respuesta = HttpResponse(buf.getvalue(),
                             content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    respuesta['Content-Disposition'] = f'attachment; filename="Resumen_DJ1887_{anio}.xlsx"'
    respuesta['Access-Control-Expose-Headers'] = 'Content-Disposition'
    return respuesta
