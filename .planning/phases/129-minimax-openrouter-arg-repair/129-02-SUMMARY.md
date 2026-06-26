---
phase: 129-minimax-openrouter-arg-repair
plan: 02
subsystem: api
tags: [minimax, agent-loop, tool-calls, provider-routing, sse, json-validation, openai-compat]

# Dependency graph
requires:
  - phase: 122-cross-provider-trust-honesty-parity
    provides: "emit_tier / forced-emit honesty vocabulary (emit_recovered family) — the intent the Deep-side tool_args_recovered signal matches"
  - phase: 095.1
    provides: "provider_gateway boundary error classifier + message_for_kind('bad_request') honest copy + T-095.1-01-02 Information-Disclosure control"
provides:
  - "MiniMax-gated truncated-tool-args guard at the agent-loop round-trip seam (json.loads validity check before messages.append)"
  - "Bounded single-shot re-ask (drop bad turn + corrective nudge + continue) on a run-scoped counter separate from the transient-error budget"
  - "Quiet Deep-side tool_args_recovered SSE signal on a successful re-ask; honest message_for_kind('bad_request') fail on exhausted re-ask"
  - "Pure unit-testable decision helper minimax_argrepair_decision() + _minimax_args_all_valid()"
  - "BUG-260607-03 (minimax-m3-invalid-tool-args-400) folded into Phase 129 and addressed"
