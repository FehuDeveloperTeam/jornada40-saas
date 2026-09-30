"""Resumen por correo al empleador: frecuencia, contenido, silencio sin novedades y preferencia."""
from datetime import date, timedelta
from io import StringIO

from django.core import mail
from django.core.management import call_command
from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import Cliente, Contrato, SolicitudDocumento, SolicitudFirma
from ..views.resumen import corresponde, enviar
from .utiles import crear_empleado, crear_usuario_completo

LUNES, MARTES = date(2026, 9, 28), date(2026, 9, 29)


class ResumenTests(APITestCase):
    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('resumen', '21.000.000-3',
                                                                                '76.000.555-K')
        # Starter: sin los temas de Pyme (reglamento, Ley Karin, días libres), que se prueban aparte.
        self.plan.nivel = 2
        self.plan.save()
        self.emp = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana', apellido='Rojas')
        # Contrato registrado en Mi DT hace tiempo: no aparece en el resumen salvo que se pida.
        self.contrato = Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', fecha_inicio='2024-01-01',
                                                sueldo_base=600_000, horas_semanales=42)
        self.empresa.registros_dt.create(clave=f'CONTRATO:{self.contrato.id}', registrado_en=timezone.now())

    def test_frecuencia(self):
        c = self.cliente
        self.assertTrue(corresponde(c, LUNES))
        self.assertFalse(corresponde(c, MARTES))                    # semanal: solo lunes
        c.resumen_hasta = timezone.now() - timedelta(days=9)
        self.assertTrue(corresponde(c, MARTES))                     # se saltó un lunes
        c.frecuencia_resumen = 'DIARIA'
        self.assertTrue(corresponde(c, MARTES))
        c.resumen_hasta = timezone.make_aware(timezone.datetime(2026, 9, 29, 12))
        self.assertFalse(corresponde(c, MARTES))                    # ya se envió hoy
        c.frecuencia_resumen = 'NUNCA'
        self.assertFalse(corresponde(c, LUNES))

    def test_sin_novedades_no_envia_correo(self):
        self.assertFalse(enviar(self.cliente, hoy=LUNES))
        self.assertEqual(len(mail.outbox), 0)
        self.cliente.refresh_from_db()
        self.assertIsNotNone(self.cliente.resumen_hasta)

    def test_contenido(self):
        SolicitudDocumento.objects.create(empleado=self.emp, tipo='CONTRATO')
        SolicitudFirma.objects.create(empleado=self.emp, empresa=self.empresa, tipo_documento='LIQUIDACION',
                                      expira_en=timezone.now() + timedelta(days=1))
        SolicitudFirma.objects.create(empleado=self.emp, empresa=self.empresa, tipo_documento='VACACION',
                                      estado='RECHAZADO')
        # Contrato nuevo sin registrar y ya vencido su plazo en Mi DT.
        otro = crear_empleado(self.empresa, '9.876.543-3', nombres='Luis', apellido='Soto')
        Contrato.objects.create(empleado=otro, tipo_contrato='INDEFINIDO', fecha_inicio='2026-01-05',
                                sueldo_base=600_000, horas_semanales=42)
        self.assertTrue(enviar(self.cliente))
        cuerpo = mail.outbox[0].body
        self.assertIn('Ana Rojas pidió: contrato de trabajo.', cuerpo)
        self.assertIn('sin firmar: liquidación de sueldo de Ana Rojas', cuerpo)
        self.assertIn('Ana Rojas rechazó: comprobante de vacaciones.', cuerpo)
        self.assertIn('Plazo vencido', cuerpo)
        self.assertIn('Luis Soto', cuerpo)
        self.assertEqual(mail.outbox[0].to, ['resumen@test.com'])
        self.assertIn('/app/solicitudes', mail.outbox[0].alternatives[0][0])

    def test_solo_lo_propio(self):
        otro, _, _, empresa2 = crear_usuario_completo('ajeno', '11.111.111-1', '77.777.777-7')
        SolicitudDocumento.objects.create(empleado=crear_empleado(empresa2, '9.876.543-3'), tipo='CONTRATO')
        self.assertFalse(enviar(self.cliente))

    def test_comando_y_preferencia(self):
        SolicitudDocumento.objects.create(empleado=self.emp, tipo='CONTRATO')
        Cliente.objects.filter(pk=self.cliente.pk).update(frecuencia_resumen='DIARIA')
        salida = StringIO()
        call_command('enviar_resumenes', stdout=salida)
        call_command('enviar_resumenes', stdout=salida)            # el mismo día no repite
        self.assertEqual(len(mail.outbox), 1)
        self.client.force_authenticate(self.user)
        r = self.client.patch('/api/clientes/resumen/', {'frecuencia': 'NUNCA'}, format='json')
        self.assertEqual(r.data['frecuencia'], 'NUNCA')
        self.assertEqual(self.client.patch('/api/clientes/resumen/', {'frecuencia': 'X'}, format='json').status_code, 400)
        self.assertEqual(len(self.client.get('/api/clientes/resumen/').data['opciones']), 3)

    def test_pyme_recuerda_reglamento_y_ley_karin(self):
        self.plan.nivel = 3
        self.plan.save()
        self.assertTrue(enviar(self.cliente))
        cuerpo = mail.outbox[0].body
        self.assertIn('Reglamento interno y Ley Karin', cuerpo)
        self.assertIn('canales de denuncia', cuerpo)
