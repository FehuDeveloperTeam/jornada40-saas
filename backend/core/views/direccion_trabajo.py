"""Dirección del Trabajo: registro electrónico laboral (Ley 21.327) y
consentimiento para la documentación electrónica (Dictamen 0789/15).

El registro en Mi DT lo hace el empleador (no hay API): aquí se calcula qué
debe registrar y hasta cuándo, se genera el CSV de la carga masiva de
contratos y se deja constancia de lo que ya registró.
"""
import datetime
import io
import math
import zipfile

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .. import registro_dt as dt
from ..models import AnexoContrato, Contrato, DocumentoLegal, Empleado, Empresa, Finiquito, RegistroDT, SolicitudFirma
from .base import _plan_permite, logger
from .feriado import es_feriado_cl
from .parametros import _parametros_previsionales

TEXTO_CONSENTIMIENTO = 'Autorización de documentación laboral electrónica'


def _fecha_local(momento):
    return timezone.localtime(momento).date() if momento else None


def _nombre(empleado):
    return ' '.join(p for p in (empleado.nombres, empleado.apellido_paterno, empleado.apellido_materno) if p).strip()


def _firmas(empresa):
    """Firmas completadas de la empresa, para saber cuándo se celebró cada documento."""
    return list(SolicitudFirma.objects.filter(empresa=empresa, estado='FIRMADO', firmado_en__isnull=False)
                .values('id', 'tipo_documento', 'contrato_id', 'anexo_contrato_id', 'empleado_id', 'firmado_en')
                .order_by('firmado_en'))


def _item(clave, tipo, empleado, detalle, fecha, vence, registros, hoy, **extra):
    registrado = registros.get(clave)
    if registrado:
        estado = 'REGISTRADO'
    elif vence < hoy:
        estado = 'VENCIDO'
    else:
        estado = 'PENDIENTE'
    return {
        'clave': clave, 'tipo': tipo, 'detalle': detalle,
        'empleado': {'id': empleado.id, 'nombre': _nombre(empleado), 'rut': empleado.rut,
                     'activo': empleado.activo},
        'fecha': fecha.isoformat(), 'vence': vence.isoformat(), 'estado': estado,
        'dias_habiles_restantes': None if estado != 'PENDIENTE' else dt.dias_habiles_entre(hoy, vence, es_feriado_cl),
        'registrado_en': registrado.isoformat() if registrado else None,
        **extra,
    }


