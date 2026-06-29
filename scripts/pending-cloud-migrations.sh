#!/usr/bin/env bash
# List the supabase/migrations/*.sql files that are present in what you are about
# to deploy but NOT yet on the live `production` branch — i.e. the exact set of
# migrations to paste into the CLOUD Supabase SQL editor at deploy time.
#
# Why this exists:
#   This project applies migrations MANUALLY (paste into the Supabase SQL editor,
#   never `db push`/`db reset` — see CLAUDE.md / docs/DEPLOYMENT-WORKFLOW.md §5).
#   Nothing automatically tracks which migrations the cloud DB has already seen.
#   But because we deploy by promoting to the `production` branch, git already
#   knows the watermark: any migration file added since `production` is one cloud
#   has not received. This script just prints that diff so you don't eyeball it.
#
# Usage:
#   bash scripts/pending-cloud-migrations.sh            # compare HEAD vs origin/production
#   bash scripts/pending-cloud-migrations.sh master     # compare a different ref vs origin/production
#   BASE_REF=origin/production bash scripts/pending-cloud-migrations.sh
#
# Notes:
#   - Migrations are append-only, so new ones always show up as ADDED files (-A).
#   - Apply the listed files IN NUMERIC ORDER, once each (079 is not idempotent —
#     re-running a migration will error).
#   - For a brand-new/greenfield cloud DB, use supabase/full-schema.sql instead
#     of replaying individual migrations.

set -euo pipefail

# Ref you're about to deploy (defaults to current HEAD; pass an arg to override).
TARGET_REF="${1:-HEAD}"
# What's currently live (defaults to origin/production; override via BASE_REF).
BASE_REF="${BASE_REF:-origin/production}"

# Refresh the base ref so the watermark is current. Non-fatal if offline.
if git rev-parse --verify --quiet "${BASE_REF}" >/dev/null; then
  git fetch --quiet origin production 2>/dev/null || \
    echo "WARNING: could not fetch origin/production; comparing against local copy of ${BASE_REF}." >&2
else
  echo "ERROR: base ref '${BASE_REF}' not found. Fetch it first: git fetch origin production" >&2
  exit 1
fi

PENDING=$(git diff --name-only --diff-filter=A "${BASE_REF}" "${TARGET_REF}" -- supabase/migrations/ | sort)

echo "Migrations on '${TARGET_REF}' not yet on '${BASE_REF}' (apply to CLOUD Supabase, in order):"
echo "------------------------------------------------------------------------------"
if [ -z "$PENDING" ]; then
  echo "  (none) — cloud is already at the same migration watermark."
else
  echo "$PENDING" | sed 's/^/  /'
  echo "------------------------------------------------------------------------------"
  echo "Paste each into the cloud Supabase SQL editor in the order shown, once each,"
  echo "then regenerate full-schema.sql. See docs/DEPLOYMENT-WORKFLOW.md §5."
fi
