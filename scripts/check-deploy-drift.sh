#!/usr/bin/env bash
# ============================================================================
# check-deploy-drift.sh — keep the Phase-157 deployment artifacts honest.
# ============================================================================
# Why this exists (Phase 158 / DEPLOY-02, decision D-16):
#   The one-box deploy artifacts — deploy/onebox.env.example,
#   docker-compose.prod.yml, and the docs/OPERATOR.md Step-3 runbook — are a
#   STATIC SNAPSHOT. They drift silently as later phases add env vars the app
#   reads, seed-bearing migrations, bundled services, or bump the sandbox image
#   tag. A drifted preset means a fresh operator's `docker compose up` boots a
#   box that is subtly mis-configured (a missing var, an un-applied seed, a
#   stale sandbox tag). This script makes that drift VISIBLE and FAILS CI so it
#   is fixed in the same commit that introduced it — the CLAUDE.md
#   "Deployment-artifact parity (same-commit rule)" is the process control; this
#   script is its enforcement.
#
#   Structural sibling: scripts/pending-cloud-migrations.sh (same strict-bash
#   mode + why/usage/notes header + non-zero-exit-on-drift style).
#
# Usage:
#   bash scripts/check-deploy-drift.sh          # run all four checks; exit 1 on drift
#   Wired into CI as the `deploy-drift` job in .github/workflows/deploy-artifacts.yml.
#
# The four checks (RESEARCH Pattern 9):
#   1. PRESET KEYS   — every key the backend reads (backend/.env.example) is
#                      present in deploy/onebox.env.example, MINUS the curated
#                      OMITTED_FROM_ONEBOX allowlist. A NAIVE diff yields ~42
#                      false positives (extra providers, S3, LangSmith,
#                      Supabase-CLI convenience vars, the direct-Postgres split
#                      vars) — hence the allowlist. Only a NEW, unclassified key
#                      trips this. HARD FAIL.
#   2. SEED LIST     — every migration filename in the OPERATOR.md Step-3 seed
#                      table exists under supabase/migrations/. HARD FAIL on a
#                      renamed/removed seed. Plus a SOFT WARN when a migration
#                      numbered above the highest listed seed carries a
#                      non-boilerplate INSERT/UPDATE (a candidate new seed the
#                      runbook may need — auto-detection is imperfect, so it is
#                      a human-review WARN, never a fail).
#   3. SANDBOX TAG   — the SANDBOX_IMAGE tag in the preset == every
#                      `agentic-rag-sandbox:<tag>` reference across CLAUDE.md,
#                      OPERATOR.md, backend/.env.example, and the preset itself
#                      (this is the Dockerfile.sandbox `-t` build intent). One
#                      distinct tag, matching the preset. HARD FAIL on a split.
#   4. COMPOSE PARSE — `docker compose -f docker-compose.prod.yml config` parses
#                      AND reflects the new setup_data volume (D-02). When docker
#                      is unavailable/denied (local dev, a runner without docker)
#                      it falls back to a dependency-free structural check + a
#                      loud WARN — CI's ubuntu-latest runs the authoritative
#                      parse.
#
# Notes:
#   - No git history is needed — every check is a static tree invariant.
#   - When you INTENTIONALLY omit a var from the one-box preset, register it in
#     OMITTED_FROM_ONEBOX below (with a one-word reason) — never leave it to
#     drift silently.
# ============================================================================

set -euo pipefail

# Run from the repo root regardless of caller cwd (so relative paths resolve).
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_ENV="backend/.env.example"
ONEBOX_ENV="deploy/onebox.env.example"
OPERATOR_DOC="docs/OPERATOR.md"
COMPOSE_FILE="docker-compose.prod.yml"
MIGRATIONS_DIR="supabase/migrations"

