# Introducción {#sec-introduccion}

## Propósito del documento {#sec-proposito}

Este documento describe técnicamente el sistema Jornada40: qué hace, qué requisitos cumple, cómo está construido, cómo protege la información, cómo se verifica su calidad y cómo se instala, opera y mantiene. Es la referencia técnica oficial del sistema y tiene tres usos:

- servir de base para mantener y hacer evolucionar el sistema, a cargo de cualquier desarrollador o agente de software;
- respaldar una evaluación técnica externa, como una revisión de inversionistas, una auditoría de seguridad o una revisión legal;
- servir de antecedente técnico para solicitar a la Dirección del Trabajo el reconocimiento del sistema de documentación laboral electrónica (etapa D del plan de cumplimiento ante la DT).

## Alcance {#sec-alcance}

### Componentes incluidos

| Componente                         | Descripción                                                                                                                                                      | Ubicación en el repositorio                      |
|------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| Servidor (API)                     | Django 5.2 y Django REST Framework: lógica de negocio, cálculos legales y previsionales, generación de documentos, autenticación, permisos e integraciones.      | `backend/` (aplicación única `core`)             |
| Aplicación web                     | React 19 y TypeScript: sitio público, panel del empleador, portal del trabajador, acceso Ley Karin, firma de documentos, verificación y portal de fiscalización. | `frontend/src/`                                  |
| Extensión "Jornada40 para Mi DT"   | Extensión de Chrome y Edge que asiste el registro de contratos, anexos y términos en el sitio Mi DT. [Solo en staging]                                          | `frontend/extension/`                            |
| Comandos de operación              | Envío de resúmenes por correo, rotación de claves de cifrado, revisión de indicadores, propuesta de parámetros desde Previred y revisión de topes imponibles.    | `backend/core/management/commands/`              |
| Administración interna             | Administración de Django para parámetros previsionales, planes, catálogos y soporte.                                                                           | `backend/core/admin.py`                          |
| Pruebas                            | Pruebas del servidor, unitarias de la interfaz, de extremo a extremo y de accesibilidad.                                                                        | `backend/core/tests/`, `frontend/src/`, `frontend/extension/src/`, `frontend/e2e/` |
| Integración continua               | Flujos de GitHub Actions y actualizaciones automáticas de dependencias.                                                                                         | `.github/`                                       |

: Componentes del sistema cubiertos por el documento

### Fuera del alcance

- La infraestructura interna de los proveedores (Railway, Vercel, Cloudflare, Backblaze, Resend, Reveniu, Transbank y Google). Se describen solo su configuración y el uso que hace de ellos el sistema.
- Los sistemas de la Dirección del Trabajo (Mi DT), Previred y el SII. Se describen solo los formatos y procedimientos con que Jornada40 interactúa con ellos.
- El manual de usuario y el material comercial (precios y propuesta de valor), que se tratan en documentos separados.
- La asesoría legal. El documento describe cómo el sistema aplica las normas; no reemplaza una opinión jurídica.

### Versión del sistema descrita {#sec-version-descrita}

El documento describe el código de la rama `{{rama}}` en el commit `{{commit-rama}}`, publicada en el ambiente de pruebas (staging). El sitio de producción ejecuta la rama `main` en el commit `{{commit-main}}`. Lo que todavía no está en producción se marca **[Solo en staging]**.

A la fecha de corte, la versión de pruebas agrega lo siguiente a la de producción:

- la extensión "Jornada40 para Mi DT": servicio en el servidor, panel lateral y página de privacidad;
- en las fichas para Mi DT, el total imponible y no imponible de la etapa 3 del contrato, y un aviso de los anexos aún sin firmar;
- mejoras de calidad:
  - actualización de las dependencias con avisos de seguridad;
  - alertas de errores por correo;
  - configuración de SQLite para desarrollo;
  - medición de cobertura, análisis estático y revisión de accesibilidad;
- correcciones de seguridad y operación: la API rechaza las escrituras que vienen de otros sitios (CSRF), las cookies de sesión de producción pasan a `SameSite=Lax` y el servidor no arranca si falla una migración;
- documentación.

## Audiencia y organización del documento {#sec-audiencia}

### Guía de lectura

