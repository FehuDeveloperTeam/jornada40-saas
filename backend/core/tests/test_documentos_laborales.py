"""Pactos, autorizaciones y constancias estructurados: reglas, PDF, firma y avisos en la liquidación."""
import datetime
from unittest.mock import patch

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from ..models import (AnexoContrato, ConceptoRemuneracion, Contrato, DocumentoLaboral, Empleado, Empresa, Plan,
                      SolicitudFirma)
from ..views.documentos_laborales import dias_permiso
from .utiles import crear_empleado, crear_usuario_completo


class DocumentosBase(APITestCase):
    def setUp(self):
        self.user, _, self.plan, self.empresa = crear_usuario_completo('docs', '21.000.000-3', '76.000.555-2')
        self.emp = crear_empleado(self.empresa, '12.345.678-5', nombres='Ana', apellido='Rojas')
        Empleado.objects.filter(pk=self.emp.pk).update(email='ana@correo.cl', afp='HABITAT', sistema_salud='FONASA')
        self.contrato = Contrato.objects.create(empleado=self.emp, tipo_contrato='INDEFINIDO', cargo='Analista',
                                                fecha_inicio='2024-01-01', sueldo_base=1_000_000, horas_semanales=42)
        self.user = User.objects.get(pk=self.user.pk)
        self.client.force_authenticate(self.user)
        # UF y UTM fijas (como @indicadores_fijos), sin consultar la red.
        for modulo in ('calculo_liquidacion', 'liquidaciones', 'parametros'):
            p = patch(f'core.views.{modulo}.obtener_uf', return_value=41057.20)
            p.start()
            self.addCleanup(p.stop)
        for modulo in ('calculo_liquidacion', 'parametros'):
            p = patch(f'core.views.{modulo}.obtener_utm', return_value=71721.0)
            p.start()
            self.addCleanup(p.stop)

    def _crear(self, tipo, **datos):
        return self.client.post('/api/documentos-laborales/', {'empleado': self.emp.id, 'tipo': tipo, 'datos': datos},
                                format='json')

    def _firmar(self, doc_id):
        doc = DocumentoLaboral.objects.get(pk=doc_id)
        return SolicitudFirma.objects.create(empleado=self.emp, empresa=self.empresa, documento_laboral=doc,
                                             tipo_documento=doc.tipo, estado='FIRMADO', firmado_en=timezone.now())


class HorasExtraTests(DocumentosBase):
    def test_pacto_calcula_vigencia_y_valida(self):
        r = self._crear('HORAS_EXTRA', desde='2026-09-01', meses=3, horas_diarias=2, motivo='DEMANDA')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual((r.data['vigente_desde'], r.data['vigente_hasta']), ('2026-09-01', '2026-11-30'))
        self.assertEqual(self._crear('HORAS_EXTRA', desde='2026-12-01', meses=4, horas_diarias=2,
                                     motivo='DEMANDA').status_code, 400)        # más de 3 meses
        self.assertEqual(self._crear('HORAS_EXTRA', desde='2026-12-01', meses=1, horas_diarias=3,
                                     motivo='DEMANDA').status_code, 400)        # más de 2 h diarias
        self.assertEqual(self._crear('HORAS_EXTRA', desde='2026-10-15', meses=1, horas_diarias=1,
                                     motivo='DEMANDA').status_code, 400)        # se cruza con el vigente
        self.assertEqual(self._crear('HORAS_EXTRA', desde='2026-12-01', meses=1, horas_diarias=1,
                                     motivo='TEXTO LIBRE').status_code, 400)
        pdf = self.client.get(f"/api/documentos-laborales/{r.data['id']}/generar_pdf/")
        self.assertTrue(pdf.content.startswith(b'%PDF'))

    def test_aviso_en_liquidacion_sin_pacto_firmado(self):
        concepto = ConceptoRemuneracion.objects.get(codigo='HORA_EXTRA_50', empresa=None)
        datos = {'empleado': self.emp.id, 'mes': 9, 'anio': 2026, 'detalle_items': [
            {'concepto': concepto.id, 'naturaleza': 'HORA_EXTRA', 'glosa': 'HE', 'horas': 5, 'recargo': 50}]}
        sim = self.client.post('/api/liquidaciones/simular/', datos, format='json')
        self.assertEqual(sim.status_code, 200, sim.data)
        self.assertTrue(any('horas extra' in a for a in sim.data['avisos_documentos']))
        doc = self._crear('HORAS_EXTRA', desde='2026-09-01', meses=1, horas_diarias=2, motivo='DEMANDA').data
        sim = self.client.post('/api/liquidaciones/simular/', datos, format='json')
        self.assertTrue(any('horas extra' in a for a in sim.data['avisos_documentos']))   # aún sin firmar
        self._firmar(doc['id'])
        sim = self.client.post('/api/liquidaciones/simular/', datos, format='json')
        self.assertEqual(sim.data['avisos_documentos'], [])

    def test_art_22_avisa_sin_bloquear(self):
        Contrato.objects.filter(pk=self.contrato.pk).update(tipo_jornada='ART_22')
        r = self._crear('HORAS_EXTRA', desde='2026-09-01', meses=1, horas_diarias=1, motivo='DEMANDA')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.data['avisos'])


