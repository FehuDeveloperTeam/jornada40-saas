from rest_framework import serializers
from .models import Empresa, Empleado, Contrato, AnexoContrato, DocumentoLegal, Liquidacion, Plan, SolicitudFirma, VacacionEmpleado, Finiquito, ConceptoRemuneracion
from dj_rest_auth.serializers import LoginSerializer, PasswordResetSerializer
from .jornada import avisos_jornada, jornada_maxima_vigente
from .rut import normalizar_rut_usuario


# ── Aislamiento entre clientes ───────────────────────────────────────────────
# Todo recurso que apunta a una empresa, un trabajador o un contrato debe
# pertenecer al usuario que hace la solicitud. Las vistas filtran lo que se
# lee, pero sin esto se podía CREAR dentro de la empresa de otro cliente con
# solo conocer un id (un trabajador, una amonestación, unas vacaciones).

def _usuario(serializer):
    request = serializer.context.get('request')
    return getattr(request, 'user', None)


def _exigir_propia(serializer, empresa):
    usuario = _usuario(serializer)
    if empresa is not None and usuario is not None and empresa.owner_id != usuario.id:
        raise serializers.ValidationError('No encontrado.')
    return empresa


def _exigir_propio_empleado(serializer, empleado):
    if empleado is not None:
        _exigir_propia(serializer, empleado.empresa)
    return empleado


def _exigir_propio_contrato(serializer, contrato):
    if contrato is not None:
        _exigir_propio_empleado(serializer, contrato.empleado)
    return contrato


class EmpresaSerializer(serializers.ModelSerializer):
    firma_configurada = serializers.SerializerMethodField()

    def get_firma_configurada(self, obj):
        return bool(obj.firma_imagen)

    class Meta:
        model = Empresa
        fields = [
            'id', 'owner', 'nombre_legal', 'rut', 'alias', 'giro',
            'direccion', 'comuna', 'ciudad', 'sucursal',
            'representante_legal', 'rut_representante',
            'activo', 'created_at',
            'firma_firmante_nombre', 'firma_firmante_cargo', 'firma_configurada_en',
            'firma_configurada',
        ]
        read_only_fields = ('id', 'owner', 'activo', 'created_at',
                            'firma_imagen', 'firma_configurada_en', 'firma_configurada')


class ContratoSerializer(serializers.ModelSerializer):
    tiene_contrato_pdf = serializers.SerializerMethodField()
    tiene_anexo_40h_pdf = serializers.SerializerMethodField()
    # Avisos de jornada (no bloquean nada): ver core/jornada.py.
    jornada_maxima_vigente = serializers.SerializerMethodField()
    avisos_jornada = serializers.SerializerMethodField()

    def get_jornada_maxima_vigente(self, obj):
        return jornada_maxima_vigente()

    def get_avisos_jornada(self, obj):
        from .views import ingreso_minimo_vigente
        return avisos_jornada(obj.tipo_jornada, obj.horas_semanales, obj.distribucion_horario,
                              sueldo_base=obj.sueldo_base, ingreso_minimo=ingreso_minimo_vigente())

    def get_tiene_contrato_pdf(self, obj):
        return bool(obj.archivo_contrato)

    def get_tiene_anexo_40h_pdf(self, obj):
        return bool(obj.archivo_anexo_40h)

    def validate_empleado(self, empleado):
        return _exigir_propio_empleado(self, empleado)

    class Meta:
        model = Contrato
        fields = [
            'id', 'empleado', 'tipo_contrato', 'cargo',
            'fecha_inicio', 'fecha_fin', 'es_profesional_titulado', 'sueldo_base',
            'tipo_jornada', 'horas_semanales', 'distribucion_dias', 'distribucion_horario',
            'dia_pago', 'gratificacion_legal',
            'tiene_quincena', 'dia_quincena', 'monto_quincena',
            'es_comisionista', 'comisiones_config',
            'jornada_personalizada', 'funciones_especificas', 'clausulas_especiales',
            'archivo_contrato', 'archivo_anexo_40h',
            'tiene_contrato_pdf', 'tiene_anexo_40h_pdf',
            'jornada_maxima_vigente', 'avisos_jornada',
            'creado_en',
        ]
        read_only_fields = ('id', 'archivo_contrato', 'archivo_anexo_40h', 'creado_en',
                            'tiene_contrato_pdf', 'tiene_anexo_40h_pdf',
                            'jornada_maxima_vigente', 'avisos_jornada')

    def validate(self, data):
        tipo = data.get('tipo_contrato', getattr(self.instance, 'tipo_contrato', None))
        fecha_inicio = data.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        fecha_fin = data.get('fecha_fin', getattr(self.instance, 'fecha_fin', None))
        es_profesional_titulado = data.get('es_profesional_titulado', getattr(self.instance, 'es_profesional_titulado', False))

        if tipo in ('PLAZO_FIJO', 'OBRA_FAENA') and not fecha_fin:
            raise serializers.ValidationError({
                'fecha_fin': 'La fecha de término es obligatoria para contratos a plazo fijo o por obra/faena.'
            })

        if fecha_fin and fecha_inicio and fecha_fin <= fecha_inicio:
            raise serializers.ValidationError({
                'fecha_fin': 'La fecha de término debe ser posterior a la fecha de inicio.'
            })

        if tipo == 'PLAZO_FIJO' and fecha_fin and fecha_inicio:
            tope_dias = 731 if es_profesional_titulado else 366
            if (fecha_fin - fecha_inicio).days > tope_dias:
                tope_anios = 2 if es_profesional_titulado else 1
                raise serializers.ValidationError({
                    'fecha_fin': f'Un contrato a plazo fijo no puede exceder {tope_anios} año(s) de duración (Art. 159 N°4 del Código del Trabajo).'
                })

        return data

