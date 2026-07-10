---
phase: 141-template-input-resolver-run-scope-stretch
plan: 02
subsystem: template-resolver
tags: [asyncpg, template-resolver, run-scope, access-control, harness, tool-dispatch, pytest, COLL-02]

# Dependency graph
requires:
  - phase: 141-01
    provides: "migration 092 nullable run_claim column + pure claim_visible/own_claim_for_ctx helpers + DEEP_CLAIM sentinel + the test_141_run_scope.py RED backstop (7 xfail-pending)"
  - phase: 120-collision-fix-context-isolation
    provides: "isolation-by-column precedent + the pure-helper-mirrors-the-SQL-WHERE discipline"
  - phase: 101-template-fill-integrity
    provides: "resolve_template_source Branch 2 (ephemeral resolver) + the {bytes,filename,provenance,mime,error} envelope + two-query expired/never probe"
provides:
  - "claim-aware Branch 2 in resolve_template_source: run_claim WHERE predicate + conditional race-safe stamp + honest foreign-claim relay + UPDATE-0 fallthrough"
  - "own-claim wired at BOTH Branch-2 resolve sites (tool_dispatcher render handler via own_claim_for_ctx; harness emit pre-resolve via str(ctx.run_id))"
  - "_ProducerStreamCtx exposes workflow_run_id (Landmine 2 fix) so a workflow emit render claims str(W), never 'deep'"
