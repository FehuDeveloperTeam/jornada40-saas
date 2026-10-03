"""Ley Karin (Ley 21.643): aviso semestral de los canales de denuncia.

El empleador debe informar cada semestre, a todos sus trabajadores, los canales
para denunciar acoso sexual, acoso laboral y violencia en el trabajo, y las
instancias estatales (Art. 211-A inc. 4° del Código del Trabajo; DS 21 de 2024,
Art. 6 letra c), dejando un documento que evidencie la entrega (Circular
SUSESO 3813). Jornada40 redacta el aviso con el canal interno que registra la
empresa y lo envía a firma como constancia de recepción. Plan Pyme en adelante.
"""
import datetime

from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import DocumentoLaboral, Empleado, Empresa, SolicitudFirma
from .base import _plan_permite

NIVEL_LEY_KARIN = 3


def semestre(fecha):
    """('2026-2', '2° semestre de 2026', inicio, fin)."""
    n = 1 if fecha.month <= 6 else 2
    inicio = datetime.date(fecha.year, 1 if n == 1 else 7, 1)
    fin = datetime.date(fecha.year, 6, 30) if n == 1 else datetime.date(fecha.year, 12, 31)
    return f'{fecha.year}-{n}', f'{n}° semestre de {fecha.year}', inicio, fin


def _mutual(empresa):
    return empresa.get_mutual_display() if empresa.mutual != '00' else 'el Instituto de Seguridad Laboral (ISL)'


def clausulas_canales(empresa, texto_semestre):
    return [
        f'Conforme al artículo 211-A del Código del Trabajo y al DS 21 de 2024, {empresa.nombre_legal} informa los '
        'canales para denunciar el acoso sexual, el acoso laboral y la violencia en el trabajo, y las instancias '
        f'estatales disponibles. Esta información corresponde al {texto_semestre}.',
        f'Canal interno de la empresa: {empresa.denuncias_responsable}, correo electrónico {empresa.denuncias_correo}. '
        'La denuncia puede hacerse por escrito o verbalmente; si es verbal, se dejará por escrito. La empresa '
        'adoptará medidas de resguardo, guardará reserva e investigará o remitirá la denuncia a la Dirección del '
        'Trabajo, según su protocolo y reglamento interno.',
        'Dirección del Trabajo: en el sitio www.dt.gob.cl (Mi DT) o en cualquier Inspección del Trabajo, tanto para '
        'denuncias de acoso o violencia como para denunciar cualquier incumplimiento de la normativa laboral.',
        f'Organismo administrador de la Ley 16.744: {_mutual(empresa)}, que otorga atención psicológica temprana y '
        'las prestaciones por accidentes del trabajo y enfermedades profesionales.',
        'Superintendencia de Seguridad Social (SUSESO): en el sitio www.suseso.cl, para reclamos sobre prestaciones '
        'de seguridad social.',
        'El trabajador declara haber recibido esta información.',
    ]


def _estado(doc):
    firma = doc.solicitudes_firma.exclude(estado='CANCELADO').order_by('-enviado_en').first() if doc else None
    return firma.estado if firma else ('SIN_ENVIAR' if doc else None)


def avance_semestre(empresa, clave):
    docs = {d.empleado_id: d for d in DocumentoLaboral.objects.filter(
        empleado__empresa=empresa, tipo='CANALES_DENUNCIA', activo=True, datos__semestre=clave).order_by('id')}
    SolicitudFirma.actualizar_estados(SolicitudFirma.objects.filter(documento_laboral__in=docs.values()))
    filas = [{'id': e.id, 'nombre': ' '.join(p for p in (e.nombres, e.apellido_paterno) if p).strip().title(),
              'correo': bool(e.email), 'estado': _estado(docs.get(e.id))}
             for e in Empleado.objects.filter(empresa=empresa, activo=True).order_by('apellido_paterno', 'nombres')]
    return {'total': len(filas), 'firmados': sum(1 for f in filas if f['estado'] == 'FIRMADO'),
            'enviados': sum(1 for f in filas if f['estado'] in ('PENDIENTE', 'PROCESANDO', 'FIRMADO')),
            'trabajadores': filas}


class LeyKarinViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def _empresa(self, request, empresa_id):
        return Empresa.objects.filter(pk=empresa_id or 0, owner=request.user).first()

    def list(self, request):
        empresa = self._empresa(request, request.query_params.get('empresa'))
        if empresa is None:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        clave, texto, inicio, fin = semestre(timezone.localdate())
        return Response({
            'permitido': _plan_permite(request.user, NIVEL_LEY_KARIN),
            'canal': {'responsable': empresa.denuncias_responsable, 'correo': empresa.denuncias_correo},
            'semestre': {'clave': clave, 'texto': texto, 'hasta': fin.isoformat()},
            'avance': avance_semestre(empresa, clave),
            'mutual': _mutual(empresa),
        })

    @action(detail=False, methods=['post'])
    def canal(self, request):
        """Guarda el canal interno de denuncias (persona o cargo y correo)."""
        empresa = self._empresa(request, request.data.get('empresa'))
        if empresa is None:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        responsable = str(request.data.get('responsable') or '').strip()
        correo = str(request.data.get('correo') or '').strip().lower()
        if not responsable or len(responsable) > 120:
            return Response({'error': 'Indique la persona o el cargo que recibe las denuncias.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_email(correo)
        except DjangoValidationError:
            return Response({'error': 'Indique un correo válido para recibir denuncias.'},
                            status=status.HTTP_400_BAD_REQUEST)
        empresa.denuncias_responsable, empresa.denuncias_correo = responsable, correo
        empresa.save(update_fields=['denuncias_responsable', 'denuncias_correo'])
        return Response({'responsable': responsable, 'correo': correo})

    @action(detail=False, methods=['post'])
    def informar(self, request):
        """Envía el aviso del semestre a firma de quienes aún no lo tienen."""
        from .firmas import SolicitudFirmaViewSet, _ErrorFirma, confirmacion_vigente, datos_emisor, \
            falta_confirmacion
        empresa = self._empresa(request, request.data.get('empresa'))
        if empresa is None:
            return Response({'error': 'Empresa no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if not _plan_permite(request.user, NIVEL_LEY_KARIN):
            return Response({'error': 'Disponible desde el plan Pyme.'}, status=status.HTTP_403_FORBIDDEN)
        if not (empresa.denuncias_responsable and empresa.denuncias_correo):
            return Response({'error': 'Primero registre el canal interno de denuncias.'},
                            status=status.HTTP_400_BAD_REQUEST)
        confirmado_en = confirmacion_vigente(request)
        if confirmado_en is None:
            return falta_confirmacion()
        hoy = timezone.localdate()
        clave, texto, inicio, fin = semestre(hoy)
        vista = SolicitudFirmaViewSet()
        enviadas, omitidas, sin_correo = 0, [], []
        for fila in avance_semestre(empresa, clave)['trabajadores']:
            if fila['estado'] in ('FIRMADO', 'PENDIENTE', 'PROCESANDO'):
                continue
            emp = Empleado.objects.get(pk=fila['id'])
            if not emp.email:
                omitidas.append({'nombre': fila['nombre'], 'motivo': 'No tiene correo registrado.'})
                continue
            DocumentoLaboral.objects.filter(empleado=emp, tipo='CANALES_DENUNCIA', activo=True,
                                            datos__semestre=clave).update(activo=False)
            doc = DocumentoLaboral.objects.create(
                empleado=emp, tipo='CANALES_DENUNCIA', fecha_emision=hoy, vigente_desde=inicio, vigente_hasta=fin,
                datos={'semestre': clave, 'clausulas': clausulas_canales(empresa, texto),
                       'resumen': f'Canales de denuncia · {texto}'})
            try:
                s = vista._crear_solicitud(request.user, emp, 'CANALES_DENUNCIA', documento_laboral_id=doc.id,
                                           emision=datos_emisor(request, confirmado_en))
                enviadas += 1
                if not s.correo_enviado:
                    sin_correo.append(fila['nombre'])
            except _ErrorFirma as e:
                omitidas.append({'nombre': fila['nombre'], 'motivo': e.mensaje})
        return Response({'enviadas': enviadas, 'omitidas': omitidas, 'correo_fallido': sin_correo})
