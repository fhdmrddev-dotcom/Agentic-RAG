---
phase: 141-template-input-resolver-run-scope-stretch
plan: 03
subsystem: database
tags: [postgres, migration, supabase, full-schema, run-scope, template-resolver, psycopg2, coll-02]

# Dependency graph
requires:
  - phase: 141-01
    provides: "authored migration 092 (nullable text run_claim column) + the author-then-apply split"
  - phase: 141-02
    provides: "claim-aware Branch-2 WHERE + conditional race-safe stamp + own-claim wiring — the resolver logic that queries this now-live column"
  - phase: 120-collision-fix-context-isolation
    provides: "author→apply migration split precedent (migration 076) + by-hand live-apply discipline"
provides:
  - "migration 092 APPLIED to the live LOCAL Supabase DB (:54322) — workspace_files.run_claim is live as nullable text, NULL default, no backfill"
  - "supabase/full-schema.sql regenerated (no --reset, live-DB pg_dump) with run_claim + its COMMENT under the workspace_files table"
  - "COLL-02 is now schema-complete: the resolver's claim filter + stamp run against the real column"
affects: [COLL-02, cloud-deploy (092 joins the pending-cloud set), 141-VALIDATION D-141-07 cross-provider render SMOKE]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "By-hand migration apply via psycopg2 on :54322 (never db push / db reset) — the established evidence/apply tool (mirrors Phase 120 mig 076, Phase 140 mig 091)"
    - "Author-then-apply split completed: Plan 01 authored 092; this BLOCKING plan applied it live + regenerated the deploy artifact"
    - "full-schema.sql regenerated from the LIVE DB (no --reset) so dev data is preserved and the artifact reflects true live state"

key-files:
  created: []
  modified:
    - "supabase/full-schema.sql (regenerated — run_claim column + COMMENT on workspace_files)"

key-decisions:
  - "Committed ONLY supabase/full-schema.sql — migration 092 itself was already committed in Plan 01 (fc668805), so the 'migration + schema together' pairing is satisfied across the two plan commits (minor deviation from plan text, see Deviations)"
  - "Applied via psycopg2 with autocommit (idempotent ADD COLUMN IF NOT EXISTS); verified nullable text / NULL default + COMMENT present + dev-data row counts unchanged before/after"
  - "Cloud parity is a DEPLOY-TIME follow-up, not a task now: migration 092 must be applied to cloud Supabase by hand at deploy (joins the 079-086 pending-cloud set)"

patterns-established:
  - "Blocking operator checkpoint gates the live-apply + commit: automated psycopg2 verify (run_claim OK) + git diff --stat scope shown, operator approves, then commit — no push to master/production"

requirements-completed: [COLL-02]

# Metrics
duration: 12min
completed: 2026-07-07
---

# Phase 141 Plan 03: Migration 092 Live-Apply + Full-Schema Regen (COLL-02) Summary

**workspace_files.run_claim is now live on the local DB (nullable text, NULL default, dev data intact) and supabase/full-schema.sql regenerated to match — COLL-02 is schema-complete, so the run-scope claim filter + stamp run against the real column.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-07 (execution session)
- **Completed:** 2026-07-07
- **Tasks:** 2 (Task 1 auto; Task 2 blocking human-verify — operator approved)
- **Files modified:** 1 (`supabase/full-schema.sql`)

## Accomplishments
- Applied migration 092 to the live LOCAL Supabase Postgres (:54322) via psycopg2 — `ADD COLUMN IF NOT EXISTS run_claim text` + its COMMENT, no `db push` / `db reset`.
- Verified live: `run_claim` is `is_nullable='YES'`, `data_type='text'`, `column_default IS NULL`; COMMENT present; dev data intact (threads=513, messages=1162, workspace_files=53 unchanged pre→post apply).
- Regenerated `supabase/full-schema.sql` from the live DB (no `--reset`, 4283 lines) — `run_claim text` now sits inside `CREATE TABLE public.workspace_files` (line 1470) with its COMMENT (line 1495).
- Plan's automated verify printed the canonical `run_claim OK ('YES', 'text', None)`.
- Operator approved the commit at the blocking checkpoint; committed the regenerated artifact only (no push, stayed on `develop`).

## Task Commits