class EmpleadoSerializer(serializers.ModelSerializer):
    contrato_activo = ContratoSerializer(read_only=True)
    tiene_rechazos_pendientes = serializers.BooleanField(read_only=True, default=False)

    def validate_empresa(self, empresa):
        return _exigir_propia(self, empresa)

    class Meta:
        model = Empleado
        fields = [
            'id', 'empresa', 'rut', 'nombres', 'apellido_paterno', 'apellido_materno',
            'sexo', 'fecha_nacimiento', 'nacionalidad', 'estado_civil',
            'direccion', 'comuna', 'numero_telefono', 'email',
            'departamento', 'cargo', 'sucursal',
            'horas_laborales', 'modalidad', 'sueldo_base', 'fecha_ingreso',
            'afp', 'sistema_salud', 'plan_isapre_uf',
            'forma_pago', 'banco', 'tipo_cuenta', 'numero_cuenta',
            'centro_costo', 'ficha_numero',
            'activo', 'creado_en',
            'contrato_activo',
            'tiene_rechazos_pendientes',
        ]
        read_only_fields = ('id', 'ficha_numero', 'creado_en', 'contrato_activo',
                            'tiene_rechazos_pendientes')


class AnexoContratoSerializer(serializers.ModelSerializer):
    def validate_contrato(self, contrato):
        return _exigir_propio_contrato(self, contrato)

    class Meta:
        model = AnexoContrato
        fields = [
            'id', 'contrato', 'titulo', 'descripcion',
            'clausulas_modificadas', 'fecha_emision',
            'cambios', 'vigencia_desde', 'aplicado', 'aplicado_en',
            'archivo_pdf', 'creado_en',
        ]
        read_only_fields = ('id', 'archivo_pdf', 'creado_en', 'aplicado', 'aplicado_en')


class DocumentoLegalSerializer(serializers.ModelSerializer):
    def validate_empleado(self, empleado):
        return _exigir_propio_empleado(self, empleado)

    class Meta:
        model = DocumentoLegal
        fields = [
            'id', 'empleado', 'tipo', 'fecha_emision',
            'causal_legal', 'hechos', 'aviso_previo_pagado',
            # Campos específicos carta de despido
            'causal_articulo',
            'fecha_ultimo_dia',
            'cotizaciones_al_dia',
            'aviso_previo_dias',
            'monto_indemnizacion_anos',
            'monto_indemnizacion_sustitutiva',
            'modalidad_finiquito',
            'copia_inspeccion_trabajo',
            'archivo_pdf', 'creado_en',
        ]
        # Las indemnizaciones de la carta las calcula el backend (_calcular_finiquito).
        read_only_fields = ('id', 'archivo_pdf', 'creado_en',
                            'monto_indemnizacion_anos', 'monto_indemnizacion_sustitutiva')


