# Mantenimiento y evolución {#sec-mantenimiento}

Este capítulo explica cómo se ha construido y se mantiene Jornada40, qué hacer al cambiarlo sin romper sus reglas, hacia dónde evoluciona y cuáles son sus limitaciones y riesgos principales.

## Metodología de desarrollo {#sec-man-metodologia}

**Trabajo asistido por IA.** Jornada40 se desarrolla con un asistente de programación basado en inteligencia artificial (Claude Code), bajo la dirección del titular del producto, que hace de responsable funcional.

| Quién | Qué hace |
|---|---|
| Titular del producto | Define qué se construye y con qué criterio legal; decide entre alternativas; prueba cada versión en staging; autoriza la publicación en producción; administra las credenciales, el administrador de Django y los trámites |
| Asistente de programación | Propone planes para los cambios grandes; escribe el código, las pruebas y la documentación en una rama; ejecuta las suites; registra hallazgos y pendientes |

: Roles en el desarrollo

**Ciclo de un cambio.**

1. **Pedido.** El titular describe el cambio. Si es grande, el asistente propone un plan y el titular lo aprueba antes de construirlo.
2. **Construcción.** El asistente lo implementa en una rama con sus pruebas. Corre las suites del servidor, de la interfaz y de navegador, el linter y el análisis de seguridad.
3. **Revisión.** El cambio se publica en staging y el titular lo prueba.
4. **Publicación.** Solo con la autorización expresa del titular se integra en `main`.

**Salvaguardas.**

- **Contexto escrito.** `CLAUDE.md` describe la arquitectura, las reglas y las convenciones, y se actualiza con cada cambio. `docs/PENDIENTES.md` lleva lo que falta fuera del código.
- **Verificación contra el código.** Cada dato de la documentación se comprueba en el código, no en la memoria del asistente ni en `CLAUDE.md`. Los ejemplos de cálculo de este documento los verifica una prueba.
- **Normas citadas en el código.** Cada regla legal cita su norma, para que una persona pueda revisarla (capítulo 10).
- **Hallazgos, no arreglos silenciosos.** Lo que se descubre se registra con una propuesta y espera la decisión del titular. Por ejemplo, la falta de protección contra CSRF se detectó al escribir este documento, se registró y se corrigió con autorización (sección 8.10).
- **Secretos fuera del alcance.** Las credenciales nunca se guardan en el repositorio ni en la conversación; las de producción no se usan en las pruebas.

**Límites del método.** Un asistente de IA puede producir código o afirmaciones verosímiles pero incorrectos. Las salvaguardas reducen ese riesgo, pero no lo eliminan. Por eso son importantes la revisión legal externa de las plantillas y la auditoría de seguridad externa pendientes (secciones 8.10 y 11.7).

## Gestión de la configuración {#sec-man-configuracion}

| Elemento | Cómo se gestiona |
|---|---|
| Código | Repositorio Git en GitHub, desde el 13-02-2026, con unos 500 commits. Ramas: `main` (producción), `staging` (pruebas) y ramas de trabajo |
| Versiones del sistema | No hay etiquetas de versión: cada publicación se identifica por su commit y su fecha. Se recomienda etiquetar cada publicación en `main` (por ejemplo, `v2026.10.1`) |
| Esquema de datos | Migraciones de Django numeradas en orden (105 a la fecha); la integración continua exige que estén al día |
| Dependencias | Versiones exactas en `requirements.txt` y `package-lock.json`; Dependabot propone actualizaciones cada semana; Django se mantiene en la serie 5.2, de soporte extendido |
| Configuración | Variables de entorno por ambiente (anexo G) y datos del administrador (sección 12.3) |
| Documentación | `CLAUDE.md` (contexto técnico), `docs/PENDIENTES.md` (lista viva), `docs/STAGING.md`, `docs/qa-pruebas-jornada40.md`, `docs/PLAN_EXTENSION_MIDT.md` y este documento (`docs/tecnico/`) |
| Este documento | Fuente en Markdown versionada junto al código; se compila a Word y PDF; su versión y el commit que describe están en `documento.json` |

: Gestión de la configuración

## Guía de mantenimiento {#sec-man-guia}

Las listas siguientes recogen lo que hay que revisar en los cambios más comunes, para no romper reglas que el código hace cumplir en otros lugares.

| Cambio | Revisar |
|---|---|
| Agregar un modelo | • Crear su migración. <br>• Asignarle un dominio en `herramientas/modelo_datos.py` (si no, el script se detiene). <br>• Si sus datos son de una empresa, darle el gestor `EnEmpresas`. <br>• Decidir si va en el administrador. <br>• Regenerar los diagramas y el anexo B |
| Agregar una ruta de la API | • Asignarla a un módulo en `core/permisos.py`; si no, queda cerrada para el equipo. <br>• Si es pública, darle un límite de intentos. <br>• Si es de un acceso aislado, aceptar solo JSON. <br>• Agregar sus pruebas; `test_permisos_equipo` la recorrerá sola. <br>• Regenerar el anexo C |
| Agregar una pantalla | • Cargarla con `diferida()`. <br>• Protegerla con `ConPermiso` en `App.tsx`. <br>• Revisar su accesibilidad con `revisarAccesibilidad`. <br>• Textos en español de Chile y letra grande |
| Cambiar un cálculo legal | • Hacerlo solo en el servidor. <br>• Actualizar la regla del capítulo 3. <br>• Si cambia un ejemplo de la sección 3.2.8, actualizarlo en el mismo commit (lo exige `test_ejemplos_documento`). <br>• Si el valor depende del período, agregarlo a las tablas de parámetros |
| Cambiar el plan mínimo de una función | • Usar `_plan_permite` con el nivel, nunca el nombre del plan. <br>• Actualizar `INCLUYE_POR_NIVEL` en `components/sitio/contenido.ts` |
| Agregar un correo | • Plantilla HTML y de texto. <br>• Enlaces con `SITIO_URL`. <br>• Informar sin perder lo hecho si el envío falla. <br>• Nunca datos personales en los registros |
| Agregar un tipo de documento que se firma | • Agregar su tipo de firma y su módulo en `MODULO_POR_TIPO`. <br>• Su función de PDF y que la descarga use `pdf_firmado`. <br>• Su visibilidad en el portal. <br>• Sus pruebas |
| Actualizar dependencias | • Dentro de la misma serie. <br>• Correr todas las suites. <br>• Que `pip-audit` y `npm audit` queden sin avisos |
| Cambiar la configuración de cookies, CORS u orígenes | • Revisar `COOKIES_SAMESITE` y las listas de orígenes, que también usa la revisión del origen de las escrituras. <br>• Correr `test_csrf` y los recorridos de navegador |

