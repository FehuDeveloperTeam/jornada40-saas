# Instalación, despliegue y operación {#sec-operacion}

Este capítulo explica cómo levantar Jornada40 en un equipo de desarrollo, cómo se configura y despliega, cómo se vigila y respalda, y qué tareas periódicas exige su operación. La arquitectura de despliegue está en la sección 4.6 y las variables de configuración, en el anexo G.

## Requisitos {#sec-op-requisitos}

| Componente | Versión o detalle | Para qué |
|---|---|---|
| Python | 3.11 (la versión que fija el Dockerfile) | API y comandos |
| Paquetes del sistema | `gcc`, `libpq-dev`, `libcairo2-dev`, `pkg-config` | Compilar el conector de PostgreSQL y pycairo (PDF) |
| Dependencias de Python | `backend/requirements.txt`, con versiones fijas; `requirements-dev.txt` para las herramientas de calidad | API y pruebas |
| Node.js | 22 (la versión de la integración continua) | Aplicación web y extensión |
| Dependencias de Node | `frontend/package-lock.json` (`npm ci`) | Aplicación web y extensión |
| Base de datos | PostgreSQL en los ambientes desplegados; SQLite en desarrollo y en los recorridos | Datos |
| Navegador | Chromium (Playwright) | Recorridos de navegador y diagramas del documento |
| Documento técnico | pandoc 3, LibreOffice 7.6 o superior con Python UNO; Node y Chromium para redibujar diagramas | `docs/tecnico/` |

: Requisitos de instalación

## Puesta en marcha local {#sec-op-local}