# ── curated allowlist — keys the app reads that the LEAN one-box preset
#    intentionally omits. Derived once via:
#      comm -23 <(grep -oE '^[A-Z_]+=' backend/.env.example|sed 's/=$//'|sort -u) \
#               <(grep -oE '^[A-Z_]+=' deploy/onebox.env.example|sed 's/=$//'|sort -u)
#    Adding a var the one-box SHOULD ship? Add it to onebox, NOT here. ────────────
OMITTED_FROM_ONEBOX=(
  # extra LLM providers — one-box ships OpenAI only; the rest are optional/commented
  ANTHROPIC_API_KEY ANTHROPIC_MODELS
  GOOGLE_API_KEY GOOGLE_MODELS
  OPENROUTER_API_KEY OPENROUTER_MODELS
  DEEPSEEK_API_KEY DEEPSEEK_MODELS
  MOONSHOT_API_KEY MOONSHOT_MODELS
  MINIMAX_API_KEY MINIMAX_MODELS
  ZHIPU_API_KEY ZHIPU_MODELS
  OLLAMA_BASE_URL OLLAMA_MODELS OLLAMA_API_KEY
  LMSTUDIO_BASE_URL LMSTUDIO_MODELS LMSTUDIO_API_KEY
  # SEED-173 / mig 180 — the generic OpenAI-compatible slot. Same class as the two
  # above: a self-hosted endpoint is the OPERATOR'S, configured in the Settings UI,
  # not a one-box preset knob.
  CUSTOM_BASE_URL CUSTOM_MODELS CUSTOM_API_KEY
  # reranking — one-box ships RERANK_ENABLED=false (torch/sentence-transformers dropped)
  RERANK_API_KEY RERANK_MODEL RERANK_PROVIDER RERANK_TOP_N
  # S3 / storage — Supabase manages storage; not a one-box knob
  S3_ACCESS_KEY S3_REGION S3_SECRET_KEY SUPABASE_STORAGE_URL
  # LangSmith observability — opt-in, commented in the preset
  LANGSMITH_API_KEY LANGSMITH_PROJECT LANGSMITH_TRACING
  # Supabase-CLI local convenience URLs — local-dev only
  SUPABASE_PROJECT_URL SUPABASE_REST_URL SUPABASE_GRAPHQL_URL
  SUPABASE_FUNCTIONS_URL SUPABASE_STUDIO_URL SUPABASE_MAILPIT_URL SUPABASE_MCP_URL
  # direct-Postgres split vars — one-box uses the single POSTGRES_DSN instead
  DATABASE_URL POSTGRES_DB POSTGRES_HOST POSTGRES_PASSWORD POSTGRES_PORT POSTGRES_USER
  # embeddings base URL — optional; falls back to the LLM provider endpoint
  EMBEDDING_BASE_URL
  # invitation email (Phase 167) — optional; only when EMAIL_PROVIDER=resend. The default
  # EMAIL_PROVIDER=none logs the invite link and needs neither. (EMAIL_PROVIDER itself IS in
  # onebox.env.example, so it is not omitted here.)
  RESEND_API_KEY INVITE_FROM_EMAIL
)

FAILURES=()
WARNINGS=()
add_fail() { FAILURES+=("$1"); printf '  \033[31mDRIFT\033[0m  %s\n' "$1"; }
add_warn() { WARNINGS+=("$1"); printf '  \033[33mWARN \033[0m  %s\n' "$1"; }
add_ok()   { printf '  \033[32mok\033[0m     %s\n' "$1"; }

# ── active (uncommented) KEY names in a dotenv-style file ─────────────────────
env_keys() { grep -oE '^[A-Z_][A-Z0-9_]*=' "$1" 2>/dev/null | sed 's/=$//' | sort -u; }