class DescuentoTests(DocumentosBase):
    def setUp(self):
        super().setUp()
        self.prestamo = ConceptoRemuneracion.objects.get(codigo='PRESTAMO', empresa=None)

    def test_solo_conceptos_voluntarios_y_cuotas(self):
        opciones = self.client.get('/api/documentos-laborales/opciones/', {'empleado': self.emp.id}).data
        nombres = [c['texto'] for c in opciones['conceptos_descuento']]
        self.assertIn(self.prestamo.nombre, nombres)
        judicial = ConceptoRemuneracion.objects.get(codigo='RETENCION_JUDICIAL', empresa=None)
        self.assertNotIn(judicial.nombre, nombres)
        r = self._crear('DESCUENTO', concepto=judicial.id, finalidad='PRESTAMO', monto_cuota=50_000, cuotas=3,
                        desde='2026-09-01')
        self.assertEqual(r.status_code, 400)
        r = self._crear('DESCUENTO', concepto=self.prestamo.id, finalidad='PRESTAMO', monto_cuota=50_000, cuotas=3,
                        desde='2026-09-15')
        self.assertEqual((r.status_code, r.data['vigente_desde'], r.data['vigente_hasta']),
                         (201, '2026-09-01', '2026-11-30'))
        r = self._crear('DESCUENTO', concepto=self.prestamo.id, finalidad='PRESTAMO', monto_cuota=200_000, cuotas=0,
                        desde='2026-09-01')
        self.assertIsNone(r.data['vigente_hasta'])
        self.assertTrue(r.data['avisos'])           # sobre el 15 % del sueldo: aviso, no bloqueo

    def test_avisos_de_la_liquidacion(self):
        judicial = ConceptoRemuneracion.objects.get(codigo='RETENCION_JUDICIAL', empresa=None)
        datos = {'empleado': self.emp.id, 'mes': 9, 'anio': 2026, 'detalle_items': [
            {'concepto': self.prestamo.id, 'naturaleza': 'DESCUENTO', 'glosa': 'P', 'valor': 60_000},
            {'concepto': judicial.id, 'naturaleza': 'DESCUENTO', 'glosa': 'J', 'valor': 300_000}]}
        avisos = self.client.post('/api/liquidaciones/simular/', datos, format='json').data['avisos_documentos']
        self.assertEqual(len(avisos), 1)                 # la retención judicial no requiere autorización
        self.assertIn('Art. 58', avisos[0])
        doc = self._crear('DESCUENTO', concepto=self.prestamo.id, finalidad='PRESTAMO', monto_cuota=50_000, cuotas=3,
                          desde='2026-09-01').data
        self._firmar(doc['id'])
        avisos = self.client.post('/api/liquidaciones/simular/', datos, format='json').data['avisos_documentos']
        self.assertEqual(len(avisos), 1)
        self.assertIn('supera la cuota', avisos[0])
        datos['detalle_items'][0]['valor'] = 50_000
        self.assertEqual(self.client.post('/api/liquidaciones/simular/', datos, format='json').data['avisos_documentos'],
                         [])


class PermisoTests(DocumentosBase):
    def test_dias_calculados_por_el_sistema(self):
        # 4 hábiles desde el viernes 18-09-2026: 18 y 19 son feriados (Fiestas Patrias), domingo 20 no cuenta.
        fin = dias_permiso(datetime.date(2026, 9, 17), 4, 'hábiles')
        self.assertEqual(fin, datetime.date(2026, 9, 23))
        self.assertEqual(dias_permiso(datetime.date(2026, 9, 1), 10, 'corridos'), datetime.date(2026, 9, 10))

    def test_fallecimiento_corre_desde_el_hecho(self):
        r = self._crear('PERMISO_LEGAL', permiso='FALLECIMIENTO_HIJO', fecha_hecho='2026-09-01', inicio='2026-09-20')
        self.assertEqual((r.status_code, r.data['vigente_desde'], r.data['vigente_hasta']),
                         (201, '2026-09-01', '2026-09-10'))
        r = self._crear('PERMISO_LEGAL', permiso='NACIMIENTO', fecha_hecho='2026-09-01', inicio='2026-11-01')
        self.assertEqual(r.status_code, 400)            # fuera del primer mes
        r = self._crear('PERMISO_LEGAL', permiso='MATRIMONIO', fecha_hecho='2026-09-05', inicio='2026-09-07')
        self.assertEqual((r.status_code, r.data['vigente_hasta']), (201, '2026-09-11'))

    def test_aviso_si_se_descuenta_ausencia_en_el_mes_del_permiso(self):
        doc = self._crear('PERMISO_LEGAL', permiso='FALLECIMIENTO_PADRES', fecha_hecho='2026-09-07').data
        self._firmar(doc['id'])
        sim = self.client.post('/api/liquidaciones/simular/', {'empleado': self.emp.id, 'mes': 9, 'anio': 2026,
                                                                'dias_ausencia': 4}, format='json')
        self.assertTrue(any('permiso legal' in a for a in sim.data['avisos_documentos']))