**Servidor.**

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
python manage.py migrate
python manage.py createsuperuser        # opcional: acceso al administrador
python manage.py runserver              # http://127.0.0.1:8000
```

Sin `RAILWAY_ENVIRONMENT_NAME`, el servidor corre en modo de desarrollo:

- `DEBUG` está activo y se usa SQLite;
- la clave secreta y la de cifrado de la Ley Karin tienen valores de desarrollo;
- los archivos van a `backend/media/`.

En desarrollo no hace falta un archivo `.env`.

**Aplicación web.**

```bash
cd frontend
npm ci
echo "VITE_API_URL=http://127.0.0.1:8000/api" > .env.local
npm run dev                             # http://localhost:5173
```

**Pruebas.** `python manage.py test core --parallel` (servidor), `npm test` (interfaz) y `npm run e2e` (navegador). Esta última levanta sola el servidor con `config.settings_e2e` y Vite; la variable `PYTHON` indica qué intérprete usar.

**Extensión.** `npm run extension:desarrollo` la construye apuntando a la API local; se instala en Chrome con «Cargar descomprimida».

## Configuración {#sec-op-configuracion}

La configuración se lee de variables de entorno: en Railway para la API y la tarea programada, en Vercel para la aplicación web. El anexo G las lista todas, con su propósito, su valor por omisión y si son secretas. Las principales por ambiente desplegado:

| Grupo | Variables |
|---|---|
| Django | `SECRET_KEY` (obligatoria), `DATABASE_URL`, `RAILWAY_ENVIRONMENT_NAME` (la pone Railway) |
| Dominios de staging | `STAGING_FRONTEND_URLS`, `STAGING_API_HOSTS`, `VERCEL_PROJECT_NAME` |
| Sitio y correo | `SITIO_URL`, `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL`, `ALERTAS_ERRORES_EMAIL`, `ALERTAS_PAGOS_EMAIL` |
| Almacenamiento | `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_ENDPOINT_URL` |
| Pagos | `REVENIU_WEBHOOK_SECRET`, `REVENIU_API_KEY`, `REVENIU_API_URL`, `REVENIU_LINK_<PLAN>_<CICLO>` |
| Ley Karin | `KARIN_CLAVES_CIFRADO` (obligatoria; una clave distinta por ambiente) |
| Lectura de contratos | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| Arranque | `DJANGO_SUPERUSER_USERNAME`, `_EMAIL` y `_PASSWORD` (crean el administrador si no existe) |
| Aplicación web | `VITE_API_URL`, `VITE_ENTORNO=staging`, `VITE_EXTENSION_MIDT` |

: Variables principales por grupo

**Datos que se cargan en el administrador.** Además de las variables, el sistema necesita estos datos, que el equipo de Jornada40 carga en el administrador de Django:

- los parámetros previsionales y las tasas de AFP de cada período;
- los tramos de asignación familiar;
- los factores de actualización del SII de cada año;
- los períodos de vacaciones escolares;
- los precios de los planes.

La sección 12.7 indica cuándo se actualiza cada uno.

## Despliegue {#sec-op-despliegue}

**Ruta de un cambio.**

1. **Rama de trabajo.** El cambio se desarrolla en una rama, con sus pruebas, y la integración continua debe pasar.
2. **Staging.** Se publica en staging con `git push origin <rama>:staging`. Railway y Vercel despliegan solos ese ambiente.
3. **Revisión.** El titular lo revisa en staging (aceptación).
4. **Producción.** Con su autorización, se integra en `main`. Railway y Vercel despliegan producción.

**Arranque de la API.** Railway construye la imagen del Dockerfile, que reúne los estáticos. Al arrancar el contenedor:

- aplica las migraciones; si alguna falla, el contenedor se detiene;
- crea el superusuario si no existe;
- inicia Gunicorn.

**[Solo en staging]** El corte por migración fallida es de la versión de pruebas; la orden que corre hoy en producción arranca Gunicorn aunque la migración falle.

**Antes de publicar en producción:**

- respaldar la base de datos, sobre todo si hay migraciones que transforman datos (sección 6.7);
- revisar que las variables nuevas estén definidas en producción;
- leer la lista «Antes de publicar en `main`» de `docs/PENDIENTES.md`.

**Después de publicar:**

- verificar el ingreso, una firma y el portal del trabajador;
- revisar el registro de Railway y que no lleguen alertas.

Con la corrección de CSRF, el panel de producción se usa solo desde jornada40.cl o www.jornada40.cl.

**Volver atrás.**

- **Railway y Vercel:** permiten volver a desplegar una versión anterior.
- **Base de datos:** una migración que transforma datos y no es reversible (sección 6.7) solo se deshace restaurando un respaldo. Por eso el respaldo previo es obligatorio en esos casos.

## Monitoreo {#sec-op-monitoreo}

| Qué | Cómo | Quién recibe |
|---|---|---|
| Errores del servidor | Correo por cada error con excepción: un aviso por error y por hora, máximo 20 por hora, sin datos personales (`core/alertas.py`) | `ALERTAS_ERRORES_EMAIL`; en producción, por omisión `contacto.jornada40@gmail.com` |
| Avisos de pago que requieren acción | Correo con el aviso y lo que hay que hacer | `ALERTAS_PAGOS_EMAIL` |
| Indicadores y parámetros desactualizados | Comando `estado_indicadores`; aviso en el panel junto a la UF y la UTM | Quien lo ejecuta; los usuarios del panel |
| Registro de ejecución | Salida del contenedor en Railway, desde el nivel WARNING | Equipo con acceso a Railway |
| Tarea programada | Registro del servicio cron en Railway | Equipo con acceso a Railway |

: Monitoreo

**Falta.**

- un monitor de disponibilidad que avise si la API o el sitio no responden;
- métricas de uso y rendimiento;
- un registro de los errores de la aplicación web en el navegador;
- una revisión periódica de que el cron terminó sin errores.

## Respaldo y recuperación {#sec-op-respaldo}

**Estado actual.**

- **Base de datos.** No hay respaldos automáticos propios. Los respaldos del servicio PostgreSQL de Railway requieren su plan Pro, y producción se publicó el 07-10-2026 sin respaldo, por decisión del titular.
- **Archivos.** Los archivos de B2 tampoco tienen versiones ni respaldo aparte.
- **Claves de cifrado.** La clave de la Ley Karin está guardada en un gestor de contraseñas: perderla significa perder las denuncias.

**Respaldo manual, mientras tanto.**

```bash
pg_dump "$DATABASE_PUBLIC_URL" --format=custom --file=jornada40-AAAAMMDD.dump
```

Los parámetros:

- `DATABASE_PUBLIC_URL` es la dirección pública de la base en Railway;
- el archivo resultante contiene datos personales, así que debe guardarse cifrado y fuera de Railway, por ejemplo en un depósito privado de B2 solo para respaldos, más una copia local.

Para restaurar:

```bash
pg_restore --clean --no-owner --dbname="$DATABASE_URL_DESTINO" jornada40-AAAAMMDD.dump
```

Conviene probar la restauración en una base aparte antes de necesitarla.

**Propuesta pendiente de autorización.**

- respaldo diario automático con `pg_dump`, cifrado y guardado en B2;
- retención de 30 copias diarias y 12 mensuales, con aviso por correo si falla;
- un simulacro de restauración periódico;
- definir el objetivo de punto de recuperación (cuántos datos se pueden perder) y el de tiempo de recuperación (cuánto puede durar la caída).

## Procedimientos de operación {#sec-op-procedimientos}

| Procedimiento | Cuándo | Cómo |
|---|---|---|
| Actualizar parámetros previsionales | Cada reajuste de topes, ingreso mínimo o tasas; Previred publica cada mes | Ejecutar `sincronizar_previred`, revisar la propuesta y confirmarla en el administrador. Las tres tasas de la reforma de pensiones que el comando no propone se ingresan a mano |
| Asignación familiar | Cuando la SUSESO publica un reajuste | Agregar los tres tramos con su fecha de vigencia en el administrador |
| Factores de actualización del SII | Cada enero | Cargar los 12 factores del año anterior antes de emitir el Certificado N°6 |
| Vacaciones escolares | Cuando el Mineduc publica el calendario | Cargar los períodos en el administrador |
| Revisar parámetros e indicadores | Cada mes y ante una alerta | `python manage.py estado_indicadores` |
| Vincular un aviso de pago no asociado | Cuando llega el correo de pagos | Administrador → Eventos de la pasarela → el aviso → elegir cliente y plan → guardar |
| Cancelar o reanudar a mano en Reveniu | Cuando el correo de pagos lo pide | Hacerlo en el panel de Reveniu, que el correo identifica |
| Recalcular liquidaciones emitidas sin tope | Una vez, si el comando lo informa | `revisar_topes_imponibles` (solo informa); con `--aplicar` recalcula las que no tienen firma |
| Rotar la clave de cifrado de la Ley Karin | Si se sospecha que se filtró, o periódicamente | Agregar la clave nueva al principio de `KARIN_CLAVES_CIFRADO`, desplegar, ejecutar `rotar_cifrado` y luego quitar la clave antigua |
| Rotar `SECRET_KEY` | Si se sospecha que se filtró | Cambiarla en Railway y desplegar. Se cierran todas las sesiones y quedan sin efecto los códigos, las invitaciones y los enlaces de recuperación pendientes; los enlaces de firma siguen sirviendo con un código nuevo. Conviene hacerlo en un horario de poco uso |
| Diagnóstico de la IP del visitante | Si los límites de intentos o la auditoría muestran IP raras | Activar `DIAGNOSTICO_RED=1`, consultar `GET /api/diagnostico/red/` y volver a desactivarlo |
| Tarea programada en un ambiente nuevo | Al crear el ambiente | Segundo servicio desde el mismo repositorio, con comando `python manage.py enviar_resumenes`, horario `0 12 * * *` y las mismas variables que el servicio web |
| Responder a una alerta de error | Al recibirla | Ubicar la ruta y la traza en el registro de Railway, reproducir con una prueba, corregir y publicar por staging |

: Procedimientos de operación
