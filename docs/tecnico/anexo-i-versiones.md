# Anexo I. Historial de versiones del sistema {.unnumbered #sec-anexo-i}

Jornada40 no tiene etiquetas de versión: cada publicación se identifica por su commit y su fecha (sección 13.2). Este anexo reconstruye los hitos desde la historia de Git: unos 500 commits en la rama `{{rama}}`, desde el 13-02-2026 hasta la fecha de corte. Las versiones de este documento están en el control de versiones de la parte preliminar.

#### Publicaciones en producción identificadas {.unnumbered}

| Fecha | Commit en `main` | Contenido |
|---|---|---|
| 07-10-2026 | `ed4f120` | Versión rediseñada, con lo construido desde fines de septiembre; migraciones 0064 a 0098 |
| 08-10-2026 | `96ca177` | Cuentas del portal por persona y separación entre verificar la identidad y firmar; migraciones 0099 a 0104. Es la versión de producción a la fecha de corte |

Railway publica cada cambio que llega a `main` (sección 4.6); las publicaciones anteriores no quedaron registradas aparte. La versión de pruebas agrega a `96ca177` lo descrito en la sección 1.2.3, incluida la migración 0105.

#### Hitos del desarrollo {.unnumbered}

| Fecha | Hito |
|---|---|
| 13-02-2026 | Inicio del repositorio, con el cálculo de la transición a 40 horas |
| 18-02-2026 | Primer despliegue: API en Railway con Docker y aplicación web en Vercel |
| 20-02 al 26-02-2026 | Empresas y trabajadores, validación del RUT, planes y registro de clientes |
| 07-03 al 13-03-2026 | Anexo de 40 horas en PDF y en lote, carga masiva desde Excel, contrato de trabajo, documentos legales y motor de liquidaciones con su PDF |
| 18-03-2026 | Pagos de suscripciones con Reveniu |
| 25-03-2026 | Correos con Resend y recuperación de la clave |
| 02-04-2026 | Plan Semilla con marca de agua en los documentos |
| 12-04 y 15-04-2026 | Dominio `jornada40.cl` y API en `api.jornada40.cl` |
| 19-04 y 20-04-2026 | Endurecimiento de seguridad: límites de intentos, verificación de los avisos de pago, campos explícitos en la API, cabeceras HTTP y pruebas de seguridad. Almacenamiento en Backblaze B2 |
| 25-04 y 26-04-2026 | Firma electrónica simple: código por correo, firma dibujada y página de certificado |
| 28-04 al 30-04-2026 | Lectura de contratos con Gemini, carta de término con sus causales, vacaciones, rechazo de firma y finiquito |
| 01-05-2026 | Archivo Previred, libro de remuneraciones y reportes multiempresa |
| 07-05-2026 | Cuatro planes, con funciones habilitadas por nivel |
| 15-09 al 23-09-2026 | Liquidación con términos congelados al emitir, tope imponible, parámetros previsionales versionados y propuestos desde Previred, catálogo de conceptos, avisos de jornada y rediseño completo del sitio y del panel |
| 24-09-2026 | Integración continua con GitHub Actions; Previred con el formato oficial de 105 campos; vistas y pruebas divididas por tema |
| 25-09-2026 | Planes consolidados con pago anual; API de Reveniu; registro en Mi DT, consentimiento electrónico, Libro de Remuneraciones Electrónico y asignación familiar |
| 28-09 y 29-09-2026 | Portal del trabajador con solicitudes y certificados verificables; pactos y constancias; ratificación del finiquito; firma del empleador por documento; portal de fiscalización; Certificado N°6 del SII; pruebas unitarias de la interfaz |
| 30-09-2026 | Resumen por correo; horas extra compensadas con días libres; reglamento interno y seguridad laboral; indemnización a todo evento; usuarios del equipo, permisos por módulo y bitácora encadenada |
| 01-10-2026 | Ambiente de staging. Acceso Ley Karin aislado y cifrado, expediente de denuncias con los plazos del DS 21, casos en el portal y denuncia desde el portal |
| 03-10 al 05-10-2026 | Cierre por inactividad, dirección por partes, borradores locales, conciliación de la vida familiar, peticiones del portal, jornada del Art. 22 en el alta de trabajadores y recarga de páginas tras una publicación |
| 07-10 y 08-10-2026 | Publicaciones en producción (tabla anterior) |
| 09-10-2026 | **[Solo en staging]** Extensión «Jornada40 para Mi DT» |
| 11-10-2026 | **[Solo en staging]** Cobertura, auditoría de dependencias, linter, accesibilidad y alertas de errores |
| 12-10-2026 | **[Solo en staging]** Protección contra CSRF y arranque que se detiene si falla una migración |

**Actividad.** Los commits se concentran en abril (159) y septiembre (102); entre junio y agosto hubo poca actividad (28 commits).
