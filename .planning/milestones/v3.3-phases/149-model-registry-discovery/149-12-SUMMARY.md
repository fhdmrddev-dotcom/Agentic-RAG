---
phase: 149-model-registry-discovery
plan: 12
subsystem: api
tags: [suggestions, reasoning, think-strip, minimax, compat-path, cross-provider]

# Dependency graph
requires:
  - phase: 149-model-registry-discovery (plan 09/10)
    provides: the D-149-10 disabled-model fallback path that served the Test-7 reply via MiniMax (a compat-path reasoning model), surfacing the leak
provides:
  - "_strip_think_blocks applied to the non-streaming suggestion completion so reasoning <think> markup never reaches the follow-up chips"
  - "Regression suite locking the MiniMax-style leak, the byte-identical no-think path, the unclosed-trailing-think case, and strip-before-clamp ordering"
affects: [suggestion_service, cross-provider reasoning handling, threads title path (shared _strip_think_blocks sibling)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reasoning <think> stripping applied at the non-streaming service boundary (the streaming chat path already separates reasoning via the compat adapter's state machine; the suggestion call bypassed it)"

key-files:
  created:
    - backend/tests/test_149_suggestion_strip.py
  modified:
    - backend/app/services/suggestion_service.py

key-decisions:
  - "Module-private copy of _strip_think_blocks in suggestion_service.py (verbatim from app.api.threads sibling) rather than importing — avoids an api→service layering inversion + a heavy import of a G-5 hot file; shared-util de-dup noted as a future candidate in the docstring"
  - "Strip runs BEFORE content.split so a think line never becomes a chip nor fills the 3-item clamp"
  - "Scope kept to <think> markup only (the non-tool suggestion call emits no DSML tool markup); same helper is the extension point if DSML residue ever appears"

patterns-established:
  - "Non-streaming provider completions that feed UI must strip reasoning markup the streaming adapter would otherwise have separated"

requirements-completed: [MODEL-02]

# Metrics
duration: ~12min
completed: 2026-07-13
---

# Phase 149 Plan 12: Suggestion Think-Strip Summary

**Follow-up suggestion chips now strip `<think>` reasoning blocks (closed + unclosed-trailing) before the line-parse, so compat-path reasoning models (MiniMax/DeepSeek/GLM) can no longer leak chain-of-thought into clickable chips — round-2 UAT Test 7 gap closed.**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-07-13
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Root-caused and closed the Test-7 leak: `suggestion_service.generate_suggestions` parsed the raw completion line-by-line with no reasoning stripping, so each `<think>` line became a question chip and pushed the real questions past the 3-item clamp.
- Added a module-private `_strip_think_blocks` (verbatim from the `threads.py` title-path sibling) applied to `content` immediately after it is read and BEFORE `content.split("\n")`.
- Left the NotFoundError fallback-retry block, model resolution, and token_param logic untouched — the strip happens after both `create()` paths have set `content`.
- Regression suite locks all four behaviors from the plan (A leak, B byte-identical, C unclosed-trailing, D strip-before-clamp).

## Task Commits

TDD task — two atomic commits (test → feat):

1. **Task 1 (RED): add failing tests for suggestion think-strip** - `a85eb20a` (test)
2. **Task 1 (GREEN): strip `<think>` blocks before suggestion line-parse** - `01b92536` (feat)

No REFACTOR commit — the implementation is minimal and clean as written.

## Files Created/Modified
- `backend/app/services/suggestion_service.py` - Added `_strip_think_blocks(text)` (closed-block while-loop + unclosed-trailing removal) mirroring the `app.api.threads` sibling; applied it to the completion `content` before the split/clamp.
- `backend/tests/test_149_suggestion_strip.py` - 4 tests: A (MiniMax-style inline `<think>` stripped → only clean questions), B (no-think byte-identical), C (unclosed trailing `<think>` stripped from tail), D (strip runs before clamp-to-3 so real questions survive).

## Verification

- `cd backend && venv/Scripts/python -m pytest tests/test_149_suggestion_strip.py -q` → **4 passed**.
- Full suggestion suite (`tests/test_149_suggestion_strip.py` + `tests/unit/test_suggestions.py`) → **12 passed, 0 failed** (no regression to the existing 8 suggestion tests).
- RED phase confirmed the 3 feature-adding tests (A, C, D) failed before the fix; B passed throughout as the byte-identical no-regression guard.
- Live confirmation folds into the `149-HUMAN-UAT.md` row 7 re-run (a MiniMax-served reply's follow-up chips are clean questions, no `<think>`).

## Decisions Made
- **Copy, not import, `_strip_think_blocks`:** importing from `app.api.threads` would invert the api→service layering and heavily import a G-5 hot file. A module-private copy with a docstring note (shared-util de-dup = future candidate) was the plan's directive and is honored.
- **Strip precedes the clamp:** applied to `content` before `content.split("\n")`, so reasoning lines never occupy slots in `questions[:3]`.
- **`<think>`-only scope:** the non-tool suggestion call emits no DSML tool markup, so the fix targets `<think>` blocks; the helper is the documented extension point if DSML residue ever surfaces.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Threat Model Coverage
- **T-149-12-01 (Information Disclosure)** — mitigated: `<think>` reasoning blocks stripped before the completion is rendered into chips, so chain-of-thought never leaks into user-visible chips (Tests A, C, D).
- **T-149-12-02 (Tampering / no-think regression)** — mitigated: Test B locks byte-identical output for completions without think markup.

No new security-relevant surface introduced (no new endpoints, auth paths, file access, or schema changes).

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Suggestion chips are clean regardless of which model served the reply; the D-149-10 fallback path (Test 7) minor gap is closed at the code level.
- Pending: live re-run of `149-HUMAN-UAT.md` row 7 (confirm MiniMax-served reply's chips are clean) as part of `/gsd:verify-work 149`, then `/gsd:secure-phase 149`.

## Self-Check: PASSED
- FOUND: `backend/app/services/suggestion_service.py` (`_strip_think_blocks` present + wired before the split)
- FOUND: `backend/tests/test_149_suggestion_strip.py`
- FOUND commit: `a85eb20a` (test RED)
- FOUND commit: `01b92536` (feat GREEN)

---
*Phase: 149-model-registry-discovery*
*Completed: 2026-07-13*
