from django.db import migrations, models

ORIGEN_CHOICES = [
    ('MANUAL', 'Carga manual'),
    ('PREVIRED', 'Propuesta leída de Previred'),
]


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0035_seed_parametros_previsionales'),
    ]

    operations = [
        migrations.AddField(
            model_name='parametroprevisional',
            name='origen',
            field=models.CharField(choices=ORIGEN_CHOICES, default='MANUAL', max_length=10),
        ),
        migrations.AddField(
            model_name='tasaafp',
            name='origen',
            field=models.CharField(choices=ORIGEN_CHOICES, default='MANUAL', max_length=10),
        ),
        migrations.AddField(
            model_name='tasaafp',
            name='confirmado',
            field=models.BooleanField(default=True),
        ),
    ]
