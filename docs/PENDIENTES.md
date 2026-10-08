# Pendientes de Jornada40

Lista viva de lo que falta hacer fuera del código (configuración, trámites) o que quedó en espera.
Cuando se pregunte por los pendientes, se responde desde aquí. Al completar algo, se marca con [x] y fecha.

## Antes de publicar en `main` (producción)

La publicación quedó en pausa el 2026-10-06 hasta completar estos puntos en el entorno **production** de Railway; se publicó en `main` el 2026-10-07 con los que están marcados:

- [ ] **Respaldo de la base de datos de producción** — *pospuesto: se publicó el 2026-10-07 sin respaldo, por decisión del titular, hasta tener el plan Pro de Railway (pestaña Backups del servicio Postgres). Mientras tanto se puede hacer gratis con `pg_dump`.* (Railway → Postgres → Backups, o `pg_dump` con `DATABASE_PUBLIC_URL`). Guardarlo fuera de Railway (bucket privado de B2 solo para respaldos + copia local). Al publicar se aplican las migraciones 0064 a 0098 (incluye separar direcciones y normalizar bancos).
- [x] (2026-10-07) **`KARIN_CLAVES_CIFRADO`** con una clave Fernet nueva (distinta a la de staging), guardada en un gestor de contraseñas. Si se pierde, se pierden las denuncias Ley Karin.
- [x] (2026-10-07) **`DEFAULT_FROM_EMAIL`** con una dirección @jornada40.cl (dominio verificado en Resend).
- [x] (2026-10-07) **`SITIO_URL=https://jornada40.cl`**.
- [x] (2026-10-07, configurado en production; revisar en los logs del servicio de cron que la primera ejecución diaria termine sin error) **Cron de Railway para los resúmenes por correo**: segundo servicio desde el mismo repo/Dockerfile, *Custom Start Command* `python manage.py enviar_resumenes`, *Cron Schedule* `0 12 * * *` (UTC = 08:00/09:00 en Chile), con las mismas variables que el servicio web (`DATABASE_URL`, `RESEND_API_KEY`, `SITIO_URL`, `DEFAULT_FROM_EMAIL`, `KARIN_CLAVES_CIFRADO`…). Sin él no salen los resúmenes del empleador, del equipo ni los avisos de plazos al encargado Ley Karin. Conviene crearlo también en staging para probarlo.

- [x] (2026-10-07) Publicado en `main` (commit `ed4f120`, CI en verde): migraciones 0064–0098 aplicadas, API y frontend nuevos verificados en producción.

## Después de publicar

- [ ] Respaldo automático diario fuera de Railway (cron `pg_dump` → B2 cifrado, retención 30 diarios / 12 mensuales, aviso por correo si falla). Pendiente de autorización.
- [x] (2026-10-07, producción) Cargar en el admin las **vacaciones escolares** (`PeriodoVacacionesEscolares`, calendario Mineduc). **Se repite cada año** cuando el Mineduc publique el calendario siguiente.
- [x] (2026-10-07) Revisar en el admin los **precios de los planes**. Si difieren de los iniciales ($16.990 / $39.990 / $89.990), actualizar la tabla del briefing comercial (`docs/briefing-comercial-jornada40.md`).
- [ ] Reveniu en **sandbox para staging** (secreto del webhook, enlaces `REVENIU_LINK_*`, `REVENIU_API_URL`).
- [ ] Eliminar el entorno duplicado de Railway ("stagging").

## Trámites y temas legales

- [ ] Reconocimiento de la plataforma ante la DT (Etapa D): acordar medidas de seguridad y presentar la solicitud.
  - Precedentes (revisados 2026-10-08): la DT aprobó en 2025–2026 a Nubox (Ord. 136, 14-03-2025, presentado el 24-09-2024: ~6 meses), Certifika "FirmaWeb" (Ord. 79), SIGNER (Ord. 741), GDEDIGITAL (Ord. 724), HPDIGITAL (Ord. 512), Visión FirmaDoc (Ord. 508), LeanGlobal (Ord. 428), SAFMAG1 (Ord. 426), entre otros; rechazó Albiorix (Ord. 131) y eProc (Ord. 509) por no cumplir el Dictamen 0789/15, y no se pronunció sobre "Workin Docs" (Ord. 48) porque los antecedentes estaban tras un registro: **adjuntar todo directo, sin exigir cuenta**.
  - Observación que la DT hizo a Nubox y a Certifika (Ord. 136 y 79): la seguridad no puede hacer que el trabajador pierda el control de su firma; objeta "claves dinámicas u OTP generadas por el mismo sistema" que se superpongan a la rúbrica del trabajador. **Hecho (2026-10-08)**: el flujo, el correo del código y el certificado dicen que el código o la clave solo verifican identidad y que firma la aceptación expresa más el trazo; firmar exige `acepto`; el código se guarda con hash; el trabajador puede usar su clave del portal. Falta explicarlo en la solicitud a la DT.
  - Al revisar esto apareció y se corrigió (2026-10-08) una falla del portal: la cuenta era una por RUT y quien verificaba cualquier correo de ese RUT (p. ej. un empleador con una ficha de RUT ajeno) veía las fichas del trabajador real y podía cambiarle la clave. Ahora la cuenta es por persona; la migración 0100 separó las cuentas mezcladas y les borró la clave.
  - Aprovechar la solicitud para preguntar a la DT por el canal de servicios web (API) para el LRE y el Registro Electrónico Laboral, que la DT anunció como "próxima evolución" (consulta 120083, actualizada 31-05-2023).
- [ ] Revisión legal de plantillas (reglamento por rubro, documentos Ley Karin, pactos).
- [ ] Verificar contra una carga real: aporte de indemnización a todo evento en Previred (campos 31–36) y CSV de registro masivo de Mi DT (oculto hasta confirmar la plantilla).

## En espera de terceros

- [ ] Códigos LRE para horas extra compensadas con feriado (Ley 21.561): la DT no los ha publicado (provisorios 2102 / 2313).
