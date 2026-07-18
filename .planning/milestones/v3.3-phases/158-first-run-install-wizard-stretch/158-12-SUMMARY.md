# Plan 158-12 — SUMMARY (Migration 102 apply + full-schema regen)

**Plan:** 158-12 (Wave 7 — the OPERATOR-gated migration apply). `autonomous: false`.
**Completed (LOCAL):** 2026-07-17

## Tasks

- **Task 1 — apply migration 102 (OPERATOR).** `supabase/migrations/102_setup_complete.sql` applied to the LOCAL Supabase DB by the operator via the SQL editor. Verified live: `public.app_settings.setup_complete` exists (`boolean DEFAULT false NOT NULL`); `app_settings['global'].setup_complete = False` (correct — the box is not wizard-finalized).
- **Task 2 — regenerate full-schema.sql.** Ran `bash scripts/regenerate-full-schema.sh` (no `--reset` — non-destructive live-DB dump). `supabase/full-schema.sql` rebuilt (4420 lines); diff = **1 line** (`setup_complete boolean DEFAULT false NOT NULL` at :480 — zero drift/cruft, confirming the local DB is clean at migration 102). drift-check exit 0. Committed `chore(158-12): regenerate full-schema.sql after migration 102`.

## Still operator-gated (NOT done here)

1. **Cloud parity** (standing rule, deploy-time): paste `102_setup_complete.sql` + the still-pending `099/100/101` into the CLOUD Supabase SQL editor, and set `SECRETS_ENCRYPTION_KEY` in Coolify (load-bearing — Phase-150 fail-open → plaintext if unset). Use `bash scripts/pending-cloud-migrations.sh` to list the exact set.
2. **Live end-to-end wizard UAT (D-18):** on a fresh `docker compose -f docker-compose.prod.yml up --build`, read the setup token from `docker compose logs backend`, walk `/setup` browser-side (env-detect → preset → bind → operator → provider → smoke → finalize), `docker compose restart backend`, log in as the wizard-created operator. This is the SC#1/2/3 lived-experience proof — the analog of Phase 157's D-09 smoke.

## Note for the runbook
The drift-check (D-16) WARNs that migrations `093`/`094`/`098` carry seed-like INSERT/UPDATE above `docs/OPERATOR.md`'s highest listed seed (`089`) — confirm whether any belong in the OPERATOR.md Step-3 seed list (non-blocking; drift-check still exits 0).
