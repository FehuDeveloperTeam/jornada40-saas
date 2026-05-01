import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0025_finiquito'),
    ]

    operations = [
        migrations.AddField(
            model_name='solicitudfirma',
            name='finiquito',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='solicitudes_firma',
                to='core.finiquito',
            ),
        ),
        migrations.AlterField(
            model_name='solicitudfirma',
            name='tipo_documento',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('CONTRATO',        'Contrato Laboral'),
                    ('ANEXO_40H',       'Anexo Ley 40 Horas'),
                    ('AMONESTACION',    'Carta de Amonestación'),
                    ('DESPIDO',         'Carta de Despido'),
                    ('CONSTANCIA',      'Constancia Laboral'),
                    ('ANEXO_CONTRATO',  'Anexo de Contrato'),
                    ('LIQUIDACION',     'Liquidación de Sueldo'),
                    ('VACACION',        'Comprobante de Vacaciones'),
                    ('FINIQUITO',       'Finiquito de Término'),
                ],
            ),
        ),
    ]
