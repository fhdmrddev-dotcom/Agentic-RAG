---
phase: 123-skill-triggering-quality
plan: 02
subsystem: api
tags: [skills, context-window, trim, agent-loop, ctx-03, pinning, g-5]

# Dependency graph
requires:
  - phase: 123-01
    provides: "agent_loop.py D-01 catalog relaxation + LOAD_SKILL_POLICY (file-ordering dependency only — disjoint region of agent_loop.py)"
  - phase: v2.1 Phase 18 / v2.4 Phase 51 / Phase 078
    provides: "trim_messages_to_fit() with system + reserve_recent protected classes, _remove_oldest_atomic grouping, _TRIM_MARKER honesty, D-078-01 progressive protected trim"
provides:
  - "trim_messages_to_fit() third protected class — pinned load_skill tool-result groups survive the trim window (CTX-03)"
  - "PIN_BUDGET_FRACTION = 1/3 module constant (A3 default, tunable) capping total pinned tokens"
  - "_atomic_groups() — partition mirroring _remove_oldest_atomic, keeps assistant+tool_calls parent with its tool-result"
  - "_extract_pinned_skill_groups() — de-dupe to latest per skill, LRU eviction over budget, honest _TRIM_MARKER on demotion"
  - "_reconstruct_history tags load_skill tool-results with _pinned_skill (in code, from tc name == load_skill; never JSON sniff)"
