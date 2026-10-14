# Registro de proveedores y transferencias internacionales

**Borrador para revisión legal.** Inventario de los terceros que tratan datos personales para Jornada40 (subencargados, cuando Jornada40 actúa por cuenta del Cliente), con las garantías de cada transferencia internacional (artículos 15 bis, 27 y 28 de la Ley N° 19.628, modificada por la Ley N° 21.719). Lo que dice el sistema sale del documento técnico (sección 9.4); lo contractual debe completarse con los términos de cada proveedor.

**Responsable de mantenerlo:** [COMPLETAR] · **Última revisión:** [COMPLETAR] · **Revisión:** cada 6 meses y ante cada proveedor nuevo.

## Proveedores del servicio

### Qué trata cada proveedor

| Proveedor | Servicio | Datos personales que trata | Ubicación del tratamiento |
|---|---|---|---|
| Railway | Servidor de la API, base de datos PostgreSQL y tarea diaria | Todos los datos del sistema | Estados Unidos [COMPLETAR: región configurada del proyecto] |
| Backblaze B2 | Almacenamiento de archivos | PDF por firmar y firmados, archivos subidos, archivos de la Ley N° 21.643 (cifrados antes de subir) | [COMPLETAR: región según `B2_ENDPOINT_URL`] |
| Resend | Envío de correos | Direcciones y contenido de los correos: códigos, enlaces de firma, avisos, PDF firmados adjuntos | Estados Unidos [COMPLETAR] |
| Cloudflare | DNS y proxy de `api.jornada40.cl` | Todo el tráfico de la API, en tránsito | Red global |
| Vercel | Publicación de la aplicación web | IP y navegador de los visitantes, en sus registros | Estados Unidos [COMPLETAR] |
| Google (Gemini) | Lectura de contratos escaneados, solo si el Cliente la usa | El contrato completo que sube el empleador | Estados Unidos [COMPLETAR] |
| Google (Fonts) | Fuentes tipográficas de la aplicación web | IP y navegador de cada visitante | Estados Unidos |
| Google (Gmail) | Correo de contacto `contacto.jornada40@gmail.com`, que también recibe las alertas | Mensajes de soporte; los avisos de pago incluyen el RUT del titular de la cuenta | Estados Unidos |
| Reveniu | Suscripciones | Nombre y correo del titular, montos y fechas | Chile |
| Transbank | Inscripción y cobro de la tarjeta | Datos de la tarjeta (Jornada40 no los ve) | Chile |

### Garantías, contratos y accesos

| Proveedor | Garantía de la transferencia internacional | Contrato de tratamiento de datos | Quién tiene acceso a la cuenta |
|---|---|---|---|
| Railway | [COMPLETAR: cláusulas contractuales del proveedor] | [COMPLETAR: enlace y fecha de aceptación] | [COMPLETAR] |
| Backblaze B2 | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Resend | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Cloudflare | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Vercel | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Google (Gemini) | [COMPLETAR] | [COMPLETAR: condiciones de la API pagada] | [COMPLETAR] |
| Google (Fonts) | [COMPLETAR] | No aplica | No aplica |
| Google (Gmail) | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Reveniu | No hay transferencia internacional [REVISAR] | [COMPLETAR] | [COMPLETAR] |
| Transbank | No hay transferencia internacional | Contrato de Reveniu con Transbank [REVISAR] | No aplica |

[REVISAR: la ley exige que el contrato del Cliente con Jornada40 autorice en forma específica cada subencargado (artículo 15 bis). Este registro es la lista que se propone autorizar en el Anexo de tratamiento por encargo.]

## Herramientas de desarrollo sin datos personales de producción

| Herramienta | Uso | Datos personales |
|---|---|---|
| GitHub | Repositorio del código e integración continua | Ninguno de producción: las pruebas usan datos ficticios |
| Asistente de programación (Claude Code) | Desarrollo y documentación | Ninguno de producción. Regla interna: no copiar datos de clientes ni de producción en la conversación |
| mindicador.cl | UF y UTM del día | Ninguno |

## Propuestas

1. **Alojar las fuentes en el propio sitio.** Cargar Poppins e IBM Plex Mono desde Google Fonts envía a Google la IP de cada visitante, incluidos los trabajadores que firman. Alojarlas en el sitio elimina esa transferencia sin cambiar el diseño.
2. **Correo de contacto propio.** Usar una dirección del dominio `jornada40.cl` para soporte, privacidad y alertas, con acceso registrado, en vez de una cuenta personal de Gmail.
3. **Inventario de accesos.** Completar la última columna con las personas que pueden entrar a la configuración de cada proveedor, y revisarla cada 6 meses (documento técnico, sección 8.10).
4. **Regiones.** Verificar la región de Railway y de B2; si el proveedor lo permite, preferir una región única y documentarla.
