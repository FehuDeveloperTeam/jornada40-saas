import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0036_origen_parametros'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConceptoRemuneracion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.SlugField(max_length=40)),
                ('nombre', models.CharField(max_length=100)),
                ('tipo', models.CharField(choices=[
                    ('HABER_IMPONIBLE', 'Haber imponible'),
                    ('HABER_NO_IMPONIBLE', 'Haber no imponible'),
                    ('HORA_EXTRA', 'Hora extra'),
                    ('COMISION', 'Comisión por venta'),
                    ('DESCUENTO', 'Descuento'),
                ], max_length=20)),
                ('es_imponible', models.BooleanField(default=False)),
                ('es_tributable', models.BooleanField(default=False)),
                ('afecta_gratificacion', models.BooleanField(default=False)),
                ('afecta_semana_corrida', models.BooleanField(default=False)),
                ('codigo_lre', models.CharField(blank=True, default='', max_length=20)),
                ('activo', models.BooleanField(default=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('empresa', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.CASCADE,
                    related_name='conceptos_remuneracion', to='core.empresa')),
            ],
            options={
                'verbose_name': 'Concepto de remuneración',
                'verbose_name_plural': 'Conceptos de remuneración',
                'ordering': ['tipo', 'nombre'],
            },
        ),
        migrations.AddConstraint(
            model_name='conceptoremuneracion',
            constraint=models.UniqueConstraint(
                condition=models.Q(('empresa__isnull', True)), fields=('codigo',),
                name='concepto_codigo_unico_en_sistema'),
        ),
        migrations.AddConstraint(
            model_name='conceptoremuneracion',
            constraint=models.UniqueConstraint(
                condition=models.Q(('empresa__isnull', False)), fields=('empresa', 'codigo'),
                name='concepto_codigo_unico_por_empresa'),
        ),
    ]
