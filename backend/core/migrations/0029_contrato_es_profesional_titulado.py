from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0028_alter_contrato_sueldo_base_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='contrato',
            name='es_profesional_titulado',
            field=models.BooleanField(default=False, help_text='Gerente o profesional/técnico con título de educación superior — habilita el tope de 2 años en vez de 1 para contratos a plazo fijo (Art. 159 N°4 del Código del Trabajo).'),
        ),
    ]