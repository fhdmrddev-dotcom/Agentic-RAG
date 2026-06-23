---
phase: 123-skill-triggering-quality
plan: 01
subsystem: api
tags: [skills, lint, agent-loop, system-prompt, trigger-tuning, pydantic, fastapi]

# Dependency graph
requires:
  - phase: 119/v3.0 skills core (Phase 10/11)
    provides: skills table CRUD, owner-scoped .or_() reads, load_skill/save_skill tool dispatch, LOAD_SKILL_TOOL
provides:
  - "skill_lint.py — pure, no-LLM, never-raises lint_description() (TRIG-03) returning {code,message} warnings"
  - "LOAD_SKILL_POLICY — shared relaxed D-01 catalog-note policy constant (Pitfall 1 fidelity guard for the Plan 03 Tuner)"
  - "D-01 runtime relaxation: agent_loop.py catalog note now fires load_skill on description match, reconciled with LOAD_SKILL_TOOL"
  - "Lint wired into all three save surfaces (POST /skills, PATCH /skills, agent save_skill) — warn-never-block (D-09/D-10)"
  - "SkillResponse.lint_warnings optional response field"
affects: [123-02 trim-pin (CTX-03), 123-03 tuner builder-knob + classifier (imports LOAD_SKILL_POLICY), 123-04 tuner background job, 123-06 inline lint UI + Tune-this]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure heuristic module mirroring context_window._parse_model_limits — module-level tunable constants + defensive try/except that returns partial results, never raises"
    - "Single-source-of-truth policy constant imported by both the runtime system-prompt assembly and the (future) Tuner classifier — no duplicated policy string"
    - "Warn-never-block save lint: warnings attached to the response/tool-result, the save ALWAYS proceeds"

key-files:
  created:
    - backend/app/services/skill_lint.py
    - backend/tests/unit/test_skill_lint.py
    - backend/tests/unit/test_skill_catalog_note.py
    - backend/tests/integration/test_skills_lint.py
  modified:
    - backend/app/services/agent_loop.py
    - backend/app/api/skills.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/models/skill.py

key-decisions:
  - "LOAD_SKILL_POLICY lives in skill_lint.py (not agent_loop.py) so the Plan 03 Tuner classifier imports ONE source of truth — Pitfall 1 fidelity guard."
  - "MIN=25 / MAX=1024 / NAME_ECHO_RATIO=0.6 defaults from RESEARCH; empty description warns 'empty' only (no double 'too_short')."
  - "Sibling fetch reuses the existing owner-scoped .or_(user_id.eq, is_global.eq.true) filter (T-123-01-02) and excludes the edited skill on PATCH; a read failure degrades to an empty sibling list."
  - "openai_service.py was NOT modified — LOAD_SKILL_TOOL was already D-01-aligned; only confirmed (one story)."

patterns-established:
  - "TRIG-03 lint: deterministic, pure, never-raises; every caller decides (none blocks)."
  - "D-01 reconciliation: the catalog note and LOAD_SKILL_TOOL.description both fire load_skill on intent/description match."

requirements-completed: [TRIG-03, TRIG-01]

# Metrics
duration: 9min
completed: 2026-06-23
---

# Phase 123 Plan 01: Skill-Description Lint + D-01 Runtime Relaxation Summary

**Deterministic warn-never-block `skill_lint.lint_description` (TRIG-03) wired into all three save surfaces, plus the load-bearing D-01 catalog-note relaxation that makes `load_skill` fire on description match — both sharing the single `LOAD_SKILL_POLICY` constant so the Plan 03 Tuner measures the real production policy.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-06-23T17:13:49Z
- **Completed:** 2026-06-23T17:22:31Z
- **Tasks:** 2 (Task 1 TDD)
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments
- `skill_lint.py`: pure, no-LLM, never-raises `lint_description()` returning `{code, message}` warnings across 7 codes (empty / too_short / too_long / name_echo / no_trigger_verb / generic / duplicate); EMPTY list = healthy. Each message names the specific reason — never a generic "weak description".
- `LOAD_SKILL_POLICY`: the relaxed D-01 catalog-note policy as one shared module constant — imported by `agent_loop.py` now and by the Plan 03 Tuner classifier later (Pitfall 1 fidelity guard).
- D-01 live: `agent_loop.py`'s `## Available Skills` note dropped the over-conservative "ONLY call … Never auto-load by similarity" wording and now interpolates `LOAD_SKILL_POLICY` — reconciled with `LOAD_SKILL_TOOL.description`. The owner-scoped catalog query + `catalog_lines` are byte-for-byte preserved.
- Lint wired into all three save surfaces — `POST /skills` (201 + warnings), `PATCH /skills` (200 + warnings), and the agent `save_skill` tool (non-fatal `lint_warnings` in the tool result). The save ALWAYS proceeds (D-09/Pitfall 6).
- `SkillResponse.lint_warnings: list[dict] | None` added.

