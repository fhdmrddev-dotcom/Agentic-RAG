#!/usr/bin/env bash
# ============================================================================
# check-security-advisors.sh — Supabase Security Advisor check via Management API
# ============================================================================
# Why this exists (Phase 248 / CRED-04):
#   Ensures that no error-level security findings exist on the Supabase project
#   prior to and following deployment. The Supabase Management API provides
#   project security advisor lints via GET /v1/projects/{ref}/advisors/security.
#
# Exit codes:
#   0 - Clean or only WARN-level findings present
#   1 - One or more ERROR-level security findings present, or missing config
#
# Requirements:
#   - SUPABASE_ACCESS_TOKEN: Management API token (sbp_...)
#   - SUPABASE_PROJECT_REF or SUPABASE_URL: Project reference ID
#
# Usage:
#   bash scripts/check-security-advisors.sh [project-ref]
#   bash scripts/check-security-advisors.sh --file <path-to-json>   # Test/mock mode
# ============================================================================

set -euo pipefail

PROJECT_REF="${1:-${SUPABASE_PROJECT_REF:-}}"
MOCK_FILE="${MOCK_SECURITY_ADVISORS_FILE:-}"

if [[ "$#" -ge 2 && "$1" == "--file" ]]; then
  MOCK_FILE="$2"
fi

if [[ -n "$MOCK_FILE" ]]; then
  if [[ ! -f "$MOCK_FILE" ]]; then
    echo "ERROR: Mock file not found: $MOCK_FILE" >&2
    exit 1
  fi
  RESPONSE=$(cat "$MOCK_FILE")
else
  # Derive project ref from SUPABASE_URL if not directly set
  if [[ -z "$PROJECT_REF" && -n "${SUPABASE_URL:-}" ]]; then
    if [[ "$SUPABASE_URL" =~ https://([a-zA-Z0-9_-]+)\.supabase\.co ]]; then
      PROJECT_REF="${BASH_REMATCH[1]}"
    fi
  fi

  if [[ -z "$PROJECT_REF" ]]; then
    echo "ERROR: Project reference not specified. Set SUPABASE_PROJECT_REF or pass as argument." >&2
    echo "Usage: bash scripts/check-security-advisors.sh <project-ref>" >&2
    exit 1
  fi

  TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
  if [[ -z "$TOKEN" ]]; then
    echo "ERROR: SUPABASE_ACCESS_TOKEN environment variable is required to query the Supabase Management API." >&2
    echo "Generate a Personal Access Token in the Supabase Dashboard (Account -> Access Tokens)." >&2
    exit 1
  fi

  API_URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/advisors/security"
  echo "Checking Supabase security advisors for project ${PROJECT_REF}..."

  HTTP_RESPONSE=$(curl -sS -w "\n%{http_code}" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" "${API_URL}")
  HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n1)
  RESPONSE=$(echo "$HTTP_RESPONSE" | sed '$d')

  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "ERROR: Management API returned HTTP ${HTTP_CODE}:" >&2
    echo "$RESPONSE" >&2
    exit 1
  fi
fi

# Parse findings using node or python (available on system)
RESULTS=$(python -c '
import json, sys

raw = sys.stdin.read().strip()
if not raw:
    print(json.dumps({"errors": [], "warnings": [], "info": []}))
    sys.exit(0)

try:
    data = json.loads(raw)
except Exception as e:
    print(f"ERROR: Failed to parse JSON response: {e}", file=sys.stderr)
    sys.exit(2)

# Normalise data structure: can be a list or {"lints": [...]} or {"findings": [...]}
if isinstance(data, dict):
    findings = data.get("lints") or data.get("findings") or []
elif isinstance(data, list):
    findings = data
else:
    findings = []

errors = []
warnings = []
info = []

for f in findings:
    level = str(f.get("level", "")).upper()
    item = {
        "name": f.get("name", "unknown"),
        "title": f.get("title", f.get("name", "")),
        "detail": f.get("detail", f.get("description", "")),
        "remediation": f.get("remediation", ""),
    }
    if level == "ERROR":
        errors.append(item)
    elif level == "WARN":
        warnings.append(item)
    else:
        info.append(item)

print(json.dumps({"errors": errors, "warnings": warnings, "info": info}))
' <<< "$RESPONSE")

# Evaluate results
ERROR_COUNT=$(echo "$RESULTS" | python -c 'import json, sys; print(len(json.load(sys.stdin)["errors"]))')
WARN_COUNT=$(echo "$RESULTS" | python -c 'import json, sys; print(len(json.load(sys.stdin)["warnings"]))')

if [[ "$ERROR_COUNT" -gt 0 ]]; then
  echo ""
  echo "=============================================================================="
  echo "  SECURITY ADVISOR FAILURES: $ERROR_COUNT ERROR-level finding(s) detected!"
  echo "=============================================================================="
  python -c '
import json, sys
data = json.loads(sys.stdin.read())
for e in data["errors"]:
    name = e.get("name", "")
    title = e.get("title", "")
    detail = e.get("detail", "")
    remedy = e.get("remediation", "")
    print(f"  [ERROR] {name}: {title}")
    if detail:
        print(f"          Detail: {detail}")
    if remedy:
        print(f"          Remedy: {remedy}")
' <<< "$RESULTS"
  echo ""
  echo "RESULT: FAIL — Resolve all error-level security advisor findings before deployment." >&2
  exit 1
fi

if [[ "$WARN_COUNT" -gt 0 ]]; then
  echo ""
  echo "  Security advisor: $WARN_COUNT warning-level finding(s) (non-blocking):"
  python -c '
import json, sys
data = json.loads(sys.stdin.read())
for w in data["warnings"]:
    name = w.get("name", "")
    title = w.get("title", "")
    print(f"  [WARN]  {name}: {title}")
' <<< "$RESULTS"
  echo ""
fi

echo "RESULT: PASS — 0 error-level security advisor findings."
exit 0