def items_registro(empresa, hoy=None):
    """Todo lo que la empresa debe registrar en Mi DT, con su plazo y estado."""
    hoy = hoy or timezone.localdate()
    registros = dict(RegistroDT.objects.filter(empresa=empresa).values_list('clave', 'registrado_en'))
    firmas = _firmas(empresa)
    firma_contrato = {f['contrato_id']: f['firmado_en'] for f in firmas if f['tipo_documento'] == 'CONTRATO'}
    firma_anexo = {f['anexo_contrato_id']: f['firmado_en'] for f in firmas if f['tipo_documento'] == 'ANEXO_CONTRATO'}
    items = []

    for c in Contrato.objects.filter(empleado__empresa=empresa).select_related('empleado'):
        firmado = _fecha_local(firma_contrato.get(c.id))
        # Sin firma electrónica, se toma el inicio de la relación laboral.
        fecha = firmado or c.fecha_inicio
        items.append(_item(f'CONTRATO:{c.id}', 'CONTRATO', c.empleado,
                           f'Contrato {c.get_tipo_contrato_display().lower()} · {c.cargo}', fecha,
                           dt.sumar_dias_habiles(fecha, dt.PLAZO_CONTRATO, es_feriado_cl), registros, hoy,
                           cargo=c.cargo, csv=True, firmado=bool(firmado)))

    anexos = AnexoContrato.objects.filter(contrato__empleado__empresa=empresa).select_related('contrato__empleado')
    for a in anexos:
        # Un anexo existe para la ley cuando ambas partes lo firmaron.
        fecha = _fecha_local(firma_anexo.get(a.id)) or (_fecha_local(a.aplicado_en) if a.aplicado else None)
        if not fecha:
            continue
        items.append(_item(f'ANEXO:{a.id}', 'ANEXO', a.contrato.empleado, f'Anexo · {a.titulo}', fecha,
                           dt.sumar_dias_habiles(fecha, dt.PLAZO_ANEXO, es_feriado_cl), registros, hoy))
    empleados = {e.id: e for e in Empleado.objects.filter(empresa=empresa)}
    for f in firmas:
        if f['tipo_documento'] == 'ANEXO_40H' and f['empleado_id'] in empleados:
            fecha = _fecha_local(f['firmado_en'])
            items.append(_item(f'ANEXO40H:{f["id"]}', 'ANEXO', empleados[f['empleado_id']], 'Anexo Ley 40 horas', fecha,
                               dt.sumar_dias_habiles(fecha, dt.PLAZO_ANEXO, es_feriado_cl), registros, hoy))

    finiquitos = {}
    for fin in Finiquito.objects.filter(empleado__empresa=empresa).select_related('documento_legal').order_by('fecha_termino'):
        finiquitos[fin.empleado_id] = fin
    cartas = {}
    for carta in DocumentoLegal.objects.filter(empleado__empresa=empresa, tipo='DESPIDO').order_by('fecha_emision'):
        cartas[carta.empleado_id] = carta
    for emp in empleados.values():
        fin, carta = finiquitos.get(emp.id), cartas.get(emp.id)
        if emp.activo and not fin:
            continue
        causal = (fin.causal_articulo if fin else '') or (carta.causal_articulo if carta else '') or ''
        fecha = (fin.fecha_termino if fin else None) or (carta.fecha_ultimo_dia if carta else None) \
            or emp.fecha_desvinculacion
        if not fecha:
            continue
        plazo = dt.plazo_termino(causal)
        if plazo == 0:
            # Art. 161: se registra al enviar la carta de aviso.
            carta_161 = (fin.documento_legal if fin and fin.documento_legal_id else None) or carta
            vence = carta_161.fecha_emision if carta_161 else fecha
        else:
            vence = dt.sumar_dias_habiles(fecha, plazo, es_feriado_cl)
        glosa = dict(Finiquito._meta.get_field('causal_articulo').choices).get(causal, 'causal sin registrar')
        items.append(_item(f'TERMINO:{emp.id}:{fecha:%Y%m%d}', 'TERMINO', emp, f'Término · {glosa}', fecha, vence,
                           registros, hoy, sin_causal=not causal))

    orden = {'VENCIDO': 0, 'PENDIENTE': 1, 'REGISTRADO': 2}
    items.sort(key=lambda i: (orden[i['estado']], i['vence']))
    return items


def resumen_consentimiento(empresa):
    activos = list(Empleado.objects.filter(empresa=empresa, activo=True).order_by('apellido_paterno', 'nombres'))
    anexos = {}
    for a in (AnexoContrato.objects.filter(contrato__empleado__empresa=empresa, tipo='CONSENTIMIENTO_ELECTRONICO')
              .order_by('creado_en')):
        anexos[a.contrato.empleado_id] = a
    firmas = {s.anexo_contrato_id: s.estado for s in SolicitudFirma.objects.filter(
        anexo_contrato__in=anexos.values()).order_by('enviado_en')}
    sin = []
    for e in activos:
        if e.consentimiento_electronico_en:
            continue
        anexo = anexos.get(e.id)
        sin.append({'id': e.id, 'nombre': _nombre(e), 'rut': e.rut, 'email': e.email or '',
                    'anexo': ({'id': anexo.id, 'firma': firmas.get(anexo.id)} if anexo else None)})
    return {'total': len(activos), 'con': len(activos) - len(sin), 'sin': sin}


def _monto_imponible_pactado(contrato):
    """Sueldo base más la gratificación mensual pactada (Art. 50, con su tope)."""
    base = int(contrato.sueldo_base or 0)
    if contrato.gratificacion_legal != 'MENSUAL':
        return base
    hoy = timezone.localdate()
    p = _parametros_previsionales(hoy.month, hoy.year)
    tope = math.floor(p['factor_gratificacion'] * p['ingreso_minimo_mensual'] / 12)
    return base + min(math.floor(base * 0.25), tope)


class RegistroDTViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _empresa(self, request, datos=None):
        try:
            return Empresa.objects.get(id=(datos or request.query_params).get('empresa'), owner=request.user)
        except (Empresa.DoesNotExist, ValueError, TypeError):
            return None

    def list(self, request):
        empresa = self._empresa(request)
        if not empresa:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        items = items_registro(empresa)
        resumen = {e: sum(1 for i in items if i['estado'] == e) for e in ('VENCIDO', 'PENDIENTE', 'REGISTRADO')}
        resumen['por_vencer'] = sum(1 for i in items if i['estado'] == 'PENDIENTE' and i['dias_habiles_restantes'] <= 3)
        return Response({'items': items, 'resumen': resumen, 'consentimiento': resumen_consentimiento(empresa),
                         'csv_disponible': _plan_permite(request.user, 3)})

    @action(detail=False, methods=['post'])
    def marcar(self, request):
        """Deja constancia de lo registrado en Mi DT (fecha por defecto: hoy)."""
        empresa = self._empresa(request, request.data)
        if not empresa:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        claves = {i['clave'] for i in items_registro(empresa)}
        pedidas = [str(c) for c in (request.data.get('claves') or [])]
        if not pedidas or not set(pedidas) <= claves:
            return Response({'error': 'Elige registros válidos de esta empresa.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            fecha = datetime.date.fromisoformat(str(request.data.get('fecha') or timezone.localdate().isoformat()))
        except ValueError:
            return Response({'error': 'Fecha inválida.'}, status=status.HTTP_400_BAD_REQUEST)
        if fecha > timezone.localdate():
            return Response({'error': 'La fecha de registro no puede ser futura.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            for clave in pedidas:
                RegistroDT.objects.update_or_create(empresa=empresa, clave=clave, defaults={'registrado_en': fecha})
        return Response({'marcados': len(pedidas)})

    @action(detail=False, methods=['post'])
    def desmarcar(self, request):
        empresa = self._empresa(request, request.data)
        if not empresa:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        borrados, _ = RegistroDT.objects.filter(empresa=empresa, clave__in=request.data.get('claves') or []).delete()
        return Response({'desmarcados': borrados})

    @action(detail=False, methods=['get'])
    def csv(self, request):
        """ZIP con un CSV por cargo para la carga masiva de contratos en Mi DT."""
        empresa = self._empresa(request)
        if not empresa:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if not _plan_permite(request.user, 3):
            return Response({'error': 'El archivo para la carga masiva en Mi DT está disponible desde el plan Pyme.'},
                            status=status.HTTP_403_FORBIDDEN)
        items = {i['clave']: i for i in items_registro(empresa) if i['tipo'] == 'CONTRATO'}
        pedidas = [c for c in (request.query_params.get('claves') or '').split(',') if c]
        claves = pedidas or [c for c, i in items.items() if i['estado'] != 'REGISTRADO']
        ids = [int(c.split(':')[1]) for c in claves if c in items]
        if not ids:
            return Response({'error': 'No hay contratos por registrar.'}, status=status.HTTP_400_BAD_REQUEST)
        contratos = Contrato.objects.filter(id__in=ids).select_related('empleado').order_by('cargo', 'empleado__apellido_paterno')

        por_cargo, avisos = {}, []
        for c in contratos:
            item = items[f'CONTRATO:{c.id}']
            fila, advertencias = dt.fila_contrato(c, c.empleado, empresa, datetime.date.fromisoformat(item['fecha']),
                                                  _monto_imponible_pactado(c))
            por_cargo.setdefault(dt.normalizar(c.cargo) or 'SIN CARGO', []).append(fila)
            avisos += [f'{_nombre(c.empleado)} ({c.empleado.rut}): {a}' for a in advertencias]

        rut = empresa.rut.replace('.', '').upper()
        nombre_csv = f'{rut}_{timezone.localdate():%Y%m}.csv'
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as z:
            for cargo, filas in por_cargo.items():
                for n in range(0, len(filas), 1000):   # máximo 1.000 filas por archivo
                    sufijo = f'_parte{n // 1000 + 1}' if len(filas) > 1000 else ''
                    z.writestr(f'{slugify(cargo) or "cargo"}{sufijo}/{nombre_csv}', dt.csv_contratos(filas[n:n + 1000]))
            z.writestr('LEEME.txt', _leeme(empresa, por_cargo, avisos).encode('utf-8'))
        respuesta = HttpResponse(buffer.getvalue(), content_type='application/zip')
        respuesta['Content-Disposition'] = f'attachment; filename="RegistroDT_{rut}_{timezone.localdate():%Y%m%d}.zip"'
        return respuesta

    @action(detail=False, methods=['post'], url_path='anexos_consentimiento')
    def anexos_consentimiento(self, request):
        """Crea el anexo de autorización de documentación electrónica a los
        trabajadores vigentes que no la han dado (y no tienen uno vigente), y
        con `enviar` los manda a firma."""
        from .firmas import SolicitudFirmaViewSet, _ErrorFirma
        empresa = self._empresa(request, request.data)
        if not empresa:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        elegidos = {int(i) for i in (request.data.get('empleados') or [])}
        pendientes = resumen_consentimiento(empresa)['sin']
        creados, enviados, omitidos = 0, 0, []
        vista = SolicitudFirmaViewSet()
        for p in pendientes:
            if elegidos and p['id'] not in elegidos:
                continue
            empleado = Empleado.objects.get(id=p['id'])
            contrato = Contrato.objects.filter(empleado=empleado).first()
            if not contrato:
                omitidos.append({'nombre': p['nombre'], 'motivo': 'No tiene contrato registrado.'})
                continue
            anexo = None
            if p['anexo'] and p['anexo']['firma'] not in ('RECHAZADO', 'EXPIRADO', 'CANCELADO'):
                anexo = AnexoContrato.objects.get(id=p['anexo']['id'])
            if anexo is None:
                anexo = AnexoContrato.objects.create(contrato=contrato, tipo='CONSENTIMIENTO_ELECTRONICO',
                                                     titulo=TEXTO_CONSENTIMIENTO, fecha_emision=timezone.localdate())
                creados += 1
            if not request.data.get('enviar'):
                continue
            if p['anexo'] and p['anexo']['firma'] in ('PENDIENTE', 'PROCESANDO') and anexo.id == p['anexo']['id']:
                omitidos.append({'nombre': p['nombre'], 'motivo': 'Ya tiene el anexo enviado a firma.'})
                continue
            try:
                vista._crear_solicitud(request.user, empleado, 'ANEXO_CONTRATO', anexo_id=anexo.id)
                enviados += 1
            except _ErrorFirma as e:
                omitidos.append({'nombre': p['nombre'], 'motivo': e.mensaje})
        return Response({'creados': creados, 'enviados': enviados, 'omitidos': omitidos})


def _leeme(empresa, por_cargo, avisos):
    lineas = [
        f'Registro masivo de contratos en Mi DT — {empresa.nombre_legal} ({empresa.rut})',
        f'Generado por Jornada40 el {timezone.localtime():%d/%m/%Y %H:%M}.',
        '',
        'Cómo subirlo:',
        '1. Entra a https://midt.dirtrab.cl con tu ClaveÚnica, perfil Empleador → Registro Electrónico Laboral →',
        '   Registro de Contrato de Trabajo → Registro Masivo de Contrato de Trabajo.',
        '2. La carga se hace por cargo: hay una carpeta por cargo. En el formulario elige el representante legal,',
        '   el domicilio, el código de actividad económica y ese cargo; luego sube el CSV de su carpeta.',
        '3. Acepta la declaración jurada y presiona "Cargar archivo". La DT procesa en hasta 7 días y avisa por correo.',
        '4. Cuando la DT confirme, marca los contratos como registrados en Jornada40 (Dirección del Trabajo).',
        '',
        'Archivos: ' + ', '.join(f'{cargo.title()} ({len(filas)})' for cargo, filas in por_cargo.items()),
        '',
    ]
    if avisos:
        lineas += ['Revisa antes de subir (la DT rechaza la fila si falta un dato obligatorio):'] + \
                  [f'- {a}' for a in avisos] + ['']
    lineas += [
        'Supuestos del archivo: trabajadores con RUT chileno, sin subcontratación ni servicios transitorios,',
        'lugar de trabajo en la comuna de la empresa, sin pactos adicionales marcados (OTROS_*) ni instrumento',
        'colectivo. Si alguno no se cumple, corrígelo en el CSV o registra ese contrato de forma individual.',
    ]
    return '\r\n'.join(lineas)


def marcar_consentimiento(empleado, via, momento):
    empleado.consentimiento_electronico_en = momento
    empleado.consentimiento_electronico_via = via
    empleado.save(update_fields=['consentimiento_electronico_en', 'consentimiento_electronico_via'])
    logger.info('Consentimiento electrónico de %s: %s', empleado.pk, via or 'revocado')
