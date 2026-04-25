import uuid
import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0018_add_anexo_contrato_model'),
    ]

    operations = [
        # 1. Campos de firma en Empresa
        migrations.AddField(
            model_name='empresa',
            name='firma_imagen',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='empresa',
            name='firma_firmante_nombre',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='empresa',
            name='firma_firmante_cargo',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
        migrations.AddField(
            model_name='empresa',
            name='firma_configurada_en',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # 2. Restricción RUT único por empresa en Empleado
        migrations.AlterUniqueTogether(
            name='empleado',
            unique_together={('empresa', 'rut')},
        ),

        # 3. Modelo SolicitudFirma
        migrations.CreateModel(
            name='SolicitudFirma',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo_documento', models.CharField(choices=[
                    ('CONTRATO', 'Contrato Laboral'),
                    ('ANEXO_40H', 'Anexo Ley 40 Horas'),
                    ('AMONESTACION', 'Carta de Amonestación'),
                    ('DESPIDO', 'Carta de Despido'),
                    ('CONSTANCIA', 'Constancia Laboral'),
                    ('ANEXO_CONTRATO', 'Anexo de Contrato'),
                ], max_length=20)),
                ('token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('estado', models.CharField(choices=[
                    ('PENDIENTE', 'Pendiente de firma'),
                    ('FIRMADO', 'Firmado'),
                    ('RECHAZADO', 'Rechazado por el trabajador'),
                    ('EXPIRADO', 'Plazo vencido'),
                    ('CANCELADO', 'Cancelado por el empleador'),
                ], default='PENDIENTE', max_length=12)),
                ('b2_key_temporal', models.CharField(blank=True, default='', max_length=500)),
                ('b2_key_firmado', models.CharField(blank=True, default='', max_length=500)),
                ('firma_trabajador_imagen', models.TextField(blank=True, default='')),
                ('ip_firmante', models.GenericIPAddressField(blank=True, null=True)),
                ('email_firmante', models.EmailField(blank=True, default='', max_length=254)),
                ('enviado_en', models.DateTimeField(auto_now_add=True)),
                ('firmado_en', models.DateTimeField(blank=True, null=True)),
                ('expira_en', models.DateTimeField()),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('empleado', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='solicitudes_firma', to='core.empleado')),
                ('empresa', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='solicitudes_firma', to='core.empresa')),
                ('contrato', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.contrato')),
                ('documento_legal', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='core.documentolegal')),
            ],
            options={'ordering': ['-enviado_en']},
        ),

        # 4. Modelo OTPFirma
        migrations.CreateModel(
            name='OTPFirma',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(max_length=6)),
                ('email_destino', models.EmailField(max_length=254)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('expira_en', models.DateTimeField()),
                ('verificado', models.BooleanField(default=False)),
                ('intentos', models.PositiveSmallIntegerField(default=0)),
                ('solicitud', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='otps', to='core.solicitudfirma')),
            ],
        ),
    ]
