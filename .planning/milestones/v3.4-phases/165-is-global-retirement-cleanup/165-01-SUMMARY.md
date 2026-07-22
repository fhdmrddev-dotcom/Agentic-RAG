---
phase: 165-is-global-retirement-cleanup
plan: 01
subsystem: database
tags: [postgres, rls, security-definer, migration, multi-tenancy, is_global, is_org_shared, is_system_global]

# Dependency graph
requires:
  - phase: 163-rls-rewrite-user-jwt-client-swap
    provides: "mig 108/109 membership-RLS + FIX-A platform-universal SELECT branch (is_system / is_global) — the policies this rename auto-propagates through"
  - phase: 164-secdef-audit-cross-org-isolation
    provides: "mig 110 the four DEFINER retrieval/visibility fn bodies (match_document_chunks / keyword_search_chunks / match_skills / folder_is_globally_visible) copied verbatim here with only column/fn-name tokens changed"
provides:
  - "supabase/migrations/111_is_global_retirement_rename.sql — the atomic value-preserving DDL that retires is_global via the D-165-01 semantic split (source of truth for plans 02–09)"
  - "The post-rename column-name contract: folders/skills.is_org_shared; workflow_definitions/document_views/classification_rules/metadata_field_definitions.is_system_global; skills.is_system unchanged"
  - "folder_is_globally_visible DEFINER fn renamed → folder_is_org_shared (OID-preserving)"
