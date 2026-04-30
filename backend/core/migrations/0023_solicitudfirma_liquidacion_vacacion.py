from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0022_vacacion_empleado'),
    ]

    operations = [
        migrations.AddField(
            model_name='solicitudfirma',
            name='liquidacion',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='core.liquidacion',
            ),
        ),
        migrations.AddField(
            model_name='solicitudfirma',
            name='vacacion',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='core.vacacionempleado',
            ),
        ),
        migrations.AlterField(
            model_name='solicitudfirma',
            name='tipo_documento',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('CONTRATO',       'Contrato Laboral'),
                    ('ANEXO_40H',      'Anexo Ley 40 Horas'),
                    ('AMONESTACION',   'Carta de Amonestación'),
                    ('DESPIDO',        'Carta de Despido'),
                    ('CONSTANCIA',     'Constancia Laboral'),
                    ('ANEXO_CONTRATO', 'Anexo de Contrato'),
                    ('LIQUIDACION',    'Liquidación de Sueldo'),
                    ('VACACION',       'Comprobante de Vacaciones'),
                ],
            ),
        ),
    ]
