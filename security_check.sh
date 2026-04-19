#!/bin/bash
# Script de análisis de seguridad estático — Jornada40 SaaS
# Requiere: pip install bandit pip-audit  (ver backend/requirements-dev.txt)
#
# Uso: bash security_check.sh
#      bash security_check.sh --ci   (sale con código 1 si hay hallazgos)

set -e
CI_MODE=false
[[ "${1}" == "--ci" ]] && CI_MODE=true

PASS=0
FAIL=0
WARNINGS=0

header() { echo; echo "══════════════════════════════════════════"; echo "  $1"; echo "══════════════════════════════════════════"; }
ok()      { echo "  ✓ $1"; ((PASS++)) || true; }
warn()    { echo "  ⚠ $1"; ((WARNINGS++)) || true; }
fail()    { echo "  ✗ $1"; ((FAIL++)) || true; }

# ── 1. Django tests de seguridad ─────────────────────────────────────────────
header "1/4  Django security tests"
cd backend
if ! python3 -c "import django" &>/dev/null; then
    warn "Django no disponible en este entorno — tests se ejecutan en Railway. Instala requirements.txt para correr localmente."
elif python3 manage.py test core --verbosity=0 2>&1; then
    ok "Todos los tests pasaron"
else
    fail "Hay tests fallando — revisa la salida"
fi
cd ..

# ── 2. Bandit — vulnerabilidades en código Python ────────────────────────────
header "2/4  Bandit (Python static analysis)"
if ! command -v bandit &>/dev/null; then
    warn "Bandit no instalado. Ejecuta: pip install bandit"
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
header "3/4  pip-audit (Python dependencies)"
if ! command -v pip-audit &>/dev/null; then
    warn "pip-audit no instalado. Ejecuta: pip install pip-audit"
else
    if pip-audit -r backend/requirements.txt --progress-spinner off 2>&1; then
        ok "Sin CVEs conocidos en dependencias Python"
    else
        fail "pip-audit encontró vulnerabilidades en dependencias"
    fi
fi

# ── 4. npm audit — dependencias frontend ─────────────────────────────────────
header "4/4  npm audit (frontend dependencies)"
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
        fail "$HIGH_COUNT vulnerabilidades high/critical en dependencias npm"
    fi
    cd ..
fi

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