| Lector                                        | Interés principal                                                  | Capítulos recomendados                      |
|-----------------------------------------------|--------------------------------------------------------------------|---------------------------------------------|
| Desarrollador o agente que mantiene el sistema | Cómo está construido y cómo cambiarlo sin romper reglas legales     | 2, 4, 5, 6, 7, 12, 13 y anexos B y C         |
| Responsable técnico o arquitecto              | Decisiones de diseño y atributos de calidad                        | 3.3, 4, 8, 11 y 13                          |
| Auditor de seguridad                          | Controles, amenazas y riesgos                                      | 8, 9, 12 y 13.5                             |
| Abogado o asesor laboral                      | Cómo el sistema aplica las normas y qué criterios adopta           | 3.1, 3.2 y 10                               |
| Dirección del Trabajo                         | Requisitos de la documentación laboral electrónica                 | 2, 8.9 y 10.3                               |
| Inversionista o evaluador técnico             | Visión, madurez, calidad y riesgos                                 | Resumen ejecutivo, 2, 11, 13.4 y 13.5       |
| Operador o administrador                      | Configuración, despliegue y tareas periódicas                      | 12                                          |

: Guía de lectura por tipo de lector

### Capítulos y estado de esta versión

| Capítulo                                  | Contenido                                                                                                   | En la versión {{version}} |
|-------------------------------------------|-------------------------------------------------------------------------------------------------------------|---------------------------|
| Resumen ejecutivo                         | Visión del sistema para lectores no técnicos                                                                 | Incluido                  |
| 1. Introducción                           | Propósito, alcance, audiencia, referencias y convenciones                                                    | Incluido                  |
| 2. Descripción general                    | Contexto, actores, módulos, planes, restricciones y dependencias externas                                    | Incluido                  |
| 3. Requerimientos                         | Funcionales, reglas de negocio y cálculos legales, y no funcionales                                         | Incluido                 |
| 4. Arquitectura                           | Principios, vistas de contexto, contenedores, componentes, secuencias y despliegue; decisiones              | Incluido                  |
| 5. Diseño detallado                       | Servidor, interfaz, extensión, diagramas de estado y algoritmos                                              | Incluido                  |
| 6. Modelo de datos                        | Entidades, integridad, datos sensibles, parámetros y retención                                               | Incluido                  |
| 7. Interfaces                             | Interfaz de usuario, API, sistemas externos y formatos de archivo                                            | Incluido                  |
| 8. Seguridad                              | Amenazas, autenticación, autorización, criptografía, auditoría, secretos y firma electrónica                 | Incluido                  |
| 9. Protección de datos personales         | Inventario, proveedores, retención y derechos de los titulares                                               | Incluido                  |
| 10. Cumplimiento normativo                | Marco legal, trazabilidad y documentación electrónica ante la DT                                             | Incluido                  |
| 11. Calidad y pruebas                     | Estrategia, ambientes, resultados, trazabilidad y pruebas pendientes                                         | Incluido                  |
| 12. Instalación, despliegue y operación   | Requisitos, puesta en marcha, configuración, integración continua, monitoreo, respaldo y procedimientos      | Incluido                  |
| 13. Mantenimiento y evolución             | Gestión de la configuración, convenciones, guía de mantenimiento, limitaciones y riesgos                     | Incluido                  |
| Anexos A a J                              | Glosario, diccionario de datos, API, pantallas, plantillas, catálogos, variables, licencias, versiones y trazabilidad | Incluido         |

: Capítulos del documento y su estado en esta versión

## Referencias {#sec-referencias}

### Estándares y marcos técnicos

| Referencia                                                          | Uso en este documento                                                            |
|---------------------------------------------------------------------|----------------------------------------------------------------------------------|
| ISO/IEC/IEEE 29148:2018, *Requirements engineering*                 | Estructura y redacción de los requerimientos (capítulo 3)                        |
| ISO/IEC/IEEE 42010:2022, *Architecture description*                 | Descripción de la arquitectura por vistas (capítulo 4)                           |
| IEEE 1016-2009, *Software Design Descriptions*                      | Diseño detallado (capítulo 5)                                                    |
| ISO/IEC 25010:2023, *Product quality model*                         | Atributos de calidad y requerimientos no funcionales (secciones 3.3 y 11)        |
| ISO/IEC/IEEE 15289:2019, *Content of life-cycle information items*  | Datos de control, versiones y distribución del documento                         |
| Modelo C4 (Simon Brown)                                             | Notación de los diagramas de arquitectura                                        |
| OWASP Top 10                                                        | Controles de seguridad de la aplicación (capítulo 8)                             |
| WCAG 2.1 (W3C), niveles A y AA                                      | Accesibilidad de la interfaz                                                     |

: Estándares y marcos técnicos de referencia

### Normativa legal

La tabla siguiente reúne las normas principales que el sistema aplica. El capítulo 10 entrega la lista completa, con los artículos, dictámenes y oficios que respaldan cada regla y su relación con el código y las pruebas.

