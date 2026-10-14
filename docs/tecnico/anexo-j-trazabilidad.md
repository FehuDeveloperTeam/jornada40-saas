# Anexo J. Matriz de trazabilidad {.unnumbered #sec-anexo-j}

El capítulo 3 da, para cada requerimiento, la norma que lo origina y las pruebas que lo verifican. Este anexo, generado con `herramientas/anexos.py` desde ese capítulo, muestra la vista inversa: qué requerimientos verifica cada archivo de prueba. Los archivos `test_*` son del servidor (`backend/core/tests/`), los `*.spec.ts` son recorridos de navegador (`frontend/e2e/`) y los `*.test.ts` son pruebas unitarias de la interfaz o de la extensión.

#### Requerimientos por archivo de prueba {.unnumbered}

| Prueba | Requerimientos que verifica |
|---|---|
| `test_acceso_karin` | RF-KAR-02, RF-KAR-03, RF-KAR-04, RF-KAR-05, RF-KAR-06, RNF-SEG-06, RNF-SEG-07 |
| `test_alertas` | RNF-SEG-10, RNF-DIS-04, RNF-PRI-01 |
| `test_asignacion_familiar` | RF-REM-12, RN-REM-13 |
| `test_bitacora` | RF-CTA-03, RF-EQU-10, RF-EQU-11, RF-EQU-12, RNF-SEG-06, RNF-REN-02, RNF-PRI-01 |
| `test_certificado_sueldos` | RF-ARC-09, RF-ARC-10, RF-ARC-11 |
| `test_certificados` | RF-POR-12, RF-POR-13, RN-POR-02, RNF-PRI-03 |
| `test_csrf` | RNF-SEG-12 |
| `test_cuentas` | RF-CTA-01, RF-CTA-02, RF-CTA-03, RF-CTA-04, RF-CTA-05, RF-CTA-06, RF-CTA-07, RF-REM-10, RNF-SEG-05, RNF-PRI-02 |
| `test_denuncias_karin` | RF-KAR-04, RF-KAR-07, RF-KAR-08, RF-KAR-09, RF-KAR-10, RF-KAR-11, RF-KAR-12, RF-KAR-13, RF-KAR-14, RF-KAR-15, RF-KAR-16, RF-KAR-17, RF-KAR-18, RF-RES-05, RF-RES-07, RN-KAR-01, RNF-SEG-07, RNF-PRI-03 |
| `test_direccion_trabajo` | RF-CON-06, RF-CON-10, RF-FIR-14, RF-DT-01, RF-DT-02, RF-DT-03, RF-DT-04, RF-DT-05, RF-DT-06, RN-DT-01, RNF-COM-04 |
| `test_direcciones` | RF-CTA-11 |
| `test_documentos_laborales` | RF-CON-09, RF-REM-13, RF-DOC-06, RF-DOC-07, RF-DOC-08, RF-DOC-09, RF-DOC-10, RF-DOC-12, RF-DOC-13, RF-FIR-14, RN-DOC-01, RN-DOC-02, RN-DOC-03, RN-DOC-04, RN-DOC-05, RNF-LEG-02 |
| `test_ejemplos_documento` | RN-REM-02, RN-REM-05, RN-REM-08, RN-REM-12, RN-VAC-01, RN-VAC-03, RN-FIN-03, RN-FIN-04, RN-DT-01, RN-KAR-01, RNF-MAN-05 |
| `test_equipo` | RF-CTA-13, RF-EQU-01, RF-EQU-02, RF-EQU-04, RF-EQU-05 |
| `test_estado_portal` | RF-POR-16 |
| `test_extension` | RF-EXT-01, RF-EXT-02, RF-EXT-03, RF-EXT-04, RF-EXT-05, RF-EXT-09, RNF-SEG-05 |
| `test_feriado` | RF-VAC-01, RF-VAC-02, RF-VAC-03, RN-VAC-01, RN-VAC-02, RN-VAC-03, RN-VAC-04 |
| `test_finiquito` | RF-CON-05, RF-CON-06, RF-VAC-01, RF-DOC-04, RF-FIN-02, RF-FIN-03, RF-FIN-04, RF-FIN-05, RF-FIN-06, RN-FIN-01, RN-FIN-02, RN-FIN-03, RN-FIN-04, RN-FIN-05, RN-FIN-07 |
| `test_firmas` | RF-CON-08, RF-REM-14, RF-VAC-07, RF-DOC-01, RF-DOC-03, RF-FIR-01, RF-FIR-02, RF-FIR-05, RF-FIR-06, RF-FIR-08, RF-FIR-09, RF-FIR-10, RF-FIR-12, RF-FIR-13, RF-FIR-15, RNF-SEG-05, RNF-DIS-01, RNF-DIS-02, RNF-LEG-03 |
| `test_horas_compensatorias` | RF-REM-15, RF-VAC-05, RF-VAC-07, RF-DOC-07, RN-REM-15 |
| `test_indemnizacion_todo_evento` | RF-REM-15, RN-REM-14, RN-FIN-06 |
| `test_inspeccion` | RF-DT-07, RF-DT-08, RF-DT-09, RF-DT-10, RF-DT-11, RNF-SEG-02, RNF-SEG-06, RNF-PRI-02 |
| `test_jornada` | RF-CON-02, RF-CON-03, RF-CON-04, RF-CON-07, RN-CON-01, RN-CON-02, RNF-LEG-01, RNF-LEG-02 |
| `test_ley_karin` | RF-KAR-01 |
| `test_liquidaciones` | RF-REM-01, RF-REM-02, RF-REM-03, RF-REM-06, RF-REM-07, RF-REM-08, RF-REM-14, RF-ARC-06, RF-ARC-08, RN-REM-04, RN-REM-05, RN-REM-06, RN-REM-07, RN-REM-09, RN-REM-10, RN-REM-11, RN-REM-12, RN-REM-16, RNF-SEG-10 |
| `test_lre` | RF-REM-09, RF-ARC-04, RF-ARC-05, RNF-COM-04 |
| `test_pagos` | RF-CTA-02, RF-TRA-03, RF-TRA-04, RF-ARC-07, RF-DOC-01, RF-DOC-02, RF-PAG-01, RF-PAG-02, RF-PAG-03, RF-PAG-04, RF-PAG-05, RF-PAG-06, RF-PAG-07, RF-PAG-08, RF-PAG-09, RF-PAG-10, RN-PAG-01, RNF-DIS-01 |
| `test_parametros` | RF-REM-10, RF-REM-11, RF-REM-16, RN-REM-01, RN-REM-02, RN-REM-03, RN-REM-08, RN-REM-10, RN-REM-16, RNF-DIS-01, RNF-MAN-04, RNF-LEG-01 |
| `test_permisos` | RF-EQU-01 |
| `test_permisos_equipo` | RF-CTA-05, RF-CTA-13, RF-TRA-02, RF-FIR-03, RF-EQU-06, RF-EQU-07, RF-EQU-08, RNF-SEG-03 |
| `test_peticiones_portal` | RF-TRA-12, RF-VAC-06, RF-POR-14, RF-POR-15, RN-POR-03 |
| `test_portal_trabajador` | RF-POR-01, RF-POR-02, RF-POR-03, RF-POR-04, RF-POR-05, RF-POR-06, RF-POR-07, RF-POR-08, RF-POR-09, RN-POR-01, RNF-SEG-02, RNF-PRI-02, RNF-PRI-03 |
| `test_previred` | RF-CTA-10, RF-ARC-01, RF-ARC-02, RF-ARC-03, RNF-COM-04 |
| `test_proteccion` | RF-TRA-10, RF-TRA-11, RF-TRA-12, RF-DOC-05, RF-FIN-01, RN-TRA-01, RN-TRA-02 |
| `test_reglamento` | RF-REG-01, RF-REG-02, RF-REG-03, RF-REG-04, RF-REG-05, RF-REG-06, RF-REG-07, RN-REG-01 |
| `test_resumen` | RF-REG-04, RF-RES-01, RF-RES-02, RF-RES-03, RF-RES-04, RF-RES-05 |
| `test_revision_panel` | RF-CTA-08, RF-CON-05, RF-CON-11, RF-REM-04, RF-FIR-03, RF-FIR-04, RF-FIR-07, RF-FIR-11, RF-FIR-16 |
| `test_seguridad` | RF-TRA-01, RF-TRA-04, RF-CON-01, RF-CON-07, RF-VAC-04, RF-DOC-01, RNF-SEG-01, RNF-SEG-02, RNF-SEG-03, RNF-REN-02 |
| `test_seguridad_laboral` | RF-DOC-11, RF-REG-08, RF-REG-09, RN-DOC-06 |
| `test_sesion_inactividad` | RF-KAR-03, RNF-SEG-01 |
| `test_solicitudes_documento` | RF-POR-10, RF-POR-11, RN-POR-03 |
| `test_trabajadores` | RF-TRA-01, RF-TRA-06, RF-TRA-07, RF-TRA-08, RF-TRA-09, RF-TRA-13, RF-CON-01, RN-REM-04, RN-PAG-01 |
| `CierreInactividad.test.tsx` | RNF-SEG-01, RNF-USA-04 |
| `accesibilidad.spec.ts` | RNF-USA-02 |
| `borradores.test.ts` | RNF-USA-04 |
| `extension.spec.ts` | RNF-COM-05 |
| `gestion.spec.ts` | RF-CON-08 |
| `levantar.test.ts` | RF-EXT-09, RNF-PRI-01 |
| `llenar.test.tsx` | RF-EXT-06, RF-EXT-07, RF-EXT-08 |
| `mapeo.test.ts` | RF-EXT-05, RF-EXT-07 |
| `panel.spec.ts` | RF-TRA-05, RF-RES-06 |
| `textos.test.ts` | RF-EXT-09 |

#### Requerimientos sin un archivo de prueba propio {.unnumbered}

- **Funcionales sin prueba directa (6):** RF-CTA-09, RF-CTA-12, RF-CON-12, RF-REM-05, RF-EQU-03, RF-EQU-09.
- **No funcionales pendientes (5):** RNF-SEG-11, RNF-DIS-03, RNF-DIS-05, RNF-REN-03, RNF-LEG-04. Aún no se cumplen, así que no hay qué probar (sección 11.7).
- **No funcionales verificados de otra forma (13):** RNF-SEG-04, RNF-SEG-08, RNF-SEG-09, RNF-REN-01, RNF-USA-01, RNF-USA-03, RNF-MAN-01, RNF-MAN-02, RNF-MAN-03, RNF-COM-01, RNF-COM-02, RNF-COM-03, RNF-PRI-04. Se comprueban en la integración continua, en los recorridos de navegador en general, en la configuración o por revisión manual, según indica su fila en el capítulo 3.

