import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0024_solicitudfirma_motivo_rechazo'),
    ]

    operations = [
        migrations.CreateModel(
            name='Finiquito',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('causal_articulo', models.CharField(
                    blank=True, default='', max_length=20,
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
                        ('160_2', 'Art. 160 N°2 — Negociaciones prohibidas en el contrato'),
                        ('160_3', 'Art. 160 N°3 — Inasistencias injustificadas'),
                        ('160_4a', 'Art. 160 N°4 a) — Abandono: salida intempestiva'),
                        ('160_4b', 'Art. 160 N°4 b) — Abandono: negativa injustificada a trabajar'),
                        ('160_5', 'Art. 160 N°5 — Actos que afectan la seguridad'),
                        ('160_6', 'Art. 160 N°6 — Daño material intencional'),
                        ('160_7', 'Art. 160 N°7 — Incumplimiento grave del contrato'),
                        ('161_1', 'Art. 161 inc. 1° — Necesidades de la empresa'),
                        ('161_2', 'Art. 161 inc. 2° — Desahucio del empleador'),
                        ('163bis', 'Art. 163 bis — Liquidación concursal del empleador'),
                    ],
                )),
                ('fecha_termino', models.DateField()),
                ('fecha_emision', models.DateField()),
                ('sueldo_base', models.IntegerField(default=0)),
                ('dias_trabajados_ultimo_mes', models.IntegerField(default=30)),
                ('gratificacion_proporcional', models.IntegerField(default=0)),
                ('feriado_proporcional', models.IntegerField(default=0)),
                ('indemnizacion_anos_servicio', models.IntegerField(default=0)),
                ('indemnizacion_sustitutiva_aviso', models.IntegerField(default=0)),
                ('otros_haberes', models.IntegerField(default=0)),
                ('otros_descuentos', models.IntegerField(default=0)),
                ('descuentos_prevision', models.IntegerField(default=0)),
                ('total_a_pagar', models.IntegerField(default=0)),
                ('modalidad', models.CharField(
                    max_length=15, default='PRESENCIAL',
                    choices=[
                        ('PRESENCIAL', 'Presencial ante ministro de fe'),
                        ('ELECTRONICO', 'Electrónico (voluntario para el trabajador)'),
                    ],
                )),
                ('archivo_pdf', models.FileField(blank=True, null=True, upload_to='finiquitos/')),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('empleado', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='finiquitos',
                    to='core.empleado',
                )),
                ('documento_legal', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='finiquitos',
                    to='core.documentolegal',
                )),
            ],
            options={'ordering': ['-fecha_emision']},
        ),
    ]
