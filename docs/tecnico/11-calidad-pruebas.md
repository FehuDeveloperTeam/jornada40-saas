# Calidad y pruebas {#sec-calidad}

Este capítulo describe cómo se asegura la calidad de Jornada40:

- la estrategia de pruebas y los ambientes en que corren;
- los resultados medidos a la fecha de corte;
- la integración continua y la trazabilidad de las pruebas;
- las pruebas manuales;
- lo que todavía no se prueba.

El inventario detallado de las pruebas está en `docs/qa-pruebas-jornada40.md`.

## Estrategia {#sec-cal-estrategia}

Las pruebas siguen una pirámide:

- **Servidor (base).** Como todo cálculo legal se hace en el servidor (ADR-04), sus pruebas cubren cada monto que ve el usuario: liquidaciones, finiquitos, feriado, plazos, archivos oficiales. También cubren los permisos, la seguridad y cada integración, con los servicios externos simulados.
- **Interfaz (unitarias).** Cubren las funciones puras de la aplicación web (RUT, formatos, jornada), el cliente HTTP y la lógica de la extensión.
- **Navegador (de extremo a extremo).** Recorren los flujos completos en Chromium, con la API y la base de datos reales, y revisan la accesibilidad de 21 pantallas.

**Prácticas que siguen todas las pruebas.**

- **Regresión:** cada error corregido deja una prueba que lo reproduce.
- **Sin internet:** ninguna prueba sale a internet. Toda llamada real falla con `SalidaAInternet`, que no se puede silenciar con un `except Exception`.
- **Avisos que no bloquean:** las pruebas comprueban que el aviso aparece y también que la operación se permite cuando la ley no la prohíbe.
- **Fechas relativas:** las fechas son relativas al día en que corre la prueba, para que sigan siendo válidas con el tiempo.
- **Documento verificado:** los ejemplos numéricos del documento los comprueba una prueba (`test_ejemplos_documento`).

## Ambientes de prueba {#sec-cal-ambientes}

| Ambiente | Para qué | Base de datos | Servicios externos |
|---|---|---|---|
| Pruebas del servidor (`manage.py test`) | API, reglas, cálculos, seguridad, formatos | SQLite en memoria, una por proceso en paralelo | Simulados: B2, Reveniu, correo en memoria, Gemini, mindicador.cl y el reloj |
| Pruebas unitarias de la interfaz (Vitest) | Utilidades, cliente HTTP, componentes de sesión y extensión | No aplica | Adaptador HTTP de Axios reemplazado en cada prueba |
| Recorridos de navegador (Playwright) | Flujos completos en Chromium | SQLite propia (`config.settings_e2e`), sembrada con `preparar_e2e` y restaurada en cada área | B2 e indicadores simulados por la aplicación `backend/e2e`; correo en consola; códigos en un archivo para la prueba |
| Integración continua (GitHub Actions) | Todo lo anterior en cada cambio | Igual que cada tipo de prueba | Igual que cada tipo de prueba |
| Staging | Aceptación manual antes de publicar | PostgreSQL propio | Reveniu de pruebas; correo, B2 y Gemini reales |

: Ambientes de prueba

## Resultados {#sec-cal-resultados}

Medidos el {{fecha}} sobre la rama `{{rama}}`:

| Tipo | Herramienta | Alcance | Resultado |
|---|---|---|---|
| Servidor | Django `APITestCase` | 551 pruebas en 42 archivos | Todas pasan |
| Cobertura del servidor | coverage.py | 12.820 líneas medibles | 83,1 % (mínimo exigido: 80 %) |
| Unitarias de la interfaz | Vitest y Testing Library | 61 pruebas en 14 archivos | Todas pasan |
| Cobertura de la interfaz | Vitest (v8) | Utilidades y extensión | Utilidades 83,1 % (mínimo 75 %), extensión 86,4 % (mínimo 80 %), cliente HTTP 28,6 %. Las pantallas (1,9 %) las cubren los recorridos de navegador |
| De extremo a extremo | Playwright (Chromium) | 59 recorridos en 13 áreas | Todos pasan; 4 más, de capturas para este documento, se omiten salvo con `CAPTURAS_DOC=1` |
| Accesibilidad | axe (WCAG 2.1 A y AA) | 21 pantallas: 9 públicas, la firma y 11 del panel | 0 problemas |
| Análisis estático | ruff, bandit, ESLint, TypeScript estricto | Servidor, interfaz y extensión | Sin hallazgos (bandit: severidad media o alta) |
| Dependencias | pip-audit y npm audit | Servidor y dependencias de producción de la interfaz | 0 avisos conocidos |
| Migraciones | `makemigrations --check` | Modelos | Al día |

: Resultados de las pruebas

| Área | Archivos de prueba y número de pruebas |
|---|---|
| Remuneraciones y archivos legales | liquidaciones 53, parámetros 35, asignación familiar 6, horas compensatorias 5, indemnización a todo evento 2, Previred 6, LRE 6, Certificado N°6 6 |
| Jornada, feriado y término | jornada 22, feriado 9, finiquito 20 |
| Documentos y firma | documentos laborales 20, firmas 19, certificados 15, reglamento 7, seguridad laboral 5 |
| Ley Karin | denuncias 18, acceso 9, aviso semestral 4 |
| Dirección del Trabajo y fiscalización | Dirección del Trabajo 16, fiscalización 10, extensión 12 |
| Portales | portal del trabajador 20, peticiones 10, solicitudes de documentos 13, estado del portal 3 |
| Seguridad, cuentas y accesos | seguridad 24, CSRF 14, cuentas 32, permisos del equipo 7, equipo 5, permisos 2, sesión por inactividad 5, bitácora 6, alertas 5 |
| Pagos | pagos 37 |
| Panel y gestión | trabajadores 19, revisión del panel 12, protecciones 8, direcciones 4, resumen por correo 7 |
| Documento técnico | ejemplos 7 |

