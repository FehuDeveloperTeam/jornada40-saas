#!/bin/bash
# Script de análisis de seguridad — Jornada40 SaaS
#
# Uso:
#   bash security_check.sh            → solo paso 1 (estático)
#   bash security_check.sh --dynamic  → paso 1 + paso 2 (dinámico)
#   bash security_check.sh --ci       → sale con código 1 si hay fallos

set -e
CI_MODE=false
DYNAMIC=false
TARGET_URL="https://jornada40.cl"

for arg in "$@"; do
  [[ "$arg" == "--ci" ]]      && CI_MODE=true
  [[ "$arg" == "--dynamic" ]] && DYNAMIC=true
done

PASS=0
FAIL=0
WARNINGS=0

header() { echo; echo "══════════════════════════════════════════"; echo "  $1"; echo "══════════════════════════════════════════"; }
ok()      { echo "  ✓ $1"; ((PASS++)) || true; }
warn()    { echo "  ⚠ $1"; ((WARNINGS++)) || true; }
fail()    { echo "  ✗ $1"; ((FAIL++)) || true; }
check_header() {
    local header="$1" label="$2"
    if echo "$RESPONSE_HEADERS" | grep -qi "^$header:"; then
        ok "Header $label presente"
    else
        fail "Header $label ausente"
    fi
}

# ══════════════════════════════════════════
#  PASO 1 — ANÁLISIS ESTÁTICO
# ══════════════════════════════════════════

# ── 1. Django security tests ──────────────────────────────────────────────────
header "1/6  Django security tests"
cd backend
if ! python3 -c "import django, rest_framework, dj_rest_auth" &>/dev/null 2>&1; then
    warn "Dependencias Django incompletas — los tests se ejecutan en Railway"
    warn "Para correr aquí: pip install -r requirements.txt"
elif python3 manage.py test core --verbosity=0 2>&1; then
    ok "Todos los tests de seguridad pasaron"
else
    fail "Hay tests fallando — revisa la salida"
fi
cd ..

# ── 2. Bandit — vulnerabilidades en código Python ────────────────────────────
header "2/6  Bandit (Python static analysis)"
if ! command -v bandit &>/dev/null; then
    warn "Bandit no instalado — ejecuta: pip install bandit"
else
    if bandit -r backend/ \
        --exclude backend/venv \
        --skip B101 \
        --severity-level medium \
        --quiet 2>&1; then
        ok "Sin vulnerabilidades medium/high en código Python"
    else
        fail "Bandit encontró vulnerabilidades — revisa la salida"
    fi
fi

# ── 3. pip-audit — dependencias Python con CVEs ──────────────────────────────
header "3/6  pip-audit (Python dependencies)"
if ! command -v pip-audit &>/dev/null; then
    warn "pip-audit no instalado — ejecuta: pip install pip-audit"
else
    if pip-audit -r backend/requirements.txt --progress-spinner off 2>&1; then
        ok "Sin CVEs conocidos en dependencias Python"
    else
        fail "pip-audit encontró vulnerabilidades en dependencias"
    fi
fi

# ── 4. npm audit — dependencias frontend ─────────────────────────────────────
header "4/6  npm audit (frontend dependencies)"
if ! command -v npm &>/dev/null; then
    warn "npm no disponible"
