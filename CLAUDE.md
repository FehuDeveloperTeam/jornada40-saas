# CLAUDE.md — Jornada40 SaaS

This document provides context for AI assistants (Claude Code and others) working on this codebase.

---

## Project Overview

**Jornada40 SaaS** is a Chilean B2B labor-management platform that helps companies comply with the Ley de 40 horas (40-hour work week). It manages employee contracts, payroll liquidations, legal document generation, and subscription billing.

- **Frontend**: React 19 + TypeScript + Vite → deployed on **Vercel**
- **Backend**: Django 5 + Django REST Framework → deployed on **Railway**
- **Database**: PostgreSQL (production) / SQLite (local development)
- **Language**: The entire UI is in Spanish; all model field names, API routes, and template strings are in Spanish.

---

## Repository Structure

```
jornada40-saas/
├── backend/               # Django REST API
│   ├── config/            # Django project settings
│   │   ├── settings.py    # Main settings file
│   │   ├── urls.py        # Root URL config
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── core/              # Single Django app containing all business logic
│   │   ├── models.py      # All data models
│   │   ├── views/         # ViewSets y vistas, un módulo por tema (ver abajo)
│   │   ├── serializers.py # All DRF serializers
│   │   ├── urls.py        # API URL router
│   │   ├── admin.py       # Django admin registration
│   │   ├── tests/         # Pruebas por tema (test_*.py) y ayudantes en utiles.py
│   │   ├── migrations/    # Database migrations
│   │   └── templates/     # Email templates
│   ├── templates/         # General Django templates
│   ├── manage.py
│   ├── requirements.txt
│   ├── runtime.txt        # Python 3.11 (referencia; manda el Dockerfile)
│   └── Dockerfile         # Lo que usa Railway para construir y arrancar
├── frontend/
│   ├── src/
│   │   ├── pages/         # One file per route (page-based architecture)
│   │   ├── context/       # React context providers (AuthContext)
│   │   ├── api/           # Axios client configuration
│   │   ├── types/         # TypeScript interfaces
│   │   ├── utils/         # Pure utility functions (rutUtils.ts)
│   │   ├── assets/        # Static images/icons
│   │   ├── App.tsx        # Root component + route definitions
│   │   └── main.tsx       # React entry point
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── vercel.json        # Vercel SPA rewrite rules
└── CLAUDE.md              # This file
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 19.2.0 |
| Frontend language | TypeScript (strict) | 5.9.3 |
| Build tool | Vite | 7.3.1 |
| Styling | Tailwind CSS | 4.1.18 |
| Routing | React Router | 7.13.0 |
| Server state | TanStack React Query | 5.x |
| HTTP client | Axios | 1.13.5 |
| Icons | Lucide React | 0.563.0 |
| Excel | xlsx / pandas / openpyxl | — |
| Backend framework | Django | 5.2.11 |
| REST API | Django REST Framework | 3.16.1 |
| Auth | dj-rest-auth + simplejwt | — |
| Database ORM | Django ORM (native) | — |
| Email | Anymail (Resend backend) | — |
| PDF generation | xhtml2pdf + reportlab (server); pdf.js in the signing page | — |
| Holidays | `holidays` (Chile calendar, feriado and semana corrida) | — |
| Payments | Stripe + Reveniu webhooks | — |
| Production web server | Gunicorn | 25.x |
| Static files | WhiteNoise | 6.x |

---

## Local Development Setup

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create a .env file (see Environment Variables section)
python manage.py migrate
python manage.py createsuperuser   # optional
python manage.py runserver         # starts on http://127.0.0.1:8000
```

### Frontend

```bash
cd frontend
npm install

# Create a .env.local file (see Environment Variables section)
npm run dev    # starts on http://localhost:5173
```

The Vite dev server proxies `/api/*` requests to `http://127.0.0.1:8000`, so the frontend talks to the local backend automatically during development.

---

## Environment Variables

### Backend — `backend/.env`

```env
SECRET_KEY=django-insecure-replace-with-real-key
DATABASE_URL=sqlite:///db.sqlite3              # or postgresql://...
RESEND_API_KEY=re_xxxxxxxxxxxx                 # Resend.com API key
# RAILWAY_ENVIRONMENT_NAME=production          # Railway sets this automatically; omit for local dev
```

> `IS_PRODUCTION` is derived from `RAILWAY_ENVIRONMENT_NAME` being set. When absent, DEBUG=True and SQLite is used.

