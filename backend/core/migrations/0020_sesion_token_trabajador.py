from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_firma_electronica'),
    ]

    operations = [
        migrations.AddField(
            model_name='solicitudfirma',
            name='sesion_token_trabajador',
            field=models.UUIDField(blank=True, null=True),
        ),
    ]
