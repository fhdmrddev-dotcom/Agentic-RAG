---
phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
plan: 04
subsystem: testing / RLS integration
tags: [rls, multi-tenancy, security, testing, ten-02, atomic-crux, d-08]
requires:
  - "plan 163-01 harness + fixtures (_rls_harness.as_user_asyncpg / as_user_supabase_txn / assert_auth_uid / open_user_conn / requires_pg; conftest two_orgs_two_users + auth_uid_variant)"
  - "app.dependencies._apply_rls_user_context (role-first + both-GUC-forms) + get_user_supabase (per-request anon+Bearer factory) — already live from Front-B"
  - "migrations 104/105/106 applied to the live local DB (the two_orgs_two_users fixture skips otherwise) — org tables + org_id backfill + BEFORE-INSERT autofill"
  - "the Phase-111.1 SupabaseTxnAdapter bridge (tests/integration/_reembed_adapter.py)"
provides:
  - "backend/tests/integration/test_163_leak_asyncpg.py — the D-08 asyncpg two-user, two-path leak core (11 tests): fail-loud preflight + positive control + read/write isolation + GUC-variant arbitration"
  - "backend/tests/integration/test_163_leak_supabase.py — the D-08 supabase-py per-request-client leak core + no-singleton-mutation guard"
  - "backend/tests/integration/test_163_role_swap.py — the T-163-01 role-swap-noop / spoof / fail-closed detector (4 tests)"
affects:
  - "plan 163-05 ([BLOCKING] Wave-3 apply of 107 THEN 108) — the apply gate that flips all 15 tests RED→GREEN"
  - "plan 163-09/10 (the operator-run LIVE runbook + pass/fail scoreboard) — the human-run counterpart of this automated mechanism proof"
tech-stack:
  added: []
  patterns:
    - "fail-loud auth.uid() preflight is the FIRST per-user assertion (asyncpg path) — a NULL uid false-passes isolation at '0 rows', so the preflight raises before any isolation check"
    - "positive control (viewer sees its OWN row >0) precedes every isolation assert — an over-restricting / NULL-uid harness fails loudly instead of false-greening at 0-for-everyone; on the supabase path the positive control DOUBLES as the auth.uid()-liveness guard (no raw-SQL preflight through the fluent adapter)"
    - "GUC-variant arbitration (D-02): a local _apply_rls_variant sets role + a selectable {legacy, json, both} GUC subset; parameterized test records which make auth.uid() resolve; both is hard-asserted (D-11-portable default), legacy/json recorded not asserted"
    - "role-swap-noop diff (T-163-01): claims-set-but-role-OMITTED stays postgres/BYPASSRLS and SEES A's row (==1); role-swap-as-B sees 0 — the 1→0 diff proves the swap, not the claims, turns RLS on"
    - "supabase-py leak via SupabaseTxnAdapter over an asyncpg RLS txn, called through run_in_threadpool so the sync .execute() schedules its coroutine back onto the running test loop (real RLS on real rows, not a mock)"
key-files:
  created:
    - backend/tests/integration/test_163_leak_asyncpg.py
    - backend/tests/integration/test_163_leak_supabase.py
    - backend/tests/integration/test_163_role_swap.py
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
decisions:
  - "Representative table set covered in two tiers: the 4 fixture-seeded tables (documents/folders/threads/skills) get EXACT id-scoped isolation + a positive control; messages/user_memory (unseeded) get owner-scoped isolation guarded on table presence — all 6 tables from the plan action are exercised without relying on positives the fixture does not seed"
  - "No explicit assert_auth_uid preflight on the supabase-py path (the SupabaseTxnAdapter exposes only the .table().select().eq() fluent surface, no raw SQL) — the positive control is the equivalent fail-loud guard there: under RLS a NULL auth.uid() hides the viewer's OWN row too, so 0-for-everyone surfaces loudly. The asyncpg path keeps the literal assert_auth_uid-FIRST invariant per the acceptance criteria"
  - "GUC arbitration hard-asserts only the both variant (the shipped default); legacy/json are DB-dependent and recorded (print + module dict), not asserted — that IS the arbitration. A resolving variant is still checked to resolve to the CORRECT uid (never a stale/other id)"
metrics:
  duration: 9m
  completed: 2026-07-19
  tasks: 2
  commits: 2
  tests_added: 15
---

# Phase 163 Plan 04: D-08 Two-User Leak Core + Role-Swap Detector Summary

Authored the three automated tests that ARE the D-08 crux proof at the mechanism level — the asyncpg two-user leak, the supabase-py per-request-client leak, and the role-swap-noop / spoof / fail-closed detector — exercising the Front-B RLS context factories + the (soon-to-be-applied) membership predicates directly against seeded two-user/two-org rows, so a wrong GUC variant, a role-swap no-op, or a predicate leak is caught at the earliest possible gate (right after the plan-05 apply, before any router-swap work). All 15 tests collect cleanly and are RED until plan 163-05 applies migrations 107+108.

## What Was Built

**Task 1 — the two-path leak core (`b5f8c188`):** two files, 11 tests.

