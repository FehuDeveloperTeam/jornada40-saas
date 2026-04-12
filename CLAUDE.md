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
│   │   ├── views.py       # All ViewSets and custom API views
│   │   ├── serializers.py # All DRF serializers
│   │   ├── urls.py        # API URL router
│   │   ├── admin.py       # Django admin registration
│   │   ├── migrations/    # Database migrations
│   │   └── templates/     # Email templates
│   ├── templates/         # General Django templates
│   ├── manage.py
│   ├── requirements.txt
│   ├── runtime.txt        # Python 3.14.2
│   ├── Dockerfile
│   ├── Procfile           # Railway process definition
│   └── nixpacks.toml      # Nixpacks deploy config
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
| Charts | Recharts | 3.x |
| Excel | xlsx / pandas / openpyxl | — |
| Backend framework | Django | 5.2.11 |
| REST API | Django REST Framework | 3.16.1 |
| Auth | dj-rest-auth + simplejwt | — |
| Database ORM | Django ORM (native) | — |
| Email | Anymail (Resend backend) | — |
| PDF generation | xhtml2pdf + reportlab | — |
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
gunicorn config.wsgi:application      # Production server (Railway uses Procfile)
```

---

## Authentication Architecture

- **Method**: JWT stored in **HTTP-only cookies** (not localStorage).
- **Cookie names**: `jornada40-auth` (access token) and `jornada40-refresh-token`.
- **Access token lifetime**: 30 minutes. **Refresh token lifetime**: 2 hours.
- **Refresh rotation**: Enabled (`ROTATE_REFRESH_TOKENS = True`).
- **Frontend auth check**: `ProtectedRoute` in `App.tsx` calls `GET /api/auth/user/` with `withCredentials: true`. A 200 response means authenticated; 401 redirects to `/login`.
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
| POST | `/api/auth/password/reset/` | Request password reset email |
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

Custom endpoints:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pagos/crear-checkout/` | Create Reveniu checkout session |
| POST | `/api/pagos/webhook/reveniu/` | Receive Reveniu payment webhooks |
| GET | `/api/clientes/mi_suscripcion/` | Logged-in user's subscription status |
| GET/PATCH | `/api/clientes/perfil/` | Logged-in user's profile |

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

All routes correspond to files in `src/pages/`. Routes are defined in `src/App.tsx`.

| Route | Component | Protection |
|-------|-----------|-----------|
| `/` | `Landing.tsx` | Public |
| `/login` | `Login.tsx` | Public |
| `/register` | `Register.tsx` | Public |
| `/forgot-password` | `ForgotPassword.tsx` | Public |
| `/reset-password/:uid/:token` | `ResetPassword.tsx` | Public |
| `/terminos` | `Terminos.tsx` | Public |
| `/empresas` | `LobbyEmpresas.tsx` | Protected |
| `/dashboard` | `Dashboard.tsx` | Protected |
| `/suscripcion` | `Suscripcion.tsx` | Protected |

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

PDFs are generated server-side in `core/views.py` using `xhtml2pdf`. The pattern is:

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

## Subscription & Payments

- **Provider**: Reveniu (Chilean payment gateway) with Stripe as underlying processor.
- **Webhook endpoint**: `POST /api/pagos/webhook/reveniu/` — validated with `svix` library.
- **Checkout creation**: `POST /api/pagos/crear-checkout/` redirects user to Reveniu hosted page.
- **Subscription states**: `TRIAL` → `ACTIVE` → `PAST_DUE` → `CANCELED`.
- Plan limits (max companies, max workers) are enforced in ViewSet `create()` methods by checking `cliente.plan`.

---

## Deployment

### Backend (Railway)

- **Procfile**: `web: python manage.py migrate && python manage.py shell -c "..." && gunicorn config.wsgi:application`
- **Docker**: `Dockerfile` present for Railway builds.
- **Production detection**: Presence of `RAILWAY_ENVIRONMENT_NAME` env var flips `IS_PRODUCTION = True`.
- **Static files**: Served via WhiteNoise middleware.
- **Internal domain**: `https://jornada40-saas-production.up.railway.app` (Railway, no expuesto al público)

### Frontend (Vercel)

- **`vercel.json`**: Configura SPA rewrites y proxy `/api/*` → Railway backend.
- **Domain**: `https://jornada40.cl`
- **Build command**: `npm run build` (runs TypeScript check then Vite bundle).
- **Proxy**: Vercel reescribe `jornada40.cl/api/*` al backend Railway; el frontend solo usa URLs relativas (`/api/...`).

---

## Code Conventions

### Python / Django

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
- Dates and times use `America/Santiago` timezone. Use `date-fns` on the frontend and Django's timezone-aware datetimes on the backend.
- Keep the `activo` soft-delete pattern — set `activo = False` instead of deleting records.

---

## Testing

There is currently **no test suite** configured for either the frontend or the backend.

- `backend/core/tests.py` exists but is empty.
- No Jest/Vitest configuration in the frontend.
- When adding tests, use Django's built-in `TestCase` / `APITestCase` for the backend, and Vitest for the frontend.

Run tests (once configured):

```bash
# Backend
cd backend && python manage.py test

# Frontend
cd frontend && npm test
```

---

## CI/CD

No GitHub Actions or other CI pipelines are configured. Deployments are triggered manually via platform dashboards (Railway for backend, Vercel for frontend).

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