class LiquidacionSerializer(serializers.ModelSerializer):
    def validate_empleado(self, empleado):
        return _exigir_propio_empleado(self, empleado)

    class Meta:
        model = Liquidacion
        fields = [
            'id', 'empleado', 'mes', 'anio',
            'dias_trabajados', 'dias_licencia', 'dias_ausencia', 'dias_no_contratados',
            'sueldo_base', 'gratificacion',
            'detalle_items', 'semana_corrida',
            'afp_nombre', 'afp_monto',
            'salud_nombre', 'isapre_cotizacion_uf', 'salud_monto',
            'seguro_cesantia', 'impuesto_unico',
            'anticipo_quincena',
            'sueldo_base_contrato', 'horas_semanales_contrato', 'gratificacion_legal', 'tipo_contrato', 'valor_uf',
            'total_imponible', 'total_haberes', 'total_descuentos', 'sueldo_liquido',
            'archivo_pdf', 'fecha_emision',
        ]
        read_only_fields = (
            'id', 'semana_corrida',
            'sueldo_base_contrato', 'horas_semanales_contrato', 'gratificacion_legal', 'tipo_contrato', 'valor_uf',
            'total_imponible', 'total_haberes', 'total_descuentos', 'sueldo_liquido',
            'archivo_pdf', 'fecha_emision',
        )


class ConceptoRemuneracionSerializer(serializers.ModelSerializer):
    es_del_sistema = serializers.SerializerMethodField()

    def get_es_del_sistema(self, obj):
        return obj.empresa_id is None

    def validate(self, attrs):
        # Tipo, código y empresa se fijan al crear: la naturaleza previsional
        # se deriva del tipo solo en ese momento, y las liquidaciones emitidas
        # referencian el código. Cambiarlos después dejaría el concepto
        # clasificado con las reglas de otro tipo.
        if self.instance is not None:
            for campo in ('tipo', 'codigo', 'empresa'):
                if campo in attrs and attrs[campo] != getattr(self.instance, campo):
                    raise serializers.ValidationError(
                        {campo: 'No se puede cambiar una vez creado el concepto. Crea uno nuevo si lo necesitas.'})
        else:
            # La restricción única es condicional y DRF no la valida sola:
            # sin esto, un código repetido terminaba en IntegrityError (500).
            empresa, codigo = attrs.get('empresa'), attrs.get('codigo')
            if empresa and codigo and ConceptoRemuneracion.objects.filter(empresa=empresa, codigo=codigo).exists():
                raise serializers.ValidationError(
                    {'codigo': 'Ya existe un concepto con ese código en esta empresa (puede estar desactivado).'})
        return attrs

    class Meta:
        model = ConceptoRemuneracion
        fields = [
            'id', 'codigo', 'nombre', 'tipo',
            'es_imponible', 'es_tributable',
            'afecta_gratificacion', 'afecta_semana_corrida',
            'codigo_lre', 'empresa', 'es_del_sistema', 'activo', 'creado_en',
        ]
        # La naturaleza previsional la deriva el modelo desde el tipo: no se
        # acepta que llegue definida desde el cliente.
        read_only_fields = (
            'id', 'creado_en', 'es_del_sistema', 'codigo_lre',
            'es_imponible', 'es_tributable',
            'afecta_gratificacion', 'afecta_semana_corrida',
        )


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = ['id', 'nombre', 'descripcion', 'precio', 'max_empresas', 'limite_trabajadores', 'nivel', 'activo']
        read_only_fields = ('id', 'nombre', 'descripcion', 'precio', 'max_empresas', 'limite_trabajadores', 'nivel', 'activo')


class SolicitudFirmaSerializer(serializers.ModelSerializer):
    empleado_nombre = serializers.SerializerMethodField()
    empresa_nombre  = serializers.SerializerMethodField()

    def get_empleado_nombre(self, obj):
        return f"{obj.empleado.nombres} {obj.empleado.apellido_paterno}"

    def get_empresa_nombre(self, obj):
        return obj.empresa.nombre_legal

    class Meta:
        model = SolicitudFirma
        fields = [
            'id', 'empleado', 'empresa', 'contrato', 'documento_legal',
            'anexo_contrato', 'liquidacion', 'vacacion', 'finiquito',
            'tipo_documento', 'token', 'estado',
            'email_firmante', 'ip_firmante',
            'enviado_en', 'firmado_en', 'expira_en',
            'motivo_rechazo', 'folio', 'hash_firmado',
            'empleado_nombre', 'empresa_nombre',
        ]
        read_only_fields = (
            'id', 'token', 'estado', 'email_firmante', 'ip_firmante',
            'enviado_en', 'firmado_en', 'expira_en',
            'motivo_rechazo', 'folio', 'hash_firmado',
            'empleado_nombre', 'empresa_nombre',
        )