: Pruebas del servidor por área (métodos de prueba por archivo)

La suma de los métodos (545) es menor que las 551 pruebas que ejecuta Django, porque algunas clases de prueba heredan casos de otras.

## Integración continua {#sec-cal-ci}

El flujo `.github/workflows/ci.yml` corre en cada envío y en cada solicitud de integración, y además cada lunes sobre la rama principal:

| Trabajo | Qué hace | Depende de |
|---|---|---|
| Servidor | ruff, bandit, `makemigrations --check` y las pruebas en paralelo con cobertura; publica el resumen de cobertura | — |
| Interfaz | ESLint, pruebas unitarias con cobertura, compilación de producción y los ZIP de la extensión, que publica como artefacto | — |
| Dependencias | pip-audit y npm audit; no detiene los recorridos | — |
| Recorridos de navegador | Instala Chromium y corre Playwright; si algo falla, publica el informe | Servidor e interfaz |

: Trabajos de la integración continua

Dependabot propone cada semana actualizaciones agrupadas de pip, npm y las acciones de GitHub. El despliegue no espera a la integración continua (sección 4.6).

## Trazabilidad de las pruebas {#sec-cal-trazabilidad}

**Estado.**

- **Requerimientos funcionales:** 192 de 199 nombran al menos un archivo de prueba en el capítulo 3.
- **Reglas de negocio:** las 44 tienen pruebas.
- **Requerimientos no funcionales:** su verificación figura en su tabla; varios se revisan a mano.

El anexo J reúne la matriz completa.

**Requerimientos sin prueba directa.** Siete requerimientos funcionales no tienen una prueba automática propia:

- RF-CTA-09 y RF-CTA-12: firma del representante y puesta en marcha;
- RF-CON-12;
- RF-REM-05;
- RF-VAC-07;
- RF-EQU-03 y RF-EQU-09.

Casi todos son comportamientos de pantalla que los recorridos de navegador ejercitan en parte. Conviene agregarles una prueba específica.

**Atributos de calidad.** De los 42 requerimientos no funcionales (ISO/IEC 25010), 28 se cumplen, 9 se cumplen en parte y 5 están pendientes:

| Atributo | Cumple | En parte | Pendiente |
|---|---|---|---|
| Seguridad (SEG) | 8 | 3 | 1 |
| Confiabilidad y disponibilidad (DIS) | 2 | 1 | 2 |
| Rendimiento (REN) | 1 | 1 | 1 |
| Usabilidad y accesibilidad (USA) | 3 | 1 | 0 |
| Mantenibilidad (MAN) | 5 | 0 | 0 |
| Compatibilidad y portabilidad (COM) | 3 | 2 | 0 |
| Privacidad (PRI) | 3 | 1 | 0 |
| Cumplimiento legal (LEG) | 3 | 0 | 1 |

: Estado de los requerimientos no funcionales por atributo

## Pruebas manuales y de aceptación {#sec-cal-manuales}

- **Staging.** El titular prueba cada versión antes de publicarla, con base de datos propia, pagos de prueba y dominio propio. Así se probó la extensión con una sesión real de Mi DT, y se corrigieron el mismo día los datos que faltaban en la etapa 3 del contrato.
- **Pagos.** En el ambiente de pruebas de Reveniu se verificaron la paginación de planes, el cambio de monto en una baja de plan y la reanudación. La inscripción de la tarjeta solo se prueba a mano, porque Transbank bloquea los navegadores automatizados.
- **Producción.** Después de cada publicación se verifican las migraciones aplicadas, las rutas nuevas y la aplicación web publicada (7 y 8 de octubre de 2026).
- **Fuentes oficiales.** Los parámetros se contrastan con los indicadores de Previred. El Libro de Remuneraciones Electrónico usa la plantilla descargada de Mi DT. Las fichas de registro se revisaron con una cuenta real de Mi DT.
- **Revisión visual.** En los cambios de diseño se toman capturas a varios anchos de pantalla, además de las pruebas automáticas de desborde en el teléfono.

## Pruebas pendientes {#sec-cal-pendientes}

| Brecha | Comentario |
|---|---|
| Carga y rendimiento | No hay mediciones bajo carga, por ejemplo de la emisión masiva de liquidaciones o de los PDF |
| Auditoría de seguridad o prueba de penetración externa | Solo hay revisión interna y pruebas automáticas (capítulo 8) |
| Navegadores y dispositivos | Los recorridos corren solo en Chromium. El teléfono se prueba por tamaño de pantalla, no en dispositivos reales |
| Accesibilidad manual | axe revisa en forma automática; falta una revisión con lector de pantalla y teclado |
| Respaldos y su restauración | Sin respaldos automáticos, tampoco hay pruebas de restauración (capítulo 12) |
| Errores del navegador | No se registran los errores de la aplicación web en el navegador de las personas |
| Formatos con cargas reales | Indemnización a todo evento en Previred y registro masivo de contratos en Mi DT |
| Extensión con Mi DT real | Falta la sesión de levantamiento de los formularios con una cuenta real para escribir los mapeos |
| Revisión legal externa | Plantillas del reglamento, de la Ley Karin y de los pactos |

: Pruebas pendientes