### Frontend — `frontend/.env.local`

```env
# Development
VITE_API_URL=http://127.0.0.1:8000/api

# Producción: no es necesario setear VITE_API_URL; el fallback '/api' funciona con el proxy de Vercel.
# VITE_API_URL=  # dejar vacío o no definir en producción
```

---

## Key Scripts

### Frontend (`frontend/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `vite` | Start HMR dev server on port 5173 |
| `npm run build` | `tsc -b && vite build` | Type-check + bundle for production |
| `npm run lint` | `eslint .` | Run ESLint |
| `npm run preview` | `vite preview` | Serve the production build locally |

### Backend (`manage.py`)

```bash
python manage.py migrate              # Apply database migrations
python manage.py makemigrations       # Generate new migrations after model changes
python manage.py createsuperuser      # Create a Django admin user
python manage.py collectstatic        # Gather static files (needed in production)
python manage.py runserver            # Start dev server
gunicorn config.wsgi:application      # Production server (Railway starts it from the Dockerfile)
```

---

## Authentication Architecture

- **Method**: JWT stored in **HTTP-only cookies** (not localStorage).
- **Cookie names**: `jornada40-auth` (access token) and `jornada40-refresh-token`.
- **Access token lifetime**: 30 minutes. **Refresh token lifetime**: 2 hours.
- **Refresh rotation**: Enabled (`ROTATE_REFRESH_TOKENS = True`).
- **Frontend auth check**: `ProtectedRoute` in `App.tsx` calls `GET /api/auth/user/` with `withCredentials: true`. A 200 response means authenticated; only a 401/403 redirects to `/login?volver=<ruta>` (Login returns there). Any other error (429, 5xx, network) shows a retry screen instead of logging out.
- **Session renewal**: `api/client.ts` has a response interceptor: on a 401 it calls `POST /auth/token/refresh/` once (concurrent requests share it; the refresh cookie rotates) and retries. If the refresh fails inside `/app`, it goes to `/login?volver=`. Logout and login clear the react-query cache.
- **CORS**: `CORS_ALLOW_CREDENTIALS = True`. Allowed origins: `https://jornada40.cl` (prod) and `http://localhost:5173` (dev).
- **Password reset flow**: Backend sends email via Resend; link points to `https://jornada40.cl/reset-password/{uid}/{token}`.
- **RUT-based recovery**: Custom endpoint `POST /api/auth/recuperar-por-rut/` for users who forgot their email.

### Key Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register/` | Register new user (custom view) |
| POST | `/api/auth/login/` | Login, sets JWT cookies |
| POST | `/api/auth/logout/` | Logout, clears cookies |
| GET | `/api/auth/user/` | Returns current user (used for session verification) |
| POST | `/api/auth/password/reset/` | Closed (410): recovery is by RUT only |
| POST | `/api/auth/password/change/` | Change password (requires `old_password`) |
| POST | `/api/auth/recuperar-por-rut/` | Recover account using Chilean RUT |

---

## API Structure

All API routes are prefixed with `/api/`. The DRF router registers these ViewSets:

| Resource | Base Path | ViewSet |
|----------|-----------|---------|
| Companies | `/api/empresas/` | `EmpresaViewSet` |
| Employees | `/api/empleados/` | `EmpleadoViewSet` |
| Contracts | `/api/contratos/` | `ContratoViewSet` |
| Legal Documents | `/api/documentos_legales/` | `DocumentoLegalViewSet` |
| Payroll (Liquidaciones) | `/api/liquidaciones/` | `LiquidacionViewSet` |
| Plans | `/api/planes/` | `PlanViewSet` |
| Annexes | `/api/anexos_contrato/` | `AnexoContratoViewSet` |
| Vacations | `/api/vacaciones/` | `VacacionViewSet` |
| Finiquitos | `/api/finiquitos/` | `FiniquitoViewSet` |
| Pay concepts | `/api/conceptos/` | `ConceptoRemuneracionViewSet` |
| Signatures | `/api/firmas/` | `SolicitudFirmaViewSet` (public flow under `/api/firma-publica/<token>/…`) |

