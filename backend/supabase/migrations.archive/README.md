# Archived migrations — DO NOT USE

These SQL files are **historical artifacts** from the masterclass-era project layout, when Supabase migrations lived under `backend/supabase/migrations/`. They are no longer applied to any database and are no longer the source of truth for the schema.

## Why this folder still exists

Kept for git history and forensic value only. Most of these files have been squashed or superseded by the canonical migrations at the repo root. Examples:

- `003_drop_openai_columns.sql` — the columns it dropped were never in the canonical `001_initial_schema.sql` (that schema was rewritten without them), so this migration is a no-op against the canonical sequence.
- `005_documents_replica_identity.sql` — Realtime replica identity is now set in `032_phase56_realtime.sql` (canonical).
- The remaining files (`013_folders.sql`, `015_sandbox.sql`, etc.) overlap conceptually with canonical migrations under different file numbers.

## Where the real migrations live

**Canonical location:** `supabase/migrations/` at the repository root.

This is what:
- The Supabase CLI reads (`supabase db reset`, `supabase db push`)
- The regenerate script consumes (`scripts/regenerate-full-schema.sh`)
- `supabase/full-schema.sql` is built from

For the full setup story, see [`supabase/SETUP.md`](../../../supabase/SETUP.md).

## What to do if you find this folder confusing

You're not alone — that's why it's archived rather than deleted. If you're tempted to apply any of these files to a database, **don't**. Apply migrations from `supabase/migrations/` instead, or use `bash scripts/regenerate-full-schema.sh` followed by pasting `supabase/full-schema.sql` into the Supabase SQL Editor.

If you find a schema concern these files seem to address that the canonical migrations miss, open a phase via `/gsd:discuss-phase` rather than running this folder.
