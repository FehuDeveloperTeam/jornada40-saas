from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0026_solicitudfirma_finiquito'),
    ]

    operations = [
        migrations.AddField(
            model_name='plan',
            name='nivel',
            field=models.IntegerField(default=1),
        ),
    ]
