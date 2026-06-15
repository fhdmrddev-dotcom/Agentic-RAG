---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 08
subsystem: api
tags: [harness, citation_policy, emit_policy, render_template, tool_dispatcher, SEED-082, GATE-01]

# Dependency graph
requires:
  - phase: 102-04
    provides: "the citation_policy post-verdict disposition seam (apply_citation_policy) + the non-strict branch in _exec_llm_emit"
  - phase: 101.1
    provides: "the _exec_llm_emit forced-emit ladder + _handle_render_template citation gate + check_coverage leaf-naming (uncited_leaves/invented_leaves)"
provides:
  - "A POLICY-AWARE render gate across phase_types -> emitters -> tool_dispatcher (citation_policy_applied threaded server-side; the gate rejects only when uncited/invented AND no policy applied)"
  - "A leaf-accurate emit_policy: matches the FULL (location, field) pair + invented leaves; partial never blanks a CITED sibling cell; a no-op falls back to strict"
  - "IN-03 honest single-surface ordering: the policy summary surfaces ONLY in the render-success text (no pre-render 'delivered' claim, no duplicate echo)"
  - "An UN-MOCKED render round-trip test driving the real _handle_render_template gate (the previously-hollow path)"
affects: [phase-103, SEED-082, citation_policy, output-quality-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-set gate-weakening flag: the gate weakens ONLY when args.get('citation_policy_applied') is truthy — a value the executor (server) sets, never the model/definition JSONB"
    - "Full (location, field) leaf matching mirroring check_coverage._iter_leaves ('scalar' / '{cname}{ri}')"
    - "No-op honest fallback: a policy that named offenders but modified zero leaves fails BACK to strict rather than claiming a false success"

key-files:
  created: []
  modified:
    - backend/app/services/harness/emit_policy.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness/emitters.py
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_citation_policy.py

key-decisions:
  - "The strict citation_policy render path is BYTE-IDENTICAL — strict never sets citation_policy_applied, so the gate rejects an uncited/invented map exactly as today (the default trust bar holds; T-102-08-01)"
  - "WR-06: leaf matching is on the FULL '{location}.{field}' string (the exact form check_coverage produces), not the bare field name — so partial blanks ONLY the named uncited/invented leaf, never a cited sibling cell sharing a column name"
  - "WR-06 honesty: a no-op policy (offenders named, zero leaves modified) returns delivered=False/fallback=strict; the executor routes it through the existing strict honest-fail path (no false success)"
  - "IN-03: the pre-render _surface_failure_message(policy_summary) call was DROPPED; the success-text carry is the single surface — kills the 'told delivered then told failed' contradiction and the 101.1 duplicate-message echo"

patterns-established:
  - "Pattern 1: policy-aware gate via a server-only flag threaded through the resolved render payload (phase_types -> emitters args -> tool_dispatcher gate)"
  - "Pattern 2: un-mocked render round-trip — mock ONLY below the gate (resolve_template_source) so the test asserts on the REAL gate verdict (rejected vs proceeded), not on docx bytes"

requirements-completed: [GATE-01]

# Metrics
duration: 35min
completed: 2026-06-13
---

# Phase 102 Plan 08: Policy-Aware Citation Render Gate (CR-02 + WR-06 + IN-03) Summary

**The non-strict citation_policy (flag/partial/draft) now actually DELIVERS a marked/blanked/labeled deliverable through the REAL render gate — strict still hard-rejects, partial never over-blanks a cited sibling, and the user is never told a failed delivery succeeded.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-06-13T14:10:00Z
- **Completed:** 2026-06-13T14:46:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- **CR-02 closed:** the GATE-01 citation_policy engine seam is functional — `flag`/`partial`/`draft` deliver instead of being silently hard-rejected by the handler's own re-run `check_coverage`. The applied policy is threaded server-side (`citation_policy_applied`) from `_exec_llm_emit` -> the render payload -> the `_handle_render_template` gate, which now rejects ONLY when uncited/invented AND no policy was applied.
- **WR-06 closed:** `emit_policy` matches on the FULL `(location, field)` leaf pair (the exact `"{location}.{field}"` form `check_coverage` produces) and includes `invented_leaves`. An uncited `risks0.risk_id` no longer destroys a cited `risks1.risk_id`. A no-op verdict (offenders named, zero leaves modified) fails BACK to strict rather than claiming a false success.
- **IN-03 closed:** the pre-render policy-summary surface was dropped; the summary now rides ONLY the render-success text (single surface). A render failure after a non-strict policy surfaces a FAILURE message, never the success summary — the "told delivered then told failed" contradiction and the 101.1 duplicate-message echo are both gone.
- **An UN-MOCKED render round-trip** (the verification's explicit demand) drives `_render_template_post` -> the real `_handle_render_template` gate with `check_coverage` and the gate condition un-mocked (mocking only `resolve_template_source` BELOW the gate), proving flag/partial/draft pass the real gate while strict rejects.
- **Strict byte-identity + G-5 preserved:** `forced_emit(` count in `phase_types.py` unchanged at 1 (no new emit shot); `threads.py` / `agent_loop.py` byte-untouched.

## Task Commits

Each task was committed atomically (TDD: RED tests + GREEN implementation per task):

1. **Task 1: WR-06 — emit_policy full-pair leaf matching + invented + strict-fallback** - `bcf642f3` (fix)
2. **Task 2: CR-02 — policy-aware render gate + IN-03 single honest surface** - `7dbe72a1` (fix)
3. **Task 3: UN-MOCKED render-gate round-trip test** - `b29f9722` (test)

**Plan metadata:** _(this SUMMARY commit)_ (docs: complete plan)

_Note: Tasks 1+3 were authored as failing tests then made green within the same commit (the un-mark-on-landing convention); the source fix and its tests committed together per task._

## Files Created/Modified
- `backend/app/services/harness/emit_policy.py` - `_offending_leaves` (uncited + invented); `_iter_leaf_dicts` yields the full `"{location}.{field}"` string (`scalar` / `{cname}{ri}`); `apply_citation_policy` matches the full pair and returns a `delivered=False`/`fallback=strict` signal on a no-op
- `backend/app/services/harness/phase_types.py` - non-strict branch sets `resolved["citation_policy_applied"] = citation_policy`; routes a WR-06 strict-fallback through the existing strict honest-fail path; dropped the pre-render `_surface_failure_message(policy_summary)` (IN-03)
- `backend/app/services/harness/emitters.py` - `_render_template_post` copies `citation_policy_applied` into the handler args
- `backend/app/services/tool_dispatcher.py` - `_handle_render_template` citation gate is policy-aware: rejects only when `(uncited or invented) and not args.get("citation_policy_applied")`
- `backend/tests/unit/test_citation_policy.py` - 7 WR-06 tests (cited-sibling preserved, invented blanked/marked, no-op fallback) + 4 un-mocked render-gate round-trip tests (strict rejects, flag/partial/draft deliver); 2 Plan-04 flat-shape fixtures corrected to the real `check_coverage` leaf string

## Decisions Made
- **Strict stays the inline honest-fail path, never routes through `emit_policy`** — `apply_citation_policy("strict")` still raises, and the executor's strict branch is byte-identical. The new policy-aware behavior is purely additive on the non-strict branch.
- **The gate-weakening flag is server-set, never model-controlled** — `citation_policy_applied` is set by the executor's non-strict branch (a decision already made + receipted via `policy_applied`), so a model/definition JSONB can never smuggle a gate bypass (T-102-08-01).
- **Below-the-gate mocking only** — the un-mocked round-trip test stops at a mocked `resolve_template_source` (which the handler reaches only AFTER a passing gate), so it asserts on the real gate verdict without needing a live sandbox / real docx bytes. The flag-marked map STILL carries an uncited value (`source_chunk_id` None) — proven via `check_coverage` returning `uncited_value_count == 1` — so the gate passes ONLY because `citation_policy_applied` is set, making the test genuinely load-bearing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected 2 Plan-04 flat-shape tests that encoded the bare-field-name WR-06 bug**
- **Found during:** Task 1 (WR-06 GREEN)
- **Issue:** `test_flag_delivers_with_marks` and `test_partial_blanks_uncited` passed `gate={"uncited_leaves": ["k"]}` (bare field name) against a flat field-map. The real `check_coverage` produces `uncited_leaves: ["scalar.k"]` for that shape — the bare-`"k"` form never occurs in production. With the WR-06 full-pair fix, those tests fell into the new (correct) strict-fallback path and failed. They were encoding the exact bare-name contract WR-06 fixes.
- **Fix:** Updated both to the real `check_coverage` leaf string (`"scalar.k"`), preserving their original intent (verified the actual format via a direct `check_coverage` call).
- **Files modified:** backend/tests/unit/test_citation_policy.py
- **Verification:** Both tests green after the correction; the full citation_policy suite is 16/16.
- **Committed in:** `bcf642f3` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — a test fixture encoding the WR-06 bug being fixed).
**Impact on plan:** Necessary for correctness — the corrected fixtures now assert the real `check_coverage` leaf format. No scope creep; the change is within the WR-06 mechanic the task already owned.

## Issues Encountered
None. The base-checkout SEED-056 proof initially showed a 10th diff line (`test_retrieval_service::test_hybrid_empty_returns_tuple`) — confirmed to be a pre-existing flaky-rot test (fails identically at base AND HEAD; the diff was a `RuntimeWarning` text artifact appended to the FAILED line). The genuine net-new diff is exactly the 9 `test_citation_policy.py` behavior tests, all mine, all load-bearing.

## Verification Results

- **Plan target suite:** `test_citation_policy.py` = **16 passed** (5 original + 7 WR-06 + 4 render-gate). The 4 render-gate tests (`-k render_gate`) = **4 passed**.
- **Adjacent harness/emit/validator slice** (`test_citation_policy` + `test_llm_emit_executor` + `test_emit_field_map` + `test_emitters` + `test_tool_dispatcher` + `test_template_render` + `test_template_integrity` + `test_forced_emit` + `test_harness_audit_emit` + `test_ask_user_disposition` + `test_pre_post_timing` + `test_validator_kinds`) = **133 passed / 0 failed**.
- **Strict byte-identity:** `forced_emit(` count in `phase_types.py` unchanged at **1** (no new emit shot). The strict citation branch is untouched; the render gate rejects an uncited map with no `citation_policy_applied` (the strict round-trip test proves it).
- **G-5 RED LINE:** `git diff --stat f337f42f HEAD -- backend/app/api/threads.py backend/app/services/agent_loop.py` is **empty** (byte-untouched).
- **SEED-056 net-new-failure proof:** wider unit slice = **56 failed / 769 passed** at HEAD. Reverting the 4 source files to the wave base `f337f42f` (test files kept at HEAD) yields **65 failed** — the 9 EXTRA are exactly my net-new `test_citation_policy.py` behavior tests failing against the base source (proving the source is load-bearing). Source restored clean to HEAD; the 16 target tests re-confirmed green. **Net-new failures = 0.** The 56 pre-existing failures live in suites this plan never touched (`test_sql_service`, `test_sandbox_service`, `test_retrieval_service`, `test_streaming_reliability`, etc.).

## Threat Model Coverage

| Threat ID | Status | Mitigation |
|-----------|--------|------------|
| T-102-08-01 | Mitigated | The gate weakens ONLY when `args.get("citation_policy_applied")` is truthy — a SERVER-set value (the executor's non-strict branch), never the model/definition JSONB. Strict (no key) rejects byte-identical. |
| T-102-08-02 | Mitigated | IN-03: the policy summary surfaces ONLY after a successful render (folded into the success text); a render failure surfaces a failure message, never the success summary. |
| T-102-08-03 | Mitigated | WR-06: full (location, field) matching blanks ONLY the named uncited/invented leaf, never a cited sibling; a no-op verdict fails back to strict rather than claiming a false success. |

## Known Stubs
None. No placeholder/stub values introduced — all four files carry real behavior backed by tests.

## Next Phase Readiness
- GATE-01's `citation_policy` engine seam is now fully functional (flag/partial/draft deliver; strict rejects) — Phase 103 can surface `citation_policy` as one plain-language question with confidence that every mode behaves honestly.
- The phase verification (`/gsd:verify-work 102`) re-run should re-test the live non-strict delivery path (the SC#10 4-axis golden-run scoreboard) — the CR-02/WR-06/IN-03 review gaps are closed at the code level here; the un-mocked round-trip backstops them offline.
- GATE-01 marks complete at phase verification (the multi-plan 099/WFSKILL-01 convention).

## Self-Check: PASSED

- Files: all 5 modified files + the SUMMARY exist on disk (FOUND).
- Commits: `bcf642f3` (Task 1), `7dbe72a1` (Task 2), `b29f9722` (Task 3) all present in git history (FOUND).

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-13*