# ── Check 1: preset keys ──────────────────────────────────────────────────────
check_preset_keys() {
  echo "[1/4] preset keys — backend/.env.example vs $ONEBOX_ENV (minus allowlist)"
  if [ ! -f "$BACKEND_ENV" ] || [ ! -f "$ONEBOX_ENV" ]; then
    add_fail "missing input file(s): $BACKEND_ENV and/or $ONEBOX_ENV"
    return
  fi
  # keys the backend reads that the preset does not actively set:
  local missing
  missing="$(comm -23 <(env_keys "$BACKEND_ENV") <(env_keys "$ONEBOX_ENV") || true)"
  # index the allowlist for O(1) lookup
  local -A omit=()
  local o
  for o in "${OMITTED_FROM_ONEBOX[@]}"; do omit["$o"]=1; done
  local unclassified=() k
  while IFS= read -r k; do
    [ -z "$k" ] && continue
    [ -n "${omit[$k]:-}" ] || unclassified+=("$k")
  done <<< "$missing"
  if [ "${#unclassified[@]}" -gt 0 ]; then
    add_fail "keys read by the app but MISSING from $ONEBOX_ENV and not in OMITTED_FROM_ONEBOX: ${unclassified[*]}"
    add_fail "  -> add each to $ONEBOX_ENV (if the one-box needs it) OR register it in OMITTED_FROM_ONEBOX with a reason."
  else
    add_ok "no unclassified preset-key drift (allowlist covers ${#OMITTED_FROM_ONEBOX[@]} intentionally-omitted keys)"
  fi
}