| Materia                                  | Normas                                                                                                                                                                                       |
|------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Relación laboral                         | Código del Trabajo (DFL N° 1, de 2002, del Ministerio del Trabajo y Previsión Social); Ley 21.561 (jornada de 40 horas); Ley 21.220 (trabajo a distancia y teletrabajo); Ley 21.645 (conciliación de la vida personal, familiar y laboral); Ley 21.063 (seguro para el acompañamiento de niños y niñas, Ley SANNA); Ley 21.015 (inclusión laboral de personas con discapacidad); Ley 19.631 (pago de cotizaciones para el despido) |
| Remuneraciones y seguridad social        | DL 3.500 de 1980 (sistema de pensiones); Ley 21.735 (reforma de pensiones, aporte del empleador); Ley 19.728 (seguro de cesantía); DFL 150 de 1981 y Ley 18.987 (asignación familiar); leyes 21.578 y 21.751 (ingreso mínimo mensual) y Ley 21.830 (montos de la asignación familiar desde mayo de 2026); Ley 18.156 (técnicos extranjeros); Ley sobre Impuesto a la Renta (DL 824 de 1974) y DL 889 de 1975 |
| Seguridad y salud en el trabajo          | Ley 16.744 (accidentes del trabajo y enfermedades profesionales); DS N° 44, de 2023, del Ministerio del Trabajo y Previsión Social (gestión preventiva de los riesgos laborales); Ley 20.949 (peso máximo de carga manual) |
| Acoso y violencia en el trabajo          | Ley 21.643 (Ley Karin); DS N° 21, de 2024, del Ministerio del Trabajo y Previsión Social (investigaciones de acoso y violencia); Circular N° 3813 de la Superintendencia de Seguridad Social |
| Dirección del Trabajo y documentos electrónicos | Ley 21.327 (modernización de la Dirección del Trabajo y registro electrónico laboral); Dictamen N° 0789/15 de la DT (documentación laboral electrónica); ORD N° 2257 de 2022 y N° 82 de 2025 (firma de documentos laborales); ORD N° 136 y N° 79 de 2025 (criterio de la DT sobre verificación de identidad y acto de firma) |
| Firma electrónica y datos personales     | Ley 19.799 (documentos y firma electrónica); Ley 19.628 (protección de la vida privada); Ley 21.719 (protección y tratamiento de datos personales, de vigencia diferida) |
| Formatos oficiales                       | Previred: formato estándar de largo variable por separador, versión 100. DT: plantilla oficial y manual de usuario del Libro de Remuneraciones Electrónico. SII: Resolución Exenta N° 6.509 (Certificado N° 6) e instrucciones de la declaración jurada 1887 |

: Normativa legal principal aplicada por el sistema

### Documentos internos

| Documento                                                              | Contenido                                                                                  |
|------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `CLAUDE.md` (raíz del repositorio)                                     | Guía técnica de trabajo del equipo y de los agentes de software: arquitectura, reglas y convenciones |
| `docs/qa-pruebas-jornada40.md`                                         | Inventario de pruebas, resultados y brechas de calidad                                     |
| `docs/STAGING.md`                                                      | Configuración del ambiente de pruebas (staging)                                            |
| `docs/PLAN_EXTENSION_MIDT.md` y `docs/guia-prueba-extension-midt.md`   | Diseño y guía de prueba de la extensión para Mi DT                                         |
| `frontend/extension/README.md`                                         | Compilación e instalación de la extensión                                                  |
| `docs/PENDIENTES.md`                                                   | Tareas pendientes fuera del código (operación, datos del admin y trámites)                 |
| `docs/dossier-jornada40.md` y `docs/briefing-comercial-jornada40.md`   | Material comercial (fuera del alcance de este documento)                                   |

: Documentos internos relacionados

## Convenciones {#sec-convenciones}

### Identificadores

Los requerimientos, reglas y decisiones llevan un código estable, que permite citarlos y trazarlos hasta el código y las pruebas:

- `RF-<módulo>-NN`: requerimiento funcional.
- `RN-<módulo>-NN`: regla de negocio o cálculo legal.
- `RNF-<atributo>-NN`: requerimiento no funcional.
- `ADR-NN`: decisión de arquitectura.

| Código | Módulo                                    | Código | Módulo                                  |
|--------|-------------------------------------------|--------|-----------------------------------------|
| CTA    | Cuentas y empresas                        | FIR    | Firma electrónica                        |
| TRA    | Trabajadores                              | POR    | Portal del trabajador                    |
| CON    | Contratos y anexos                        | DT     | Dirección del Trabajo y fiscalización    |
| REM    | Remuneraciones                            | REG    | Reglamento interno y seguridad laboral   |
| ARC    | Archivos legales (Previred, LRE y SII)    | KAR    | Ley Karin                                |
| VAC    | Vacaciones y feriado                      | EQU    | Usuarios del equipo y bitácora           |
| DOC    | Documentos legales y laborales            | PAG    | Suscripciones y pagos                    |
| FIN    | Finiquitos                                | RES    | Inicio y resumen por correo              |
| EXT    | Extensión para Mi DT                      |        |                                         |