affects: [141-03 (live migration apply + full-schema regen), COLL-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "In-code claim_visible mirror + claim-aware SQL WHERE = defense-in-depth: the offline recorder can't evaluate the WHERE, so the same eligibility truth is re-asserted in Python (faithful offline repro + future WHERE-drift guard)"
    - "Conditional race-safe stamp: UPDATE ... WHERE run_claim IS NULL, then rowcount-status re-check → re-SELECT → honest error on a lost race (never bytes) (T-141-03)"
    - "Emit-path lineage exposed on the proxy CLASS (_ProducerStreamCtx.__init__), not merely at the call site — the raw harness bag has no workflow_run_id attr, so the proxy derives it from the bag's run_id (= workflow_runs.id)"

key-files:
  created: []
  modified:
    - "backend/app/services/template_asset_service.py (own_claim param + claim-aware Branch 2: WHERE predicate, conditional stamp, foreign probe, honest relay)"
    - "backend/app/services/tool_dispatcher.py (own_claim_for_ctx-derived own_claim threaded into the render-handler resolve)"
    - "backend/app/services/harness/phase_types.py (_ProducerStreamCtx.workflow_run_id stamp + emit pre-resolve own_claim=str(ctx.run_id))"
    - "backend/tests/test_141_run_scope.py (dropped all 7 xfail markers — the RED backstop is now fully GREEN)"

key-decisions:
  - "_ProducerStreamCtx exposes workflow_run_id in __init__ (from the inner bag's run_id), NOT via a call-site stamp — the acceptance test constructs the proxy directly, and Plan 01's key-decision explicitly anticipated this. Cleaner + directly testable + correct at every construction site."
  - "own_claim is derived from ctx.run_id at the emit pre-resolve (NOT own_claim_for_ctx(ctx)) — the raw harness bag has no workflow_run_id attr, so the helper would mis-derive 'deep' (Landmine 1/2). own_claim_for_ctx is left UNIMPORTED in phase_types to avoid a dead import."
  - "COLL-02 still NOT marked complete at the requirement level — Plan 03 (BLOCKING) must apply migration 092 to the live DB + regenerate full-schema.sql before the claim column exists in production."

patterns-established:
  - "A defense-in-depth in-code claim check paired with the claim-aware SQL WHERE lets the offline mock recorder (which never evaluates a WHERE) faithfully repro the foreign-claim leak fix without a live DB"

requirements-completed: []  # COLL-02 completes at the phase level after Plan 03 applies migration 092

# Metrics
duration: 5min
completed: 2026-07-07
---

# Phase 141 Plan 02: Claim-Aware Branch 2 + Own-Claim Wiring Summary

**Wired the run-lineage claim end-to-end — `resolve_template_source` Branch 2 now filters, stamps (race-safe), and honestly rejects on `run_claim`, with the own-claim threaded through BOTH Branch-2 callers (including the harness emit `_ProducerStreamCtx` Landmine-2 fix) — flipping all 7 Plan-01 RED tests GREEN (15 passed / 0 xfail).**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-07T19:02:56Z
- **Completed:** 2026-07-07T19:07:22Z
- **Tasks:** 3
- **Files modified:** 4 (0 created, 4 modified — 3 source + 1 test)

## Accomplishments
- **Claim-aware Branch 2** in `template_asset_service.py`: `resolve_template_source` gains an `own_claim: str | None = None` param. Branch 2's SELECT carries `run_claim` in the projection and `AND (run_claim IS NULL OR run_claim = $3 OR $3 IS NULL)` in the WHERE — the `OR $3 IS NULL` arm makes `own_claim=None` (legacy / Branch-1-only callers) a pure no-op (pre-141 behavior, single static query, no dynamic SQL). Owner/thread scope (`thread_id = $1` + `created_by = $2`) is preserved in every probe query (V4 — never widened).
- **Conditional, race-safe claim-on-first-resolve (D-141-03 / Pitfall 2 / T-141-03):** a visible NULL-claim row is stamped via `UPDATE ... SET run_claim = $1 WHERE id = $2 AND run_claim IS NULL`. On a losing race (`UPDATE 0`) the resolver re-SELECTs the claim and, if it is now foreign, relays the honest error rather than returning bytes. The stamp is a non-blocking asyncpg `pool.execute` (CLAUDE.md D-v2.5-01 — no `run_in_threadpool`).
- **Honest foreign-claim relay (D-141-05):** a foreign-claimed non-expired row yields `"This template belongs to a different run or context. Upload it again for this run."` — `bytes=None`, never the foreign run's id/filename/bytes. Two paths reach it: an in-code `claim_visible` mirror (defense-in-depth + faithful offline repro, since the mock recorder doesn't evaluate the WHERE) and a dedicated foreign probe in the row-not-found chain ordered eligible→FOREIGN→expired→never (Pitfall 4).
- **Own-claim wired at BOTH Branch-2 resolve sites (Landmine 1):** `tool_dispatcher._handle_render_template` derives `own_claim = own_claim_for_ctx(ctx)` (server substrate, never tool args — Tampering); `phase_types._exec_llm_emit`'s direct pre-resolve derives `own_claim = str(ctx.run_id)` (the bag's `run_id` IS `workflow_runs.id`; None-guarded).
- **Landmine-2 fix:** `_ProducerStreamCtx.__init__` now exposes `workflow_run_id` from the wrapped bag's `run_id`, so the emit re-dispatch's `own_claim_for_ctx(_render_ctx)` yields `str(W)` — never the `'deep'` sentinel. Both emit-path resolves stamp/filter with the SAME lineage (Landmine 1 consistency).

## Task Commits

Each task was committed atomically:

1. **Task 1: Claim-aware Branch 2 — WHERE + conditional stamp + honest foreign-claim error** — `c29cf9cb` (feat)
2. **Task 2: Thread own-claim through the Deep/sub-agent render handler** — `59ed350c` (feat)
3. **Task 3: Emit-path own-claim + _ProducerStreamCtx workflow_run_id stamp (Landmine 2)** — `3b70a824` (feat)

**Plan metadata:** final docs commit (this SUMMARY + STATE + ROADMAP)

