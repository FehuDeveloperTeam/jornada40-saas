"""Trabajadores y su carga masiva desde planilla."""
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework import viewsets
from rest_framework.exceptions import ValidationError
from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string, get_template
from ..models import Empresa, Empleado, Contrato, AnexoContrato, DocumentoLegal, Liquidacion, SolicitudFirma
from xhtml2pdf import pisa
import datetime
import io
import zipfile
import re
import math
from ..jornada import jornada_maxima_vigente
from ..rut import formatear_rut, limpiar_rut, validar_rut
from num2words import num2words
import pandas as pd
from django.db.models import Max, Exists, OuterRef
from django.core.files.base import ContentFile
from ..serializers import EmpleadoSerializer

from .base import _ctx_contrato, _es_plan_semilla, _exigir_cupo_trabajador, _limite_trabajadores, _plan_permite, estandarizar_fecha, logger


# Columnas obligatorias para crear un trabajador desde la planilla. Al
# actualizar uno existente basta el RUT: solo cambian las columnas que traen dato.
_COLUMNAS_OBLIGATORIAS = ('rut', 'nombres', 'apellido_paterno', 'cargo', 'fecha_ingreso', 'sueldo_base', 'horas_laborales')
_CAMPOS_TEXTO_CARGA = ('nombres', 'apellido_paterno', 'apellido_materno', 'nacionalidad', 'departamento',
                       'sucursal', 'cargo', 'forma_pago', 'banco', 'tipo_cuenta')
_NOMBRE_CAMPO = {
    'nombres': 'nombres', 'apellido_paterno': 'apellido paterno', 'apellido_materno': 'apellido materno',
    'email': 'correo', 'sexo': 'sexo', 'nacionalidad': 'nacionalidad', 'fecha_nacimiento': 'fecha de nacimiento',
    'fecha_ingreso': 'fecha de ingreso', 'departamento': 'departamento', 'sucursal': 'sucursal', 'cargo': 'cargo',
    'sueldo_base': 'sueldo', 'horas_laborales': 'horas', 'forma_pago': 'forma de pago', 'banco': 'banco',
    'tipo_cuenta': 'tipo de cuenta', 'numero_cuenta': 'número de cuenta',
}


def _vacio(valor):
    return valor is None or (isinstance(valor, float) and math.isnan(valor)) or str(valor).strip() == ''