affects: [123-04 tuner background job (shares the relaxed trigger surface), future skill-context work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Third protected class added IN PLACE inside the single trim path (D-14 RED LINE / G-5 — never a forked trim function)"
    - "Pin flag set in code at reconstruction time from tc metadata (parent tool_call name), never by sniffing the tool-result content JSON (D-13)"
    - "Atomic-group partition mirrors _remove_oldest_atomic so a pinned group always carries its assistant+tool_calls parent (Pitfall 2)"
    - "LRU eviction (lowest original index) + budget cap + honest _TRIM_MARKER — pinning never silently starves the recent-message budget (T-123-02-01 / Pitfall 5)"

key-files:
  created: []
  modified:
    - backend/app/services/context_window.py
    - backend/app/services/agent_loop.py
    - backend/tests/unit/test_context_window.py

key-decisions:
  - "PIN_BUDGET_FRACTION = 1/3 (A3 default) caps total pinned tokens against the max_tokens already passed into trim_messages_to_fit — never re-resolves the budget."
  - "Pin flag value is the skill name from tc args (skill_name), falling back to the tool_call_id so de-dupe still works when args lack skill_name — a load_skill row is NEVER left unpinned."
  - "_extract_pinned_skill_groups returns ([], rest, False) fast-path when no pins are present → pre-CTX-03 behavior is byte-identical (G-5 regression: all 28 pre-existing trim tests unchanged)."
  - "De-dupe keeps the LATEST group per skill; older duplicates demote back into the trimmable pool. LRU eviction evicts the lowest original index pinned group on overflow."

patterns-established:
  - "CTX-03 pinning: a third protected class inside trim_messages_to_fit, fed by an in-code flag from _reconstruct_history, with a budget cap + LRU eviction + honest marker."

requirements-completed: [CTX-03]

# Metrics
duration: 7min
completed: 2026-06-23
---

# Phase 123 Plan 02: CTX-03 Trim-Pin (Loaded-Skill Survival) Summary

**A loaded skill's instructions now stay available for the rest of the session — `trim_messages_to_fit()` gains a THIRD protected class (pinned `load_skill` tool-result groups) alongside the system message and the `reserve_recent` tail, entirely in place (D-14 RED LINE / G-5), with de-dupe, a 1/3 budget cap, LRU eviction, and the honest `_TRIM_MARKER` on any demotion — while `_reconstruct_history` tags those tool-results in code from the parent `load_skill` call name (never by sniffing the result JSON).**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-23T17:31:10Z
- **Completed:** 2026-06-23T17:38:34Z
- **Tasks:** 2 (Task 1 TDD)
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments

- **Task 1 (CTX-03 trim core):** Extended `trim_messages_to_fit()` in place with a third protected class:
  - `PIN_BUDGET_FRACTION = 1.0 / 3` module constant (A3 default, documented as Claude's-discretion-tunable).
  - `_atomic_groups()` partitions `rest` into atomic message groups MIRRORING `_remove_oldest_atomic` — an assistant+tool_calls message plus its immediately-following tool-role messages stay together, so a pinned group always carries its parent (Pitfall 2 — never an orphaned tool result that would 400 a provider).
  - `_extract_pinned_skill_groups()` pulls groups flagged `_pinned_skill` out of `rest`, de-dupes to the LATEST group per skill name (D-13), caps the surviving pins at `PIN_BUDGET_FRACTION * max_tokens`, and evicts the least-recently-loaded (lowest original index) pinned group on overflow — every demotion sets `trimmed_any` so the honest `_TRIM_MARKER` is inserted (D-14, never silent).
  - `_build_candidate()` places pinned groups after the system message + marker and BEFORE the trimmable + protected sections; kept like the protected tail, never entered into the trimmable removal loop.
  - No pins present → `([], rest, False)` fast path → behavior byte-identical to pre-CTX-03 (G-5 regression invariant).
- **Task 2 (pin tag at reconstruction):** `_reconstruct_history` now sets `tool_msg["_pinned_skill"] = <skill name>` on the rebuilt tool-result dict when `tc.get("name") == "load_skill"`. The skill name is derived from `tc["args"]["skill_name"]` with a stable fallback to `tc["tool_call_id"]` so de-dupe still works. No JSON sniffing of the tool-result content (D-13 anti-pattern), no hoist into the system prompt. Additive — non-`load_skill` rows are unchanged.

## Task Commits

1. **Task 1 (TDD RED): failing CTX-03 trim-pin tests** — `b14ed398` (test)
2. **Task 1 (TDD GREEN): pin load_skill groups as third protected class** — `37ad641f` (feat)
3. **Task 2: tag load_skill tool-results as pinned in _reconstruct_history** — `16b1e421` (feat)

**Plan metadata:** (final docs commit — this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md)

## Files Created/Modified

- `backend/app/services/context_window.py` (modified) — `PIN_BUDGET_FRACTION` constant; `_atomic_groups()` + `_extract_pinned_skill_groups()` helpers; pinned partition woven into `trim_messages_to_fit()`; `_build_candidate()` extended with a `pinned` parameter. Single trim path preserved (`^def trim` == 1).
- `backend/app/services/agent_loop.py` (modified) — `_reconstruct_history` tool-result emit loop now tags `load_skill` results with `_pinned_skill` (in code, gated on `tc.get("name") == "load_skill"`). Disjoint from the Plan 01 D-01 catalog edit near `:1099`.
- `backend/tests/unit/test_context_window.py` (modified) — `_skill_tool` factory + 5 trim-pin tests (survives, atomic pair, de-dupe, LRU evict + marker, never starves recent) AND 3 `_reconstruct_history` pin-tag tests (load_skill tagged + search_documents not, fallback-to-tool_call_id, end-to-end reconstruct→trim) — all in the one existing file.

## Decisions Made

- `PIN_BUDGET_FRACTION = 1/3` multiplies the `max_tokens` already passed into `trim_messages_to_fit` (does NOT re-resolve the budget — per the plan's interfaces note).
- The pin flag value falls back to the `tool_call_id` when `skill_name` is missing from args, so a `load_skill` row is never left unpinned and de-dupe still keys on a stable identifier.
- De-dupe keeps the LATEST group per skill; older duplicates and budget-evicted groups demote back into the trimmable pool (where the normal removal loop may drop them).
- No-pins fast path keeps the function byte-identical for pure-Deep histories — the G-5 regression invariant.

## Deviations from Plan

None — plan executed exactly as written. No bugs, no missing-critical functionality, no blocking issues, no architectural changes. Zero schema migrations, zero new packages (as the plan mandated).

(One TDD-harness calibration during the GREEN phase, NOT a behavior deviation: the initial `max_tokens` budgets in three "survives" tests and the LRU-eviction test were too tight relative to the ~150-token-per-group estimate, so a single legitimately-pinned skill was being correctly evicted by the budget cap. The test budgets were raised to `max_tokens=900` (pin budget 300, comfortably fits one ~150-token pin) and the eviction test was sized so one group fits the budget but two overflow, with non-skill filler added so the demoted least-recent pin is actually trimmed. The pinning BEHAVIOR — survive, dedupe, cap at 1/3, LRU-evict, honest marker — is exactly as specified; only the test fixtures' token arithmetic was calibrated to exercise the intended path.)

## Issues Encountered

None blocking. The eviction-test sizing iterated twice in the GREEN phase (single pin too large for the 1/3 cap at the first budget; then the demoted group not trimmed because the total still fit) — resolved by the harness calibration above. The production logic was correct from the first GREEN implementation; only the test arithmetic needed tuning.

## User Setup Required

None — no external service configuration, no schema migration, no new packages.

## Next Phase Readiness

- CTX-03 is delivered: a loaded skill survives the trim window for the rest of the session, with the safety valve that pinning never starves the recent-message budget.
- **SC#10 cross-provider UAT is MANDATORY** for the trim-pin behavior alongside the Plan 01 D-01 relaxation (no false-fire regression + loaded-skill survival across the 4 axes) — authored in VALIDATION.md as a DEV gate, exercised at phase verification, not a runtime check.
- G-5 hot files (`context_window.py` / `agent_loop.py`) kept minimal and at the seam; the single trim path and the `_reconstruct_history` shape are preserved.

## Verification

- `pytest backend/tests/unit/test_context_window.py` — 36 passed (28 pre-existing + 5 trim-pin + 3 reconstruct-history pin-tag).
- G-5 replay gate `pytest backend/tests/integration/test_075_4_subagent_truncation.py` — 3 passed (reconstruction change does not break replay).
- Task 1 grep gates: `PIN_BUDGET_FRACTION` count 5 (≥2); `^def trim` count 1 (single trim path — D-14); `_TRIM_MARKER` count 5 (≥3, reused for eviction); `json.loads`/`instructions` in the file = 0 (flag-only, never JSON sniff).
- Task 2 grep gates: `_pinned_skill` in agent_loop.py = 1 (≥1), assignment gated on `tc.get("name") == "load_skill"`; flag set from tc metadata only; pin-tag test lives in `test_context_window.py` (not a separate file).

## Self-Check: PASSED

- All 3 modified files exist on disk + the SUMMARY.
- All 3 task commits present in git history (`b14ed398`, `37ad641f`, `16b1e421`).

---
*Phase: 123-skill-triggering-quality*
*Completed: 2026-06-23*