## Files Created/Modified
- `backend/app/services/template_asset_service.py` — `own_claim` param; Branch 2 claim-aware WHERE + `run_claim` projection + conditional race-safe stamp + UPDATE-0 re-SELECT fallthrough + foreign probe + `_foreign_error()` honest relay. Branch 1 (trusted library) untouched.
- `backend/app/services/tool_dispatcher.py` — lazy import extended with `own_claim_for_ctx`; `own_claim = own_claim_for_ctx(ctx)` derived and passed into the render-handler `resolve_template_source`.
- `backend/app/services/harness/phase_types.py` — `_ProducerStreamCtx.__init__` stamps `self.workflow_run_id = getattr(inner, "run_id", None)`; `_exec_llm_emit` passes `own_claim=str(run_id)` (None-guarded) into the emit pre-resolve.
- `backend/tests/test_141_run_scope.py` — dropped all 7 `xfail(strict=False)` markers (5 in Task 1, 2 in Task 3); full file 15 passed / 0 xfail.

## Decisions Made
- **`_ProducerStreamCtx` exposes `workflow_run_id` in `__init__`, not via a call-site stamp.** The plan's Task-3 action text described stamping `_render_ctx.workflow_run_id` at the construction site (:1398), but the acceptance test `test_emit_ctx_carries_workflow_lineage` constructs `_ProducerStreamCtx(inner, "producer-stream-1")` DIRECTLY and asserts `own_claim_for_ctx(...) == str(W)`. A call-site-only stamp would leave the directly-constructed proxy without the attribute → the test would fail. Setting it in `__init__` (deriving from `inner.run_id`) is correct at every construction site (the real call site passes `ctx` as `inner`, so `inner.run_id == ctx.run_id`), is cleaner, and is exactly what Plan 01's key-decision anticipated ("expose workflow_run_id from the proxy itself, deriving from the inner bag's run_id in __init__"). See Deviations.
- **`own_claim_for_ctx` intentionally NOT used at the emit pre-resolve.** The raw harness bag has no `workflow_run_id` attribute, so `own_claim_for_ctx(ctx)` would return the `'deep'` sentinel — the Landmine. The bag's `run_id` IS `workflow_runs.id` on this path, so `own_claim = str(run_id)` is the correct workflow lineage. `own_claim_for_ctx` is therefore left unimported in `phase_types.py` (no dead import). See Deviations.
- **COLL-02 not marked complete.** The claim-aware logic is wired, but the `run_claim` column does not exist in the live DB until Plan 03 (BLOCKING) applies migration 092 + regenerates `full-schema.sql`. The requirement completes at the phase level.

## Deviations from Plan

### Auto-fixed / plan-text reconciliations

**1. [Rule 1 — Acceptance-test conformance] `_ProducerStreamCtx.workflow_run_id` set in `__init__`, not at the call site**
- **Found during:** Task 3
- **Issue:** The Task-3 action text said to stamp `_render_ctx.workflow_run_id = getattr(ctx, "run_id", None)` at the :1398 construction site. But the authoritative acceptance test constructs the proxy directly (`_ProducerStreamCtx(inner, "producer-stream-1")`) with no call-site stamp and asserts `own_claim_for_ctx == str(W)`. A call-site-only stamp fails that test.
- **Fix:** Set `self.workflow_run_id = getattr(inner, "run_id", None)` inside `_ProducerStreamCtx.__init__`. Correct at the real call site (`inner` is `ctx`), correct for the direct-construction test, and matches Plan 01's explicit key-decision. The `contains: "workflow_run_id ="` artifact check is satisfied by the `__init__` assignment.
- **Files modified:** `backend/app/services/harness/phase_types.py`
- **Commit:** `3b70a824`

**2. [Rule 3 — avoid dead import] `own_claim_for_ctx` not imported into `phase_types.py`**
- **Found during:** Task 3
- **Issue:** The Task-3 action text suggested extending the module-top import to also import `own_claim_for_ctx`, but the emit pre-resolve deliberately derives `own_claim = str(ctx.run_id)` (NOT via the helper, which would mis-derive 'deep' on the raw bag). Importing an unused helper would be dead code.
- **Fix:** Left the `phase_types.py` import as-is; derived `own_claim` from `str(run_id)` directly. The source-assertion `test_both_branch2_resolve_sites_pass_own_claim` only requires the substring `"own_claim"` in the file, which the `own_claim=` kwarg satisfies. (No repo lint/pre-commit hook exists to flag an unused import, but avoiding one is still correct.)
- **Files modified:** `backend/app/services/harness/phase_types.py`
- **Commit:** `3b70a824`

