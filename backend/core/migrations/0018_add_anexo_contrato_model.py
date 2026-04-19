import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_contrato_archivo_anexo_40h_contrato_archivo_contrato_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='AnexoContrato',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('titulo', models.CharField(max_length=200)),
                ('descripcion', models.TextField(blank=True)),
                ('clausulas_modificadas', models.JSONField(blank=True, default=list)),
                ('fecha_emision', models.DateField()),
                ('archivo_pdf', models.FileField(blank=True, null=True, upload_to='anexos_contrato/')),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('contrato', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='anexos',
                    to='core.contrato',
                )),
            ],
        ),
    ]