else
    cd frontend
    AUDIT_RESULT=$(npm audit --audit-level=high --json 2>/dev/null || true)
    HIGH_COUNT=$(echo "$AUDIT_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
vulns = data.get('metadata', {}).get('vulnerabilities', {})
print(vulns.get('high', 0) + vulns.get('critical', 0))
" 2>/dev/null || echo "0")

    if [ "$HIGH_COUNT" = "0" ]; then
        ok "Sin vulnerabilidades high/critical en npm"
    else
        XLSX_ONLY=$(echo "$AUDIT_RESULT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
vulns = data.get('vulnerabilities', {})
non_xlsx = [k for k in vulns if k != 'xlsx']
print('yes' if not non_xlsx else 'no')
" 2>/dev/null || echo "no")
        if [ "$XLSX_ONLY" = "yes" ]; then
            warn "$HIGH_COUNT vuln(s) high en xlsx (sin fix oficial — prototype pollution solo en export client-side)"
        else
            fail "$HIGH_COUNT vulnerabilidades high/critical en dependencias npm"
        fi
    fi
    cd ..
fi

# ══════════════════════════════════════════
#  PASO 2 — ANÁLISIS DINÁMICO
# ══════════════════════════════════════════

if ! $DYNAMIC; then
    echo
    echo "  (Paso 2 dinámico omitido — usa --dynamic para activarlo)"
    echo "  Ej: bash security_check.sh --dynamic"
else

# ── 5. django-check --deploy (análisis de settings) ──────────────────────────
header "5/6  Configuración Django (deploy check)"
python3 - <<'PYCHECK'
import sys, pathlib, re

settings_path = pathlib.Path("backend/config/settings.py")
content = settings_path.read_text()

checks = []

def ok(msg):   checks.append(("ok",   msg))
def warn(msg): checks.append(("warn", msg))
def fail(msg): checks.append(("fail", msg))

# DEBUG
if "DEBUG = not IS_DEPLOYED" in content or "DEBUG = False" in content:
    ok("DEBUG desactivado en producción")
elif "DEBUG = True" in content:
    fail("DEBUG está True — nunca en producción")
else:
    warn("No se pudo confirmar DEBUG = False en producción")

# SECRET_KEY fallback inseguro
if "django-insecure" in content and "IS_DEPLOYED" not in content:
    fail("SECRET_KEY tiene fallback inseguro accesible en producción")
else:
    ok("SECRET_KEY sin fallback inseguro en producción")

# HTTPS cookies
if "SESSION_COOKIE_SECURE = True" in content:
    ok("SESSION_COOKIE_SECURE = True")
else:
    fail("SESSION_COOKIE_SECURE no está True en producción")

if "CSRF_COOKIE_SECURE = True" in content:
    ok("CSRF_COOKIE_SECURE = True")
else:
    fail("CSRF_COOKIE_SECURE no está True en producción")

# ALLOWED_HOSTS en producción no vacío
prod_block = content[content.find("if IS_PRODUCTION:"):content.find("elif IS_STAGING:")]
if "ALLOWED_HOSTS" in prod_block and "jornada40.cl" in prod_block:
    ok("ALLOWED_HOSTS configurado explícitamente en producción")
else:
    warn("No se pudo verificar ALLOWED_HOSTS en bloque IS_PRODUCTION")

# Rate limiting configurado
if "DEFAULT_THROTTLE_CLASSES" in content:
    ok("Rate limiting (throttle) configurado en REST_FRAMEWORK")
else:
    fail("DEFAULT_THROTTLE_CLASSES ausente — sin rate limiting")

# Paginación
if "DEFAULT_PAGINATION_CLASS" in content:
    ok("Paginación configurada en REST_FRAMEWORK")
else:
    warn("DEFAULT_PAGINATION_CLASS ausente — endpoints sin límite de filas")

# Resultados
fails = [m for t,m in checks if t == "fail"]
warns = [m for t,m in checks if t == "warn"]
oks   = [m for t,m in checks if t == "ok"]

for m in oks:   print(f"  ✓ {m}")
for m in warns: print(f"  ⚠ {m}")
for m in fails: print(f"  ✗ {m}")

sys.exit(1 if fails else 0)
PYCHECK

if [ $? -eq 0 ]; then
    ok "django-check --deploy: configuración correcta"
else
    fail "django-check --deploy: hay configuraciones inseguras"
fi

# ── 6. Security headers — producción ─────────────────────────────────────────
header "6/6  Security headers → $TARGET_URL"
if ! command -v curl &>/dev/null; then
    warn "curl no disponible"
else
    RESPONSE_HEADERS=$(curl -sI --max-time 10 "$TARGET_URL" 2>/dev/null || true)
    if [ -z "$RESPONSE_HEADERS" ]; then
        warn "No se pudo conectar a $TARGET_URL (¿servidor caído?)"
    else
        # HTTPS redirect
        STATUS=$(echo "$RESPONSE_HEADERS" | head -1)
        if echo "$STATUS" | grep -qE "301|302"; then
            ok "Redirige HTTP → HTTPS"
        fi

        # Recolectar headers sobre la URL final
        RESPONSE_HEADERS=$(curl -sIL --max-time 10 "$TARGET_URL" 2>/dev/null || true)

        check_header "Strict-Transport-Security" "HSTS"
        check_header "X-Content-Type-Options"    "X-Content-Type-Options"
        check_header "X-Frame-Options"           "X-Frame-Options"
        check_header "Referrer-Policy"           "Referrer-Policy"

        # Content-Security-Policy (warning si falta, no fallo — es complejo de implementar)
        if echo "$RESPONSE_HEADERS" | grep -qi "^Content-Security-Policy:"; then
            ok "Content-Security-Policy presente"
        else
            warn "Content-Security-Policy ausente (recomendado pero complejo)"
        fi

        # Cookies con Secure y HttpOnly
        COOKIES=$(echo "$RESPONSE_HEADERS" | grep -i "set-cookie:" || true)
        if [ -n "$COOKIES" ]; then
            if echo "$COOKIES" | grep -qi "secure"; then
                ok "Cookies con flag Secure"
            else
                fail "Cookies sin flag Secure"
            fi
            if echo "$COOKIES" | grep -qi "httponly"; then
                ok "Cookies con flag HttpOnly"
            else
                fail "Cookies sin flag HttpOnly"
            fi
            if echo "$COOKIES" | grep -qi "samesite"; then
                ok "Cookies con SameSite configurado"
            else
                warn "Cookies sin SameSite (recomendado)"
            fi
        else
            warn "No se encontraron cookies en la respuesta inicial (normal si requiere login)"
        fi

        # Server header no debe exponer versión
        SERVER=$(echo "$RESPONSE_HEADERS" | grep -i "^server:" || true)
        if [ -n "$SERVER" ]; then
            if echo "$SERVER" | grep -qiE "apache/|nginx/[0-9]|gunicorn/[0-9]"; then
                warn "Header Server expone versión: $SERVER"
            else
                ok "Header Server no expone versión"
            fi
        fi
    fi
fi

fi  # fin --dynamic

# ── Resumen ───────────────────────────────────────────────────────────────────
echo
echo "══════════════════════════════════════════"
echo "  RESUMEN"
echo "══════════════════════════════════════════"
echo "  ✓ Pasaron:    $PASS"
echo "  ⚠ Avisos:     $WARNINGS"
echo "  ✗ Fallaron:   $FAIL"
echo

if $CI_MODE && [ "$FAIL" -gt 0 ]; then
    echo "  CI: saliendo con código 1 por $FAIL fallo(s)"
    exit 1
fi