## Issues Encountered
- **Two now-unused symbols in the test file** (`import pytest` and the `_PLAN_02` reason constant) after all 7 xfail markers were dropped. Confirmed there is no `.pre-commit-config.yaml`, no non-sample git hook, and no `ruff`/`flake8` config under `backend/`, so neither blocks the commit. Left in place to keep the diff focused on the behavior change (test files conventionally retain `import pytest`); a future tidy can remove them.

## Threat Register Coverage (from PLAN.md `<threat_model>`)
- **T-141-01** (foreign-lineage info disclosure) — claim predicate `run_claim IS NULL OR run_claim = own` + in-code `claim_visible` mirror. ✓
- **T-141-02** (tampering — own-claim from tool args) — own-claim derived from `ctx.workflow_run_id` / raw-bag `ctx.run_id` only, never `args`. ✓
- **T-141-03** (claim-stamp race) — conditional `UPDATE ... WHERE run_claim IS NULL` + rowcount re-check + re-SELECT → honest error on `UPDATE 0`. ✓ (`test_resolver_claim_race_falls_through`)
- **T-141-04** (scope-widen regression) — `created_by`/`thread_id` in every Branch-2 probe. ✓ (`test_where_preserves_user_and_thread_scope`)
- **T-141-05** (honest foreign error) — message names the condition only; no foreign id/filename/bytes. ✓
- **T-141-08** (Landmine 2 — emit mis-claims 'deep') — `_ProducerStreamCtx.workflow_run_id` from raw-bag run_id. ✓ (`test_emit_ctx_carries_workflow_lineage`)

## Verification
- `tests/test_141_run_scope.py -x -q` → **15 passed, 0 xfailed** (all Plan-01 markers dropped).
- Wave-merge blast radius (`test_141_run_scope + test_workspace_template + unit/test_citation_policy + unit/test_llm_emit_executor`) → **79 passed**, no resolver-neighbor regression.
- Both edited caller modules import cleanly (`tool_dispatcher`, `harness.phase_types`).
- **G-5 CLEAN:** no `threads.py`, `template_service.py`, or `pin_templates_for_run` touched; Branch 1 unchanged. Exactly 3 source files + 1 test file changed.

## Next Phase Readiness
- **Plan 03 (BLOCKING) ready:** the claim logic is fully wired and offline-green. Plan 03 must (operator-gated) apply migration 092 to the live local DB by hand (Supabase SQL editor / psycopg2 `:54322` — never `db push`/`db reset`), run `bash scripts/regenerate-full-schema.sh` (no `--reset`), then apply 092 to cloud Supabase at deploy. Only after the `run_claim` column exists live does the cross-context block actually take effect in production — COLL-02 completes at that point.
- **No blockers.** No package installs, no schema applied to the live DB, `full-schema.sql` untouched (Plan 03's responsibility).

## Self-Check: PASSED
- FOUND: `backend/app/services/template_asset_service.py` (`own_claim` param + `run_claim IS NULL` predicate/stamp present)
- FOUND: `backend/app/services/tool_dispatcher.py` (`own_claim_for_ctx` derivation present)
- FOUND: `backend/app/services/harness/phase_types.py` (`workflow_run_id =` stamp present)
- FOUND: `backend/tests/test_141_run_scope.py` (15 passed / 0 xfail)
- FOUND commit: `c29cf9cb` (Task 1), `59ed350c` (Task 2), `3b70a824` (Task 3)
- Blast-radius neighbors green: 79 passed (test_141_run_scope + test_workspace_template + test_citation_policy + test_llm_emit_executor)

---
*Phase: 141-template-input-resolver-run-scope-stretch*
*Completed: 2026-07-07*
