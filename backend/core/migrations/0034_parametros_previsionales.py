from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0033_anexo_aplica_cambios'),
    ]

    operations = [
        migrations.CreateModel(
            name='ParametroPrevisional',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('vigente_desde', models.DateField(help_text='Primer día del período en que rigen estos valores.', unique=True)),
                ('tope_imponible_afp_uf', models.DecimalField(decimal_places=2, default=87.8, max_digits=6)),
                ('tope_imponible_afc_uf', models.DecimalField(decimal_places=2, default=131.9, max_digits=6)),
                ('ingreso_minimo_mensual', models.IntegerField(default=529000)),
                ('factor_gratificacion', models.DecimalField(decimal_places=2, default=4.75, max_digits=4)),
                ('tasa_salud', models.DecimalField(decimal_places=5, default=0.07, max_digits=6)),
                ('tasa_afc_trabajador_indefinido', models.DecimalField(decimal_places=5, default=0.006, max_digits=6)),
                ('tasa_afc_empleador_indefinido', models.DecimalField(decimal_places=5, default=0.024, max_digits=6)),
                ('tasa_afc_empleador_plazo', models.DecimalField(decimal_places=5, default=0.03, max_digits=6)),
                ('tasa_sis', models.DecimalField(decimal_places=5, default=0.0149, max_digits=6)),
                ('tasa_mutual_base', models.DecimalField(decimal_places=5, default=0.0093, max_digits=6)),
                ('tasa_expectativa_vida', models.DecimalField(decimal_places=5, default=0.009, max_digits=6)),
                ('confirmado', models.BooleanField(default=False)),
                ('notas', models.TextField(blank=True, default='')),
            ],
            options={
                'verbose_name': 'Parámetro previsional',
                'verbose_name_plural': 'Parámetros previsionales',
                'ordering': ['-vigente_desde'],
            },
        ),
        migrations.CreateModel(
            name='TasaAFP',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=50)),
                ('tasa', models.DecimalField(decimal_places=5, max_digits=6)),
                ('vigente_desde', models.DateField()),
            ],
            options={
                'verbose_name': 'Tasa AFP',
                'verbose_name_plural': 'Tasas AFP',
                'ordering': ['-vigente_desde', 'nombre'],
                'unique_together': {('nombre', 'vigente_desde')},
            },
        ),
        migrations.AddField(
            model_name='liquidacion',
            name='valor_uf',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]
