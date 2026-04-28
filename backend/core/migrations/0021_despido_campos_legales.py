from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0020_sesion_token_trabajador'),
    ]

    operations = [
        migrations.AddField(
            model_name='documentolegal',
            name='causal_articulo',
            field=models.CharField(
                blank=True,
                null=True,
                max_length=20,
                choices=[
                    ('159_1', 'Art. 159 N°1 — Mutuo acuerdo de las partes'),
                    ('159_2', 'Art. 159 N°2 — Renuncia voluntaria del trabajador'),
                    ('159_3', 'Art. 159 N°3 — Muerte del trabajador'),
                    ('159_4', 'Art. 159 N°4 — Vencimiento del plazo convenido'),
                    ('159_5', 'Art. 159 N°5 — Conclusión del trabajo o servicio'),
                    ('159_6', 'Art. 159 N°6 — Caso fortuito o fuerza mayor'),
                    ('160_1a', 'Art. 160 N°1 a) — Falta de probidad'),
                    ('160_1b', 'Art. 160 N°1 b) — Acoso sexual'),
                    ('160_1c', 'Art. 160 N°1 c) — Vías de hecho contra empleador u otro trabajador'),
                    ('160_1d', 'Art. 160 N°1 d) — Injurias al empleador'),
                    ('160_1e', 'Art. 160 N°1 e) — Conducta inmoral grave'),
                    ('160_1f', 'Art. 160 N°1 f) — Acoso laboral (mobbing)'),
                    ('160_2',  'Art. 160 N°2 — Negociaciones prohibidas en el contrato'),
                    ('160_3',  'Art. 160 N°3 — Inasistencias injustificadas'),
                    ('160_4a', 'Art. 160 N°4 a) — Abandono: salida intempestiva'),
                    ('160_4b', 'Art. 160 N°4 b) — Abandono: negativa injustificada a trabajar'),
                    ('160_5',  'Art. 160 N°5 — Actos que afectan la seguridad'),
                    ('160_6',  'Art. 160 N°6 — Daño material intencional'),
                    ('160_7',  'Art. 160 N°7 — Incumplimiento grave del contrato'),
                    ('161_1',  'Art. 161 inc. 1° — Necesidades de la empresa'),
                    ('161_2',  'Art. 161 inc. 2° — Desahucio del empleador'),
                    ('163bis', 'Art. 163 bis — Liquidación concursal del empleador'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='documentolegal',
            name='fecha_ultimo_dia',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='documentolegal',
            name='cotizaciones_al_dia',
            field=models.BooleanField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='documentolegal',
            name='aviso_previo_dias',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='documentolegal',
            name='monto_indemnizacion_anos',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='documentolegal',
            name='monto_indemnizacion_sustitutiva',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='documentolegal',
            name='modalidad_finiquito',
            field=models.CharField(
                blank=True,
                null=True,
                max_length=15,
                choices=[
                    ('PRESENCIAL',  'Presencial ante ministro de fe'),
                    ('ELECTRONICO', 'Electrónico (voluntario para el trabajador)'),
                ],
            ),
        ),
        migrations.AddField(
            model_name='documentolegal',
            name='copia_inspeccion_trabajo',
            field=models.BooleanField(blank=True, null=True),
        ),
    ]
