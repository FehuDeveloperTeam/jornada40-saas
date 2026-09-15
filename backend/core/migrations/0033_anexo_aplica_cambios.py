import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0032_liquidacion_terminos_congelados'),
    ]

    operations = [
        migrations.AddField(
            model_name='anexocontrato',
            name='cambios',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='anexocontrato',
            name='vigencia_desde',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='anexocontrato',
            name='aplicado',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='anexocontrato',
            name='aplicado_en',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='solicitudfirma',
            name='anexo_contrato',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='solicitudes_firma',
                to='core.anexocontrato',
            ),
        ),
    ]