1. **Task 1: Apply migration 092 to live LOCAL DB + regenerate full-schema.sql** — `32b5cd63` (feat) — regenerated `supabase/full-schema.sql`. (The live-DB apply itself produces no committed file; the migration DDL was already committed in Plan 01 at `fc668805`.)
2. **Task 2: [BLOCKING] Operator confirms live apply + approves commit** — operator approved; the approval gates the Task-1 commit above (no separate code commit).

**Plan metadata:** committed alongside this SUMMARY + STATE + ROADMAP (docs commit).

## Files Created/Modified
- `supabase/full-schema.sql` — regenerated single-file deploy artifact; now includes `workspace_files.run_claim` (nullable text) + its Phase-141 COMMENT.

## Decisions Made
- **Committed only `full-schema.sql`.** Migration 092 was already committed in Plan 01 (`fc668805`), so the "migration + regenerated schema together" pairing spans the two plan commits rather than one. This is a benign consequence of the author-then-apply split.
- **psycopg2 live-apply (autocommit), never CLI reset.** Followed the CLAUDE.md migration rule and the Phase 120 / Phase 140 precedent; the `IF NOT EXISTS` DDL is idempotent.
- **Cloud parity deferred to deploy.** Migration 092 must be applied to cloud Supabase by hand at deploy (see Next Phase Readiness / cloud-parity note below).

## Deviations from Plan

### Non-fixing deviation (scope note, not an auto-fix)

**1. Commit scope is `full-schema.sql` only (migration file already committed in Plan 01)**
- **Found during:** Task 2 (checkpoint — capturing `git diff --stat`)
- **Issue:** The plan Task 2 text says commit "migration 092 + regenerated full-schema.sql together." Migration 092 (`supabase/migrations/092_workspace_files_run_claim.sql`) was already committed in Plan 01 at `fc668805` and showed no pending diff.
- **Resolution:** Staged and committed ONLY `supabase/full-schema.sql` (individually — never `git add .`, to avoid the unrelated pre-existing `supabase/.temp/cli-latest` + `supabase/snippets/Untitled query *.sql` scratch noise). The migration file remains in history from Plan 01, so the migration↔schema pairing is preserved across the two commits.
- **Files modified:** `supabase/full-schema.sql`
- **Verification:** `git show --stat 32b5cd63` = exactly 1 file changed (`supabase/full-schema.sql`, +8); no deletions; migration 092 confirmed present at `fc668805`.

---

**Total deviations:** 1 (scope note; no code auto-fix). No scope creep — commit is exactly the regenerated artifact.
**Impact on plan:** None on correctness. Acceptance criteria all met (live column verified, full-schema contains run_claim, no db push/reset, dev data intact).

## Issues Encountered
None. Migration applied cleanly on first attempt; regeneration succeeded; dev data preserved.

## Cloud-Parity Follow-Up (deploy-time, MANDATORY)

Migration 092 is applied to the **local** DB only. It joins the pending-cloud set (currently 079–086) — **at deploy, migration 092 must be applied to cloud Supabase BY HAND** (paste into the cloud Supabase SQL editor), or the production resolver will query a missing `run_claim` column (threat T-141-09, information disclosure). `scripts/pending-cloud-migrations.sh` lists migrations not yet on `origin/production`; 092 will surface there until deployed.

## User Setup Required
None for local dev — the column is live. Cloud requires the by-hand migration apply above at deploy time.

## Next Phase Readiness
- **COLL-02 is schema-complete:** the `run_claim` column is live, so the Plan-02 resolver claim filter + race-safe stamp now execute against the real schema. Phase verification will no longer false-positive on the missing column.
- **Still manual:** the D-141-07 cross-provider render SMOKE (one representative model uploads a `.docx` in a Deep turn and renders it in-scope, byte-correct) lives in `141-VALIDATION.md` "Manual-Only Verifications" and is now RUNNABLE against the live column — it remains an operator UAT, not automated here.
- **Deploy blocker recorded:** cloud apply of 092 (see cloud-parity note).

## Self-Check: PASSED

- `supabase/full-schema.sql` regenerated + committed — FOUND (`run_claim` present 3× in committed artifact)
- Commit `32b5cd63` (feat: migration 092 run_claim + regen full-schema) — FOUND in git history
- Migration 092 (`fc668805`, Plan 01) — FOUND in git history
- `141-03-SUMMARY.md` — FOUND

---
*Phase: 141-template-input-resolver-run-scope-stretch*
*Completed: 2026-07-07*
