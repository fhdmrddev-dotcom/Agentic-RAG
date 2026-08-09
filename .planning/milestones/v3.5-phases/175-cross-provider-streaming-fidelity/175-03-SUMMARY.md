---
phase: 175-cross-provider-streaming-fidelity
plan: 03
subsystem: provider-routing
tags: [cross-provider, reasoning, openai, gpt-5.6, calling-mode, error-classification, structured-tools]

# Dependency graph
requires:
  - phase: 175-01-shared-substrate
    provides: "reasoning_first capability marker on the 3 gpt-5.6-class rows (read via get_model_capability at the resolve_calling_mode seam)"
provides:
  - "reasoning_first STRUCTURED routing gate in resolve_calling_mode (XPROV-01 D-01) — gpt-5.6-class route STRUCTURED (no tools/reasoning_effort param → no 400, reasoning stays on), the hard API constraint winning over an operator native_tools=True override"
  - "reasoning_tools_unsupported ErrorKind + fixed honest copy + narrow structured-signature classify branch (XPROV-01 D-04) — the specific gpt-5.6 reasoning-tools 400 gets an actionable hint instead of the generic bad_request"
affects: [openai_service.resolve_calling_mode, provider_gateway.errors, agent_loop-error-copy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability-keyed routing gate above the native-tools read — a hard provider API constraint wins over an operator override (never a hardcoded id-list, D-122-04)"
    - "Structured-body signature detection for error classification (mirrors _has_insufficient_quota) — never a loose str(exc) keyword scan (tamper-safe)"
    - "Additive ErrorKind + fixed _MESSAGES copy — specific kinds fall through message_for_kind's non-unknown branch, so no raw-detail interpolation by construction"

key-files:
  created:
    - backend/tests/unit/test_reasoning_first_routing.py
  modified:
    - backend/app/services/openai_service.py
    - backend/app/services/provider_gateway/errors.py
    - backend/app/services/provider_gateway/test_errors.py

key-decisions:
  - "D-01: the reasoning_first gate sits ABOVE the db_native/effective_native resolution so an operator native_tools=True cannot re-trigger the API 400 (Open Q2 — hard OpenAI constraint wins)"
  - "D-04: reasoning_tools_unsupported detection anchors on body[\"error\"][\"message\"] signature substrings OR param==\"reasoning_effort\" (both structured-body reads) — never str(exc), so a crafted message cannot misclassify an unrelated 400 (T-175-03-02)"
  - "D-14: no reasoning_effort param and no tools flip introduced — STRUCTURED routing alone removes the tools param at the else:pass branch; non-reasoning_first models and generic 400s are byte-identical"

patterns-established:
  - "Gate-above-native TDD proof: reasoning_first-wins-over-operator-db_native=True asserted directly (ordering is the security-relevant property, not just the happy path)"
  - "Tamper-guard test: signature-in-str(exc)-only must NOT reclassify (anchors detection on structured body)"

requirements-completed: [XPROV-01]

# Metrics
duration: ~3min
completed: 2026-07-22
---

# Phase 175 Plan 03: Cross-Provider Streaming Fidelity — Reasoning-First Routing + Honest 400 Copy Summary

**A one-line `reasoning_first` STRUCTURED gate in `resolve_calling_mode` (above the native-tools read, so the hard OpenAI API constraint wins over an operator `native_tools=True`) routes gpt-5.6-class models with tools via XML injection — no `tools`/`reasoning_effort` param → no 400, reasoning stays on — plus a dedicated `reasoning_tools_unsupported` ErrorKind with fixed, actionable, non-interpolated copy for the specific gpt-5.6 reasoning-tools 400 (XPROV-01 / D-01 + D-04).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-22T17:10:20Z
- **Completed:** 2026-07-22T17:13:39Z
- **Tasks:** 2 (both TDD RED→GREEN)
- **Files:** 4 (1 created, 3 modified)

## Accomplishments
- **XPROV-01 (D-01) — routing gate:** `resolve_calling_mode` now returns `CallingMode.STRUCTURED` immediately when `cap.get("reasoning_first")` is set, placed right after `cap = get_model_capability(model_id)` and BEFORE `db_native = _resolve_db_native_tools(model_id)`. This short-circuits above the OpenRouter strategy branch and the `effective_native` resolution, so an operator `native_tools=True` override cannot re-trigger the gpt-5.6 400 (RESEARCH Open Q2). STRUCTURED routing alone drops the `tools` param at the existing `else: pass` no-tools branch — no `reasoning_effort` param is introduced anywhere, and `native_tools` on the registry rows is untouched.
- **XPROV-01 (D-04) — honest error copy:** added `"reasoning_tools_unsupported"` to the `ErrorKind` Literal + a fixed `_MESSAGES` entry (auto-switch explanation + pick-a-non-reasoning-model fallback), and a NARROW classify branch that fires only when the error is a 400 AND its structured body carries the reasoning-tools signature. Detection (`_has_reasoning_tools_signature`) mirrors `_has_insufficient_quota`: it reads `body["error"]["message"]` (signature substrings) and the reinforcing `param == "reasoning_effort"` — never a loose `str(exc)` scan. `message_for_kind` interpolates no raw detail for the new kind (specific-kinds branch).
- **D-14 byte-identical:** a model with no `reasoning_first` key routes exactly as today (NATIVE when native_tools true); a generic 400 lacking the signature stays `bad_request`; a signature present ONLY in `str(exc)` (no structured body) is NOT reclassified.

## Task Commits

1. **Task 1 (TDD RED): failing reasoning_first routing test** — `77642293` (test)
2. **Task 1 (TDD GREEN): reasoning_first STRUCTURED gate in resolve_calling_mode** — `834b4034` (feat)
3. **Task 2 (TDD RED): failing reasoning_tools_unsupported classify+copy tests** — `f325dc0f` (test)
4. **Task 2 (TDD GREEN): reasoning_tools_unsupported ErrorKind + copy + narrow branch** — `9173a158` (feat)

**Plan metadata:** _(final docs commit — SUMMARY + STATE + ROADMAP + REQUIREMENTS)_

## Files Created/Modified
- `backend/app/services/openai_service.py` — one gate (`if cap.get("reasoning_first"): return CallingMode.STRUCTURED`) added above `db_native` in `resolve_calling_mode`; no other line changed.
- `backend/app/services/provider_gateway/errors.py` — `reasoning_tools_unsupported` added to `ErrorKind`; `_REASONING_TOOLS_SIGNATURES` + `_is_bad_request` + `_has_reasoning_tools_signature` helpers; the narrow classify branch before the compat isinstance ladder; the fixed `_MESSAGES` copy.
- `backend/app/services/provider_gateway/test_errors.py` — 5 new cases (classify → new kind; fixed-copy-no-raw-detail; generic-400-stays-bad_request; str-only-signature-not-reclassified; no-leak sanity).
- `backend/tests/unit/test_reasoning_first_routing.py` — 4 cases (STRUCTURED gate; reasoning_first-wins-over-db_native=True ordering; non-reasoning_first byte-identical; registry-rows-carry-reasoning_first data tie-in).

## TDD Gate Compliance
Both tasks followed RED→GREEN with a `test(...)` commit before its `feat(...)` commit (Task 1: `77642293`→`834b4034`; Task 2: `f325dc0f`→`9173a158`). RED runs confirmed the new-behavior tests failed before implementation (Task 1: 2 routing tests NATIVE≠STRUCTURED; Task 2: 3 tests fell to `bad_request` / raw-detail-leaking `unknown` fallback). No REFACTOR phase needed (changes were already minimal).

## Decisions Made
- **Gate placement is the security-relevant property.** Putting the `reasoning_first` short-circuit above `_resolve_db_native_tools` is what makes the hard OpenAI API constraint win over an operator `native_tools=True` override — the ordering is asserted directly (`test_reasoning_first_wins_over_operator_db_native_true`), not just the happy path.
- **`param == "reasoning_effort"` accepted as a reinforcing structured signal** alongside the message substrings. Both are reads off `body["error"]` (structured), so neither is the `str(exc)` keyword-soup the classifier was built to avoid; a 400 with that param is specific to this exact API constraint. A signature that appears only in `str(exc)` is explicitly NOT reclassified.

## Deviations from Plan
None — plan executed exactly as written. The Task 1 verify command path was corrected from the plan's literal `backend/tests/test_149_native_tools_routing.py` to `tests/test_149_native_tools_routing.py` (the plan's `cd backend &&` prefix makes the `backend/` prefix a double path); this is a command-invocation correction only, no behavior change.

