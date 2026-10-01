"""Expedientes de denuncias Ley Karin: solo el encargado, con la sesión del acceso Ley Karin.

`/api/karin/denuncias/…`: registrar, medidas de resguardo, decidir (investigar o
derivar), investigación (investigador, participantes, citaciones, antecedentes,
actas firmadas), informe (Art. 16 DS 21), envío y pronunciamiento de la DT,
medidas y cierre. Las reglas y plazos están en core/denuncias_karin.py; cada
acción queda en la bitácora reservada (RegistroKarin) solo con el folio.
"""
import datetime
import hashlib
import uuid

from django.db import transaction
from django.db.models import Max
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .. import denuncias_karin as dk
from .. import documentos_karin
from ..cifrado import cifrar_bytes, descifrar_bytes
from ..karin import registrar_karin
from ..models import ArchivoKarin, DenunciaKarin, Empresa
from .acceso_karin import EsEncargado, KarinSesionThrottle, SesionKarin
from .base import logger

MAX_ARCHIVO = 15 * 1024 * 1024
_HITOS = {
    # hito: (texto para la bitácora, condición)
    'denunciante_informado_en': ('Informó por escrito a quien denunció la decisión adoptada', lambda h, d: True),
    'inicio_informado_dt_en': ('Informó a la DT el inicio de la investigación',
                               lambda h, d: h.get('decision') == 'INTERNA'),
    'investigador_informado_en': ('Informó por escrito quién investiga',
                                  lambda h, d: h.get('decision') == 'INTERNA' and (d.investigacion or {}).get('investigador')),
    'informe_emitido_en': ('Emitió el informe de investigación',
                           lambda h, d: h.get('decision') == 'INTERNA' and d.informe
                           and (d.investigacion or {}).get('investigador')),
    'informe_enviado_dt_en': ('Remitió el informe a la DT', lambda h, d: bool(h.get('informe_emitido_en'))),
    'partes_notificadas_en': ('Notificó las conclusiones a las partes', lambda h, d: bool(h.get('informe_enviado_dt_en'))),
    'resultado_dt_en': ('Registró el resultado de la investigación de la DT', lambda h, d: h.get('decision') == 'DT'),
}
_REQUISITO = {
    'inicio_informado_dt_en': 'Primero registre que la investigará la empresa.',
    'investigador_informado_en': 'Primero registre a quien investiga.',
    'informe_emitido_en': 'Primero complete el informe y a quien investiga.',
    'informe_enviado_dt_en': 'Primero emita el informe.',
    'partes_notificadas_en': 'Primero remita el informe a la DT.',
    'resultado_dt_en': 'Solo para denuncias derivadas a la DT.',
}


def _ip(request):
    return request.META.get('REMOTE_ADDR', '')


def _catalogo(lista):
    return [{'valor': v, 'texto': t} for v, t in lista]


def _archivo(a):
    return {'id': a.id, 'tipo': a.tipo, 'tipo_texto': a.get_tipo_display(), 'participante': a.participante,
            'nombre': a.nombre, 'tamano': a.tamano, 'subido_en': timezone.localtime(a.subido_en).isoformat()}


def _fila(d, hoy):
    sig = dk.siguiente_plazo(dk.plazos(d, hoy))
    return {'id': d.id, 'folio': d.folio, 'empresa': d.empresa.alias or d.empresa.nombre_legal, 'tipo': d.tipo,
            'tipo_texto': d.get_tipo_display(), 'estado': d.estado, 'estado_texto': d.get_estado_display(),
            'recibida_en': timezone.localtime(d.recibida_en).isoformat(), 'siguiente': sig}


