#!/usr/bin/env bash
# Regenerate supabase/full-schema.sql from the numbered migrations.
#
# Run this after adding ANY migration to supabase/migrations/.
# CI / pre-commit can enforce that full-schema.sql is up to date.
#
# Requirements:
#   - Supabase CLI installed (`supabase --version` should work)
#   - Local Supabase running (`supabase start`) OR linked to a remote project
#   - The local DB will be RESET (data wiped, schema reapplied from migrations)
#
# Usage:
#   bash scripts/regenerate-full-schema.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${REPO_ROOT}/supabase/full-schema.sql"
HEADER="${REPO_ROOT}/scripts/full-schema-header.sql"

cd "${REPO_ROOT}"

if ! command -v supabase >/dev/null 2>&1; then
  echo "Error: supabase CLI not found. Install via https://supabase.com/docs/guides/cli" >&2
  exit 1
fi

if ! supabase status >/dev/null 2>&1; then
  echo "Error: Supabase is not running locally. Start it with 'supabase start'." >&2
  exit 1
fi

echo "[1/3] Resetting local Supabase DB and applying all migrations in order..."
supabase db reset --no-seed

echo "[2/3] Dumping schema-only snapshot..."
TMP="$(mktemp)"
supabase db dump --schema public --data-only=false -f "${TMP}"

echo "[3/3] Prepending header banner and writing to ${TARGET}..."
{
  cat "${HEADER}"
  echo
  cat "${TMP}"
} > "${TARGET}"
rm -f "${TMP}"

LATEST_MIGRATION="$(ls supabase/migrations | grep -E '^[0-9]+' | sort | tail -1)"
echo
echo "Done. ${TARGET} regenerated."
echo "Latest migration included: ${LATEST_MIGRATION}"
echo
echo "Tip: commit ${TARGET} alongside any new migration so deploys see a consistent snapshot."
