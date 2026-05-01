from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0023_solicitudfirma_liquidacion_vacacion'),
    ]

    operations = [
        migrations.AddField(
            model_name='solicitudfirma',
            name='motivo_rechazo',
            field=models.TextField(blank=True, default=''),
        ),
    ]