def _detalle(d, enc):
    hoy = timezone.localdate()
    items = dk.plazos(d, hoy)
    return {**_fila(d, hoy), 'empresa': {'id': d.empresa_id, 'nombre': d.empresa.nombre_legal, 'rut': d.empresa.rut},
            'canal': d.canal, 'canal_texto': d.get_canal_display(), 'pide_derivar_dt': d.pide_derivar_dt,
            'datos': d.datos, 'resguardo': d.resguardo or [], 'investigacion': d.investigacion or {},
            'informe': d.informe, 'medidas': d.medidas, 'hitos': d.hitos, 'plazos': items,
            'derivacion_obligatoria': dk.derivacion_obligatoria(d), 'avisos': dk.avisos(d, enc),
            'archivos': [_archivo(a) for a in d.archivos.filter(activo=True)]}


class DenunciaKarinViewSet(viewsets.ViewSet):
    authentication_classes = [SesionKarin]
    permission_classes = [EsEncargado]
    throttle_classes = [KarinSesionThrottle]
    parser_classes = [JSONParser]

    # ── ayudantes ──
    def _denuncias(self, request):
        enc = request.user
        return DenunciaKarin.objects.filter(cuenta=enc.cuenta, empresa__in=enc.empresas.all()).select_related('empresa')

    def _denuncia(self, request, pk):
        return self._denuncias(request).filter(pk=pk).first()

    def _registrar(self, request, d, texto, accion='EXPEDIENTE'):
        registrar_karin(request.user.cuenta, accion, f'{d.folio}: {texto}', encargado=request.user, ip=_ip(request))

    def _guardar(self, request, d, texto, campos):
        d.estado = dk.estado_de(d)
        d.save(update_fields=[*campos, 'estado', 'actualizado_en'])
        self._registrar(request, d, texto)
        return Response(_detalle(d, request.user))

    def _abierta(self, d):
        if (d.hitos or {}).get('cerrada_en'):
            return Response({'error': 'La denuncia está cerrada.'}, status=status.HTTP_400_BAD_REQUEST)
        return None

    def _obtener(self, request, pk):
        d = self._denuncia(request, pk)
        if d is None:
            return None, Response({'error': 'Denuncia no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        return d, None

    # ── listado y registro ──
    def list(self, request):
        hoy = timezone.localdate()
        qs = self._denuncias(request)
        if request.query_params.get('empresa'):
            qs = qs.filter(empresa_id=request.query_params['empresa'])
        return Response([_fila(d, hoy) for d in qs])

    @action(detail=False, methods=['get'])
    def catalogos(self, request):
        """Listas cerradas del formulario y del expediente."""
        return Response({
            'tipos': _catalogo(DenunciaKarin.TIPOS), 'canales': _catalogo(DenunciaKarin.CANALES),
            'vinculos': _catalogo(dk.VINCULOS), 'representaciones': _catalogo(dk.REPRESENTACIONES),
            'resguardos': _catalogo(dk.RESGUARDOS), 'aplica_a': _catalogo(dk.APLICA_A), 'roles': _catalogo(dk.ROLES),
            'antecedentes': _catalogo(dk.ANTECEDENTES), 'conclusiones': _catalogo(dk.CONCLUSIONES),
            'medidas_correctivas': _catalogo(dk.MEDIDAS_CORRECTIVAS), 'sanciones': _catalogo(dk.SANCIONES),
            'resultados_dt': _catalogo(dk.RESULTADOS_DT), 'archivos': _catalogo(ArchivoKarin.TIPOS),
            'documentos': [{'valor': v, 'texto': t, 'participante': v in documentos_karin.CON_PARTICIPANTE}
                           for v, t in documentos_karin.TIPOS.items()],
            'empresas': [{'id': e.id, 'nombre': e.alias or e.nombre_legal}
                         for e in request.user.empresas.filter(activo=True).order_by('nombre_legal')],
        })

    def create(self, request):
        enc = request.user
        empresa = enc.empresas.filter(pk=request.data.get('empresa') or 0, activo=True).first()
        if empresa is None:
            return Response({'error': 'Elige una de las empresas a tu cargo.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            datos = dk.validar_denuncia(request.data, empresa)
            recibida = datetime.datetime.fromisoformat(str(request.data.get('recibida_en')))
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except (TypeError, ValueError):
            return Response({'error': 'Indica la fecha y hora en que se recibió la denuncia.'},
                            status=status.HTTP_400_BAD_REQUEST)
        recibida = timezone.make_aware(recibida) if timezone.is_naive(recibida) else recibida
        if recibida > timezone.now() + datetime.timedelta(minutes=5):
            return Response({'error': 'La fecha de recepción no puede ser futura.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            Empresa.objects.select_for_update().filter(pk=empresa.pk).first()
            numero = (DenunciaKarin.objects.filter(empresa=empresa).aggregate(n=Max('numero'))['n'] or 0) + 1
            d = DenunciaKarin.objects.create(
                cuenta=enc.cuenta, empresa=empresa, numero=numero, tipo=request.data['tipo'],
                canal=request.data['canal'], recibida_en=recibida, registrada_por=enc, datos=datos,
                pide_derivar_dt=bool(request.data.get('pide_derivar_dt')), hitos={})
        self._registrar(request, d, 'Registró la denuncia', accion='DENUNCIA')
        return Response(_detalle(d, enc), status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        d, error = self._obtener(request, pk)
        if error:
            return error
        self._registrar(request, d, 'Abrió el expediente', accion='CONSULTA')
        return Response(_detalle(d, request.user))

    def partial_update(self, request, pk=None):
        """Completar o corregir los datos de la denuncia (Art. 15: plazo para completar antecedentes)."""
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        try:
            d.datos = dk.validar_denuncia({**request.data, 'tipo': request.data.get('tipo', d.tipo),
                                           'canal': request.data.get('canal', d.canal)}, d.empresa)
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        d.tipo = request.data.get('tipo', d.tipo)
        d.canal = request.data.get('canal', d.canal)
        if 'pide_derivar_dt' in request.data:
            d.pide_derivar_dt = bool(request.data['pide_derivar_dt'])
        return self._guardar(request, d, 'Completó o corrigió los datos de la denuncia',
                             ['datos', 'tipo', 'canal', 'pide_derivar_dt'])

    # ── pasos del procedimiento ──
    @action(detail=True, methods=['post'])
    def resguardo(self, request, pk=None):
        """Medidas de resguardo (Art. 13): la lista completa vigente."""
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        medidas = []
        recibida = timezone.localtime(d.recibida_en).date()
        for m in request.data.get('medidas') or []:
            if (m or {}).get('tipo') not in dict(dk.RESGUARDOS) or m.get('aplica_a') not in dict(dk.APLICA_A):
                return Response({'error': 'Elige cada medida y a quién se aplica.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                fecha = dk._fecha(m.get('fecha'), 'la medida')
            except dk.DatosInvalidos as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
            if fecha < recibida:
                return Response({'error': 'La medida no puede ser anterior a la denuncia.'},
                                status=status.HTTP_400_BAD_REQUEST)
            medidas.append({'tipo': m['tipo'], 'aplica_a': m['aplica_a'], 'fecha': fecha.isoformat()})
        d.resguardo = medidas
        return self._guardar(request, d, 'Registró las medidas de resguardo', ['resguardo'])

    @action(detail=True, methods=['post'])
    def decidir(self, request, pk=None):
        """Investigar en la empresa (INTERNA) o derivar a la DT (DT), Art. 12."""
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        decision = request.data.get('decision')
        if decision not in ('INTERNA', 'DT'):
            return Response({'error': 'Elige investigar en la empresa o derivar a la DT.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if decision == 'INTERNA' and dk.derivacion_obligatoria(d):
            return Response({'error': dk.derivacion_obligatoria(d)}, status=status.HTTP_400_BAD_REQUEST)
        if (d.hitos or {}).get('decision') and (d.hitos or {}).get('decision') != decision \
                and ((d.hitos or {}).get('informe_emitido_en') or (d.hitos or {}).get('resultado_dt_en')):
            return Response({'error': 'La decisión ya no se puede cambiar.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            fecha = dk._fecha(request.data.get('fecha'), 'la decisión')
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if fecha < timezone.localtime(d.recibida_en).date():
            return Response({'error': 'La decisión no puede ser anterior a la denuncia.'},
                            status=status.HTTP_400_BAD_REQUEST)
        d.hitos = {**(d.hitos or {}), 'decision': decision, 'decision_en': fecha.isoformat()}
        texto = 'Decidió investigar en la empresa' if decision == 'INTERNA' else 'Derivó la denuncia a la DT'
        return self._guardar(request, d, texto, ['hitos'])

    @action(detail=True, methods=['post'])
    def marcar(self, request, pk=None):
        """Registra (o deshace) la fecha de un paso: informar, emitir, remitir, notificar…"""
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        hito = request.data.get('hito')
        if hito not in _HITOS:
            return Response({'error': 'Paso no válido.'}, status=status.HTTP_400_BAD_REQUEST)
        texto, condicion = _HITOS[hito]
        hitos = dict(d.hitos or {})
        if request.data.get('deshacer'):
            hitos.pop(hito, None)
            d.hitos = hitos
            return self._guardar(request, d, f'Deshizo: {texto.lower()}', ['hitos'])
        if not condicion(hitos, d):
            return Response({'error': _REQUISITO.get(hito, 'Aún no corresponde.')}, status=status.HTTP_400_BAD_REQUEST)
        try:
            fecha = dk._fecha(request.data.get('fecha'), 'este paso')
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        hitos[hito] = fecha.isoformat()
        d.hitos = hitos
        return self._guardar(request, d, texto, ['hitos'])

    @action(detail=True, methods=['post'])
    def investigador(self, request, pk=None):
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        if (d.hitos or {}).get('decision') != 'INTERNA':
            return Response({'error': 'Primero registre que la investigará la empresa.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            persona = dk._persona(request.data, 'quien investiga', rut_obligatorio=True, con_correo=True)
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        persona['externo'] = bool(request.data.get('externo'))
        d.investigacion = {**(d.investigacion or {}), 'investigador': persona}
        return self._guardar(request, d, 'Designó a quien investiga', ['investigacion'])

    @action(detail=True, methods=['post'])
    def participantes(self, request, pk=None):
        """Agrega una persona a la investigación, o actualiza su citación o declaración ({id, …})."""
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        inv = dict(d.investigacion or {})
        lista = list(inv.get('participantes', []))
        texto = 'Actualizó a una persona de la investigación'
        try:
            if request.data.get('id'):
                p = next((x for x in lista if x['id'] == request.data['id']), None)
                if p is None:
                    return Response({'error': 'Persona no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
                if 'citacion' in request.data:
                    p['citacion'] = dk.citacion(request.data['citacion']) if request.data['citacion'] else None
                    texto = 'Registró una citación'
                if 'declaro_en' in request.data:
                    p['declaro_en'] = (dk._fecha(request.data['declaro_en'], 'la declaración').isoformat()
                                       if request.data['declaro_en'] else None)
                    texto = 'Registró una declaración'
                if request.data.get('quitar'):
                    lista.remove(p)
                    texto = 'Quitó a una persona de la investigación'
            else:
                lista.append(dk.nuevo_participante(request.data))
                texto = 'Agregó a una persona a la investigación'
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        inv['participantes'] = lista
        d.investigacion = inv
        return self._guardar(request, d, texto, ['investigacion'])

    @action(detail=True, methods=['post'])
    def antecedentes(self, request, pk=None):
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        d.investigacion = {**(d.investigacion or {}),
                           'antecedentes': [a for a in request.data.get('antecedentes') or [] if a in dict(dk.ANTECEDENTES)]}
        return self._guardar(request, d, 'Registró los antecedentes revisados', ['investigacion'])

    @action(detail=True, methods=['post'])
    def informe(self, request, pk=None):
        """Borrador del informe (Art. 16 f a i). Se puede editar hasta emitirlo."""
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        if (d.hitos or {}).get('decision') != 'INTERNA':
            return Response({'error': 'El informe corresponde a una investigación de la empresa.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if (d.hitos or {}).get('informe_emitido_en'):
            return Response({'error': 'El informe ya fue emitido.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            informe = dk.validar_informe(request.data)
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        total = len(d.datos.get('denunciados', []))
        if any(s['persona'] >= total for s in informe['sanciones']):
            return Response({'error': 'Revisa la propuesta de sanciones.'}, status=status.HTTP_400_BAD_REQUEST)
        d.informe = informe
        return self._guardar(request, d, 'Guardó el informe de investigación', ['informe'])

    @action(detail=True, methods=['post'])
    def pronunciamiento(self, request, pk=None):
        """Resultado de la revisión de la DT (Art. 18)."""
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        h = dict(d.hitos or {})
        if not h.get('informe_enviado_dt_en'):
            return Response({'error': 'Primero remita el informe a la DT.'}, status=status.HTTP_400_BAD_REQUEST)
        resultado = request.data.get('resultado')
        if resultado not in dict(dk.RESULTADOS_DT):
            return Response({'error': 'Elige el resultado.'}, status=status.HTTP_400_BAD_REQUEST)
        vence = dk.habiles(datetime.date.fromisoformat(h['informe_enviado_dt_en']), dk.PLAZO_PRONUNCIAMIENTO_DT)
        if resultado == 'SIN_PRONUNCIAMIENTO':
            if timezone.localdate() <= vence:
                return Response({'error': f'La DT tiene plazo hasta el {vence:%d-%m-%Y} para pronunciarse.'},
                                status=status.HTTP_400_BAD_REQUEST)
            h.pop('pronunciamiento_en', None)
        else:
            try:
                h['pronunciamiento_en'] = dk._fecha(request.data.get('fecha'), 'la notificación').isoformat()
            except dk.DatosInvalidos as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        h['resultado_dt'] = resultado
        d.hitos = h
        return self._guardar(request, d, 'Registró el pronunciamiento de la DT', ['hitos'])

    @action(detail=True, methods=['post'])
    def medidas(self, request, pk=None):
        """Medidas y sanciones aplicadas e informadas a las partes (Arts. 19 a 22)."""
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        if d.estado != 'MEDIDAS':
            return Response({'error': 'Las medidas se aplican después del pronunciamiento o resultado de la DT.'},
                            status=status.HTTP_400_BAD_REQUEST)
        total = len(d.datos.get('denunciados', []))
        sanciones = []
        for s in request.data.get('sanciones') or []:
            if (s or {}).get('sancion') not in dict(dk.SANCIONES) or not str(s.get('persona', '')).isdigit() \
                    or int(s['persona']) >= total:
                return Response({'error': 'Revisa las sanciones.'}, status=status.HTTP_400_BAD_REQUEST)
            sanciones.append({'persona': int(s['persona']), 'sancion': s['sancion']})
        correctivas = [m for m in request.data.get('correctivas') or [] if m in dict(dk.MEDIDAS_CORRECTIVAS)]
        try:
            fecha = dk._fecha(request.data.get('fecha'), 'aplicación de las medidas')
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if not request.data.get('informadas'):
            return Response({'error': 'Las medidas deben informarse a la persona denunciante y a la denunciada.'},
                            status=status.HTTP_400_BAD_REQUEST)
        d.medidas = {'sanciones': sanciones, 'correctivas': correctivas}
        d.hitos = {**(d.hitos or {}), 'medidas_aplicadas_en': fecha.isoformat()}
        return self._guardar(request, d, 'Registró las medidas aplicadas e informadas', ['medidas', 'hitos'])

    @action(detail=True, methods=['post'])
    def cerrar(self, request, pk=None):
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        if not (d.hitos or {}).get('medidas_aplicadas_en'):
            return Response({'error': 'Primero registre las medidas aplicadas e informadas.'},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            fecha = dk._fecha(request.data.get('fecha'), 'cierre')
        except dk.DatosInvalidos as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        d.hitos = {**d.hitos, 'cerrada_en': fecha.isoformat()}
        return self._guardar(request, d, 'Cerró el expediente', ['hitos'])

    # ── documentos (PDF al vuelo, no se guardan) ──
    @action(detail=True, methods=['get'])
    def documento(self, request, pk=None):
        d, error = self._obtener(request, pk)
        if error:
            return error
        tipo = request.query_params.get('tipo', '')
        try:
            titulo, contenido = documentos_karin.pdf(d, tipo, request.query_params.get('participante', ''),
                                                     request.user)
        except documentos_karin.DocumentoNoDisponible as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        self._registrar(request, d, f'Descargó: {titulo.lower()}', accion='DESCARGA')
        respuesta = HttpResponse(contenido, content_type='application/pdf')
        respuesta['Content-Disposition'] = f'attachment; filename="{d.folio}_{tipo.lower()}.pdf"'
        return respuesta

    # ── archivos (cifrados) ──
    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def archivos(self, request, pk=None):
        from .. import b2_client
        d, error = self._obtener(request, pk)
        if error or (error := self._abierta(d)):
            return error
        archivo = request.FILES.get('archivo')
        tipo = request.data.get('tipo')
        if tipo not in dict(ArchivoKarin.TIPOS):
            return Response({'error': 'Elige qué documento es.'}, status=status.HTTP_400_BAD_REQUEST)
        if archivo is None or archivo.size > MAX_ARCHIVO:
            return Response({'error': 'Sube un PDF o una imagen de hasta 15 MB.'}, status=status.HTTP_400_BAD_REQUEST)
        contenido = archivo.read()
        if not (contenido.startswith(b'%PDF') or contenido[:3] == b'\xff\xd8\xff' or contenido[:8] == b'\x89PNG\r\n\x1a\n'):
            return Response({'error': 'Sube un PDF o una imagen (JPG o PNG).'}, status=status.HTTP_400_BAD_REQUEST)
        participante = str(request.data.get('participante') or '')[:12]
        clave = f'karin/{d.cuenta_id}/{d.id}/{uuid.uuid4().hex}.bin'
        try:
            b2_client.subir_documento(cifrar_bytes(contenido), clave, content_type='application/octet-stream')
        except Exception:
            logger.exception('No se pudo guardar un archivo Ley Karin')
            return Response({'error': 'No pudimos guardar el archivo. Intenta de nuevo.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        ArchivoKarin.objects.create(denuncia=d, tipo=tipo, participante=participante,
                                    nombre=str(archivo.name)[:200], clave=clave, tamano=len(contenido),
                                    huella=hashlib.sha256(contenido).hexdigest(), subido_por=request.user)
        if tipo == 'ACTA_DECLARACION' and participante:
            inv = dict(d.investigacion or {})
            for p in inv.get('participantes', []):
                if p['id'] == participante and not p.get('declaro_en'):
                    p['declaro_en'] = timezone.localdate().isoformat()
            d.investigacion = inv
            d.save(update_fields=['investigacion'])
        self._registrar(request, d, f'Subió un archivo ({dict(ArchivoKarin.TIPOS)[tipo].lower()})')
        return Response(_detalle(d, request.user), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path=r'archivos/(?P<archivo_id>\d+)')
    def descargar_archivo(self, request, pk=None, archivo_id=None):
        from .. import b2_client
        d, error = self._obtener(request, pk)
        if error:
            return error
        a = d.archivos.filter(pk=archivo_id, activo=True).first()
        if a is None:
            return Response({'error': 'Archivo no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        contenido = descifrar_bytes(b2_client.descargar_documento(a.clave))
        tipo = 'application/pdf' if contenido.startswith(b'%PDF') else (
            'image/png' if contenido[:4] == b'\x89PNG' else 'image/jpeg')
        self._registrar(request, d, f'Descargó un archivo ({a.get_tipo_display().lower()})', accion='DESCARGA')
        respuesta = HttpResponse(contenido, content_type=tipo)
        extension = {'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg'}[tipo]
        respuesta['Content-Disposition'] = f'attachment; filename="{d.folio}_{a.tipo.lower()}_{a.id}.{extension}"'
        return respuesta
