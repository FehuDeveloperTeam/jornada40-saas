from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0030_alter_solicitudfirma_estado'),
    ]

    operations = [
        migrations.AddField(
            model_name='contrato',
            name='es_comisionista',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='contrato',
            name='comisiones_config',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='liquidacion',
            name='detalle_comisiones',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='liquidacion',
            name='semana_corrida',
            field=models.IntegerField(default=0),
        ),
    ]