class IndemnizacionTests(DocumentosBase):
    def test_desde_el_septimo_anio(self):
        r = self._crear('INDEMNIZACION', porcentaje='4.11', desde='2026-09-01')
        self.assertEqual(r.status_code, 400)
        Empleado.objects.filter(pk=self.emp.pk).update(fecha_ingreso='2019-03-01')
        self.assertEqual(self._crear('INDEMNIZACION', porcentaje='3', desde='2026-09-01').status_code, 400)
        r = self._crear('INDEMNIZACION', porcentaje='4.11', desde='2026-09-01')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(self._crear('INDEMNIZACION', porcentaje='5', desde='2026-10-01').status_code, 400)


class TeletrabajoTests(DocumentosBase):
    def _pacto(self, **extra):
        datos = {'modalidad': 'PARCIAL', 'lugar': 'DOMICILIO', 'desde': '2026-10-01', 'duracion': 'INDEFINIDA',
                 'desconexion': '20:00', 'equipos': ['COMPUTADOR'], 'dias_presenciales': ['LUNES', 'MIERCOLES'],
                 'compensacion': 20_000, **extra}
        return self._crear('TELETRABAJO', **datos)

    def test_crea_anexo_con_clausulas_legales(self):
        self.assertEqual(self._pacto(dias_presenciales=[]).status_code, 400)
        self.assertEqual(self._pacto(equipos=['NAVE']).status_code, 400)
        r = self._pacto()
        self.assertEqual(r.status_code, 201, r.data)
        anexo = AnexoContrato.objects.get(pk=r.data['anexo'])
        texto = ' '.join(anexo.clausulas_modificadas)
        self.assertIn('entre las 20:00 y las 08:00', texto)
        self.assertIn('lunes, miércoles', texto)
        self.assertIn('treinta días', texto)

    @patch('core.b2_client.eliminar_documento')
    @patch('core.b2_client.subir_documento')
    @patch('core.pdf_firma.agregar_certificado_firma', return_value=b'%PDF-firmado')
    @patch('core.b2_client.descargar_documento', return_value=b'%PDF-original')
    def test_al_firmarse_la_ficha_queda_hibrida(self, *_):
        import uuid
        anexo = AnexoContrato.objects.get(pk=self._pacto().data['anexo'])
        sesion = uuid.uuid4()
        solicitud = SolicitudFirma.objects.create(
            empleado=self.emp, empresa=self.empresa, tipo_documento='ANEXO_CONTRATO', anexo_contrato=anexo,
            estado='PENDIENTE', b2_key_temporal='pendientes/t.pdf', sesion_token_trabajador=sesion,
            expira_en=timezone.now() + datetime.timedelta(days=1))
        self.client.force_authenticate(None)
        r = self.client.post(f'/api/firma-publica/{solicitud.token}/firmar/',
                             {'sesion_token': str(sesion), 'firma_trabajador': 'data:image/png;base64,aGVsbG8='},
                             format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Empleado.objects.get(pk=self.emp.pk).modalidad, 'HIBRIDO')


class FirmaYPlanTests(DocumentosBase):
    @patch('core.b2_client.subir_documento')
    def test_se_envia_a_firma_y_no_se_anula_en_firma(self, _):
        Empresa.objects.filter(pk=self.empresa.pk).update(firma_imagen='data:image/png;base64,AAAA')
        doc = self._crear('PERMISO_LEGAL', permiso='FALLECIMIENTO_PADRES', fecha_hecho='2026-09-07').data
        with patch('core.views.firmas.SolicitudFirmaViewSet._enviar_email_firma'):
            r = self.client.post('/api/firmas/solicitar/', {'empleado_id': self.emp.id, 'tipo_documento': 'PERMISO_LEGAL',
                                                            'documento_laboral_id': doc['id']}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['documento_laboral'], doc['id'])
        self.assertEqual(self.client.post(f"/api/documentos-laborales/{doc['id']}/anular/").status_code, 400)

    def test_semilla_no_crea_y_otro_empleador_no_ve(self):
        Plan.objects.filter(pk=self.plan.pk).update(nivel=1)
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        self.assertEqual(self._crear('PERMISO_LEGAL', permiso='NACIMIENTO', fecha_hecho='2026-09-01',
                                     inicio='2026-09-01').status_code, 403)
        Plan.objects.filter(pk=self.plan.pk).update(nivel=3)
        self.client.force_authenticate(User.objects.get(pk=self.user.pk))
        doc = self._crear('PERMISO_LEGAL', permiso='NACIMIENTO', fecha_hecho='2026-09-01', inicio='2026-09-01').data
        otro, _, _, _ = crear_usuario_completo('docs_b', '11.111.111-1', '77.777.777-7')
        self.client.force_authenticate(otro)
        self.assertEqual(self.client.get('/api/documentos-laborales/', {'empleado': self.emp.id}).data, [])
        self.assertEqual(self.client.get(f"/api/documentos-laborales/{doc['id']}/generar_pdf/").status_code, 404)