class VacacionSerializer(serializers.ModelSerializer):
    dias_habiles_calculados = serializers.SerializerMethodField()

    def get_dias_habiles_calculados(self, obj):
        """Días hábiles reales del período, útil para validación en frontend."""
        if obj.fecha_inicio and obj.fecha_fin:
            from .views import _calcular_dias_habiles_vacacion
            return _calcular_dias_habiles_vacacion(obj.fecha_inicio, obj.fecha_fin)
        return 0

    def validate_empleado(self, empleado):
        return _exigir_propio_empleado(self, empleado)

    def validate_empresa(self, empresa):
        return _exigir_propia(self, empresa)

    def validate(self, attrs):
        empleado = attrs.get('empleado', getattr(self.instance, 'empleado', None))
        empresa = attrs.get('empresa', getattr(self.instance, 'empresa', None))
        if empleado and empresa and empleado.empresa_id != empresa.id:
            raise serializers.ValidationError({'empresa': 'El trabajador no pertenece a esta empresa.'})
        return attrs

    class Meta:
        model = VacacionEmpleado
        fields = [
            'id', 'empleado', 'empresa',
            'fecha_inicio', 'fecha_fin', 'dias_habiles',
            'tipo', 'estado', 'observaciones',
            'archivo_pdf', 'creado_en',
            'dias_habiles_calculados',
        ]
        read_only_fields = ('id', 'archivo_pdf', 'creado_en', 'dias_habiles_calculados')


class FiniquitoSerializer(serializers.ModelSerializer):
    causal_articulo_label = serializers.SerializerMethodField()

    def get_causal_articulo_label(self, obj):
        return obj.get_causal_articulo_display() if obj.causal_articulo else ''

    def validate_empleado(self, empleado):
        return _exigir_propio_empleado(self, empleado)

    class Meta:
        model = Finiquito
        fields = [
            'id', 'empleado', 'documento_legal',
            'causal_articulo', 'causal_articulo_label',
            'fecha_termino', 'fecha_emision',
            'sueldo_base', 'dias_trabajados_ultimo_mes', 'gratificacion_proporcional',
            'feriado_proporcional', 'indemnizacion_anos_servicio',
            'indemnizacion_sustitutiva_aviso', 'otros_haberes', 'otros_descuentos',
            'descuentos_prevision', 'total_a_pagar',
            'modalidad', 'aviso_previo_dado', 'archivo_pdf', 'creado_en',
        ]
        # Los montos los calcula el backend (_calcular_finiquito): nunca se
        # aceptan desde el cliente.
        read_only_fields = ('id', 'archivo_pdf', 'creado_en', 'causal_articulo_label',
                            'sueldo_base', 'gratificacion_proporcional', 'feriado_proporcional',
                            'indemnizacion_anos_servicio', 'indemnizacion_sustitutiva_aviso',
                            'descuentos_prevision', 'total_a_pagar')


class CustomPasswordResetSerializer(PasswordResetSerializer):
    def get_email_options(self):
        return {
            'html_email_template_name': 'registration/password_reset_email.html',
            'email_template_name': 'registration/password_reset_email.txt',
        }


class LoginPorRutSerializer(LoginSerializer):
    """Inicio de sesión solo con el RUT del titular (el `username`).

    El correo no identifica a una cuenta: el registro no lo exige único y una
    persona puede tener varias cuentas con el mismo correo. Con el login por
    correo de dj-rest-auth, un correo repetido hacía fallar la búsqueda con un
    error 500, y además ese camino no pasaba por el límite de intentos por
    cuenta, que se calcula sobre el `username`.
    """
    # Quitar el campo hace que dj-rest-auth autentique solo por username.
    email = None

    def validate(self, attrs):
        if not (attrs.get('username') or '').strip():
            raise serializers.ValidationError(
                {'username': 'Ingresa el RUT del titular de la cuenta.'})
        # "123456785" y "12.345.678-5" son la misma cuenta.
        attrs['username'] = normalizar_rut_usuario(attrs['username'])
        return super().validate(attrs)
