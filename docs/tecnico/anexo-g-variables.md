# Anexo G. Variables de entorno {.unnumbered #sec-anexo-g}

Todas las variables de entorno que lee el sistema. Salen del código: de la configuración de Django y de los módulos que leen su propia variable, de la configuración de Vite y de Playwright, y del script que compila la extensión. La sección 12.3 las agrupa por ambiente, y `docs/STAGING.md` da los valores de staging.

**Cómo leer las tablas.**

- **Por omisión:** el valor si la variable no está definida; «—» indica que no tiene.
- ***Secreta*** (bajo el nombre): da acceso a un servicio o a datos. Se guarda solo en Railway, nunca en el repositorio ni en la conversación, y cada ambiente tiene la suya.
- **Correo de contacto:** `contacto.jornada40@gmail.com`.

#### Servidor (Railway) {.unnumbered}

| Variable | Propósito | Por omisión |
|---|---|---|
| `RAILWAY_ENVIRONMENT_NAME` | La pone Railway. Con `production`, el servidor corre como producción; con otro valor, como staging; sin ella, como desarrollo (`DEBUG` activo y SQLite) | — |
| `SECRET_KEY`<br>*Secreta* | Firma de las sesiones, los tokens, las cookies de los accesos y las huellas de los códigos. Obligatoria al desplegar: sin ella, el servidor no arranca | Solo en local, un valor de desarrollo |
| `DATABASE_URL`<br>*Secreta* | Conexión a la base de datos | `sqlite:///db.sqlite3` |
| `SITIO_URL` | Sitio público: enlaces de los correos, del QR de los certificados y de la recuperación de clave | `https://jornada40.cl` |
| `KARIN_CLAVES_CIFRADO`<br>*Secreta* | Claves Fernet de los datos reservados de la Ley Karin, separadas por coma; la primera cifra (sección 8.5). Obligatoria al desplegar: sin ella, falla todo cifrado o descifrado | Solo en local y en las pruebas, una derivada de `SECRET_KEY` |
| `RAILWAY_PUBLIC_DOMAIN` | La pone Railway. Dominio interno del servicio, aceptado en staging | Vacío |
| `STAGING_FRONTEND_URLS` | Orígenes de la aplicación web de staging, separados por coma (CORS y revisión del origen) | Vacío |
| `STAGING_API_HOSTS` | Dominios propios de la API de staging, separados por coma | Vacío |
| `VERCEL_PROJECT_NAME` | Nombre del proyecto de Vercel: en staging se aceptan sus vistas previas `<proyecto>-*.vercel.app` | `jornada40-saas` |
| `RESEND_API_KEY`<br>*Secreta* | Envío de correos por Resend | Vacío: el envío falla y se informa a la persona |
| `DEFAULT_FROM_EMAIL` | Remitente de los correos | `Jornada40 <noreply@jornada40.cl>` |
| `ALERTAS_ERRORES_EMAIL` | Destino de las alertas de errores del servidor | En producción, el correo de contacto; en los demás ambientes, vacío (sin alertas) |
| `ALERTAS_PAGOS_EMAIL` | Destino de los avisos de pagos que requieren acción | El correo de contacto |
| `B2_KEY_ID`<br>*Secreta* | Identificador de la clave de Backblaze B2. Con las cuatro variables de B2, los archivos y los PDF de la firma se guardan en B2. Sin ellas, los archivos subidos van al disco del contenedor, que no persiste, y el envío a firma responde 503 | — |
| `B2_APPLICATION_KEY`<br>*Secreta* | Clave de Backblaze B2 | — |
| `B2_BUCKET_NAME` | Depósito de B2 (uno por ambiente) | — |
| `B2_ENDPOINT_URL` | Dirección S3 de la región de B2 | — |
| `B2_PUBLIC_URL` | Base de las direcciones de los archivos de B2. Los archivos son privados y se entregan con enlaces firmados de una hora | Vacío |
| `REVENIU_WEBHOOK_SECRET`<br>*Secreta* | Secreto que Reveniu envía en cada aviso de pago; también sirve de clave de su API si no se define otra | — |
| `REVENIU_API_KEY`<br>*Secreta* | Clave de la API de Reveniu, si es distinta del secreto anterior | El valor de `REVENIU_WEBHOOK_SECRET` |
| `REVENIU_API_URL` | Dirección de la API de Reveniu (en staging, la de pruebas) | `https://api.reveniu.com` |
| `REVENIU_LINK_<PLAN>_<CICLO>` | Enlace de pago de cada plan y ciclo, por ejemplo `REVENIU_LINK_PYME_MENSUAL` o `REVENIU_LINK_STARTER_ANUAL`. Sin el enlace, ese plan responde 503 | — |
| `GEMINI_API_KEY`<br>*Secreta* | Lectura de contratos escaneados con Gemini. Sin ella, la función responde que no está disponible | — |
| `GEMINI_MODEL` | Modelo de Gemini; si no existe, se usa el de respaldo | `gemini-2.5-flash` |
| `DOMINIOS_CORREO_INSPECCION` | Dominios de correo aceptados en el portal de fiscalización, separados por coma | `dt.gob.cl` |
| `DIAGNOSTICO_RED` | Con `1`, abre `GET /api/diagnostico/red/` para revisar los encabezados de la IP del visitante (sección 12.7) | `0` |
| `DJANGO_SUPERUSER_USERNAME`, `DJANGO_SUPERUSER_EMAIL`, `DJANGO_SUPERUSER_PASSWORD`<br>*La clave es secreta* | Las lee `createsuperuser --noinput` al arrancar el contenedor para crear el administrador si no existe | — |

El servicio programado de `enviar_resumenes` usa las mismas variables que el servicio web (sección 12.7).

#### Aplicación web (Vercel) {.unnumbered}

Vite las incorpora al compilar, así que un cambio exige volver a desplegar. Ninguna es secreta: quedan en el código que recibe el navegador.

| Variable | Propósito | Por omisión |
|---|---|---|
| `VITE_API_URL` | Dirección de la API: `https://api.jornada40.cl/api` en producción | — |
| `VITE_ENTORNO` | Con `staging`, muestra la etiqueta «Pruebas», agrega `noindex` y habilita la tarjeta de la extensión | Vacío |
| `VITE_EXTENSION_MIDT` | Con `1`, muestra la tarjeta de la extensión para Mi DT fuera de staging; la usan los recorridos de navegador | Vacío |

#### Pruebas y herramientas {.unnumbered}

| Variable | Dónde | Propósito |
|---|---|---|
| `E2E_DB` | `config/settings_e2e.py` | Archivo SQLite de los recorridos de navegador (por omisión, `backend/e2e.sqlite3`) |
| `E2E_ARCHIVOS_DIR` | `settings_e2e.py` y Playwright | Carpeta de los archivos de los recorridos, incluidos los códigos de un solo uso que leen las pruebas |
| `PYTHON` | Playwright | Intérprete con el que se levanta el servidor de los recorridos |
| `CI` | Playwright | En la integración continua: un reintento por recorrido, informe para GitHub y servidores nuevos en cada ejecución |
| `CAPTURAS_DOC` | `frontend/e2e/capturas.spec.ts` | Con `1`, toma las capturas del capítulo 7 de este documento |
| `J40_API` | `frontend/extension/construir.mjs` | Cambia la API a la que apunta la extensión al compilarla; por omisión, la del ambiente elegido |
