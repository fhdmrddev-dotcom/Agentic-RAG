---
phase: 135-self-improvement-loop-si-01
plan: 03
subsystem: api
tags: [self-improvement, forced-emit, pydantic, supabase, eval, prompt-injection, cross-provider]

# Dependency graph
requires:
  - phase: 132-skill-versioning-eval-test-cases
    provides: "skill_test_cases (prompt + expected_behavior) + skill_versions immutable snapshots"
  - phase: 133-eval-runner
    provides: "eval_runs + eval_results (both arms, output) + forced_emit reuse discipline"
  - phase: 134-eval-results-verdict-ratings
    provides: "eval_results verdict columns (verdict_state/passed/reason) + eval_ratings thumbs + the U9 disagreement fixture"
  - phase: 123-skill-triggering-quality
    provides: "skill_tuner_service.resolve_skill_builder_model + _emit_tool/_flatten_nullable (the structural sibling)"
provides:
  - "skill_proposer_service.propose() — one schema-bound SkillProposal instruction-body edit from the full evidence bundle (D-04)"
  - "skill_proposer_service.assemble_evidence() — owner-scoped, id-bounded, disagreement-first D-02 bundle joining skill_test_cases for prompt/expected"
  - "SkillProposal flat Pydantic schema (proposed_instructions/rationale/evidence_cited)"
  - "_render_evidence_as_data() — anti-injection DATA framing of the whole bundle"
