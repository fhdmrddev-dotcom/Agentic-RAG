---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 11
subsystem: database
tags: [rls, postgres, multi-tenancy, migration, is_system, is_global, security]
wave: 6

# Dependency graph
requires:
  - phase: 163-05
    provides: mig 108 membership-RLS rewrite (the 7 SELECT policies whose global branch got org-trapped)
  - phase: 163-10
    provides: the live crux go/no-go that ran the UAT which surfaced the Test-7 regression
provides:
  - "Migration 109 — platform-universal RLS fix: lifts is_system (skills/skill_files/tuner_runs) + hard-set-false is_global (workflow_definitions/document_views/classification_rules/metadata_field_definitions) OUT of the mig-108 org-gate so seed/system content is cross-org visible again"
  - "T-163-11 badge-spoof hardening: skills INSERT+UPDATE WITH CHECK gain AND (is_system = false) — an authenticated user cannot self-set is_system=true"
  - "test_163_rls_platform_universal.py — 8 cross-org (non-co-member) regression asserts covering platform-universal read, user-is_global-stays-org-scoped, and badge-spoof write rejection"
affects: [164, 165, secure-phase-163, is_global-retirement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Platform branch OUTSIDE the org-gate: (<platform>) OR (org_id IN (SELECT current_user_org_ids()) AND (<owner> OR <user-global>)) — only seed/system content escapes; user-self-served global stays gated"
    - "Universal-read escape hardened at the WRITE seam: when a column becomes a universal read key, its self-set path gets a WITH CHECK block (is_system = false)"

key-files:
  created:
    - supabase/migrations/109_platform_universal_rls_fix.sql
    - backend/tests/integration/test_163_rls_platform_universal.py
  modified:
    - supabase/full-schema.sql

key-decisions:
  - "FIX A (operator-locked): lift ONLY platform/system-seeded content out of the org-gate; keep user-self-served is_global (skills.is_global, folders.is_global, global-folder documents) org-scoped — those become cross-user-visible only when orgs gain members in Phases 166/167"
  - "documents + folders SELECT policies deliberately LEFT UNCHANGED — user-shared global stays gated is the point of Fix A"
  - "is_system chosen as the universal escape key precisely because it is write-locked (mig 087, now hardened by T-163-11) — so is_system=true is only ever seed content"

patterns-established:
  - "Platform-vs-user global distinction in RLS: is_system + hard-set-false-for-users is_global = platform (universal); owner-toggled is_global = user-shared (org-scoped)"

requirements-completed: [TEN-01]

# Metrics
duration: ~40min
completed: 2026-07-20
---

# 163-11 SUMMARY — FIX-A: platform-universal RLS fix (Test-7 regression closure)

**Migration 109 lifts platform/`is_system` + seed-`is_global` content out of the mig-108 org-gate so the built-in skill-creator and seeded starter workflows are cross-org visible again, while user-self-served global content stays org-scoped — plus a badge-spoof WITH-CHECK hardening so `is_system=true` cannot be self-set.**

> **Close-out note (safe-resume gate):** This plan's three commits (`34665b22` plan, `5948d694` mig+test, `5f058e69` full-schema) landed during the FIX-A session but the SUMMARY was never written. `/gsd:execute-phase 163 --gaps-only` re-entered on the missing summary; the `safe_resume_gate` fired (production commits exist + SUMMARY missing). Recovery path taken: **close out manually** (NOT re-execute — mig 109 is already applied to the live DB; re-running would re-apply DDL). The committed work was re-verified live before this summary was stamped (evidence below).

## Performance

- **Duration:** ~40 min (plan 00:33 → mig+test 01:03 → full-schema regen 01:13, 2026-07-20 +04)
- **Tasks:** 3 (author RED → operator-apply → regenerate+verify)
- **Files:** 3 source (migration, test, full-schema) + 2 planning (PLAN, UAT)

## Accomplishments
- **Migration 109** — 7 SELECT policies corrected (platform branch hoisted outside the org-gate) + 2 skills WRITE checks hardened. Single atomic `BEGIN/COMMIT`, re-paste-safe (DROP IF EXISTS → CREATE). Every org-gated branch still calls the SECDEF `current_user_org_ids()` helper (42P17-safe).
- **The regression is closed:** the built-in `skill-creator` (`is_system=true`, seed-owned) went from visible-to-1-of-8-users back to universal; seeded `is_global` starter workflows visible cross-org again.
- **Over-widening avoided:** a user's own `is_global` skill/folder, and a document inside a global folder, remain invisible to a non-co-member — Fix A keeps user-shared global org-scoped.
- **T-163-11 badge-spoof hardening:** `is_system=true` INSERT and UPDATE by an authenticated user are rejected by the WITH CHECK.

## Task Commits

1. **Task 1: Author mig 109 + RED cross-org test + structural self-check** — `5948d694` (feat) — migration (148 lines) + `test_163_rls_platform_universal.py` (315 lines), RED by design (assertions fail only because 109 unapplied).
2. **Task 2: [BLOCKING] Operator applies mig 109 via Supabase SQL editor** — operator-gated, no commit; confirmed applied (all 9 policies verified live in `pg_policies` @ :54322).
3. **Task 3: Regenerate full-schema + verify GREEN + commit** — `5f058e69` (docs) — `full-schema.sql` regenerated (no `--reset`) reflecting the 9 corrected policies.

**Plan metadata:** `34665b22` (plan + UAT Test-7 marked as the fix source).

## Files Created/Modified
- `supabase/migrations/109_platform_universal_rls_fix.sql` — the 9-policy fix (7 SELECT + 2 WITH CHECK), atomic, SECDEF-helper-preserving.
- `backend/tests/integration/test_163_rls_platform_universal.py` — 8 cross-org regression asserts (platform-universal read, user-is_global stays org-scoped incl. global-folder document, badge-spoof INSERT+UPDATE rejected, non-vacuity control).
- `supabase/full-schema.sql` — regenerated from the applied live DB.

## Verification (re-run live at close-out, 2026-07-20)

- **Mig 109 applied — all 9 policies confirmed live** via psycopg2 @ 127.0.0.1:54322:
  - skills SELECT USING = `(is_system = true) OR (org_id IN (…current_user_org_ids…) AND (owner OR is_global))` ✓
  - skill_files / tuner_runs SELECT = `EXISTS(skills … is_system=true) OR (org-gate …)` ✓
  - workflow_definitions / document_views / classification_rules / metadata_field_definitions SELECT = `(is_global = true) OR (org-gate …)` ✓
  - skills INSERT + UPDATE WITH CHECK both carry `AND (is_system = false)` ✓
- **Platform-universal test GREEN:** `test_163_rls_platform_universal.py` **8/8 passed**.
- **Full isolation suite GREEN:** `test_163_rls_platform_universal + test_163_rls_skills + test_163_leak_asyncpg + test_163_leak_supabase + test_163_role_swap + test_058_concurrency` → **35 passed** (CONCUR-01 < 1s held — policy-shape change only, no new join).
- **Deep red-line HELD:** the three 163-11 commits touched only the migration, the test, `full-schema.sql`, and planning files — `agent_loop.py` / `run_producer.py` / `provider_gateway` byte-unchanged (`git diff` empty). Pure DB-migration + test change.

## Decisions Made
None beyond the plan — FIX A executed exactly as the operator-locked plan specified.

## Deviations from Plan

**1. [Process — same-commit rule] Migration and regenerated full-schema landed in two commits, not one.**
- **Plan/CLAUDE.md guidance:** migration + regenerated `full-schema.sql` committed together.
- **What happened:** the migration + RED test were committed at authoring time (`5948d694`, Task 1, deliberately RED pre-apply); `full-schema.sql` was regenerated and committed after the operator applied 109 (`5f058e69`, Task 3). Splitting was forced by the RED-authoring-then-operator-apply-then-regenerate task order.
- **Impact:** none functionally — the applied DB, the migration file, and the regenerated schema are all mutually consistent (verified live). Process-only note.

## Issues Encountered
None — the committed work verified clean on re-run. The only anomaly was the missing SUMMARY (a bookkeeping gap, closed here via the safe-resume close-out path).

## User Setup Required
None — migration 109 already applied to the local DB by the operator. **Cloud parity owed:** 109 joins the pending cloud migration set (099 → … → 108 → 109), applied to production in order at the next operator-gated push. Schema-only policy DDL — not seed-bearing, owes no `docs/OPERATOR.md` / `check-deploy-drift.sh` change (D-16 satisfied by exclusion, as mig 108).

## Next Phase Readiness
- **Phase 163 is now closeable** — all 11 plans complete. Two bookkeeping follow-ups remain before formal close:
  1. **`/gsd:secure-phase 163`** — re-run to register **T-163-11** (the `is_system` badge-spoof WITH-CHECK) added after the prior SECURED run at `ae25a358`.
  2. **`/gsd:verify-work 163`** — re-confirm Test 7 now passes and flip `163-UAT.md` (`status: diagnosed` → `pass`).
- **Phase 164** (SECDEF Audit + Cross-Org Isolation Suite) is unblocked once 163 closes.

---
*Phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux*
*Completed: 2026-07-20*
