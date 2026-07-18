---
phase: 142-non-python-skill-script-honesty-stretch
plan: 04
subsystem: api
tags: [sandbox, tool-schema, execute_code, cross-provider, honesty, python-only]

# Dependency graph
requires:
  - phase: 120
    provides: "off the COLL-01 injection seam — honesty layer builds beside it, not on the shared system prompt"
provides:
  - "Proactive capability facts on EXECUTE_CODE_TOOL.description (D-04/D-05a): the model is told BEFORE it plans a call that the sandbox is Python-only, what IS pre-installed, and which runtimes are NOT available / cannot be installed (Node/npm/npx, LibreOffice soffice, pandoc, Poppler pdftoppm, markitdown, bundled scripts/office/*) plus a do-not-shell-out instruction"
  - "Single-source, D-14-safe delivery: the fact lives on the tool CONTRACT string (get_tools) translated uniformly by every provider gateway (OpenAI/Anthropic/Google), NOT on SYSTEM_PROMPT — Deep Mode stays byte-identical"
  - "test_execute_code_capability_facts unit assertion pinning the NOT-available tokens + an available library + a do-not/will-fail instruction, asserted against the tool description only (never SYSTEM_PROMPT)"
affects: [142-02, 142-03, 142-05, SRH-01, execute_code, provider-gateway]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capability declaration on the tool contract string (single source → all provider gateways), NOT on the shared system prompt — the D-14-safe home for cross-provider model-facing facts"
    - "Declaration-only honesty (D-02): describe the existing Python-only reality; add no runtime capability (sandbox_service.py / Dockerfile.sandbox untouched)"

key-files:
  created: []
  modified:
    - "backend/app/services/openai_service.py — EXECUTE_CODE_TOOL.description extended with the generic capability facts (single additive concatenation)"
    - "backend/tests/unit/test_sandbox_tools.py — added test_execute_code_capability_facts"

key-decisions:
  - "Facts placed on EXECUTE_CODE_TOOL.description (single source, get_tools) and explicitly NOT on SYSTEM_PROMPT — preserves the D-14 byte-identical Deep invariant while reaching every provider uniformly"
  - "Declaration only (D-02): no capability added; sandbox_service.py:41 lang-hardcode + Dockerfile.sandbox left untouched"
  - "Authored em-dash rendered as ASCII double-hyphen in the Python source string for encoding safety; the do-not-shell-out meaning is preserved verbatim"

patterns-established:
  - "Proactive half of the honesty gate lives on the tool contract; the reactive backstop (Plan 02) catches what slips through"

requirements-completed: [SRH-01]  # NOTE: SRH-01 is a phase-level requirement spanning plans 01–05; this plan delivers the proactive tool-description half only. Not marked complete in REQUIREMENTS.md until the phase closes.

# Metrics
duration: ~5min
completed: 2026-07-08
---

# Phase 142 Plan 04: Proactive execute_code Capability Facts Summary

**Extended EXECUTE_CODE_TOOL.description so every provider's model knows, before it plans a call, that the sandbox is Python-only — naming the pre-installed libraries and the NOT-available/uninstallable runtimes (Node/npm/npx, soffice, pandoc, pdftoppm, markitdown, scripts/office/*) with a do-not-shell-out instruction — delivered on the single-source tool contract, not SYSTEM_PROMPT.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-08T00:37:16Z
- **Completed:** 2026-07-08T00:42Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added the proactive layer of the SRH-01 honesty gate (D-04/D-05a) — the capability facts that prevent the first dead call (the pptx → soffice/markitdown loop class documented in BUG-260707-02).
- Kept the fact on the tool CONTRACT (get_tools single source, uniformly translated by the OpenAI/Anthropic/Google gateways) — one additive edit reaches all providers with zero fork (D-14-safe).
- Declaration-only (D-02): no runtime capability added; `sandbox_service.py` and `Dockerfile.sandbox` untouched, `SYSTEM_PROMPT` (agent_loop.py) byte-identical.
- Pinned the behavior with `test_execute_code_capability_facts` (RED → GREEN), asserting the NOT-available tokens + an available library + a do-not/will-fail phrase, against the tool description only.

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: Assert the capability facts in test_sandbox_tools.py** - `9f0588d1` (test — RED)
2. **Task 2: Append the capability facts to EXECUTE_CODE_TOOL.description** - `37213e94` (feat — GREEN)

