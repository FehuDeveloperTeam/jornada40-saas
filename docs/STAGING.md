# Entorno de pruebas (staging)

Rama `staging` → backend en Railway (environment **staging**) y frontend en Vercel
(dominio asignado a la rama `staging`). Producción (`main`) no se toca.

```
staging.jornada40.cl  ──(VITE_API_URL)──▶  api-staging.jornada40.cl  ──▶  Postgres de staging
      Vercel (rama staging)                    Railway (env staging, rama staging)
```

Se recomiendan subdominios propios de `jornada40.cl`: frontend y backend quedan en el
mismo sitio, las cookies de sesión funcionan igual que en producción y Safari no las
bloquea (con `*.vercel.app` + `*.railway.app` son cookies de terceros).

Para actualizar staging con lo nuevo de la rama de trabajo:

```bash
git checkout staging
git merge --ff-only claude/review-dashboard-branch-IV6aW   # o la rama que se quiera probar
git push origin staging                                    # Railway y Vercel despliegan solos
```

---

## 1. Railway (backend)

1. Proyecto → selector de environment (arriba, dice *production*) → **New Environment**
   → nombre **`staging`** → *Duplicate environment* desde production (copia servicios y
   variables; después se cambian las que difieren).
   Railway define `RAILWAY_ENVIRONMENT_NAME=staging` y el backend se configura como
   staging solo (`IS_STAGING`: `DEBUG=False`, cookies seguras, sin HSTS preload).
2. En el environment **staging**, servicio del backend → **Settings → Source → Branch**:
   cambiar a **`staging`** (producción sigue en `main`).
3. **Base de datos propia**: en staging, *+ New → Database → PostgreSQL*. En el servicio
   del backend, `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (la del Postgres de staging,
   **nunca** la de producción). Las migraciones corren solas al arrancar y crean los
   planes base.
4. **Settings → Networking → Custom Domain**: `api-staging.jornada40.cl`. Railway muestra
   el registro CNAME a crear (paso 3 de DNS).
5. Variables del servicio en staging (las que no se nombran se copian igual que producción):

| Variable | Valor en staging |
|---|---|
| `SECRET_KEY` | una **nueva** (distinta de producción) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` del Postgres de staging |
| `SITIO_URL` | `https://staging.jornada40.cl` (enlaces de correos, firma, QR de certificados) |
| `STAGING_FRONTEND_URLS` | `https://staging.jornada40.cl` |
| `STAGING_API_HOSTS` | `api-staging.jornada40.cl` |
| `REVENIU_API_URL` | `https://integration.reveniu.com` (sandbox) |
| `REVENIU_WEBHOOK_SECRET` / `REVENIU_API_KEY` | las claves del **sandbox** de Reveniu |
| `REVENIU_LINK_*` | los links de los planes creados en el sandbox |
| `B2_BUCKET_NAME` (y claves B2) | un bucket **aparte** (o dejar B2 vacío: los PDF firmados no se guardan) |
| `RESEND_API_KEY` | puede ser la misma; los correos salen de verdad, usar correos propios de prueba |
| `DEFAULT_FROM_EMAIL` | p. ej. `Jornada40 Pruebas <noreply@jornada40.cl>` |
| `ALERTAS_PAGOS_EMAIL` | correo del equipo |
| `DJANGO_SUPERUSER_USERNAME` / `_EMAIL` / `_PASSWORD` | admin de staging (lo crea el arranque) |
| `KARIN_CLAVES_CIFRADO` | una clave **propia de staging** (`python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`); obligatoria en Railway |
| `GEMINI_API_KEY` | opcional (digitalización de contratos) |

6. En el sandbox de Reveniu, webhook → `https://api-staging.jornada40.cl/api/pagos/webhook/reveniu/`.
7. (Opcional) Servicio cron de resúmenes, igual que en producción pero en staging.

## 2. Vercel (frontend)

1. Proyecto → **Settings → Domains → Add** `staging.jornada40.cl` → en *Git Branch*
   elegir **`staging`**. Vercel indica el CNAME (`cname.vercel-dns.com`).
2. **Settings → Environment Variables** → agregar, en el entorno **Preview** y con
   *Git Branch* = `staging`:
   - `VITE_API_URL` = `https://api-staging.jornada40.cl/api`
   - `VITE_ENTORNO` = `staging` (franja "Entorno de pruebas" y `noindex`)
3. Cada push a `staging` despliega solo. Si hace falta, *Deployments → Redeploy*
   después de cambiar variables (las `VITE_*` se leen al construir).

## 3. DNS (donde está `jornada40.cl`, Cloudflare)

| Tipo | Nombre | Destino | Proxy |
|---|---|---|---|
| CNAME | `staging` | `cname.vercel-dns.com` | DNS only (nube gris) |
| CNAME | `api-staging` | el que indique Railway (`xxxx.up.railway.app`) | igual que `api` en producción |

Si `api-staging` va con la nube naranja (como `api`), `IpRealMiddleware` ya toma la IP
real desde `X-Real-IP`.

## 4. Comprobar

- `https://api-staging.jornada40.cl/admin/` abre el admin (entrar con el superusuario).
- `https://staging.jornada40.cl` muestra la franja naranja "Entorno de pruebas".
- Crear una cuenta, iniciar sesión, recargar: la sesión se mantiene (cookies OK).
- Pagar un plan con la tarjeta de prueba del sandbox: llega el webhook y el plan cambia.
- Pedir recuperación de clave: el enlace del correo apunta a `staging.jornada40.cl`.