# ── Check 2: seed-migration list ──────────────────────────────────────────────
check_seed_list() {
  echo "[2/4] seed list — $OPERATOR_DOC Step-3 table vs $MIGRATIONS_DIR/"
  if [ ! -f "$OPERATOR_DOC" ]; then add_fail "missing $OPERATOR_DOC"; return; fi
  local seeds
  seeds="$(grep -oE '[0-9]{3}_[a-z0-9_]+\.sql' "$OPERATOR_DOC" | sort -u || true)"
  if [ -z "$seeds" ]; then
    add_warn "no seed-migration filenames found in $OPERATOR_DOC (Step-3 table changed shape?)"
    return
  fi
  local missing=() f highest=0 n
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$MIGRATIONS_DIR/$f" ] || missing+=("$f")
    n="${f%%_*}"
    if [[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -gt "$highest" ]; then highest="$n"; fi
  done <<< "$seeds"
  if [ "${#missing[@]}" -gt 0 ]; then
    add_fail "seed migration(s) listed in $OPERATOR_DOC but ABSENT under $MIGRATIONS_DIR/: ${missing[*]}"
  else
    local count
    count="$(printf '%s\n' "$seeds" | grep -c . || true)"
    add_ok "all $count runbook seed migrations exist (highest listed: $highest)"
  fi
  # SOFT: candidate new seeds numbered above the highest listed (non-boilerplate INSERT/UPDATE)
  local candidates=() mf base mn
  for mf in "$MIGRATIONS_DIR"/*.sql; do
    [ -f "$mf" ] || continue
    base="$(basename "$mf")"
    mn="${base%%_*}"
    [[ "$mn" =~ ^[0-9]+$ ]] || continue
    [ "$mn" -gt "$highest" ] || continue
    # non-boilerplate seed statement? (exclude the ubiquitous app_settings 'global' row insert)
    if grep -iE 'INSERT INTO|^[[:space:]]*UPDATE ' "$mf" 2>/dev/null \
         | grep -qviE "app_settings[^;]*'global'|VALUES[[:space:]]*\('global'\)"; then
      candidates+=("$base")
    fi
  done
  if [ "${#candidates[@]}" -gt 0 ]; then
    add_warn "migration(s) above #$highest carry seed-like INSERT/UPDATE — review whether the OPERATOR.md Step-3 list needs them: ${candidates[*]}"
  fi
}

# ── Check 3: sandbox image tag consistency ────────────────────────────────────
check_sandbox_tag() {
  echo "[3/4] sandbox tag — preset SANDBOX_IMAGE == every agentic-rag-sandbox:<tag> reference"
  local preset_tag
  preset_tag="$(grep -oE '^SANDBOX_IMAGE=agentic-rag-sandbox:[A-Za-z0-9._-]+' "$ONEBOX_ENV" 2>/dev/null | head -1 | sed 's/.*://' || true)"
  if [ -z "$preset_tag" ]; then
    add_fail "no active SANDBOX_IMAGE=agentic-rag-sandbox:<tag> line in $ONEBOX_ENV"
    return
  fi
  # every agentic-rag-sandbox:<tag> reference across the tracked docs (the -t build intent)
  local tags
  tags="$(grep -rhoE 'agentic-rag-sandbox:[A-Za-z0-9._-]+' \
            CLAUDE.md "$OPERATOR_DOC" "$ONEBOX_ENV" "$BACKEND_ENV" 2>/dev/null \
            | sed 's/.*://' | sort -u || true)"
  local distinct
  distinct="$(printf '%s\n' "$tags" | grep -c . || true)"
  if [ "$distinct" -ne 1 ]; then
    add_fail "multiple distinct sandbox tags in the tracked artifacts (bump missed somewhere): $(printf '%s ' $tags)"
  elif [ "$tags" != "$preset_tag" ]; then
    add_fail "sandbox tag mismatch: preset SANDBOX_IMAGE=$preset_tag but the docs reference agentic-rag-sandbox:$tags"
  else
    add_ok "sandbox tag consistent everywhere: agentic-rag-sandbox:$preset_tag"
  fi
}

# ── Check 4: compose parses + reflects setup_data ─────────────────────────────
check_compose_parse() {
  echo "[4/4] compose parse — $COMPOSE_FILE parses AND declares the setup_data volume (D-02)"
  if [ ! -f "$COMPOSE_FILE" ]; then add_fail "missing $COMPOSE_FILE"; return; fi
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 \
       && docker compose -f "$COMPOSE_FILE" config >/dev/null 2>&1; then
    if docker compose -f "$COMPOSE_FILE" config 2>/dev/null | grep -q 'setup_data'; then
      add_ok "docker compose config parses and reflects the setup_data volume"
    else
      add_fail "docker compose config parses but the setup_data volume is absent from the rendered config"
    fi
    return
  fi
  # docker unavailable/denied → dependency-free structural fallback + loud WARN
  add_warn "docker compose unavailable/denied here — CI (ubuntu-latest) runs the authoritative parse; using a structural fallback"
  local ok_mount=0 ok_decl=0
  grep -qE '^[[:space:]]*-[[:space:]]*setup_data:/data([[:space:]]|$)' "$COMPOSE_FILE" && ok_mount=1 || true
  grep -qE '^[[:space:]]{2}setup_data:[[:space:]]*$' "$COMPOSE_FILE" && ok_decl=1 || true
  if [ "$ok_mount" -eq 1 ] && [ "$ok_decl" -eq 1 ]; then
    add_ok "structural check: backend mounts setup_data:/data AND top-level volumes declares setup_data"
  else
    [ "$ok_mount" -eq 1 ] || add_fail "backend service does not mount setup_data:/data in $COMPOSE_FILE"
    [ "$ok_decl" -eq 1 ]  || add_fail "top-level volumes: block does not declare setup_data in $COMPOSE_FILE"
  fi
}

echo "=============================================================="
echo " Deployment-artifact drift check (Phase 158 / D-16)"
echo " repo: $REPO_ROOT"
echo "=============================================================="
check_preset_keys
check_seed_list
check_sandbox_tag
check_compose_parse
echo "--------------------------------------------------------------"

if [ "${#WARNINGS[@]}" -gt 0 ]; then
  echo "WARN summary (${#WARNINGS[@]}) — human review, non-blocking:"
  for w in "${WARNINGS[@]}"; do echo "  - $w"; done
fi

if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo ""
  echo "RESULT: DRIFT DETECTED (${#FAILURES[@]} blocking) — fix the artifact(s) in THIS commit."
  echo "        See CLAUDE.md 'Deployment-artifact parity (same-commit rule)'."
  exit 1
fi

echo "RESULT: PASS — the one-box deploy artifacts are in sync."
exit 0