: Lista de revisión por tipo de cambio

**Tareas periódicas.** Los parámetros legales y los calendarios que se cargan cada año están en la sección 12.7.

**Al cerrar un cambio.** Actualizar `CLAUDE.md`, `docs/PENDIENTES.md` y el capítulo de este documento que describe lo cambiado.

## Evolución prevista {#sec-man-evolucion}

| Línea | Qué falta | Estado |
|---|---|---|
| Publicación | Llevar a producción las correcciones de la versión de pruebas: dependencias, alertas, CSRF y arranque | Requiere la autorización del titular |
| Extensión para Mi DT | Sesión de levantamiento con una cuenta real; mapeos; publicación en Chrome Web Store y Edge Add-ons; plan comercial | En piloto en staging |
| Reconocimiento de la DT | Acordar las medidas de seguridad y presentar la solicitud (Etapa D) | Pendiente |
| Protección de datos | Contrato de encargo, política de privacidad, registro de proveedores, procedimiento de vulneraciones, conservación (sección 9.8) | Urgente: la Ley 21.719 rige desde el 01-12-2026 |
| Continuidad | Respaldos automáticos, simulacros de restauración, monitor de disponibilidad (capítulo 12) | Pendiente de autorización |
| Seguridad | Hallazgos pendientes (sección 8.10), segundo factor, CSP, auditoría externa | Por priorizar |
| Calidad | Carga, navegadores adicionales, accesibilidad manual, formatos con cargas reales (sección 11.7) | Por priorizar |
| Firma avanzada | Integrar un proveedor acreditado si se requiere más que la firma simple | Fuera del plan actual (decidido en septiembre de 2026) |
| Precios | Estudio de precios de plataformas comparables | En pausa a pedido del titular |
| Libro de Remuneraciones | Códigos de las horas extra compensadas con descanso | A la espera de que la DT los publique |

: Evolución prevista

## Limitaciones y riesgos {#sec-man-riesgos}

| Riesgo | Probabilidad | Impacto | Mitigación actual | Acción propuesta |
|---|---|---|---|---|
| Pérdida de datos por falta de respaldos | Media | Alto | Base administrada por Railway; respaldo manual posible | Respaldo diario automático y simulacros (sección 12.6) |
| Incumplir la Ley 21.719 desde su vigencia | Alta | Alto | Controles técnicos del capítulo 8 | Cerrar las brechas de la sección 9.8 antes del 01-12-2026 |
| Explotación de la falta de CSRF en producción antes de publicar la corrección | Media | Alto | Sesiones cortas y cierre por inactividad; confirmación de clave para firmar | Publicar la corrección en `main` |
| Un cambio en Mi DT deja sin uso la extensión | Alta | Medio | Si falta un campo, no llena nada; las fichas para copiar siguen disponibles | Mapeos como datos, actualizables sin publicar la extensión |
| Un parámetro legal o un calendario no se carga a tiempo | Media | Alto | El sistema advierte parámetros antiguos o sin confirmar; `estado_indicadores` | Revisión mensual con fecha en la agenda del equipo |
| Caída o cambio de condiciones de un proveedor (Railway, B2, Resend, Reveniu) | Baja | Alto | Respaldo de enlace de pago; correos que se pueden reenviar; errores informados | Plan de continuidad por proveedor; respaldos fuera de Railway |
| Pérdida de la clave de cifrado de la Ley Karin | Baja | Alto | Clave guardada en un gestor de contraseñas | Segunda copia custodiada; procedimiento de rotación probado |
| Conocimiento concentrado en el titular y el asistente | Media | Alto | `CLAUDE.md`, este documento, las pruebas y la lista de pendientes | Incorporar a una segunda persona técnica que revise y apruebe |
| Formatos oficiales sin verificar con cargas reales | Media | Medio | Advertencias y documentación de los supuestos | Probar con cargas reales (sección 11.7) |
| Firma simple discutida en un juicio | Baja | Medio | Evidencia de identidad, voluntad, integridad y emisión (sección 8.9) | Firma avanzada si el mercado o la DT la exigen |
| Rendimiento desconocido bajo carga | Media | Medio | Límites de intentos; tiempos máximos | Pruebas de carga y métricas |
| Datos sensibles en claro en la base | Baja | Alto | Control de acceso y aislamiento por cuenta | Revisar su necesidad y evaluar cifrarlos (sección 9.3) |

: Registro de riesgos

**Limitaciones funcionales.** Las limitaciones conocidas están en las secciones de cada tema:

- archivos y formatos oficiales (sección 10.5);
- firma (sección 8.9);
- datos personales (sección 9.8);
- operación (capítulo 12).
