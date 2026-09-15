from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0031_comisiones_semana_corrida'),
    ]

    operations = [
        migrations.AddField(
            model_name='liquidacion',
            name='sueldo_base_contrato',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='liquidacion',
            name='gratificacion_legal',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
        migrations.AddField(
            model_name='liquidacion',
            name='tipo_contrato',
            field=models.CharField(blank=True, default='', max_length=20),
        ),
    ]