## Issues Encountered
- **Full `tests/unit` has 63 pre-existing failures** (test_sql_service, test_streaming_reliability, test_retrieval_service, test_sandbox_service, and the rest of the documented rot cluster). Confirmed IDENTICAL to the Plan 01 phase-start baseline of 63 — **zero net-new failures** from this plan; my new `test_reasoning_first_routing.py` (4 tests) is among the 1357 passed. Documented rot routed to Phases 076/077 (075.4-TEST-TRIAGE) — OUT OF SCOPE, not touched.

## Verification
- `venv/Scripts/python -m pytest tests/unit/test_reasoning_first_routing.py tests/test_149_native_tools_routing.py -q` → **13 passed** (4 new + 9 analog, unregressed).
- `venv/Scripts/python -m pytest app/services/provider_gateway/test_errors.py -q` → **35 passed** (5 new + 30 existing byte-identical).
- `venv/Scripts/python -m pytest tests/unit -q` → **63 failed / 1357 passed / 2 xfailed / 2 xpassed** — the 63 == documented pre-existing baseline (zero net-new).
- SC#10 cross-provider + multi-tool live-UAT (gpt-5.6-class + tools → no 400, reasoning on) is authored in `175-VALIDATION.md` (manual, real OpenAI endpoint constraint) — NOT duplicated here.

