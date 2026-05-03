#!/usr/bin/env bash
# Regenerate supabase/full-schema.sql from the LIVE local Supabase DB (default)
# or from a fresh reset+replay of all migrations (--reset).
#
# Default mode (NO RESET): dumps the schema of whatever your local Supabase DB
# currently looks like. Use this after applying a migration via the Supabase
# SQL editor so full-schema.sql reflects the new state without wiping data.
#
# --reset mode (DESTRUCTIVE): runs `supabase db reset --no-seed` first, which
# wipes the local DB and replays all migrations in numeric order. Use this
# only when you want to verify that the migration sequence on disk produces
# the expected schema from a clean slate (CI / release verification).
#
# Requirements:
#   - Supabase CLI installed (`supabase --version` should work)
#   - Local Supabase running (`supabase start`)
#   - Docker (we use docker exec + pg_dump; sidesteps `supabase db dump` flakiness)
#
# What this does:
#   [1] (--reset only) Resets local Supabase DB and applies all migrations
#   [2] Dumps schema-only snapshot via pg_dump inside the Supabase Postgres container
#   [3] Prepends the bootstrap header banner
#
# Usage:
#   bash scripts/regenerate-full-schema.sh           # default: no reset, dump live DB
#   bash scripts/regenerate-full-schema.sh --reset   # reset + replay migrations, then dump

set -euo pipefail

RESET_DB=false
for arg in "$@"; do
  case "$arg" in
    --reset)
      RESET_DB=true
      ;;
    -h|--help)
      sed -n '2,27p' "$0"
      exit 0
      ;;
    *)
      echo "Error: unknown flag '$arg'. Use --reset or no arguments." >&2
      exit 1
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${REPO_ROOT}/supabase/full-schema.sql"
HEADER="${REPO_ROOT}/scripts/full-schema-header.sql"

cd "${REPO_ROOT}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found. Install via https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found. Docker Desktop must be installed and running." >&2
  exit 1
fi

if ! supabase status >/dev/null 2>&1; then
  echo "Error: Supabase is not running locally. Start it with 'supabase start'." >&2
  exit 1
fi

# Find the Supabase Postgres container (name pattern: supabase_db_<project_ref>)
DB_CONTAINER="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1 || true)"
if [ -z "${DB_CONTAINER}" ]; then
  echo "Error: could not locate Supabase Postgres container (expected name 'supabase_db_*')." >&2
  echo "       Run 'docker ps' and ensure 'supabase start' has finished." >&2
  exit 1
fi

# Sanity check: warn if any non-standard migration filenames exist
NONSTANDARD="$(ls supabase/migrations/ | grep -v -E '^[0-9]+_[a-z0-9_]+\.sql$' || true)"
if [ -n "${NONSTANDARD}" ]; then
  echo "Warning: these migrations don't match the standard '<digits>_name.sql' pattern:" >&2
  echo "${NONSTANDARD}" | sed 's/^/  - /' >&2
  echo "         Supabase CLI will SKIP them. Rename to fit the pattern." >&2
fi

if [ "${RESET_DB}" = "true" ]; then
  echo "[1/3] --reset specified: resetting local Supabase DB and replaying all migrations..."
  supabase db reset --no-seed
else
  echo "[1/3] No reset (default): dumping live DB schema as-is."
  echo "       If you just added a migration, apply it via the Supabase SQL editor before running this."
fi

echo "[2/3] Dumping schema-only snapshot via pg_dump inside ${DB_CONTAINER}..."
TMP="$(mktemp)"
docker exec -i "${DB_CONTAINER}" pg_dump \
  --schema-only \
  --no-owner \
  --no-privileges \
  --schema=public \
  -U postgres \
  -d postgres > "${TMP}"

if [ ! -s "${TMP}" ]; then
  echo "Error: pg_dump produced an empty file." >&2
  rm -f "${TMP}"
  exit 1
fi

echo "[3/3] Prepending header banner and writing to ${TARGET}..."
{
  cat "${HEADER}"
  echo
  cat "${TMP}"
} > "${TARGET}"
rm -f "${TMP}"

LATEST_MIGRATION="$(ls supabase/migrations | grep -E '^[0-9]+_' | sort | tail -1)"
LINE_COUNT="$(wc -l < "${TARGET}")"
echo
echo "Done. ${TARGET} regenerated (${LINE_COUNT} lines)."
echo "Latest migration on disk: ${LATEST_MIGRATION}"
if [ "${RESET_DB}" = "false" ]; then
  echo "Mode: live-DB dump (no reset). If full-schema.sql doesn't reflect a recent migration,"
  echo "      apply the migration via Supabase SQL editor first, then re-run this script."
fi
echo
echo "Tip: commit ${TARGET} alongside any new migration so deploys see a consistent snapshot."