- `test_163_leak_asyncpg.py` (8 tests): the shipped role-first + both-GUC-forms path (via the harness `open_user_conn` / `_apply_rls_user_context`) driven as each user across the seeded table set. Each direction runs the FAIL-LOUD `assert_auth_uid` preflight FIRST, then a POSITIVE CONTROL (viewer sees its own row == 1), then ISOLATION (id-scoped count of the other user's row == 0) for `documents / folders / threads / skills`. A dedicated write-isolation test proves cross-org `UPDATE`/`DELETE` affect 0 rows inside an always-rolled-back transaction. An unseeded-table test extends owner-scoped isolation to `messages / user_memory` (guarded on presence). GUC-variant arbitration is parameterized over `legacy / json / both` — records which make `auth.uid()` resolve on this DB, hard-asserts `both`, and a structural companion test records which GUC form the DB's `auth.uid()` body references.
- `test_163_leak_supabase.py` (3 tests): the same isolation, both directions, on the PostgREST path — supabase-py fluent reads over an asyncpg RLS txn via the `SupabaseTxnAdapter` bridge, called through `run_in_threadpool` so the sync `.execute()` schedules back onto the test loop and hits REAL RLS on REAL rows. Plus a structural guard that `get_user_supabase` builds a NEW per-request anon+Bearer client and never re-creates or mutates the `get_supabase()` service-role singleton (Pitfall 2).

**Task 2 — the role-swap detector (`b190f17c`):** `test_163_role_swap.py` (4 tests). The T-163-01 diff: claims-set-but-role-swap-OMITTED stays `postgres`/BYPASSRLS and SEES A's row (==1), role-swap-as-B sees 0 — the 1→0 diff proves the SWAP (not the claims) turns RLS on. Fail-closed: role `authenticated` with NULL `auth.uid()` → 0 rows. Spoof: a random/non-member `sub` (honored claim, `auth.uid()` resolves) reaches 0 of A's rows, and a REAL Org-Y member (B, valid claim) likewise reaches 0 — membership, not a well-formed claim, is the gate.

## Verification

Per the plan's `<automated>` blocks (this plan is the mechanism-level proof; the LIVE operator runbook is plan 163-09/10) — the bar is `--collect-only` clean, RED until plan 05:

- `pytest tests/integration/test_163_leak_asyncpg.py tests/integration/test_163_leak_supabase.py --collect-only` → **11 tests collected, 0 errors**.
- `pytest tests/integration/test_163_role_swap.py --collect-only` → **4 tests collected, 0 errors**.
- Combined all three → **15 tests collected, 0 errors**.

Not run to GREEN by design — the migrations (107+108) are deliberately not applied until the `[BLOCKING]` plan 163-05 apply gate.

## must_haves Coverage

- **D-08 asyncpg two-user leak (read + write) with fail-loud preflight** → `test_163_leak_asyncpg.py` (`_assert_isolated` preflight-FIRST + `test_asyncpg_cross_org_write_affects_zero_rows`).
- **D-08 supabase-py per-request-client leak (no singleton mutation)** → `test_163_leak_supabase.py`.
- **T-163-01 role-swap-noop detector (BYPASSRLS-vs-authenticated diff)** → `test_role_swap_is_the_load_bearing_diff`.
- **Spoof / fail-closed (no-claims NULL → 0; non-member → 0; membership is the gate)** → `test_fail_closed_no_claims_sees_zero` + the two `test_spoof_*` tests.
- **GUC-variant arbitration (legacy / json / both, records which resolve; both = default)** → `test_guc_variant_arbitration` + `test_structural_guc_variant_recorded`.
- **Positive control (viewer sees own rows >0)** → present on both paths (`own == 1` before every isolation assert).

## Threat Model Coverage

The three files ARE the mitigations in the plan's `<threat_model>`: T-163-01 (role-swap no-op → the WITHOUT/WITH diff), T-163-03 (GUC-variant false-pass → the fail-loud `assert_auth_uid` preflight + variant arbitration), T-163-02 (predicate leak → two-user both-path isolation with non-vacuity + positive control), T-163-SPOOF (non-member sub → the spoof cases). No NEW security surface introduced (test-only; T-163-SC accepted — no new package).

## Deviations from Plan

**1. [Rule 1 — inaccurate state write] TEN-02 kept Pending, not marked Complete.**
- **Found during:** state updates (post-execution bookkeeping).
- **Issue:** the workflow's `requirements mark-complete` (fed from the plan frontmatter `requirements: [TEN-02]`) flipped TEN-02 → Complete. But this is a Wave-2 plan that only AUTHORS the leak tests, which are RED by design until plan 163-05 applies migrations 107+108. TEN-02's own text says it "**Ships in the same phase as TEN-01** (RLS is inert without it)," and TEN-01 + TEN-04 remain Pending — so a lone TEN-02 Complete is cross-requirement-inconsistent and would risk a false phase-done signal (the exact stale-bookkeeping class the project repeatedly flags).
- **Fix:** reverted `REQUIREMENTS.md` — TEN-02 checkbox `[x]→[ ]` and traceability row `Complete→Pending`. TEN-02 should be marked Complete when the plan-05 apply + Wave-4 hot-path swap land and its tests go GREEN.
- **Files modified:** `.planning/REQUIREMENTS.md`.

Otherwise the plan executed as written. Two in-spec design choices are recorded in the frontmatter `decisions` (two-tier representative table coverage; positive-control as the supabase-path fail-loud guard since the fluent adapter exposes no raw-SQL preflight). Neither changes behavior or scope.

## Known Stubs

None. The files are RED-until-apply BY DESIGN (documented in each file's STATE CONTRACT docstring and in the plan objective) — this is the intended pre-apply state, not an unwired stub. Plan 163-05's migration apply is the named resolver that flips them GREEN.

## Self-Check: PASSED

- Files exist: `test_163_leak_asyncpg.py` (236 lines), `test_163_leak_supabase.py` (123 lines), `test_163_role_swap.py` (136 lines) — all FOUND.
- Commits exist: `b5f8c188` (Task 1) FOUND, `b190f17c` (Task 2) FOUND.
- Combined `--collect-only`: 15 tests, 0 collection errors.