**Plan metadata:** (final docs commit — this SUMMARY + state)

## Files Created/Modified
- `backend/app/services/openai_service.py` - EXECUTE_CODE_TOOL.description extended with the generic Python-only capability facts (single concatenation onto the existing string; no new field).
- `backend/tests/unit/test_sandbox_tools.py` - Added module-level `test_execute_code_capability_facts` (5/5 file tests green).

## Decisions Made
- **Placement on the tool contract, not SYSTEM_PROMPT** — the facts must reach every provider uniformly without forking the shared path; the single-source `get_tools()` feed to each gateway is the D-14-safe home. The test deliberately asserts against the description only and never SYSTEM_PROMPT.
- **Declaration only (D-02)** — the description DECLARES the existing Python-only reality; no capability is added. `sandbox_service.py:41` (language hardcode) and `Dockerfile.sandbox` were not touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Cosmetic — verbatim reproduction] Authored em-dash rendered as ASCII double-hyphen**
- **Found during:** Task 2 (description edit)
- **Issue:** The `<authored_content>` block uses a Unicode em-dash ("do NOT — they will fail"). Embedding a non-ASCII glyph directly in the Python source string is an avoidable encoding risk on Windows.
- **Fix:** Rendered the dash as an ASCII double-hyphen ("do NOT -- they will fail"). Meaning and all load-bearing tokens are preserved; the plan's test asserts only on `do not` / `will fail`, both present.
- **Files modified:** backend/app/services/openai_service.py
- **Verification:** `test_execute_code_capability_facts` + full `test_sandbox_tools.py` green (5/5).
- **Committed in:** `37213e94` (Task 2 commit)

---

**Total deviations:** 1 (cosmetic ASCII-safety render of a dash — no semantic change)
**Impact on plan:** None on behavior or acceptance criteria. No scope creep.

## Issues Encountered
None — plan executed as written. Working tree for the two target files was clean at start; net change set = exactly `openai_service.py` + `test_sandbox_tools.py` (verified via `git diff --name-only 9f0588d1~1 37213e94`).

## Threat Model Compliance
- **T-142-D14 (Tampering / shared-path fork) — mitigated.** The capability facts live only on the single-source `EXECUTE_CODE_TOOL` contract (uniformly translated by every gateway), explicitly NOT on `SYSTEM_PROMPT`. Verified: the diff touches only the tool description; `agent_loop.py` / `sandbox_service.py` / `Dockerfile.sandbox` have empty `git status` (untouched). The D-14 byte-identical Deep invariant is preserved.
- No untrusted input, no new read/write authority, no package-manager install — no additional STRIDE surface introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Proactive half of SRH-01 is live for all providers. Plan 02's reactive reshape + per-run repeat-guard backstops what slips past the description; Plan 03 handles read_skill_file decode + load_skill flag; Plan 05 handles the import-time note + SkillsPage render.
- SRH-01 (phase-level requirement) is NOT yet complete — it closes when plans 02/03/05 land. Requirement not marked complete in REQUIREMENTS.md by this plan; left for phase completion.
- No blockers.

## Self-Check: PASSED
- FOUND: backend/app/services/openai_service.py
- FOUND: backend/tests/unit/test_sandbox_tools.py
- FOUND commit: 9f0588d1 (Task 1, test)
- FOUND commit: 37213e94 (Task 2, feat)

---
*Phase: 142-non-python-skill-script-honesty-stretch*
*Completed: 2026-07-08*