def _procesar_carga_masiva(empresa, registros, limite_trabajadores, guardar):
    """Revisa (y si `guardar`, aplica) cada fila de la planilla de trabajadores.

    Devuelve una fila de resultado por registro: 'nuevo', 'actualiza', 'error'
    o 'limite' (no cabe en el plan), con el mensaje para mostrar. Al actualizar
    solo se escriben las columnas que traen dato: una columna ausente o vacía
    no borra lo que ya estaba guardado.
    """
    empleados_bd = Empleado.objects.filter(empresa=empresa)
    mapa = {limpiar_rut(e.rut): e for e in empleados_bd}
    siguiente_ficha = (empleados_bd.aggregate(Max('ficha_numero'))['ficha_numero__max'] or 0) + 1
    total_actual = Empleado.objects.filter(empresa__owner=empresa.owner, activo=True).count()
    maximo_legal = jornada_maxima_vigente()
    vistos = set()
    resultados = []

    with transaction.atomic():
        for fila_num, row in enumerate(registros, start=2):  # la fila 1 es el encabezado
            r = {str(k).strip().lower().replace(' ', '_'): v for k, v in row.items()}
            if all(_vacio(v) for v in r.values()):
                continue  # fila en blanco
            rut_raw = str(r.get('rut', '')).strip()
            base = {'fila': fila_num, 'rut': rut_raw,
                    'nombre': f"{str(r.get('nombres', '')).strip()} {str(r.get('apellido_paterno', '')).strip()}".strip(),
                    'cargo': str(r.get('cargo', '')).strip(), 'horas': None, 'sueldo': None,
                    'cambios': [], 'alerta': ''}

            def error(msj):
                resultados.append({**base, 'resultado': 'error', 'mensaje': msj})

            if not rut_raw:
                error('Falta el RUT.'); continue
            if not validar_rut(rut_raw):
                error(f'RUT inválido ({rut_raw}): revisa el dígito verificador.'); continue
            rut_limpio = limpiar_rut(rut_raw)
            base['rut'] = formatear_rut(rut_raw)
            if rut_limpio in vistos:
                error('RUT repetido en la planilla: se usa solo la primera fila.'); continue
            vistos.add(rut_limpio)
            existente = mapa.get(rut_limpio)
            if existente is not None and not base['nombre']:
                base['nombre'] = f'{existente.nombres} {existente.apellido_paterno}'.title()

            # ── Valores presentes en la fila ─────────────────────────────
            datos = {}
            for campo in _CAMPOS_TEXTO_CARGA:
                if not _vacio(r.get(campo)):
                    datos[campo] = str(r[campo]).strip().upper()
            if not _vacio(r.get('email')):
                datos['email'] = str(r['email']).strip().lower()
            if not _vacio(r.get('sexo')):
                datos['sexo'] = str(r['sexo']).strip().upper()[:1]
            if not _vacio(r.get('numero_cuenta')):
                crudo = r['numero_cuenta']
                try:
                    datos['numero_cuenta'] = str(int(float(crudo)))
                except (ValueError, TypeError):
                    datos['numero_cuenta'] = str(crudo).strip()
            for campo in ('fecha_ingreso', 'fecha_nacimiento'):
                if not _vacio(r.get(campo)):
                    fecha = estandarizar_fecha(r[campo])
                    if fecha is None:
                        error(f'{_NOMBRE_CAMPO[campo].capitalize()} inválida ({r[campo]}): usa DD-MM-AAAA.'); break
                    datos[campo] = fecha
            else:
                try:
                    if not _vacio(r.get('sueldo_base')):
                        datos['sueldo_base'] = int(float(r['sueldo_base']))
                        if datos['sueldo_base'] < 0:
                            error('El sueldo no puede ser negativo.'); continue
                    if not _vacio(r.get('horas_laborales')):
                        datos['horas_laborales'] = int(float(r['horas_laborales']))
                        if not 1 <= datos['horas_laborales'] <= 168:
                            error('Las horas semanales deben estar entre 1 y 168.'); continue
                except (ValueError, TypeError):
                    error('El sueldo o las horas no son números.'); continue

                faltan = [c for c in _COLUMNAS_OBLIGATORIAS[1:] if c not in datos]
                if existente is None and faltan:
                    error('Faltan datos para crearlo: ' + ', '.join(_NOMBRE_CAMPO[c] for c in faltan) + '.'); continue

                base['horas'] = datos.get('horas_laborales', existente.horas_laborales if existente else None)
                base['sueldo'] = datos.get('sueldo_base', existente.sueldo_base if existente else None)
                if base['horas'] and base['horas'] > maximo_legal:
                    # Aviso, no bloqueo: la decisión es del empleador.
                    base['alerta'] = f'Jornada de {base["horas"]} h: supera el máximo legal vigente de {maximo_legal} h.'

                if existente is not None:
                    cambios = [c for c, v in datos.items() if str(getattr(existente, c) or '') != str(v)]
                    base['cambios'] = [_NOMBRE_CAMPO[c] for c in cambios]
                    if guardar and cambios:
                        for c in cambios:
                            setattr(existente, c, datos[c])
                        existente.save(update_fields=cambios)
                    resultados.append({**base, 'resultado': 'actualiza',
                                       'mensaje': ('Cambia: ' + ', '.join(base['cambios']) + '.') if cambios else 'Sin cambios.'})
                    continue

                if total_actual >= limite_trabajadores:
                    resultados.append({**base, 'resultado': 'limite',
                                       'mensaje': f'Tu plan permite {limite_trabajadores} trabajadores vigentes: esta fila no se crea.'})
                    continue
                if guardar:
                    Empleado.objects.create(rut=formatear_rut(rut_raw), empresa=empresa, ficha_numero=siguiente_ficha,
                                            **{'nacionalidad': 'CHILENA', **datos})
                    siguiente_ficha += 1
                total_actual += 1
                resultados.append({**base, 'resultado': 'nuevo', 'mensaje': 'Se crea.'})
    return resultados


