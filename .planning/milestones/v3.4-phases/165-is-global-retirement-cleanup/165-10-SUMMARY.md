# Plan 165-10 SUMMARY — Migration 111 apply + catalog verification + full-schema regen

**Plan:** 165-10 (Wave 2 — the `[BLOCKING]` apply gate)
**Requirement:** MIG-02
**Status:** COMPLETE
**Executed by:** orchestrator (checkpoint plan — see Deviation 1)

## What shipped

Migration `111_is_global_retirement_rename.sql` is **applied to the live local Supabase DB**, catalog-verified with no over-widening and the write-lock intact, and `supabase/full-schema.sql` is regenerated no-reset with **zero bare `is_global`**. DB + already-committed Wave-1 code (plans 01–09) now converge with no partial-deploy window (D-165-06).

## Task 1 — Apply (Deviation 1: operator-authorized direct apply)

The plan authored this task as `checkpoint:human-action` ("Claude MUST NOT apply"). The **operator explicitly overrode this** mid-run, instructing: *"for the migration applied directly respect the rules of not resetting or push DB just apply the migration and continue."*

- Applied via `psycopg2` @ `127.0.0.1:54322`, executing the file's own `BEGIN…COMMIT` under `autocommit=True` so the **server transaction** controls atomicity — functionally identical to a Supabase SQL-editor paste (one atomic pure-DDL execution).
- **NO `supabase db push`, NO `supabase db reset`** — the two hard rules honored; dev data preserved.
- Pre-check confirmed `NOT_YET_APPLIED` (all 6 tables had `is_global`) before applying.
- Result: `APPLY_OK` — migration executed atomically, no error.

## Task 2 — Catalog verification (read-only psycopg2) — ALL PASS

- **Columns (6):** `folders.is_org_shared`, `skills.is_org_shared`, and `workflow_definitions`/`document_views`/`classification_rules`/`metadata_field_definitions`.`is_system_global` all exist; **NO `is_global` remains** on any of the six; **`skills.is_system` preserved** (D-165-02).
- **Folder DEFINER fn:** `folder_is_org_shared(uuid)` exists as `SECURITY DEFINER` with `search_path=''`; `folder_is_globally_visible` is **gone**.
- **T-165-01 over-widening check (CRITICAL):** all four write-locked tables' SELECT universal branch = exactly `is_system_global = true` (auto-propagated, **not** widened); INSERT/UPDATE `WITH CHECK` = `is_system_global = false` (write-lock intact).
- **folders/skills SELECT policies** reference the new names — folders → `folder_is_org_shared(id)`; skills → `is_system = true OR … is_org_shared = true` (is_system universal escape kept).
- **Storage policy** "Users can read own skill files" → `s.is_system = true OR s.is_org_shared = true`, no bare `is_global`.

## Full-schema regen + two artifact-parity fixes

`bash scripts/regenerate-full-schema.sh` (no `--reset`, live-DB dump). The first regen surfaced **2 bare `is_global` in `full-schema.sql`** that the migration's §2/§3 notes had flagged as out-of-DDL-scope — both fixed at the **source** (never hand-editing `full-schema.sql`):

- **Deviation 2 (functional — required):** `scripts/full-schema-supplement.sql` carried the OLD storage read policy (`s.is_global = true`). The public-only `pg_dump` can't cover `storage.objects`, so the supplement is the bootstrap source for that policy — and it was never mirrored to the migration-§3 change. A greenfield paste would have failed (`column s.is_global does not exist`). Reconciled to `s.is_system = true OR s.is_org_shared = true` (mig-109 shape) + updated the supplement's MAINTENANCE provenance to cite mig 111. Sanctioned by the supplement's own maintenance note.
- **Deviation 3 (doc-only):** folded a **§4 `COMMENT ON TABLE public.skill_versions`** into migration 111 (RENAME COLUMN doesn't touch comment TEXT, like function bodies) reconciling `is_global`→`is_org_shared`, and applied that single idempotent statement live. Amends plan-01's migration, which is safe because 111 is **not yet deployed to cloud** — keeps the whole retirement atomic in one migration for cloud/replay.

Final: `grep -Ec "\bis_global\b" supabase/full-schema.sql` → **0**. Split targets present (is_org_shared ×15, is_system_global ×18, folder_is_org_shared ×7, folder_is_globally_visible ×0).

## Same-commit landing

Migration 111 (amended §4) + `supabase/full-schema.sql` + `scripts/full-schema-supplement.sql` land in ONE commit (same-commit rule / D-165-06). Plans 01–09 were committed BEFORE apply → no partial-deploy window.

## Cloud parity (OWED — not applied now)

Standing item: cloud-parity migrations **099 → 110 → 111** + `SECRETS_ENCRYPTION_KEY` are owed at the next operator-gated production push, in order. **Not applied to cloud in this plan.** Migration 111 is schema-only, value-preserving — seeds no reference data, touches no env var / bundled service / sandbox tag → owes NO `docs/OPERATOR.md` / `check-deploy-drift.sh` change (D-16 satisfied by exclusion, like migs 105–110).

## Dev-server restart cleared

DB + code are now consistent — backend/frontend dev servers may be restarted (W1 window closed).

## Files modified
- `supabase/full-schema.sql` (regenerated no-reset — plan's declared file)
- `supabase/migrations/111_is_global_retirement_rename.sql` (§4 comment reconciliation — Deviation 3)
- `scripts/full-schema-supplement.sql` (storage read-policy reconciliation — Deviation 2)

## Self-Check: PASSED
Migration applied atomically (no reset/push); live catalog verified (no over-widening, write-lock intact, is_system preserved); full-schema regenerated no-reset with zero bare `is_global`; same-commit landing; cloud-parity recorded. Unblocks plan 165-11 (exit-gate arbitration).