affects: [agent-loop, provider-routing, cross-provider-tool-use, minimax, sc10-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure side-effect-free decision helper extracted from an inline streaming-loop seam so the decision tree is unit-pinnable without driving the full agent loop"
    - "Provider-gated proactive validity guard (D-14 RED LINE) — the entire guard returns 'ok' for non-MiniMax providers; shared round-trip append byte-identical"
    - "Bounded recovery without budget-stealing — own run-scoped single-shot counter mirroring _empty_retries, NOT the transient-error _provider_retries"

key-files:
  created:
    - backend/tests/test_129_minimax_argrepair.py
  modified:
    - backend/app/services/agent_loop.py
    - .planning/reported-bugs/minimax-m3-invalid-tool-args-400.md

key-decisions:
  - "Recovered-signal event name = tool_args_recovered (Phase-122 family, quiet Deep-side _emit, not the harness forced_emit substrate the Deep loop bypasses) — resolves Open Q1"
  - "Corrective-nudge re-ask (not a bare re-ask): inject a user message asking the model to re-emit complete args and split large code — resolves Open Q3"
  - "Decision logic extracted to a pure module-level helper so the D-01 ladder is unit-tested against the REAL code, not a re-implementation"
  - "Honest-fail mirrors the finish_reason=='length' shape (emit bad_request copy + error event + break) — surfaces the existing copy without raw-detail interpolation"

patterns-established:
  - "minimax_argrepair_decision(resolved_provider, tool_calls, retries, pending) -> {ok|reask|honest_fail|recovered}: the single source of truth for the D-01 ladder"
  - "Guard sits BEFORE the round-trip messages.append and only diverts via continue/break for MiniMax-invalid cases; 'ok' falls through to the unchanged append"

requirements-completed: [MP-04]

# Metrics
duration: ~20min
completed: 2026-06-27
---

# Phase 129 Plan 02: MiniMax/OpenRouter Arg Repair (MiniMax half) Summary

**MiniMax-gated truncated-tool-args guard at the agent-loop round-trip seam — `json.loads`-validate each buffered tool-call's `arguments` before re-send, run one bounded corrective-nudge re-ask, then either a quiet `tool_args_recovered` signal or an honest `bad_request` fail; non-MiniMax round-trips byte-identical.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-27 (local) / commit `876996c7`
- **Completed:** 2026-06-27
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 3 (1 source, 1 new test, 1 bug-report frontmatter+body)

## Accomplishments
- **D-01 ladder live (MP-04):** invalid/truncated MiniMax tool-call args are detected at the round-trip assistant-message build seam (before `messages.append`), independent of `finish_reason` (MiniMax reports `tool_calls` even when truncated at the output-token cap — Pitfall 2). On invalid args: ONE bounded re-ask (drop the bad turn, inject a corrective nudge, `continue`); successful re-ask → quiet `tool_args_recovered` SSE signal; still-malformed → honest `message_for_kind("bad_request")` copy. Never a silent swallow, never a fabricated/partial dispatch (no brace-balancing).
- **D-03 / D-14 RED LINE held:** the entire guard is gated on `_resolved_provider == "minimax"` (resolved provider identity, not the model string). For openai/anthropic/google the decision is always `"ok"` and the `messages.append` round-trip is byte-identical to pre-Phase-129 (verified by a block-level byte comparison + a purely-additive diff with zero real-code deletions).
- **Pitfall 3 honored:** the re-ask uses a NEW run-scoped single-shot counter `_minimax_argrepair_retries` (init alongside `_empty_retries` at top-of-run, cap = 1), distinct from `_provider_retries` (the per-iteration transient-error budget) — so a code-heavy MiniMax run that also hits a transient 503 cannot burn its arg-repair budget on the transient path or vice-versa.
- **Unit-pinned:** 6 named tests (8 collected with the 3-provider parametrization) pin the real decision helper + the seam's I/O contract; all green.
- **BUG-260607-03 folded** into Phase 129 with the confirmed truncation root cause recorded and a pointer to the fix commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: MiniMax-gated arg-validity guard + bounded re-ask + recovered signal + honest-fail (D-01/D-03)** — `876996c7` (feat)
   - Added the round-scoped counter `_minimax_argrepair_retries` (+ `_minimax_argrepair_pending`) alongside `_empty_retries`.
   - Added the pure helpers `minimax_argrepair_decision()` + `_minimax_args_all_valid()` + the `MINIMAX_ARGREPAIR_NUDGE` constant at module scope; the inline seam delegates the decision and owns only the I/O (emit/append/continue/break/counter).
   - Verify: `ast.parse` OK + both `tool_args_recovered` and `_minimax_argrepair_retries` literals present — **PASS**.
2. **Task 2: Unit coverage + fold BUG-260607-03** — `d6cbe086` (test)
   - `backend/tests/test_129_minimax_argrepair.py` (6 named tests) + bug frontmatter/body fold.
   - Verify: `pytest tests/test_129_minimax_argrepair.py -x -q` → **8 passed** — **PASS**.

**Plan metadata:** (this SUMMARY) — `docs(129-02): complete plan`

_Note: Task 1 was committed then amended (single SHA `876996c7`) to fold in the pure-helper extraction that makes the guard unit-testable — the helper extraction is part of implementing a testable guard, not a separate change._

## Verify Commands (exact + result)

| Task | Command | Result |
|------|---------|--------|
| 1 | `cd backend && venv/Scripts/python -c "import ast; src=open('app/services/agent_loop.py').read(); ast.parse(src); assert 'tool_args_recovered' in src; assert '_minimax_argrepair_retries' in src; print('parse OK')"` | PASS (ran with `encoding='utf-8'` — see Deviations) |
| 2 | `cd backend && venv/Scripts/python -m pytest tests/test_129_minimax_argrepair.py -x -q` | PASS — 8 passed |
| Regression sweep | `cd backend && venv/Scripts/python -m pytest -q -k "minimax or tuner or agent_loop or argrepair"` | PASS — 81 passed, 0 failed |
| Regression (errors/router) | `pytest app/services/provider_gateway/test_errors.py tests/test_provider_router.py -q -k "minimax or tuner or error or router or argrepair"` | PASS — 34 passed |

## Files Created/Modified
- `backend/app/services/agent_loop.py` — Added module-level `MINIMAX_ARGREPAIR_NUDGE`, `_minimax_args_all_valid()`, `minimax_argrepair_decision()`; run-scoped `_minimax_argrepair_retries` / `_minimax_argrepair_pending` counters; the inline MiniMax-gated guard at the round-trip seam that delegates to the decision helper and performs the re-ask / honest-fail / recovered-emit I/O. Purely additive (zero real-code deletions); the tool_calls `messages.append` block is byte-identical.
- `backend/tests/test_129_minimax_argrepair.py` (NEW) — 6 named tests pinning the real helpers + the seam's I/O contract (nudge text, recovered event name + single-emit, honest-fail copy + no raw-detail leak + no brace-balancing, D-14 non-MiniMax no-op parametrized over openai/anthropic/google, cap=1 + counter distinctness).
- `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` — confirmed `status: folded` / `folded_into: 129`; recorded the CONFIRMED truncation root cause (output_tokens=8192 cap-hit) and added a "## Fix" body section pointing at Plan 02 commit `876996c7`.

## Decisions Made
- **Recovered event = `tool_args_recovered`** on the Deep-side `_emit(redis, run_id, ...)` (one XADD on `run:{run_id}`), NOT the harness `forced_emit` / `_emit_audit` substrate the Deep agent loop bypasses by design (resolves Open Q1). It is a quiet audit signal (no `delta`/`error` event), so the FE can ignore unknown event types — no new FE handler.
- **Corrective-nudge re-ask** (inject a user message asking the model to re-emit complete arguments and split large code across calls) rather than a bare re-ask (resolves Open Q3) — makes a re-truncation less likely.
- **Pure-helper extraction** of the decision logic so the unit tests pin the REAL code path (not a copy), avoiding a false-green from re-implementing the ladder in the test.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 verify command needed `encoding='utf-8'`**
- **Found during:** Task 1 (verify step)
- **Issue:** The plan's literal verify command `open('app/services/agent_loop.py').read()` defaulted to the Windows cp1252 codec and raised `UnicodeDecodeError` on a pre-existing non-ASCII byte (an em-dash `—`) in the file — a Windows-default-encoding artifact, NOT a problem with the edit. The file is valid UTF-8 Python source and `py_compile` / module import both succeed.
- **Fix:** Ran the identical assertions with `open(..., encoding='utf-8')` (and confirmed via `py_compile.compile(..., doraise=True)` that the file is valid UTF-8 Python source). The `ast.parse` + both literal-presence assertions pass.
- **Files modified:** none (verify-command-only adjustment)
- **Verification:** `parse OK` printed; both `tool_args_recovered` and `_minimax_argrepair_retries` present.
- **Committed in:** n/a (no source change)

**2. [Rule 1 - Bug] Over-brittle test assertion (self-inflicted, fixed before Task 2 commit)**
- **Found during:** Task 2 (first pytest run)
- **Issue:** `test_recovered_signal_emitted` asserted `"forced_emit" not in recovered_branch`, but the branch's explanatory COMMENT literally names `forced_emit` (to explain it is bypassed), so the substring matched the comment and the test failed.
- **Fix:** Tightened the assertion to check for an actual CALL — `"forced_emit(" not in` and `"_emit_audit(" not in`, plus `"await _emit(" in` — so it verifies the recovered signal uses the Deep-side `_emit` and never the harness substrate, without false-matching prose.
- **Files modified:** backend/tests/test_129_minimax_argrepair.py
- **Verification:** `pytest tests/test_129_minimax_argrepair.py -x -q` → 8 passed.
- **Committed in:** `d6cbe086` (Task 2 commit)

---

**Total deviations:** 2 (1 Rule 3 verify-command encoding, 1 Rule 1 test-assertion fix). Both were blocking/correctness fixes within the plan's scope. No scope creep.
**Impact on plan:** None — the implementation matches the plan's `<action>` and `<acceptance_criteria>` exactly.

## Threat Model Coverage
- **T-129-04 (DoS — malformed args crashing the round-trip):** mitigated — `json.loads` validity guard + bounded re-ask + honest-fail; the run recovers or fails cleanly instead of 400-dying.
- **T-129-05 (Spoofing/Integrity — fabricated/partial dispatch):** mitigated — never brace-balance/re-escape; only a fresh re-ask, then honest `bad_request`. `test_still_malformed_honest_fail` pins the absence of brace-balancing in source.
- **T-129-06 (Information Disclosure — raw 400 leaking):** mitigated — reuse `message_for_kind("bad_request")` fixed copy; `test_still_malformed_honest_fail` asserts no `tool_call_id` / `json string` leak.
- **T-129-07 (cross-run bleed):** mitigated — counter is run-scoped (init alongside `_empty_retries`); the recovered `_emit` targets `run:{run_id}` only (Plan 03 parallel-thread UAT axis).
- **T-129-08 (behavior bleed to non-MiniMax):** mitigated — guard strictly inside the `_resolved_provider == "minimax"` gate; `test_non_minimax_unaffected` proves openai/anthropic/google are byte-identical (D-14 RED LINE).
- **T-129-SC (package installs):** accept — no installs (stdlib `json` + existing OpenAI SDK).

No unmitigated HIGH threats. No new security surface beyond the modeled boundary.

## Issues Encountered
- The full backend suite (~2105 tests) carries known pre-existing rot (per project memory); per the plan the NET-NEW gate is the scoped new test file. The targeted regression sweep over the directly-affected modules (`errors`, `router`, `agent_loop`, all `-k minimax` / `-k tuner`) is fully green (81 passed), so no regressions were introduced.

## Self-Check: PASSED
- `backend/tests/test_129_minimax_argrepair.py` — FOUND
- `backend/app/services/agent_loop.py` — FOUND (modified)
- commit `876996c7` — FOUND
- commit `d6cbe086` — FOUND
- `folded_into: 129` in bug report — FOUND
- tool_calls `messages.append` round-trip block byte-identical pre/post — VERIFIED

## Next Phase Readiness
- The MiniMax half of MP-04 is implemented + unit-pinned. The OpenRouter `require_parameters` half (D-02) is Plan 01 (already complete per `f72adb03`). The SC#10 4-axis live UAT (cross-provider regression + MiniMax recovered/honest-fail rungs + OpenRouter before/after) is authored under VALIDATION.md and runs at the Plan 03 phase gate — both repair rungs and the parallel-thread run-scoping check are exercised there.
- No blockers. The recovered/honest-fail recovery RATE is a confirm-at-execution UAT measurement (Open Q3 design is sound; worst case = current behavior + one wasted call, still honest per D-01).

---
*Phase: 129-minimax-openrouter-arg-repair*
*Completed: 2026-06-27*