: Códigos de módulo

| Código | Atributo de calidad (ISO/IEC 25010)       | Código | Atributo de calidad (ISO/IEC 25010)      |
|--------|-------------------------------------------|--------|------------------------------------------|
| SEG    | Seguridad                                 | USA    | Usabilidad y accesibilidad               |
| DIS    | Confiabilidad y disponibilidad            | MAN    | Mantenibilidad                           |
| REN    | Rendimiento                               | COM    | Compatibilidad y portabilidad            |
| PRI    | Privacidad                                | LEG    | Cumplimiento legal                       |

: Códigos de atributo de calidad

### Redacción y formato

- **Obligación:** en los requerimientos, "debe" expresa una obligación y "puede", una opción, como recomienda ISO/IEC/IEEE 29148.
- **Rutas de código:** se escriben relativas a la raíz del repositorio, en letra de ancho fijo (por ejemplo, `backend/core/views/base.py`). Una función se indica con una flecha: `views/base.py → _plan_permite`.
- **Normas:** "Art. 22 CT" es el artículo 22 del Código del Trabajo; "DS" es un decreto supremo; "ORD" es un oficio ordinario de la DT.
- **Fechas y horas:** se escriben dd-mm-aaaa y, salvo que se diga otra cosa, corresponden a la hora de Chile (America/Santiago).
- **Montos:** en pesos chilenos, con punto de miles y coma decimal.
- **Funciones no publicadas:** la marca **[Solo en staging]** señala lo que aún no está en producción (sección 1.2.3).
- **Diagramas:**
  - los de arquitectura siguen el modelo C4: el sistema Jornada40 en azul, los sistemas externos en gris y las personas como actores;
  - los de secuencia y de estado usan la notación UML;
  - todos se escriben en Mermaid y su fuente está en `docs/tecnico/figuras/`.

### Términos y siglas principales

El anexo A reúne el glosario completo. Los términos siguientes se usan desde el capítulo 2.

| Término o sigla       | Significado                                                                                                                                      |
|-----------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
| Titular               | Dueño de la cuenta de Jornada40, normalmente el empleador o su representante. Contrata el plan y administra empresas, trabajadores y usuarios.    |
| Usuario del equipo    | Persona que el titular invita, con acceso solo a los módulos y empresas que se le asignan.                                                       |
| Empresa               | Empleador registrado en una cuenta, identificado por su RUT. Una cuenta puede tener varias empresas, según el plan.                               |
| Ficha / carpeta       | La ficha es el registro de un trabajador (`Empleado`); la carpeta es la pantalla que reúne sus datos y documentos.                                 |
| Aviso                 | Advertencia de un posible incumplimiento normativo. Informa, pero no impide continuar.                                                           |
| AFP / AFC             | Administradora de Fondos de Pensiones / Administradora de Fondos de Cesantía.                                                                    |
| API                   | Interfaz de programación de aplicaciones; aquí, la API REST del servidor de Jornada40.                                                             |
| CT                    | Código del Trabajo.                                                                                                                              |
| DT / Mi DT            | Dirección del Trabajo / su sitio de trámites en línea para empleadores.                                                                           |
| FEA                   | Firma electrónica avanzada (Ley 19.799). Jornada40 usa firma electrónica simple.                                                                  |
| IMM                   | Ingreso mínimo mensual.                                                                                                                          |
| JWT                   | JSON Web Token: credencial firmada que usa la sesión del panel, guardada en cookies.                                                              |
| LRE                   | Libro de Remuneraciones Electrónico que se carga mensualmente en Mi DT (Art. 62 bis CT).                                                          |
| OTP                   | Código de un solo uso enviado por correo para verificar la identidad.                                                                             |
| Previred              | Plataforma de declaración y pago de cotizaciones previsionales.                                                                                  |
| RIOHS / RIHS          | Reglamento Interno de Orden, Higiene y Seguridad (10 o más trabajadores) / Reglamento Interno de Higiene y Seguridad.                              |
| RUT                   | Rol Único Tributario, identificador de personas y empresas en Chile.                                                                             |
| SII / SUSESO          | Servicio de Impuestos Internos / Superintendencia de Seguridad Social.                                                                           |
| Staging               | Ambiente de pruebas, separado de producción, donde se valida cada versión antes de publicarla.                                                    |
| UF / UTM              | Unidad de Fomento / Unidad Tributaria Mensual, unidades reajustables usadas en topes y tramos.                                                    |

: Términos y siglas principales