Custom endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pagos/crear-checkout/` | Create Reveniu checkout session |
| POST | `/api/pagos/webhook/reveniu/` | Receive Reveniu payment webhooks |
| GET | `/api/clientes/mi_suscripcion/` | Logged-in user's subscription status |
| GET/PATCH | `/api/clientes/perfil/` | Logged-in user's profile |
| GET | `/api/indicadores/` | UF, UTM and legal max weekly hours |
| GET | `/api/parametros/vigentes/` | Current previsional parameters (read-only) |

### Views package (`core/views/`)

`core/views/__init__.py` re-exports every name, so `from core.views import X` keeps working (urls, admin, serializers, management commands). Modules, with no import cycles:

| Module | Contents |
|--------|----------|
| `base` | Throttles, active plan and worker quota, dates, PDF helpers, contract context |
| `feriado` | Chilean holidays, business days, vacation balance (Arts. 67–70) |
| `parametros` | Versioned previsional parameters, AFP/AFC rates, daily indicators |
| `calculo_liquidacion` | Payroll calculation (`_calcular_liquidacion`), concepts and commissions |
| `previred` | Previred 105-field file (`_linea_previred`) |
| `finiquitos` | Finiquito calculation and `FiniquitoViewSet` |
| `documentos`, `vacaciones`, `empresas`, `empleados`, `contratos`, `conceptos`, `liquidaciones`, `firmas` | Their ViewSets (contracts also hold annexes; employees the bulk import) |
| `suscripciones` | Plans, subscription, Reveniu checkout and webhook |
| `cuentas` | Login, registration, RUT recovery, profile, network diagnostic |
| `firma_publica` | Worker-facing signing flow |

---

## Data Models (core/models.py)

### Core Models

| Model | Purpose |
|-------|---------|
| `Plan` | Pricing tier (name, price, max companies, max workers) |
| `Cliente` | User profile, extends Django's `User` model via OneToOne; stores RUT, plan reference |
| `Empresa` | Company owned by a `Cliente`; has RUT, address, legal rep |
| `Empleado` | Employee within a company; stores personal info, AFP, ISAPRE, bank account |
| `Contrato` | Employment contract for an employee; types: indefinido / plazo fijo / obra_faena |
| `DocumentoLegal` | Legal documents (warnings, terminations); generates PDF |
| `Liquidacion` | Monthly salary slip; unique per (empleado, mes, anio) |
| `Suscripcion` | Subscription record for a `Cliente`; states: TRIAL, ACTIVE, PAST_DUE, CANCELED |

### Important Field Conventions

- `activo` boolean field is used for soft-deletes (never hard-delete rows).
- `creado_en` / `actualizado_en` are standard timestamp fields.
- `rut` fields store Chilean national IDs and are validated/formatted using helpers in `utils/rutUtils.ts` (frontend) and inline validation (backend).
- `distribucion_horario` on `Contrato` is a `JSONField` storing a schedule matrix.
- `ficha_numero` on `Empleado` is auto-generated per company (sequential number).
- Contracts are OneToOne with employees (one active contract per employee at a time).

---

## Frontend Architecture

### Page-Based Routing

Routes are defined in `src/App.tsx`. Public pages live in `src/pages/sitio/`; the admin panel lives in `src/pages/app/`, rendered inside `components/app/AppShell.tsx` (sidebar, company switcher, ⌘K palette, toasts) and protected by `ProtectedRoute`.

| Route | Component | Protection |
|-------|-----------|-----------|
| `/` | `sitio/Landing.tsx` (redirects to `/app` if logged in) | Public |
| `/login`, `/register`, `/forgot-password`, `/reset-password/:uid/:token` | `sitio/*` (login and recovery by RUT only) | Public |
| `/terminos` | `sitio/Terminos.tsx` | Public |
| `/firma/:token` | `sitio/Firma.tsx` (worker signing flow: RUT → OTP → review → sign) | Public |
| `/bienvenida` | `sitio/Bienvenida.tsx` (onboarding) | Protected |
| `/app` | `app/Inicio.tsx` | Protected |
| `/app/trabajadores`, `/app/trabajadores/importar` | `app/Trabajadores.tsx`, `app/Importar.tsx` | Protected |
| `/app/trabajadores/:id` (`?tab=`, `?accion=anexo\|documento\|vacacion`) | `app/Carpeta.tsx` | Protected |
| `/app/trabajadores/:id/contrato`, `/app/trabajadores/:id/finiquito` | `app/ContratoEditor.tsx`, `app/Finiquito.tsx` | Protected |
| `/app/remuneraciones`, `/app/remuneraciones/conceptos` | `app/Remuneraciones.tsx`, `app/Conceptos.tsx` | Protected |
| `/app/firmas`, `/app/reportes` | `app/Firmas.tsx`, `app/Reportes.tsx` | Protected |
| `/app/empresa`, `/app/empresas`, `/app/plan`, `/app/cuenta` | `app/Empresa.tsx`, `app/Empresas.tsx`, `app/Plan.tsx`, `app/Cuenta.tsx` | Protected |

Legacy URLs (`/dashboard`, `/empresas`, `/suscripcion`, `/reportes`) redirect to their `/app/*` equivalents.

UI primitives live in `src/components/j40/` (design tokens in `src/styles/j40.css`, themed by `data-j40`).

### Backend-first rule

Every legal/previsional calculation happens in the backend; the frontend only shows it. Previews use server endpoints: `POST /liquidaciones/simular/`, `POST /finiquitos/simular/`, `POST /contratos/evaluar-jornada/`, `GET /vacaciones/dias_habiles/`, `POST /empleados/carga_masiva/?previsualizar=1`. Legal amounts (indemnizations, feriado, deductions, a concept's previsional nature) are never accepted from the client. Labor-norm issues (e.g. hours over the legal maximum) produce **warnings, never blocks**.

### State Management

- **Authentication state**: `AuthContext` in `src/context/AuthContext.tsx` — provides `user`, `isAuthenticated`, `loading`, `login()`, `logout()`.
- **Server state**: TanStack React Query for data fetching/caching; Axios for HTTP calls.
- **No global client-state library** (no Redux/Zustand); component-local `useState` + React Context is used.

### Axios Client

`src/api/client.ts` creates a pre-configured Axios instance pointing to `VITE_API_URL` with `withCredentials: true` so JWT cookies are sent automatically on every request.

### TypeScript Types

All shared types live in `src/types/index.ts`: `User`, `Empresa`, `Empleado`, `Contrato`, and related interfaces. Always update this file when adding new model fields that the frontend needs.

### Chilean RUT Utilities

`src/utils/rutUtils.ts` contains `formatRut()`, `validateRut()`, and related helpers. Always use these when displaying or validating RUTs — never implement ad-hoc RUT logic.

---

## PDF Generation

PDFs are generated server-side in the `core/views/` modules using `xhtml2pdf`. The pattern is:

1. Fetch required model data.
2. Render an HTML template string (inline or from `templates/`) with context.
3. Convert HTML to PDF with `pisa.CreatePDF`.
4. Return as `HttpResponse` with `Content-Type: application/pdf`.

PDF files may optionally be saved to `MEDIA_ROOT` (`backend/media/`).

---

## Excel Import/Export

- **Bulk import**: `pandas` reads uploaded `.xlsx` files; rows are validated and bulk-created.
- **Export**: `openpyxl` / `xlsx` used to build spreadsheets on the fly.
- Import endpoints are custom actions on the relevant ViewSets (e.g., `@action(detail=False, methods=['post'])`).

---

## Documentos firmados

- A document with a `SolicitudFirma` in `FIRMADO` is **always** delivered in its signed version (from B2, `b2_key_firmado`): every download endpoint and the ZIPs call `pdf_firmado(tipo, **documento)` (`core/views/base.py`) first and only regenerate from the template if there is no signature. Responses carry `X-Documento-Firmado` and a `_firmado.pdf` filename.
- One PDF function per document type, shared by download, signing and ZIPs: `pdf_documento_legal`, `pdf_anexo_contrato` (`views/documentos.py`), `pdf_vacacion` (`views/vacaciones.py`), `pdf_finiquito` (`views/finiquitos.py`), `_pdf_liquidacion` (`views/calculo_liquidacion.py`).
- `POST /api/firmas/solicitar_liquidaciones/ {empresa, mes, anio}` sends every payslip of the period without a pending/processing/signed request (used by Remuneraciones → "Enviar N a firma"); workers without email are reported, not blocking.
- Times shown to users (emails, reports) use `timezone.localtime()` / `timezone.localdate()` (Chile), never UTC.
- **States**: `SolicitudFirma.actualizar_estados(qs)` marks overdue PENDIENTE as EXPIRADO and returns PROCESANDO older than 10 minutes to PENDIENTE (a crashed signing); it runs before listing, resending and public reads. A document can't have two live requests (PENDIENTE/PROCESANDO/FIRMADO); `_generar_pdf_firma` always scopes lookups to the worker (a `contrato_id` from another client is rejected).
- **Locks**: a contract with a CONTRATO request pending/processing/signed can't be edited (400: changes go through an anexo); liquidaciones and finiquitos in PENDIENTE/PROCESANDO/FIRMADO neither.
- **Public signing**: `GET /firma-publica/<token>/documento/?sesion=` requires the session obtained with RUT + OTP (403 otherwise); the session is kept after signing so the worker can download the signed PDF. Public signing views are throttled per link (`firma_publica`, 120/h) plus a wide per-IP cap (`firma_publica_ip`), not by the anonymous daily limit (workers of one site share an IP).

---

## Digitalización de contratos (Gemini)

- `POST /api/empleados/{id}/digitalizar_contrato/` (PDF/JPG/PNG, 20 MB) → `core/extractor_contrato.py`: `GEMINI_API_KEY`, model `GEMINI_MODEL` (default `gemini-2.5-flash`; on a 404 it falls back to `gemini-flash-latest`), 45 s timeout. The answer is filtered to the expected keys and a RUT with a wrong check digit is dropped. Errors raise `ExtraccionNoDisponible` with a user-facing message (502). The editor fills the contract fields and only shows the worker's personal data for confirmation. `google-genai` is pinned to 1.75.0 (1.16.0 was yanked).

---

## Archivo Previred

- `GET /api/liquidaciones/exportar_previred/?mes=&anio=[&empresa=]` genera el **formato estándar de largo variable por separador, versión 100 (septiembre 2026)**: 105 campos por trabajador separados por `;`, Latin-1, fin de línea `\r\n`. La construcción está en `_linea_previred` (`core/views/previred.py`), con el número de campo del documento oficial en cada `poner(n, …)`.
- Datos que lo alimentan: en `Empresa`, `mutual`, `tasa_accidentes`, `sucursal_mutual` y `ccaf`, editables en `/app/empresa` → Seguridad social. En `Empleado`, `isapre`, `numero_fun`, `tramo_asignacion_familiar` y las cargas, editables en la carpeta → Previsión y pago. La asignación familiar se toma de los ítems `ASIGNACION_FAMILIAR` de la liquidación.
- Si falta un dato sin el cual Previred rechaza el archivo (sexo M/F, AFP, Isapre, tramo con asignación, 0 días sin movimiento), responde 400 con la lista por trabajador, en vez de un archivo inválido.
- No cubre: régimen IPS (ex INP), pensionados, APV/APVC, licencias médicas con fechas (movimientos 3 y 6) ni líneas adicionales (tipo 01/02). Esos casos se informan directo en Previred.

---

## Subscription & Payments

- **Provider**: Reveniu (Chilean payment gateway) with Stripe as underlying processor.
- **Webhook endpoint**: `POST /api/pagos/webhook/reveniu/` — secret in the `Reveniu-Secret-Key` header (legacy `X-Webhook-Token` also accepted), checked against `REVENIU_WEBHOOK_SECRET` with `hmac.compare_digest`.
- **Events** (payload `{"event", "data": {...}}`; the flat legacy format is also accepted): `subscription_activated` / `subscription_payment_succeeded` activate the plan; `subscription_renewal_cancelled` sets `fecha_cancelacion` (access kept until the paid period ends); `subscription_deactivated` sets `CANCELED` and moves `Cliente.plan` to the free base plan (nothing is deleted). Events from a subscription that is no longer the client's current one never change the plan.
- **`EventoPasarela`** stores every notice as received (payment history on `/app/plan`, retries deduplicated by `buy_order`). The client is identified by `subscription_external_id`/`custom_reference` (`<cliente_id>_<plan_id>`) or by a known `gateway_subscription_id`; a notice that can't be matched is stored without a client, an email goes to `ALERTAS_PAGOS_EMAIL`, and it is linked by hand in the admin (choose cliente and plan, save → `aplicar_evento_pasarela`). A plan change (new Reveniu subscription) also emails a request to cancel the old one in Reveniu.
- **Checkout creation**: `POST /api/pagos/crear-checkout/`. First via the **Reveniu API** (`core/reveniu.py`): resolves the Reveniu plan id from the `REVENIU_LINK_*` link (its slug, via `GET /api/v1/plans/`), creates `POST /api/v1/subscriptions/` with `external_id` = `IntentoPago.id`, and returns `{completion_url, security_token}`; the frontend (`api/pagos.ts → irAPagar`) POSTs `TBK_TOKEN` to Transbank. If the API fails it falls back to the payment link (`{url}`). Webhooks resolve the client/plan/cycle from the intento (external_id or subscription id).
- **Reveniu API**: header `Reveniu-Secret-Key` = `REVENIU_API_KEY` or, by default, `REVENIU_WEBHOOK_SECRET` (same key). Base URL `REVENIU_API_URL` (default `https://api.reveniu.com`; sandbox `https://integration.reveniu.com`, account at `https://sandbox.reveniu.com`, test cards in docs). `GET /api/v1/plans/` is paginated (`{"data": {"results": [...], "total_pages": N}}`, verified in the sandbox). Before creating a subscription the plan's `frequency` must match the cycle (`"3"` monthly, `"4"` yearly): otherwise checkout returns 503 and emails the admin (`PlanMalConfigurado`), so a yearly price is never charged monthly. Transbank's inscription page blocks automated browsers (Incapsula), so card enrollment can only be tested by hand. On a plan/cycle change the previous subscription gets `POST /api/v1/subscriptions/{id}/disablerenew/` (stays active until its next charge, no double charge); if the API fails, the cancel-by-hand email is sent.
- **Subscription states**: `TRIAL` → `ACTIVE` → `PAST_DUE` → `CANCELED`.
- Plans: one set, **Semilla (1), Starter (2), Pyme (3), Corporativo (4)**; features are gated only by `Plan.nivel` (`_plan_permite`), never by name. Migration `0052_consolidar_planes` moved clients of the legacy "Plan Semilla/Pyme/Corporativo" (which had `nivel=1`) to their equivalent and deactivated them. Registration assigns the active plan with `nivel=1`; `mi_suscripcion` returns the plan the backend uses (`_plan_activo`) with `nivel` and `max_empresas`, and the panel takes the level from there. Reveniu links: `REVENIU_LINK_<PLAN>_<CICLO>` with the plan name normalized and `CICLO` = `MENSUAL` or `ANUAL` (e.g. `REVENIU_LINK_STARTER_MENSUAL`, `REVENIU_LINK_PYME_ANUAL`). `Plan.precio_anual` (0 = not sold yearly; initial value 10 × monthly, "2 meses gratis") is editable in the admin; landing, registration and `/app/plan` share `SelectorCiclo`. `Suscripcion.ciclo` (MENSUAL/ANUAL) comes from the checkout reference (`<cliente>_<plan>_<ciclo>`) or, failing that, the amount paid; on `/app/plan` the current plan offers "Cambiar a anual/mensual", and the old Reveniu subscription is flagged for cancellation like a plan change.
- Worker quota (`_trabajadores_vigentes` / `_exigir_cupo_trabajador`): active workers **plus those dismissed during the current month** (`Empleado.fecha_desvinculacion`, set when `activo` goes False). A dismissed worker frees the slot the following month; reactivating someone dismissed this month needs no extra slot.
- Previsional parameters (`ParametroPrevisional`, `TasaAFP`) are shared by all clients, maintained by Jornada40 in the Django admin, and read-only in the panel.
- **Downgrade** (`POST /api/pagos/bajar-plan/ {plan_id}`, only to a lower `nivel`): to a paid plan, the same Reveniu subscription gets `POST /api/v1/subscriptions/{id}/amount/` (verified in the sandbox) with the new plan's price for the current cycle, and `Suscripcion.plan_programado` is set; it applies on the next payment notice. Refused (400) if the account exceeds the new plan's workers/companies. To Semilla: `disablerenew` + `fecha_cancelacion` (paid plan kept until the period ends). `POST /api/pagos/cancelar-cambio/` restores the amount. `mi_suscripcion.cambio_programado` feeds the banner on `/app/plan`.
- **Renewal rule**: a payment notice from the client's current Reveniu subscription (same `gateway_subscription_id`) never changes the plan (its checkout reference still names the original plan), except `plan_programado`, which takes effect then. Every payment refreshes `fecha_proximo_cobro` from `GET /api/v1/subscriptions/{id}/` (`next_due`).
- **Resume** (`POST /api/pagos/reanudar/`): `POST /api/v1/subscriptions/extend/ {subs, cicles: 1, auto_renew: true}` and then checks `is_auto_renew` on the subscription; Reveniu only accepts it on live subscriptions (an abandoned one fails, verified in the sandbox). If not confirmed, it emails the team to do it by hand. Never a new checkout (it would charge the paid period again).
- Known gaps: only when the API fails (link fallback) can a first payment arrive unidentified and need manual linking; no proration (the Terms say so); `extend` on an active subscription is untested in the sandbox (Transbank's test card doesn't enroll), which is why its result is verified.

---

## Dirección del Trabajo — Must do

- **Registro de contratos (Ley 21.327, Art. 9 CT):** the employer must register each contract in Mi DT within 15 days of signing, plus its modifications (anexos) and the termination (plazos de los Arts. 162/163 bis; 10 días hábiles en el Art. 159 N°1-3). **Jornada40 does not do it today.** Mi DT has no public API; it accepts one-by-one entry or a bulk CSV (official template, max 1000 rows, 5 MB, processed in up to 7 days). Plan: export the DT CSV for contracts, anexos and terminations, plus reminders of pending/overdue registrations.
- **Libro de Remuneraciones Electrónico (Art. 62 bis):** monthly upload to Mi DT; the official LRE format is not implemented yet (only the readable Excel/PDF book).
- **Autorización del sistema (Dictamen 0789/15):** a platform is recognized when the DT, on request, issues an ORD stating it meets the dictamen (e.g. ORD 902 of 04.07.2023 for "Genera HR Digital"; ORD 2965 rejected TuRecibo.com for not emailing documents automatically). Requirements, cumulative: inspector access by the employer's RUT from any DT computer, without restrictions; the same access for the employer; printing and certifying with electronic signature; inspector ratification with electronic signature; security measures agreed with the employer; worker's express consent (clause in the contract or an annex); automatic delivery to the worker's personal email. Today it meets only the last one (signed PDF emailed to the worker) and printing; the rest is Must do before submitting.

---

## Deployment

### Backend (Railway)

- **Build/start**: Railway uses `backend/Dockerfile` (Python 3.11): `migrate`, `createsuperuser --noinput || true`, then `gunicorn --workers 2 --threads 4 --timeout 60`. Deploys automatically on push to `main`.
- Base plans (Semilla, Starter, Pyme, Corporativo) are created by migration `0048_planes_base` only if missing; prices and limits of existing plans are managed in the Django admin.
- **Production detection**: Presence of `RAILWAY_ENVIRONMENT_NAME` env var flips `IS_PRODUCTION = True`.
- **Static files**: Served via WhiteNoise middleware.
- **IP del visitante**: `api.jornada40.cl` pasa por Cloudflare (nube naranja) y luego por Railway. `REMOTE_ADDR` es interna (100.64.x) y `X-Forwarded-For` trae la IP de Cloudflare; Railway escribe `X-Real-IP` con la IP real y descarta la que mande el cliente. `core.middleware.IpRealMiddleware` la copia a `REMOTE_ADDR` y DRF usa `NUM_PROXIES = 0`: el límite de intentos y la auditoría de firma usan esa IP. `GET /api/diagnostico/red/` (solo con `DIAGNOSTICO_RED=1`) muestra los encabezados si hay que revisarlo.
- **Internal domain**: `https://jornada40-saas-production.up.railway.app` (Railway, no expuesto al público)

### Frontend (Vercel)

- **`vercel.json`**: solo headers de seguridad y el rewrite SPA (todo → `index.html`). **No hay proxy `/api`**: `jornada40.cl/api/...` devuelve la app de React.
- **Domain**: `https://jornada40.cl`
- **Build command**: `npm run build` (runs TypeScript check then Vite bundle).
- **API**: el frontend llama al backend en su propio dominio (`https://api.jornada40.cl`, vía `VITE_API_URL`) con cookies cross-site (`SameSite=None`). Para abrir un endpoint del backend en el navegador, usar ese dominio.
- **Static files**: `collectstatic` corre al construir la imagen (sin variables de Railway), así que el almacenamiento de estáticos va sin manifiesto (`CompressedStaticFilesStorage`); con manifiesto, el admin y la API navegable caían en 500.

---

## Code Conventions

### Python / Django

- Never return an exception's text to the user: inside `except`, use `error_interno('contexto')` (`views/base.py`), which logs the traceback and answers a generic message. Same for configuration names (e.g. a missing `REVENIU_LINK_*` is logged, the client gets a 503).
- Payroll proration: `_dias_fuera_de_contrato` (`calculo_liquidacion.py`) adds the days before the start (earliest of contract start and `fecha_ingreso`) and, for a dismissed worker, after the finiquito/plazo-fijo end, so a default 30-day emission (bulk) doesn't pay a full month to someone who joined mid-month. A period before the start is rejected (400).

- All Django code is in the single `core` app — keep it that way unless the codebase grows significantly.
- Use snake_case for Python identifiers and model field names.
- Use Django's ORM; avoid raw SQL.
- When adding new model fields, always create and apply a migration.
- Custom DRF actions use `@action(detail=True/False, methods=[...])` decorators.
- ViewSets filter querysets to the authenticated user's data; never return data belonging to other users.
- When generating PDFs or Excel files, return `HttpResponse`/`FileResponse` directly from the view — do not store permanently unless necessary.

### TypeScript / React

- Strict TypeScript is enforced (`"strict": true`). Do not use `any`; define proper types in `src/types/index.ts`.
- All components are functional (no class components).
- Page components live in `src/pages/`; shared sub-components should be co-located or placed in a `src/components/` directory if reused across pages.
- Use Tailwind CSS utility classes for all styling; avoid inline styles.
- Use `clsx` for conditional class name composition.
- Use Lucide React for icons; do not add other icon libraries.
- Always pass `withCredentials: true` when making requests that require authentication.

### General

- All user-visible text is in **Spanish** (Chilean Spanish). Do not introduce English strings into the UI.
- RUT fields must be validated using the existing utilities before saving to the DB.
- Dates and times use `America/Santiago` timezone. On the frontend use the helpers in `src/utils/formato.ts` (`fechaLocal`, `fechaCL`, …) and `toLocaleString('es-CL', { timeZone: 'America/Santiago' })`; on the backend, Django's timezone-aware datetimes.
- Keep the `activo` soft-delete pattern — set `activo = False` instead of deleting records.

---

## Testing

- **Backend:** `backend/core/tests/` (Django `APITestCase`, ~260 tests), one file per topic: `test_seguridad`, `test_cuentas`, `test_pagos`, `test_parametros`, `test_liquidaciones`, `test_previred`, `test_trabajadores`, `test_jornada`, `test_feriado`, `test_finiquito`, `test_firmas`, `test_revision_panel`. Shared helpers (`crear_usuario_completo`, `crear_empleado`, `indicadores_fijos`, `_mock_config`) live in `tests/utiles.py`. Run with `cd backend && python manage.py test core`.
- **Patching:** patch a name in the view module that uses it (e.g. `core.views.suscripciones.config`, `core.views.firma_publica._enviar_email_otp`), not in `core.views`; for UF/UTM use `@indicadores_fijos`. Shared modules like `core.b2_client` are patched at their source.
- **Frontend:** no unit test runner yet; `npm run build` (type-check) and `npm run lint` must pass.
- **End-to-end:** Playwright specs in `frontend/e2e/` (panel, remuneraciones, firma, gestión). Run with `cd frontend && npm run e2e`; it starts Django with `config.settings_e2e` (own SQLite, B2 and indicadores stubbed by the `backend/e2e` app) and Vite. `manage.py preparar_e2e` seeds the base (user `12.345.678-5` / `Clave-Segura-2026`, two companies, four workers); each spec restores it with `--reset`. Dates are relative to today.

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) runs on every push and pull request: backend (`makemigrations --check`, `manage.py test core`), frontend (`lint`, `build`) and, if both pass, the Playwright e2e suite. Deploys are separate: Railway auto-deploys `main` (backend), Vercel deploys the frontend.

---

## Common Pitfalls

1. **CORS errors in development**: The frontend dev server (`localhost:5173`) must be listed in `CORS_ALLOWED_ORIGINS`. Do not change the port without updating `settings.py`.
2. **JWT cookies not sent**: Always include `withCredentials: true` in Axios requests. The Axios client in `src/api/client.ts` does this by default — use that client.
3. **URLs de API**: Todas las llamadas deben usar el `client` de `src/api/client.ts` con rutas relativas (ej. `/auth/user/`). En producción el proxy de Vercel las dirige al backend Railway. Nunca hardcodear URLs absolutas en el frontend.
4. **RUT validation**: The Chilean RUT has a check digit algorithm. Always use `rutUtils.ts` / backend validators — never skip validation.
5. **Plan limits**: Enforce plan limits (max companies, max workers) in backend views before creating new `Empresa` or `Empleado` records.
6. **Migrations**: After every model change, run `python manage.py makemigrations && python manage.py migrate`. Never edit migration files manually.
7. **Soft deletes**: Do not use `.delete()` on `Empleado`, `Empresa`, or `Contrato` records. Set `activo = False` instead.
8. **Timezone-naive datetimes**: Always use `django.utils.timezone.now()` instead of `datetime.now()` to avoid timezone bugs.
