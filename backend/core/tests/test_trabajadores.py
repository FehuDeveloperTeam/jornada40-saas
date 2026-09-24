"""Carga masiva de trabajadores y validación de contratos."""
from rest_framework import status
from rest_framework.test import APITestCase
from ..models import Empleado
from ..serializers import ContratoSerializer

from .utiles import crear_empleado, crear_excel_bytes, crear_usuario_completo


# ─── A6 / A7: Límites en carga masiva Excel ───────────────────────────────────

class CargaMasivaLimitesTests(APITestCase):
    """El endpoint de importación Excel debe rechazar archivos grandes o con muchas filas."""

    def setUp(self):
        self.user, _, _, self.empresa = crear_usuario_completo(
            'a6_user', '55500000-1', '66600001-1'
        )
        self.client.force_authenticate(user=self.user)
        self.url = '/api/empleados/carga_masiva/'

    def test_archivo_mayor_5mb_retorna_400(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        contenido = b'0' * (6 * 1024 * 1024)
        archivo = SimpleUploadedFile('grande.xlsx', contenido,
                                     content_type='application/octet-stream')
        resp = self.client.post(
            self.url, {'empresa': self.empresa.id, 'file': archivo},
            format='multipart'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('5 MB', resp.data.get('error', ''))

    def test_mas_de_500_filas_retorna_400(self):
        excel = crear_excel_bytes(filas=501)
        resp = self.client.post(
            self.url, {'empresa': self.empresa.id, 'file': excel},
            format='multipart'
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('500', resp.data.get('error', ''))

    def test_500_filas_exactas_no_retorna_400_por_limite(self):
        excel = crear_excel_bytes(filas=500)
        resp = self.client.post(
            self.url, {'empresa': self.empresa.id, 'file': excel},
            format='multipart'
        )
        # No debe rechazar por límite de filas (puede fallar por RUTs inválidos, pero no por límite)
        self.assertNotEqual(resp.data.get('error', ''), 'El archivo no puede tener más de 500 filas por importación.')

class ContratoValidacionFechasTests(APITestCase):
    """Verifica las reglas de fecha/duración de ContratoSerializer."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo(
            'contrato_owner', '11.111.111-1', '76.111.111-1'
        )
        self.empleado = crear_empleado(self.empresa, '22.222.222-2')

    def _data(self, **overrides):
        base = {
            'empleado': self.empleado.id,
            'tipo_contrato': 'PLAZO_FIJO',
            'cargo': 'Analista',
            'fecha_inicio': '2026-01-01',
            'fecha_fin': '2026-06-01',
            'sueldo_base': 500000,
        }
        base.update(overrides)
        return base

    def test_plazo_fijo_sin_fecha_fin_es_invalido(self):
        serializer = ContratoSerializer(data=self._data(fecha_fin=None))
        self.assertFalse(serializer.is_valid())
        self.assertIn('fecha_fin', serializer.errors)

    def test_fecha_fin_anterior_a_inicio_es_invalido(self):
        serializer = ContratoSerializer(data=self._data(fecha_inicio='2026-06-01', fecha_fin='2026-01-01'))
        self.assertFalse(serializer.is_valid())
        self.assertIn('fecha_fin', serializer.errors)

    def test_plazo_fijo_mas_de_un_ano_sin_titulo_es_invalido(self):
        serializer = ContratoSerializer(data=self._data(fecha_inicio='2026-01-01', fecha_fin='2027-06-01'))
        self.assertFalse(serializer.is_valid())
        self.assertIn('fecha_fin', serializer.errors)

    def test_plazo_fijo_dos_anos_con_titulo_es_valido(self):
        serializer = ContratoSerializer(data=self._data(
            fecha_inicio='2026-01-01', fecha_fin='2027-12-01', es_profesional_titulado=True
        ))
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_indefinido_sin_fecha_fin_es_valido(self):
        serializer = ContratoSerializer(data=self._data(tipo_contrato='INDEFINIDO', fecha_fin=None))
        self.assertTrue(serializer.is_valid(), serializer.errors)


class CargaMasivaRevisionTests(APITestCase):
    """Importador: revisión previa sin guardar, resultado por fila y actualización sin borrar datos."""

    def setUp(self):
        self.user, self.cliente, self.plan, self.empresa = crear_usuario_completo('carga_owner', '16.666.666-6', '76.321.321-3')
        self.plan.nivel = 3; self.plan.limite_trabajadores = 3; self.plan.save()
        self.client.force_authenticate(self.user)
        self.existente = crear_empleado(self.empresa, '12.345.678-5')
        self.existente.email = 'guardado@example.com'; self.existente.cargo = 'BODEGUERO'; self.existente.save()

    def _excel(self, filas):
        import io
        from django.core.files.uploadedfile import SimpleUploadedFile
        import pandas as pd
        buf = io.BytesIO(); pd.DataFrame(filas).to_excel(buf, index=False)
        return SimpleUploadedFile('t.xlsx', buf.getvalue(),
                                  content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    def _subir(self, filas, previsualizar=False):
        url = '/api/empleados/carga_masiva/' + ('?previsualizar=1' if previsualizar else '')
        return self.client.post(url, {'empresa': self.empresa.id, 'file': self._excel(filas)}, format='multipart')

    def _nuevo(self, rut, **extra):
        return {'rut': rut, 'nombres': 'Ana', 'apellido_paterno': 'Rojas', 'cargo': 'Vendedora',
                'fecha_ingreso': '01-03-2025', 'sueldo_base': 600000, 'horas_laborales': 42, **extra}

    def test_previsualizar_no_guarda_y_detalla_filas(self):
        filas = [self._nuevo('11.111.111-1'), {'rut': '12.345.678-5', 'cargo': 'Jefe de bodega'},
                 {'rut': '11.111.111-2', 'nombres': 'X'}, self._nuevo('9.876.543-3', horas_laborales=45)]
        antes = Empleado.objects.count()
        r = self._subir(filas, previsualizar=True)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Empleado.objects.count(), antes)
        res = {f['rut']: f for f in r.data['filas']}
        self.assertEqual(res['11.111.111-1']['resultado'], 'nuevo')
        self.assertEqual(res['12.345.678-5']['resultado'], 'actualiza')
        self.assertIn('cargo', res['12.345.678-5']['cambios'])
        self.assertEqual(res['11.111.111-2']['resultado'], 'error')      # RUT inválido: ya no se omite en silencio
        self.assertIn('RUT inválido', res['11.111.111-2']['mensaje'])
        self.assertIn('máximo legal', res['9.876.543-3']['alerta'])      # aviso, no bloqueo
        self.assertEqual(res['9.876.543-3']['resultado'], 'nuevo')

    def test_actualizar_no_borra_columnas_ausentes(self):
        r = self._subir([{'rut': '12.345.678-5', 'cargo': 'Jefe de bodega'}])
        self.assertEqual(r.status_code, 200)
        self.existente.refresh_from_db()
        self.assertEqual(self.existente.cargo, 'JEFE DE BODEGA')
        self.assertEqual(self.existente.email, 'guardado@example.com')

    def test_nuevo_sin_fecha_de_ingreso_es_error(self):
        fila = self._nuevo('11.111.111-1'); fila['fecha_ingreso'] = ''
        r = self._subir([fila])
        self.assertEqual(r.data['filas'][0]['resultado'], 'error')
        self.assertIn('fecha de ingreso', r.data['filas'][0]['mensaje'])
        self.assertFalse(Empleado.objects.filter(rut='11.111.111-1').exists())

    def test_limite_del_plan_por_fila(self):
        r = self._subir([self._nuevo('11.111.111-1'), self._nuevo('9.876.543-3'), self._nuevo('7.654.321-6')])
        resultados = [f['resultado'] for f in r.data['filas']]
        self.assertEqual(resultados, ['nuevo', 'nuevo', 'limite'])   # 1 existente + 2 nuevos = 3
        self.assertTrue(r.data['limite_alcanzado'])
        self.assertEqual(r.data['agregados'], 2)