class EmpleadoViewSet(viewsets.ModelViewSet):
    serializer_class = EmpleadoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        rechazos_qs = SolicitudFirma.objects.filter(
            empleado=OuterRef('pk'),
            estado='RECHAZADO',
        )
        qs = Empleado.objects.filter(empresa__owner=self.request.user).annotate(
            tiene_rechazos_pendientes=Exists(rechazos_qs)
        )
        # El panel pide los trabajadores de la empresa activa; sin el
        # parámetro se mantienen todos los del usuario (panel anterior).
        empresa_id = self.request.query_params.get('empresa')
        if empresa_id:
            qs = qs.filter(empresa_id=empresa_id)
        return qs

    def perform_create(self, serializer):
        _exigir_cupo_trabajador(self.request.user)
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}

        empresa_destino = serializer.validated_data.get('empresa')

        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            if not validar_rut(rut_raw):
                raise ValidationError({'error': 'El RUT ingresado no es válido.'})
            rut_form = formatear_rut(rut_raw)

            if Empleado.objects.filter(empresa=empresa_destino, rut=rut_form).exists():
                raise ValidationError({'error': 'Este trabajador ya está registrado en esta empresa.'})

            datos_mayusculas['rut'] = rut_form

        telefono = datos_mayusculas.get('numero_telefono')
        if telefono and isinstance(telefono, str):
            solo_digitos = re.sub(r'[^0-9]', '', telefono)
            datos_mayusculas['numero_telefono'] = f'+56{solo_digitos[-9:]}' if solo_digitos else None

        serializer.save(**datos_mayusculas)

    def perform_update(self, serializer):
        # Reactivar a un desvinculado vuelve a ocupar cupo del plan.
        if serializer.validated_data.get('activo') is True and not serializer.instance.activo:
            _exigir_cupo_trabajador(self.request.user)
        datos_mayusculas = {k: (v.upper() if isinstance(v, str) else v) for k, v in serializer.validated_data.items()}

        empresa_destino = serializer.validated_data.get('empresa', serializer.instance.empresa)

        rut_raw = self.request.data.get('rut', '')
        if rut_raw:
            if not validar_rut(rut_raw):
                raise ValidationError({'error': 'El RUT ingresado no es válido.'})
            rut_form = formatear_rut(rut_raw)

            if Empleado.objects.filter(empresa=empresa_destino, rut=rut_form).exclude(id=serializer.instance.id).exists():
                raise ValidationError({'error': 'Ya existe otro trabajador con este RUT en esta empresa.'})

            datos_mayusculas['rut'] = rut_form

        # Normalizar teléfono: extraer solo los últimos 9 dígitos y anteponer +56
        telefono = datos_mayusculas.get('numero_telefono')
        if telefono and isinstance(telefono, str):
            solo_digitos = re.sub(r'[^0-9]', '', telefono)
            datos_mayusculas['numero_telefono'] = f'+56{solo_digitos[-9:]}' if solo_digitos else None

        serializer.save(**datos_mayusculas)

    @action(detail=False, methods=['post'])
    def carga_masiva(self, request):
        if not _plan_permite(request.user, 3):
            return Response(
                {'error': 'La importación masiva por Excel está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            data = request.data[0] if isinstance(request.data, list) else request.data
            empresa_id = data.get('empresa')
            archivo_excel = request.FILES.get('file') or data.get('file')

            if not archivo_excel or not empresa_id:
                return Response({'error': 'Falta el archivo o la empresa.'}, status=400)

            MAX_EXCEL_MB = 5
            if hasattr(archivo_excel, 'size') and archivo_excel.size > MAX_EXCEL_MB * 1024 * 1024:
                return Response({'error': f'El archivo no puede superar {MAX_EXCEL_MB} MB.'}, status=400)

            MIME_EXCEL = {
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
            }
            if hasattr(archivo_excel, 'content_type') and archivo_excel.content_type not in MIME_EXCEL:
                return Response({'error': 'Solo se aceptan archivos Excel (.xlsx o .xls).'}, status=400)

            empresa = Empresa.objects.get(id=empresa_id, owner=request.user)
            limite_trabajadores = _limite_trabajadores(request.user)

            # dtype=str: el RUT, la cuenta y las fechas llegan tal como se escribieron.
            df = pd.read_excel(archivo_excel, dtype=object).fillna('')
            registros = df.to_dict('records')

            MAX_FILAS = 500
            if len(registros) > MAX_FILAS:
                return Response({'error': f'El archivo no puede tener más de {MAX_FILAS} filas por importación.'}, status=400)

            # ?previsualizar=1 revisa cada fila con las mismas reglas y no guarda nada:
            # es la revisión previa del importador del panel.
            previsualizar = str(request.query_params.get('previsualizar', '')).lower() in ('1', 'true', 'si')
            filas = _procesar_carga_masiva(empresa, registros, limite_trabajadores, guardar=not previsualizar)

            creados = sum(1 for f in filas if f['resultado'] == 'nuevo')
            actualizados = sum(1 for f in filas if f['resultado'] == 'actualiza')
            return Response({
                'previsualizacion': previsualizar,
                'agregados': creados,
                'actualizados': actualizados,
                'limite_alcanzado': any(f['resultado'] == 'limite' for f in filas),
                'errores': [f"Fila {f['fila']}: {f['mensaje']}" for f in filas if f['resultado'] in ('error', 'limite')],
                'filas': filas,
            }, status=200)

        except Empresa.DoesNotExist:
            return Response({'error': 'Empresa no encontrada.'}, status=404)
        except Exception:
            return Response({'error': 'Error procesando el archivo. Revisa el formato e inténtalo de nuevo.'}, status=500)
                
   # ====================================================
    # DISPONIBILIDAD DE DOCUMENTOS POR TRABAJADOR
    # ====================================================
    @action(detail=True, methods=['get'])
    def documentos_disponibles(self, request, pk=None):
        empleado = self.get_object()
        contrato = Contrato.objects.filter(empleado=empleado).first()

        data = {
            'tiene_contrato': contrato is not None,
            'tiene_anexo_40h': bool(contrato and contrato.archivo_anexo_40h),
            'cantidad_liquidaciones': Liquidacion.objects.filter(empleado=empleado).count(),
            'cantidad_amonestaciones': DocumentoLegal.objects.filter(empleado=empleado, tipo='AMONESTACION').count(),
            'tiene_despido': DocumentoLegal.objects.filter(empleado=empleado, tipo='DESPIDO').exists(),
            'tiene_mutuo_acuerdo': DocumentoLegal.objects.filter(empleado=empleado, tipo='MUTUO_ACUERDO').exists(),
            'cantidad_constancias': DocumentoLegal.objects.filter(empleado=empleado, tipo='CONSTANCIA').count(),
            'cantidad_anexos_contrato': AnexoContrato.objects.filter(contrato=contrato).count() if contrato else 0,
        }
        return Response(data)

    @action(detail=True, methods=['get'], url_path='historial_salarial')
    def historial_salarial(self, request, pk=None):
        empleado = self.get_object()
        contrato = Contrato.objects.filter(empleado=empleado).first()

        liqs = list(
            Liquidacion.objects.filter(empleado=empleado)
            .order_by('anio', 'mes')
            .values('mes', 'anio', 'sueldo_base', 'total_haberes', 'total_descuentos',
                    'sueldo_liquido', 'dias_trabajados')
        )

        periodos = []
        prev_liq = None
        for liq in liqs:
            delta_pct = None
            if prev_liq is not None and prev_liq > 0:
                delta_pct = round((liq['sueldo_liquido'] - prev_liq) / prev_liq * 100, 1)
            periodos.append({**liq, 'delta_pct': delta_pct})
            prev_liq = liq['sueldo_liquido']

        liquidos = [p['sueldo_liquido'] for p in periodos]
        promedio = round(sum(liquidos) / len(liquidos)) if liquidos else 0

        # Tendencia: promedio últimos 3 meses vs los 3 anteriores
        tendencia_3m = None
        if len(liquidos) >= 6:
            avg_rec = sum(liquidos[-3:]) / 3
            avg_ant = sum(liquidos[-6:-3]) / 3
            if avg_ant > 0:
                tendencia_3m = round((avg_rec - avg_ant) / avg_ant * 100, 1)
        elif len(liquidos) >= 2:
            tendencia_3m = periodos[-1]['delta_pct']

        return Response({
            'contrato_sueldo_base': contrato.sueldo_base if contrato else None,
            'contrato_tipo': contrato.tipo_contrato if contrato else None,
            'promedio_liquido': promedio,
            'tendencia_3m': tendencia_3m,
            'periodos': periodos,
        })

   # ====================================================
    # MOTOR DOCUMENTAL PERSISTENTE (CON PLANTILLAS REALES)
    # ====================================================

    def _html_a_pdf(self, html_string, nombre_doc):
        """Convierte HTML a bytes PDF con xhtml2pdf. Lanza excepción clara si falla."""
        resultado = io.BytesIO()
        status = pisa.pisaDocument(io.BytesIO(html_string.encode("UTF-8")), resultado)
        if status.err:
            raise Exception(
                f"xhtml2pdf reportó {status.err} error(s) generando '{nombre_doc}'. "
                f"Revisar el template y el contexto pasado."
            )
        pdf_bytes = resultado.getvalue()
        if not pdf_bytes:
            raise Exception(
                f"PDF '{nombre_doc}' resultó vacío tras la conversión. "
                f"xhtml2pdf no reportó error pero el resultado es b\"\". "
                f"Posible problema de encoding o template vacío."
            )
        return pdf_bytes

    def _obtener_o_generar_documento(self, empleado, tipo_documento, user=None):
        """Revisa si el PDF ya existe en la BD. Si no, lo genera usando los templates HTML reales."""

        empresa = empleado.empresa
        es_plan_semilla = _es_plan_semilla(user) if user else False

        # --- LÓGICA PARA CONTRATOS ---
        if tipo_documento == 'contrato':
            try:
                contrato = Contrato.objects.get(empleado=empleado)
            except Contrato.DoesNotExist:
                raise Exception(f"El trabajador {empleado.nombres} no tiene contrato registrado.")
            if contrato.archivo_contrato:
                try:
                    return contrato.archivo_contrato.read()
                except Exception:
                    pass

            context = _ctx_contrato(contrato, es_plan_semilla)
            html_string = render_to_string('contrato_trabajo.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Contrato_{empleado.rut}')
            contrato.archivo_contrato.save(f"Contrato_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        # --- LÓGICA PARA ANEXOS 40 HORAS ---
        elif tipo_documento == 'anexo_40h':
            try:
                contrato = Contrato.objects.get(empleado=empleado)
            except Contrato.DoesNotExist:
                raise Exception(f"El trabajador {empleado.nombres} no tiene contrato registrado.")
            if contrato.archivo_anexo_40h:
                try:
                    return contrato.archivo_anexo_40h.read()
                except Exception:
                    pass

            context = _ctx_contrato(contrato, es_plan_semilla)
            html_string = render_to_string('anexo_40h.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Anexo_40h_{empleado.rut}')
            contrato.archivo_anexo_40h.save(f"Anexo_40h_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        # --- LÓGICA PARA LIQUIDACIONES (MES ACTUAL) ---
        elif tipo_documento == 'liquidacion_actual':
            hoy = datetime.date.today()
            try:
                liquidacion = Liquidacion.objects.get(empleado=empleado, mes=hoy.month, anio=hoy.year)
            except Liquidacion.DoesNotExist:
                raise Exception(f"No existe liquidación del mes actual para {empleado.nombres}.")
            if liquidacion.archivo_pdf:
                try:
                    return liquidacion.archivo_pdf.read()
                except Exception:
                    pass

            try:
                liquido_palabras = num2words(liquidacion.sueldo_liquido, lang='es')
            except Exception:
                liquido_palabras = str(liquidacion.sueldo_liquido)
            contrato_liq = Contrato.objects.filter(empleado=empleado).first()
            meses_liq = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
            agrupados = liquidacion.items_agrupados
            det_no_imp = agrupados['no_imponibles']
            det_otros = agrupados['descuentos']
            context = {
                'empleado': empleado, 'empresa': empresa,
                'liquidacion': liquidacion, 'contrato': contrato_liq,
                'mes_nombre': meses_liq[liquidacion.mes - 1].upper(),
                'liquido_palabras': liquido_palabras,
                'total_no_imponible': sum(int(i.get('valor', 0)) for i in det_no_imp if isinstance(i, dict)),
                'total_ley': (liquidacion.afp_monto or 0) + (liquidacion.salud_monto or 0) + (liquidacion.seguro_cesantia or 0) + (liquidacion.impuesto_unico or 0),
                'total_otros_dsctos': (liquidacion.anticipo_quincena or 0) + sum(int(i.get('valor', 0)) for i in det_otros if isinstance(i, dict)),
                'es_plan_semilla': es_plan_semilla,
            }
            html_string = render_to_string('liquidacion.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Liquidacion_{hoy.month}_{hoy.year}_{empleado.rut}')
            liquidacion.archivo_pdf.save(
                f"Liquidacion_{hoy.month}_{hoy.year}_{empleado.rut}.pdf", ContentFile(pdf_bytes)
            )
            return pdf_bytes

        # --- LÓGICA PARA LIQUIDACIONES HISTÓRICAS ---
        elif tipo_documento.startswith('liquidacion_historica_'):
            _, _, mes_str, anio_str = tipo_documento.split('_')
            mes_hist, anio_hist = int(mes_str), int(anio_str)

            try:
                liquidacion = Liquidacion.objects.get(empleado=empleado, mes=mes_hist, anio=anio_hist)
            except Liquidacion.DoesNotExist:
                raise Exception(f"No existe liquidación {mes_hist}/{anio_hist} para {empleado.nombres}.")
            if liquidacion.archivo_pdf:
                try:
                    return liquidacion.archivo_pdf.read()
                except Exception:
                    pass

            try:
                liquido_palabras = num2words(liquidacion.sueldo_liquido, lang='es')
            except Exception:
                liquido_palabras = str(liquidacion.sueldo_liquido)
            contrato_liq = Contrato.objects.filter(empleado=empleado).first()
            meses_liq = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
            agrupados = liquidacion.items_agrupados
            det_no_imp = agrupados['no_imponibles']
            det_otros = agrupados['descuentos']
            context = {
                'empleado': empleado, 'empresa': empresa,
                'liquidacion': liquidacion, 'contrato': contrato_liq,
                'mes_nombre': meses_liq[liquidacion.mes - 1].upper(),
                'liquido_palabras': liquido_palabras,
                'total_no_imponible': sum(int(i.get('valor', 0)) for i in det_no_imp if isinstance(i, dict)),
                'total_ley': (liquidacion.afp_monto or 0) + (liquidacion.salud_monto or 0) + (liquidacion.seguro_cesantia or 0) + (liquidacion.impuesto_unico or 0),
                'total_otros_dsctos': (liquidacion.anticipo_quincena or 0) + sum(int(i.get('valor', 0)) for i in det_otros if isinstance(i, dict)),
                'es_plan_semilla': es_plan_semilla,
            }
            html_string = render_to_string('liquidacion.html', context)
            pdf_bytes = self._html_a_pdf(html_string, f'Liquidacion_{mes_hist}_{anio_hist}_{empleado.rut}')
            liquidacion.archivo_pdf.save(
                f"Liquidacion_{mes_hist}_{anio_hist}_{empleado.rut}.pdf", ContentFile(pdf_bytes)
            )
            return pdf_bytes

        # --- LÓGICA PARA CARTAS DE AMONESTACIÓN ---
        elif tipo_documento == 'amonestacion':
            doc_legal = DocumentoLegal.objects.filter(
                empleado=empleado, tipo='AMONESTACION'
            ).order_by('-fecha_emision').first()
            if doc_legal is None:
                raise Exception(f"El trabajador {empleado.nombres} no tiene amonestaciones registradas.")
            if doc_legal.archivo_pdf:
                try:
                    return doc_legal.archivo_pdf.read()
                except Exception:
                    pass

            pdf_bytes = self._pdf_para_documento_legal(doc_legal, es_plan_semilla)
            doc_legal.archivo_pdf.save(f"Amonestacion_{empleado.rut}.pdf", ContentFile(pdf_bytes))
            return pdf_bytes

        raise Exception(f"Tipo de documento no soportado: '{tipo_documento}'")
    
    # ====================================================
    # HELPERS PDF PARA DOCUMENTOS LEGALES Y ANEXOS
    # ====================================================
    def _pdf_para_documento_legal(self, doc, es_plan_semilla):
        empleado = doc.empleado
        empresa = empleado.empresa
        meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
        hoy = doc.fecha_emision
        fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
        ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
        context = {
            'documento': doc, 'empleado': empleado, 'empresa': empresa,
            'fecha_actual': fecha_espanol, 'ciudad': ciudad,
            'es_plan_semilla': es_plan_semilla,
        }
        if doc.tipo == 'DESPIDO':
            codigo = doc.causal_articulo or ''
            causal_label, causal_descripcion, requiere_indemnizacion = self._CAUSAL_INFO.get(
                codigo, (doc.causal_legal or '—', '', False)
            )
            def _fmt(v):
                return f'$ {v:,}'.replace(',', '.') if v else '$ 0'
            fecha_ult = None
            if doc.fecha_ultimo_dia:
                f = doc.fecha_ultimo_dia
                fecha_ult = f"{f.day:02d} de {meses[f.month - 1]} de {f.year}"
            try:
                contrato_cargo = doc.empleado.contrato.cargo
            except Exception:
                contrato_cargo = None
            context.update({
                'causal_label': causal_label,
                'causal_descripcion': causal_descripcion,
                'requiere_indemnizacion': requiere_indemnizacion,
                'monto_anos_texto': _fmt(doc.monto_indemnizacion_anos or 0),
                'monto_sustitutiva_texto': _fmt(doc.monto_indemnizacion_sustitutiva or 0),
                'monto_total_texto': _fmt((doc.monto_indemnizacion_anos or 0) + (doc.monto_indemnizacion_sustitutiva or 0)),
                'fecha_ultimo_dia_texto': fecha_ult,
                'contrato_cargo': contrato_cargo,
            })
            html = render_to_string('carta_despido.html', context)
        else:
            html = render_to_string('documento_legal.html', context)
        return self._html_a_pdf(html, f'{doc.tipo}_{empleado.rut}_{doc.fecha_emision}')

    def _pdf_para_anexo_contrato(self, anexo, es_plan_semilla):
        contrato = anexo.contrato
        empleado = contrato.empleado
        empresa = empleado.empresa
        meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
        hoy = anexo.fecha_emision
        fecha_espanol = f"{hoy.day:02d} de {meses[hoy.month - 1]} de {hoy.year}"
        ciudad = str(getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or 'Santiago').strip().title()
        context = {
            'anexo': anexo, 'contrato': contrato, 'empleado': empleado, 'empresa': empresa,
            'fecha_actual': fecha_espanol, 'ciudad': ciudad,
            'es_plan_semilla': es_plan_semilla,
        }
        html = render_to_string('anexo_contrato.html', context)
        return self._html_a_pdf(html, f'AnexoContrato_{empleado.rut}_{hoy}')

    # ====================================================
    # ENDPOINT: DESCARGA MASIVA Y EXPEDIENTES (ZIP)
    # ====================================================
    @action(detail=False, methods=['post'])
    def descarga_masiva(self, request):
        """
        POST body:
          empleados: [id, ...]
          empresa_id: int
          documentos: lista de tipos a incluir:
            'contrato', 'anexo_40h', 'liquidaciones',
            'amonestaciones', 'despidos', 'mutuo_acuerdo',
            'constancias', 'anexos_contrato'
          cantidad_liquidaciones: int (cuántas liquidaciones recientes incluir)
        """
        try:
            empleados_ids = request.data.get('empleados', [])
            empresa_id = request.data.get('empresa_id')
            documentos = request.data.get('documentos', [])
            cantidad_liquidaciones = int(request.data.get('cantidad_liquidaciones', 1))

            if not empleados_ids or not empresa_id:
                return Response({'error': 'Faltan IDs de trabajadores o empresa'}, status=400)
            if not documentos:
                return Response({'error': 'Debes seleccionar al menos un tipo de documento'}, status=400)

            MAX_EMPLEADOS_ZIP = 50
            if len(empleados_ids) > MAX_EMPLEADOS_ZIP:
                return Response({'error': f'Máximo {MAX_EMPLEADOS_ZIP} trabajadores por descarga. Divide la selección en grupos.'}, status=400)

            MAX_LIQUIDACIONES_ZIP = 12
            cantidad_liquidaciones = min(cantidad_liquidaciones, MAX_LIQUIDACIONES_ZIP)

            if not _plan_permite(request.user, 3):
                return Response({'error': 'La descarga masiva de expedientes en ZIP está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'}, status=403)

            empresa = Empresa.objects.get(id=empresa_id, owner=request.user)
            empleados = Empleado.objects.filter(id__in=empleados_ids, empresa=empresa)
            if not empleados.exists():
                return Response({'error': 'No se encontraron trabajadores válidos'}, status=404)

            es_semilla = False  # ya verificado arriba
            meses_corto = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
            zip_buffer = io.BytesIO()

            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for emp in empleados:
                    rut_limpio = emp.rut.replace("-", "").replace(".", "")
                    carpeta = f"{rut_limpio}_{emp.nombres}_{emp.apellido_paterno}".replace(" ", "_")

                    if 'contrato' in documentos:
                        try:
                            pdf = self._obtener_o_generar_documento(emp, 'contrato', request.user)
                            zip_file.writestr(f"{carpeta}/Contrato.pdf", pdf)
                        except Exception:
                            pass

                    if 'anexo_40h' in documentos:
                        try:
                            pdf = self._obtener_o_generar_documento(emp, 'anexo_40h', request.user)
                            zip_file.writestr(f"{carpeta}/Anexo_Ley_40h.pdf", pdf)
                        except Exception:
                            pass

                    if 'liquidaciones' in documentos and cantidad_liquidaciones > 0:
                        liq_qs = Liquidacion.objects.filter(empleado=emp).order_by('-anio', '-mes')[:cantidad_liquidaciones]
                        for liq in liq_qs:
                            try:
                                pdf = self._obtener_o_generar_documento(emp, f'liquidacion_historica_{liq.mes}_{liq.anio}', request.user)
                                zip_file.writestr(f"{carpeta}/Liquidaciones/Liq_{meses_corto[liq.mes - 1]}_{liq.anio}.pdf", pdf)
                            except Exception:
                                pass

                    if 'amonestaciones' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='AMONESTACION').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Amonestaciones/Amonestacion_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'despidos' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='DESPIDO').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Terminos_Contrato/Termino_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'mutuo_acuerdo' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='MUTUO_ACUERDO').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Renuncias/Renuncia_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'constancias' in documentos:
                        for doc in DocumentoLegal.objects.filter(empleado=emp, tipo='CONSTANCIA').order_by('fecha_emision'):
                            try:
                                pdf = self._pdf_para_documento_legal(doc, es_semilla)
                                zip_file.writestr(f"{carpeta}/Constancias/Constancia_{doc.fecha_emision}.pdf", pdf)
                            except Exception:
                                pass

                    if 'anexos_contrato' in documentos:
                        contrato_emp = Contrato.objects.filter(empleado=emp).first()
                        if contrato_emp:
                            for anexo in AnexoContrato.objects.filter(contrato=contrato_emp).order_by('fecha_emision'):
                                try:
                                    pdf = self._pdf_para_anexo_contrato(anexo, es_semilla)
                                    titulo_corto = anexo.titulo[:30].replace(" ", "_")
                                    zip_file.writestr(f"{carpeta}/Anexos_Contrato/Anexo_{anexo.fecha_emision}_{titulo_corto}.pdf", pdf)
                                except Exception:
                                    pass

            zip_buffer.seek(0)
            nombre_zip = f"Expedientes_{empresa.nombre_legal.replace(' ', '_')}_{datetime.date.today()}.zip"
            response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
            response['Content-Disposition'] = f'attachment; filename="{nombre_zip}"'
            response['Access-Control-Expose-Headers'] = 'Content-Disposition'
            return response

        except Exception:
            logger.exception('Error al generar ZIP de expedientes')
            return Response({'error': 'Error al generar el ZIP. Inténtalo de nuevo.'}, status=500)
        

    @action(detail=False, methods=['post'])
    def descargar_anexos_zip(self, request):

        if not _plan_permite(request.user, 3):
            return Response(
                {'error': 'La descarga masiva de expedientes en ZIP está disponible desde el plan Pyme. Mejora tu suscripción para acceder.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        empleado_ids = request.data.get('empleados', [])

        if not empleado_ids:
            return Response({'error': 'No se seleccionaron trabajadores'}, status=status.HTTP_400_BAD_REQUEST)

        MAX_EMPLEADOS_ZIP = 50
        if len(empleado_ids) > MAX_EMPLEADOS_ZIP:
            return Response({'error': f'Máximo {MAX_EMPLEADOS_ZIP} trabajadores por descarga. Divide la selección en grupos.'}, status=status.HTTP_400_BAD_REQUEST)
        
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for emp_id in empleado_ids:
                try:
                    empleado = Empleado.objects.get(id=emp_id, empresa__owner=request.user)
                    empresa = empleado.empresa
                    
                    contrato = Contrato.objects.filter(empleado=empleado).first()
                    if not contrato:
                        try: s_base = int(str(empleado.sueldo_base).strip()) if empleado.sueldo_base else 0
                        except: s_base = 0
                        
                        f_inicio = empleado.fecha_ingreso if isinstance(empleado.fecha_ingreso, datetime.date) else datetime.date.today()
                        c_cargo = str(empleado.cargo).strip().upper() if empleado.cargo else 'NO ESPECIFICADO'
                        
                        try:
                            contrato = Contrato.objects.create(
                                empleado=empleado,
                                tipo_contrato='INDEFINIDO',
                                fecha_inicio=f_inicio,
                                sueldo_base=s_base,
                                cargo=c_cargo
                            )
                        except Exception as e:
                            print(f"Aviso BD Contrato - Creando virtual para {empleado.rut}: {e}")
                            class ContratoVirtual:
                                pass
                            contrato = ContratoVirtual()
                            contrato.sueldo_base = s_base

                    meses_zip = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
                    hoy_zip = datetime.date.today()
                    fecha_zip = f"{hoy_zip.day:02d} de {meses_zip[hoy_zip.month - 1]} de {hoy_zip.year}"
                    ciudad_zip = str(
                        getattr(empresa, 'comuna', '') or getattr(empresa, 'ciudad', '') or
                        getattr(empleado, 'comuna', '') or 'Santiago'
                    ).strip().title()
                    context = {
                        'contrato': contrato,
                        'empleado': empleado,
                        'empresa': empresa,
                        'fecha_actual': fecha_zip,
                        'ciudad': ciudad_zip,
                        'es_plan_semilla': _es_plan_semilla(request.user),
                    }

                    template = get_template('anexo_40h.html')
                    html = template.render(context)
                    
                    pdf_buffer = io.BytesIO()
                    pisa_status = pisa.CreatePDF(html, dest=pdf_buffer)
                    
                    if not pisa_status.err:
                        nombre_archivo = f"Anexo_40h_{empleado.rut}.pdf"
                        zip_file.writestr(nombre_archivo, pdf_buffer.getvalue())
                        
                except Exception as e:
                    print(f"Error fatal saltando empleado {emp_id} en ZIP: {e}")
                    continue 
        
        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer, content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="Anexos_Masivos_40h.zip"'
        return response

    @action(detail=True, methods=['post'], url_path='digitalizar_contrato')
    def digitalizar_contrato(self, request, pk=None):
        from ..extractor_contrato import extraer_campos_contrato

        archivo = request.FILES.get('file')
        if not archivo:
            return Response({'error': 'No se recibió ningún archivo.'}, status=400)

        MIME_PERMITIDOS = {
            'application/pdf': 'application/pdf',
            'image/jpeg':      'image/jpeg',
            'image/png':       'image/png',
        }
        mime = archivo.content_type or ''
        if mime not in MIME_PERMITIDOS:
            return Response(
                {'error': 'Formato no soportado. Sube un PDF, JPG o PNG.'},
                status=400,
            )

        LIMITE_BYTES = 20 * 1024 * 1024  # 20 MB
        if archivo.size > LIMITE_BYTES:
            return Response({'error': 'El archivo supera el límite de 20 MB.'}, status=400)

        try:
            campos = extraer_campos_contrato(archivo.read(), mime)
        except RuntimeError as e:
            return Response({'error': str(e)}, status=502)
        except Exception as e:
            return Response(
                {'error': f'Error inesperado al analizar el documento: {e}'},
                status=500,
            )

        return Response(campos)