## Security
- **T-175-03-01 (Information Disclosure — mitigate):** the `reasoning_tools_unsupported` copy is a fixed `_MESSAGES` string; `message_for_kind` never interpolates `raw_detail` for specific kinds. Guarded by `test_reasoning_tools_message_is_fixed_copy_no_raw_detail` + `test_reasoning_tools_message_does_not_regress_other_kinds` (no key/body leak).
- **T-175-03-02 (Tampering — mitigate):** detection anchors on the structured `body["error"]` (message substrings / `param`), never a `str(exc)` scan. Guarded by `test_reasoning_tools_signature_only_in_str_is_not_reclassified` (a crafted message string cannot force a misclassification of an unrelated 400).
- **T-175-03-03 / T-175-03-SC (accept):** the routing gate changes request SHAPE (STRUCTURED) only — no new input surface, no authz change; no package installs (`git diff` shows zero requirements.txt / Dockerfile.sandbox changes).

## Threat Flags
None — no new network endpoint, auth path, file-access pattern, or schema change introduced.

## Known Stubs
None — the gate reads live registry data (`reasoning_first`, landed by Plan 01) and the error kind is fully wired into `classify_provider_error` + `message_for_kind` (the agent_loop consumer already composes those two). The known `force_tool_name` boundary (a workflow forcing a tool on a reasoning-first model could still 400) is explicitly OUT of scope (SEED-114 territory per the plan's `<verification>` note); Deep chat uses `tool_choice="auto"` / `force_tool_name=None`, which is fixed here.

## Next Phase Readiness
- **Plan 04 (title-call injection + guard application)** is independent of this plan; it reads `reasoning_off` (Plan 01) and calls `provider_safe_utility_model` at the thread_title + suggestion sites.
- Deep Mode byte-identical for non-reasoning_first models (default-inert gate; generic 400s unchanged, D-14).
- Live SC#10 UAT (`175-VALIDATION.md`) remains the closing evidence for the real gpt-5.6 endpoint constraint (BUG-260714-01).

## Self-Check: PASSED
- `backend/tests/unit/test_reasoning_first_routing.py` — FOUND (4 passed)
- `backend/app/services/openai_service.py` — FOUND (reasoning_first gate)
- `backend/app/services/provider_gateway/errors.py` — FOUND (reasoning_tools_unsupported kind + branch + copy)
- `backend/app/services/provider_gateway/test_errors.py` — FOUND (35 passed)
- Commits `77642293`, `834b4034`, `f325dc0f`, `9173a158` — all present in `git log`

---
*Phase: 175-cross-provider-streaming-fidelity*
*Completed: 2026-07-22*
