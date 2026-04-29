from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0021_despido_campos_legales'),
    ]

    operations = [
        migrations.CreateModel(
            name='VacacionEmpleado',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('fecha_inicio', models.DateField()),
                ('fecha_fin', models.DateField()),
                ('dias_habiles', models.PositiveIntegerField(default=0)),
                ('tipo', models.CharField(
                    max_length=25,
                    default='VACACION_LEGAL',
                    choices=[
                        ('VACACION_LEGAL',      'Vacación Legal (Art. 67)'),
                        ('VACACION_PROGRESIVA', 'Feriado Progresivo (Art. 68)'),
                        ('PERMISO_SIN_GOCE',    'Permiso Sin Goce de Sueldo'),
                    ],
                )),
                ('estado', models.CharField(
                    max_length=12,
                    default='APROBADO',
                    choices=[
                        ('PENDIENTE',  'Pendiente de aprobación'),
                        ('APROBADO',   'Aprobado'),
                        ('RECHAZADO',  'Rechazado'),
                    ],
                )),
                ('observaciones', models.TextField(blank=True, default='')),
                ('archivo_pdf', models.FileField(blank=True, null=True, upload_to='vacaciones/')),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('empleado', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='vacaciones',
                    to='core.empleado',
                )),
                ('empresa', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='vacaciones',
                    to='core.empresa',
                )),
            ],
            options={
                'ordering': ['-fecha_inicio'],
            },
        ),
    ]