## Task Commits

1. **Task 1 (TDD RED): failing skill_lint tests** - `abedbc90` (test)
2. **Task 1 (TDD GREEN): skill_lint + LOAD_SKILL_POLICY** - `ef07461d` (feat)
3. **Task 2: D-01 relaxation + lint on all three save surfaces + tests** - `3daaaf84` (feat)

**Plan metadata:** (final docs commit — this SUMMARY, STATE.md, ROADMAP.md, REQUIREMENTS.md, deferred-items.md)

## Files Created/Modified
- `backend/app/services/skill_lint.py` (created) - Pure `lint_description()` + tunable constants + the shared `LOAD_SKILL_POLICY`.
- `backend/app/services/agent_loop.py` (modified) - Imports `LOAD_SKILL_POLICY`; catalog note relaxed (D-01). Owner-scoped query unchanged.
- `backend/app/api/skills.py` (modified) - `_sibling_descriptions` helper + lint in `create_skill`/`update_skill`; owner-scoping preserved.
- `backend/app/services/tool_dispatcher.py` (modified) - `_handle_save_skill` lints, returns non-fatal `lint_warnings`, never blocks.
- `backend/app/models/skill.py` (modified) - `SkillResponse.lint_warnings` optional field.
- `backend/tests/unit/test_skill_lint.py` (created) - 7 codes + healthy-empty + never-raises contract + policy-constant assertion (23 tests).
- `backend/tests/unit/test_skill_catalog_note.py` (created) - Structural reconciliation of the note with `LOAD_SKILL_TOOL`.
- `backend/tests/integration/test_skills_lint.py` (created) - Lint on all three surfaces, all warn-never-block.

## Decisions Made
- Kept `LOAD_SKILL_POLICY` in `skill_lint.py` (not `agent_loop.py`) so the Plan 03 Tuner classifier imports the SAME constant — no duplicate policy string (Pitfall 1).
- Empty descriptions emit only the `empty` code (not also `too_short`) — one length verdict.
- Sibling fetch reuses the existing owner-scoped `.or_()` filter and is wrapped to degrade to `[]` on read failure (lint stays advisory; never blocks the save).
- `openai_service.py` left untouched — `LOAD_SKILL_TOOL` was already D-01-aligned (confirmed one story, no behavior change).

## Deviations from Plan

None - plan executed exactly as written. No bugs, no missing-critical, no blocking issues, no architectural changes.

(One TDD-harness adjustment, not a deviation: the never-raises parametrized test built its "huge input" indirectly via a `case_id` key instead of embedding a 1M-char string in the param id — Windows' `PYTEST_CURRENT_TEST` env var caps at 32767 chars and pytest writes the full param into it. The contract is unchanged: a >>MAX_DESCRIPTION_CHARS input still exercises the long path and must not raise.)

## Issues Encountered
- 11 `test_threads_skills.py` failures surfaced during the Task 2 regression check. **Verified pre-existing** by stashing all 123-01 source changes and re-running — the same 11 fail identically on the base (they are the fragile SSE-on-POST→GET-stream harness tests, unrelated to skill linting). Logged to `deferred-items.md` per the scope boundary; NOT fixed (out of scope). The `TestCatalogInjection` tests assert only the `## Available Skills` header presence, so the D-01 change does not affect their pass/fail.

## User Setup Required
None - no external service configuration, no schema migration, no new packages.

## Next Phase Readiness
- Plan 03 (D-08 builder-knob + tuner classifier) can import `LOAD_SKILL_POLICY` directly to measure the real production firing policy.
- Plan 06 (inline lint UI + "Tune this") can consume `SkillResponse.lint_warnings` and the agent-path `lint_warnings` note.
- **SC#10 cross-provider UAT is MANDATORY** for the D-01 relaxation (no false-fire regression on the 4 axes) — authored in VALIDATION.md as a DEV gate, exercised at phase verification, not a runtime check.

## Verification
- `pytest test_skill_lint.py test_skill_catalog_note.py test_skills_lint.py` — 32 passed.
- G-5 regression `pytest test_context_window.py test_075_4_subagent_truncation.py` — 31 passed (trim path not regressed).
- All task acceptance grep gates pass: `def lint_description|LOAD_SKILL_POLICY` ≥2; purity 0; `ONLY call|Never auto-load` in agent_loop.py = 0; `lint_description` in skills.py + tool_dispatcher.py ≥1 each; `update_skill` owner-scoping intact.

## Self-Check: PASSED

- All 4 created files exist on disk + the SUMMARY.
- All 3 task commits present in git history (`abedbc90`, `ef07461d`, `3daaaf84`).

---
*Phase: 123-skill-triggering-quality*
*Completed: 2026-06-23*