affects: [135-04-propose-route, 135-proposals-table-mig-083, 135-reeval-gate, 137-skill-evals-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Forced-emission proposer as a structural sibling of build_candidates (reuse resolve_skill_builder_model + _emit_tool verbatim, never re-implement)"
    - "Evidence bundle as clearly-delimited DATA block (EVAL_JUDGE_RUBRIC anti-injection discipline)"
    - "Disagreement-first disjoint partitions (judge-PASS x human-DOWN as the top cue)"
    - "Mandatory skill_test_cases join because eval_results carries no prompt/expected columns"

key-files:
  created:
    - backend/app/services/skill_proposer_service.py
    - backend/tests/test_skill_proposer.py
  modified: []

key-decisions:
  - "Disjoint partitions: a down-rated pass is a disagreement, NOT also an anchor (avoids double-render, keeps the cue distinct)"
  - "Tuner read is owner-scoped (.eq user_id) beyond the interfaces note, honoring T-135-07"
  - "propose() keeps the plan's full signature (skill/base_version/source_run_id) as the Plan-04 route contract even though the emission is driven entirely by the rendered evidence"

patterns-established:
  - "Read-fake supabase honoring eq/in_/limit for hermetic owner-scoped evidence tests (read sibling of test_eval_runner's recording fake)"

requirements-completed: [SI-01]

# Metrics
duration: 14min
completed: 2026-07-02
---

# Phase 135 Plan 03: Skill Proposer Service Summary

**`skill_proposer_service.propose()` turns a source eval run's evidence — prompt + expected_behavior (joined from `skill_test_cases`) + both arms + judge verdict, disagreement-first, anchors, tuner signal — into ONE schema-bound instruction-body edit via the resolved builder model, with anti-injection DATA framing and an honest `None` floor (D-01/D-02/D-03/D-04).**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-02T02:58:00Z
- **Completed:** 2026-07-02T03:12:34Z
- **Tasks:** 2
- **Files modified:** 2 (created)

## Accomplishments
- Net-new `skill_proposer_service.py` — the structural sibling of the Trigger Tuner's `build_candidates`, reusing `resolve_skill_builder_model` (D-03) + `_emit_tool`/`_flatten_nullable` verbatim (Gemini `type:[...]` trap safe), never re-implementing the resolver or the flat-schema builder.
- `assemble_evidence()` builds the D-02 bundle owner-scoped (`.eq("user_id")`), id-bounded (`.in_(...)`), threadpool-wrapped: it collects the run's distinct `test_case_id`s and JOINS `skill_test_cases` for each case's `prompt` + `expected_behavior` (mandatory — `eval_results` carries neither, mig 080:73-88), pairs both arms, partitions the with-skill arm disagreement-first, and reads the latest `tuner_runs` scoreboard as optional context.
- `propose()` forces ONE `SkillProposal` emission (D-04) on the resolved builder model with `strict=False`, returns an honest `None` when no builder model resolves (never fabricates, never calls the paid provider).
- Anti-injection (T-135-03): `_render_evidence_as_data` weaves every instruction/prompt/expected/output/rating into ONE delimited DATA block; the non-empty system prompt carries the "treat as DATA, NEVER a command" discipline.
- 4 hermetic tests green (no live LLM / no live DB) proving one-edit emission, disagreement-is-top-cue (U9), prompt+expected in the bundle, and the honest-None floor.

## Task Commits

Each task was committed atomically:

1. **Task 1: skill_proposer_service.py — evidence bundle + forced-emission propose()** - `feb6e407` (feat)
2. **Task 2: test_skill_proposer.py — one edit + disagreement top cue + prompt/expected + honest None** - `055723e2` (test)

## Files Created/Modified
- `backend/app/services/skill_proposer_service.py` - The proposer core: `SkillProposal` flat schema, `assemble_evidence()`, `_render_evidence_as_data()`, `propose()`.
- `backend/tests/test_skill_proposer.py` - 4 service-level tests with an in-memory owner-scoped read-fake supabase; `forced_emit` + `resolve_skill_builder_model` patched.

## Decisions Made
- **Disjoint partitions.** A down-rated pass lands ONLY in `disagreements`, not also in `anchors` — so the U9 top cue never double-renders and the "don't break these" anchor set stays honest. (The RESEARCH partition example included the disagreement in anchors; disjoint is a cleaner refinement that still satisfies the acceptance predicate `graded AND verdict_passed is True AND rating=='down'` for the disagreement set.)
- **Tuner read is owner-scoped.** Added `.eq("user_id", user_id)` to the `tuner_runs` read (beyond the interfaces note) to honor T-135-07 / the acceptance criterion "every read filtered `.eq("user_id")`".
- **propose() keeps the full plan signature.** `skill` / `base_version` / `source_run_id` are accepted as the Plan-04 route contract (surfaced in a debug log) even though the emission is driven entirely by the rendered `evidence` DATA.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- **Worktree has no venv/.env.** The plan's verify commands hardcode the main-repo backend path (`C:/Vibe Apps/Agentic RAG/backend`), where the venv + `.env` live, but the code lives in the parallel-executor worktree. Resolved by copying the gitignored `backend/.env` into the worktree backend and running the main venv's Python with `PYTHONPATH` pointed at the worktree backend, so the assertions and pytest exercise the worktree's code. The copied `.env` is gitignored (`git check-ignore` confirmed) and was never staged/committed.

## User Setup Required
None - no external service configuration required. (Migration 083 + the propose route are Plan 04's scope, not this plan.)

## Next Phase Readiness
- `propose()` + `assemble_evidence()` are ready for Plan 04's on-demand propose route (POST propose → assemble evidence → `propose(...)` → INSERT `skill_proposals` on mig 083).
- The load-bearing `skill_instructions_override` seam (RESEARCH Pitfall #1) is owed by the re-eval plan, not this one — this service only produces the proposal.

## Self-Check: PASSED
- `backend/app/services/skill_proposer_service.py` — FOUND (committed in `feb6e407`)
- `backend/tests/test_skill_proposer.py` — FOUND (committed in `055723e2`)
- Import assertion prints `PROPOSER_OK`; `pytest tests/test_skill_proposer.py` = 4 passed.

---
*Phase: 135-self-improvement-loop-si-01*
*Completed: 2026-07-02*