affects: [165-02 folder_utils, 165-03 backend-model-api-rename, 165-04 service-db-rename, 165-05/06/07 backend-tests, 165-08/09 frontend-rename, 165-10 operator-apply-gate, 165-11 sc4-arbiter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RENAME COLUMN auto-propagation: rely on Postgres attribute-number node-trees to carry column renames into RLS USING/WITH-CHECK, CHECK constraints, and indexes — never hand-re-create policies (over-widening / T-165-01)"
    - "OID-preserving ALTER FUNCTION … RENAME so dependent RLS policies auto-follow by OID (no policy re-create); CREATE OR REPLACE the body FIRST, then rename"
    - "Semantic split of a single legacy flag: org-scoped toggle (is_org_shared) vs platform-universal write-locked flag (is_system_global), keyed by which write-lock the table already carries"

key-files:
  created:
    - supabase/migrations/111_is_global_retirement_rename.sql
  modified: []

key-decisions:
  - "D-165-01 semantic split honored: folders/skills → is_org_shared (user org-share toggle); the four write-locked tables → is_system_global (platform-seed universal). Keeps the 15 seeded workflows cross-org by construction (no mig-109 Test-7 regression)."
  - "D-165-02 honored: skills.is_system physical column NOT renamed (load-bearing allow-list); is_system_global appears only on the four write-locked tables."
  - "Relied on RENAME COLUMN auto-propagation (T-165-01): zero hand-written CREATE POLICY on the six renamed public tables — auto-propagation preserves mig-109 semantics verbatim, avoiding the over-widening cross-org-leak vector."
  - "folder_is_globally_visible renamed OID-preservingly to folder_is_org_shared so documents/folders/document_chunks SELECT policies auto-follow by OID; the two retrieval DEFINER fns re-target the new name."
  - "capture_skill_version included as the 2nd trigger-fn rewrite (artifact spec: '2 trigger-fn') — body byte-identical, only the toggle-flip comment updated to is_org_shared."

patterns-established:
  - "Migration is one BEGIN…COMMIT atomic, re-paste-safe (RENAME / CREATE OR REPLACE / DROP-IF-EXISTS+CREATE only)"
  - "DEFINER search_path pins (='' for the audited four, ='public','pg_temp' for capture_skill_version) + OPERATOR(public.<=>) preserved verbatim — search-path safety (CVE-2018-1058 / T-165-04) not weakened by the rename"

requirements-completed: [MIG-02]

# Metrics
duration: 20min
completed: 2026-07-21
---

# Phase 165 Plan 01: is_global Retirement Rename Migration Summary

**Authored `111_is_global_retirement_rename.sql` — the atomic, value-preserving DDL that retires `is_global` via the D-165-01 semantic split (6 RENAME COLUMN + 4 DEFINER-fn CREATE OR REPLACE + OID-preserving folder-fn rename + 2 trigger-fn rewrites + storage skill-files policy reconciliation), relying on RENAME-COLUMN auto-propagation to preserve mig-109 RLS semantics verbatim.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-21
- **Completed:** 2026-07-21
- **Tasks:** 2
- **Files modified:** 1 (created)

## Accomplishments
- **§1 — 6 value-preserving `ALTER TABLE … RENAME COLUMN`** implementing the D-165-01 split: `folders`/`skills` → `is_org_shared`; `workflow_definitions`/`document_views`/`classification_rules`/`metadata_field_definitions` → `is_system_global`. `skills.is_system` deliberately untouched (D-165-02).
- **§2 — function/trigger bodies (TEXT, don't auto-follow):** `folder_is_globally_visible` body fixed to `is_org_shared` then OID-preservingly renamed to `folder_is_org_shared`; `match_document_chunks` + `keyword_search_chunks` re-target the renamed fn; `match_skills` keeps `is_system` as the universal escape and moves the org-gated toggle to `is_org_shared`; `workflow_definitions_block_published_update` guards `is_system_global`; `capture_skill_version` comment updated (body verbatim).
- **§3 — storage `skill-files` read policy** reconciled to the mig-109 shape (`s.is_system = true OR s.is_org_shared = true`) so the built-in skill-creator's files stay cross-org readable while the renamed original branch is value-preservingly carried.
- **No hand-written `CREATE POLICY`** on any of the six renamed public tables — RENAME COLUMN auto-propagation owns those (T-165-01 over-widening avoided); every DEFINER `search_path` pin + `OPERATOR(public.<=>)` preserved verbatim (T-165-04).

## Task Commits

Each task was committed atomically:

1. **Task 1: §1 column renames + §3 storage policy (with §2 placeholder)** - `ba09c653` (feat)
2. **Task 2: §2 DEFINER/trigger fn rewrites + folder fn OID-preserving rename** - `3737f603` (feat)

_Migration NOT applied to any database — application is the Wave-2 [BLOCKING] operator gate (plan 165-10)._

## Files Created/Modified
- `supabase/migrations/111_is_global_retirement_rename.sql` - The single atomic `BEGIN…COMMIT` rename migration: 6 RENAME COLUMN, 4 DEFINER-fn CREATE OR REPLACE, 1 ALTER FUNCTION rename, 2 trigger-fn CREATE OR REPLACE, 1 storage-policy DROP+CREATE.

## Decisions Made
- **Split, not uniform rename:** the four write-locked tables get `is_system_global` (platform-universal) rather than `is_org_shared` (org-scoped) so the 15 seeded workflows stay cross-org by construction — the exact mig-109 Test-7 regression is avoided with zero data movement.
- **`skills.is_system` kept (D-165-02):** the physical column name is load-bearing (load_skill tie-break / mig-109 badge-spoof WITH-CHECK / mig-087 seeding); renamed only where it is a genuine user org-share toggle.
- **Auto-propagation over hand-transcription:** deliberately did NOT re-create any RLS policy on the renamed tables. Postgres carries the rename into policy USING/WITH-CHECK, the `mfd_reachable` CHECK, and indexes automatically — hand-writing them is the over-widening vector (T-165-01).
- **`capture_skill_version` treated as the 2nd trigger-fn** per the plan's artifact spec ("2 trigger-fn CREATE OR REPLACE") even though its `is_global` reference is comment-only — copied byte-identical, changing only the toggle-flip comment, to keep the documentation truthful post-rename without behavior risk.

## Deviations from Plan

The plan executed as written for all authored DDL. Two interpretation/scoping notes (no unplanned code work; recorded for the verifier and plan-11 arbiter):

### 1. [Rule 3 - Plan-check inconsistency] Task 2's `! grep -Eq "is_global"` is impossible as literally written; resolved via the acceptance-criteria's "bare token" clarification
- **Found during:** Task 2 (verification)
- **Issue:** Task 1's automated check requires **6** lines matching `RENAME COLUMN is_global TO` (the unavoidable source column name), while Task 2's automated check requires **zero** `is_global` in the file. These are mutually exclusive: `ALTER TABLE … RENAME COLUMN is_global TO …` must name the source column, and the fn name `folder_is_globally_visible` (referenced in the required `ALTER FUNCTION … RENAME` — itself asserted by another Task-2 grep) contains the substring `is_global`.
- **Fix:** Applied the acceptance-criteria's explicit clarification — "the ENTIRE migration file contains ZERO occurrences of the **bare token** `is_global`" — as a word-boundary check. Verified `grep -nE "\bis_global\b"` returns **only** the 6 `RENAME COLUMN is_global TO` source-name lines; every function body, RLS/storage clause, and trigger uses `is_org_shared` / `is_system_global` (bare `is_global` outside the RENAME statements = **none**). The two `folder_is_globally_visible` occurrences (the CREATE OR REPLACE def + the ALTER RENAME) are the function's own name, not a bare column token, and are required to reference/rename the existing object.
- **Files modified:** none beyond the authored migration
- **Verification:** `grep -nE "\bis_global\b" … | grep -v "RENAME COLUMN is_global TO"` → empty; all three positive Task-2 greps pass.
- **Committed in:** `3737f603` (Task 2 commit)

### 2. [Scope note] COMMENT ON TABLE public.skill_versions still names the old flag
- **Found during:** Task 2 (catch-all grep of full-schema)
- **Issue:** The `COMMENT ON TABLE public.skill_versions` doc-string (`full-schema.sql:1694`) mentions "toggles (is_enabled/is_global)". It is a table comment, not a trigger/function body — outside this migration's declared DDL artifact scope (6 RENAME + 4 DEFINER-fn + fn RENAME + 2 trigger-fn + storage policy).
- **Fix:** Intentionally NOT modified — cosmetic doc-string, no behavior impact; kept the migration within its declared scope. Noted here so a later pass can refresh the comment if desired (it does not affect the "bare token" check on the migration file, which is clean).
- **Files modified:** none
- **Verification:** n/a (deliberately out of scope)
- **Committed in:** n/a

---

**Total deviations:** 0 unplanned code changes; 2 interpretation/scoping notes (1 plan-check reconciliation, 1 cosmetic-scope note).
**Impact on plan:** None on the shipped migration. The authored DDL matches the plan's success criteria exactly; the plan-check reconciliation only affects how "zero is_global" is measured (word-boundary vs substring). No scope creep.

## Issues Encountered
- The two `folder_is_globally_visible` DDL lines and the 6 RENAME source names unavoidably contain the substring `is_global`; addressed by measuring the "bare token" requirement with a word boundary (see Deviation 1).

## User Setup Required
None in this plan. **Migration application is deferred to the Wave-2 [BLOCKING] operator gate (plan 165-10)** — the operator stops dev servers, pastes `111_is_global_retirement_rename.sql` into the Supabase SQL editor, runs `scripts/regenerate-full-schema.sh` (no --reset), and commits the migration + regenerated `full-schema.sql` together. This plan is authoring-only per CLAUDE.md apply discipline (never `db push`/`db reset`).

## Next Phase Readiness
- The column-name contract is now fixed on disk for plans 02–09 to mirror: `is_org_shared` (folders/skills), `is_system_global` (the four write-locked tables), `is_system` unchanged, `folder_is_org_shared` DEFINER fn.
- **Cloud parity owed** at the next operator-gated push: migrations 099→110 + this new 111 + `SECRETS_ENCRYPTION_KEY`, in order.
- No blockers. Migration is atomic, re-paste-safe, and not yet applied (by design).

## Self-Check: PASSED

- `supabase/migrations/111_is_global_retirement_rename.sql` — FOUND
- `.planning/phases/165-is-global-retirement-cleanup/165-01-SUMMARY.md` — FOUND
- Commit `ba09c653` (Task 1) — FOUND
- Commit `3737f603` (Task 2) — FOUND
- Commit `0cd2886b` (metadata) — FOUND
- STATE.md / ROADMAP.md — NOT modified by this executor (orchestrator owns those writes)

---
*Phase: 165-is-global-retirement-cleanup*
*Completed: 2026-07-21*
