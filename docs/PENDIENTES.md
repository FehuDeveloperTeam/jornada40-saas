# Pendientes de Jornada40

Lista viva de lo que falta hacer fuera del código (configuración, trámites) o que quedó en espera.
Cuando se pregunte por los pendientes, se responde desde aquí. Al completar algo, se marca con [x] y fecha.

## Antes de publicar en `main` (producción)

La publicación quedó en pausa el 2026-10-06 hasta completar estos puntos en el entorno **production** de Railway; se publicó en `main` el 2026-10-07 con los que están marcados:

- [ ] **Respaldo de la base de datos de producción** — *pospuesto: se publicó el 2026-10-07 sin respaldo, por decisión del titular, hasta tener el plan Pro de Railway (pestaña Backups del servicio Postgres). Mientras tanto se puede hacer gratis con `pg_dump`.* (Railway → Postgres → Backups, o `pg_dump` con `DATABASE_PUBLIC_URL`). Guardarlo fuera de Railway (bucket privado de B2 solo para respaldos + copia local). Al publicar se aplican las migraciones 0064 a 0098 (incluye separar direcciones y normalizar bancos).
- [x] (2026-10-07) **`KARIN_CLAVES_CIFRADO`** con una clave Fernet nueva (distinta a la de staging), guardada en un gestor de contraseñas. Si se pierde, se pierden las denuncias Ley Karin.
- [x] (2026-10-07) **`DEFAULT_FROM_EMAIL`** con una dirección @jornada40.cl (dominio verificado en Resend).
- [x] (2026-10-07) **`SITIO_URL=https://jornada40.cl`**.
- [ ] **Cron de Railway para los resúmenes por correo**: segundo servicio desde el mismo repo/Dockerfile, *Custom Start Command* `python manage.py enviar_resumenes`, *Cron Schedule* `0 12 * * *` (UTC = 08:00/09:00 en Chile), con las mismas variables que el servicio web (`DATABASE_URL`, `RESEND_API_KEY`, `SITIO_URL`, `DEFAULT_FROM_EMAIL`, `KARIN_CLAVES_CIFRADO`…). Sin él no salen los resúmenes del empleador, del equipo ni los avisos de plazos al encargado Ley Karin. Conviene crearlo también en staging para probarlo.

- [x] (2026-10-07) Publicado en `main` (commit `ed4f120`, CI en verde): migraciones 0064–0098 aplicadas, API y frontend nuevos verificados en producción.

## Después de publicar

- [ ] Respaldo automático diario fuera de Railway (cron `pg_dump` → B2 cifrado, retención 30 diarios / 12 mensuales, aviso por correo si falla). Pendiente de autorización.
- [ ] Cargar en el admin las **vacaciones escolares** (`PeriodoVacacionesEscolares`, calendario Mineduc) de cada año.
- [ ] Revisar en el admin los **precios de los planes** (el briefing comercial usa los valores iniciales).
- [ ] Reveniu en **sandbox para staging** (secreto del webhook, enlaces `REVENIU_LINK_*`, `REVENIU_API_URL`).
- [ ] Eliminar el entorno duplicado de Railway ("stagging").

## Trámites y temas legales

- [ ] Reconocimiento de la plataforma ante la DT (Etapa D): acordar medidas de seguridad y presentar la solicitud.
- [ ] Revisión legal de plantillas (reglamento por rubro, documentos Ley Karin, pactos).
- [ ] Verificar contra una carga real: aporte de indemnización a todo evento en Previred (campos 31–36) y CSV de registro masivo de Mi DT (oculto hasta confirmar la plantilla).

## En espera de terceros

- [ ] Códigos LRE para horas extra compensadas con feriado (Ley 21.561): la DT no los ha publicado (provisorios 2102 / 2313).
