---
phase: 288-drafts-that-survive-pauses-that-publish
plan: 04
subsystem: live-proof-and-close-out
tags: [AUTH-03, AUTH-01, G-4, SC10, gates]
requirements: [AUTH-03, AUTH-01]
key-files:
  created:
    - .planning/phases/288-drafts-that-survive-pauses-that-publish/288-VALIDATION.md
    - .planning/phases/288-drafts-that-survive-pauses-that-publish/288-UAT.md
    - .planning/phases/288-drafts-that-survive-pauses-that-publish/evidence/ (6 screenshots)
  modified:
    - scripts/vitest-count-gate.cjs
    - backend/tests/unit/test_182_validate.py
    - backend/tests/unit/test_286_workflows_seam_pins.py
    - backend/tests/fixtures/phase286/workflows_openapi.json
    - backend/tests/fixtures/phase286/workflows_moved_ast.json
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/seeds/SEED-183-*.md
    - .planning/seeds/SEED-164-*.md
commits: [062b5c21e, b0bc01acb]
metrics:
  completed: 2026-10-19
---

# Phase 288 Plan 04: Live proof and close-out Summary

The four success criteria were driven against the live local stack: no cross-draft bleed (S2, not reproduced), a draft that keeps name, decisions and node config across a library round trip and a hard reload (S1, one arm blocked on billing), unbounded pause waits refused RED-then-GREEN while 300 and 1800 publish (S4), and a run that says who it waits on and says it again after reload (S3). The drive also found four defects around the new line; none comes from lines this phase added, none was fixed, and no gap round was opened.

## Gates (re-derived, never quoted)

| Gate | Result |
|---|---|
| Backend `pytest tests/unit -q --continue-on-collection-errors` | First run **74 failed**, 7783 passed: over the ceiling. Established at base (`266e344c9`, a worktree, same 74 ids re-run): 69 of them fail at base too; **3 were new at 288** (`test_276_openapi_snapshot_fresh`, two `test_286_workflows_seam_pins`), 2 were flaky (`test_111_1_reembed_kickoff`, `test_cross_worker_cancellation` passed on re-run). Fixed the 3 (below). Final run: **70 failed, 7787 passed, 1 skipped, 2 xfailed, 2 xpassed, 0 collection errors**: under the 71 ceiling. |
| Outside `tests/unit` | `test_288_waiting_on`, `test_188_workflow_run_read`, `test_288_pause_lint`, `test_187_armed_checkpoint_property`, `test_185_engine_attachment`: green. `test_200_human_gate_pause::test_no_twenty_fifth_audit_kind_was_added` (25 != 24), `test_182_canvas_gate::test_openapi_tracks_the_flag...`, `test_182_extraction_parity::test_nl_gen_regression_test_count_unchanged`: **red at base too, inherited**, untouched. |
| Vitest count gate (`GSD_VITEST_MAX_WORKERS=2`, root) | Run 1: `count gate OK 461/461, no per-file decrease, 0 failing`, total 10627 vs pinned 9799. After adoption, run 2: **`count gate OK 463/463`, failed 0**, total 10633 vs pinned 9901. Per-file deltas read from the gate's own table: WorkflowRunPage 148 -> 177 (+29), canvas 128 -> 154 (+26), PublishGauntlet 83 -> 91 (+8), DraftArrivalCard 35 -> 61 (+26, includes growth that was never pinned), decisionsVocabulary 22 -> 24 (+2), facts 5 -> 6 (+1), WaitingOnLine new 4, WorkflowBuilderPage.draftSettings new 6 (also added to TARGETS: `src/pages` is file-level). Other suites the gate showed ahead of their pins (e.g. DecisionsList +19, PhaseNodeCard +22) were left alone: not touched by 288. |
| Frontend typecheck `tsc -p tsconfig.app.json` | Error files at head compared with an earlier base listing: no file with errors at head that was not already in it, and none of the 28 files with errors is one of the 29 files this phase changed. (A fresh base typecheck was not re-run; the set is by file, not by line.) |
| Ledger / CLAUDE.md size | `check-hot-file-ledger.cjs` on the phase dir: OK (577 rows, 30 subject files, 13 watched). `check-claude-md-size.cjs`: 96,088 chars, 64.1% of limit, OK. Plans 01-03 had already merged into `develop`, so there were no doc conflicts to resolve. `git diff --ignore-space-at-eol --numstat 266e344c9 HEAD -- builderStore.ts` is empty (store untouched, A-01). `check-seeds-register.cjs`: OK after the two seed edits. |

### The 3 new-at-288 failures, and the one inherited suspect

- OpenAPI snapshot (`docs/public/api/openapi.snapshot.json`, `.public.json`) regenerated with `export-openapi.py` + `build-public-openapi.cjs`: +112 lines, 0 deletions (the two additive fields).
- `test_286_workflows_seam_pins`: the `PublishVerdict` field `auto_answered` changes the /workflows OpenAPI sub-document and the class's AST hash. Re-captured the fixture with `PIN286_CAPTURE=1` for that field only (diff checked to exactly +5 lines and one hash; the routes fixture byte-unchanged and not committed), reason written into the test docstring. This is a deliberate retirement, not a bless-whatever.
- `tests/unit/test_182_validate.py::test_interactive_phase_verdict_is_incomplete_and_per_node`: **inherited, not caused by 288** (fails at `266e344c9`; it expected 200.3's removed blanket refusal). Re-pointed at the shapes still refused (an `ask_user` validator, a 0-second pause) plus a legal pause that must not be refused. 24 passed with the 286 pins.

## Scenario results

See `288-VALIDATION.md` for the evidence per row. In one line each:

- **S2 no bleed: PASS, not reproduced** (A/B/A, B/A/B, save in flight, hard reload, DB cross-check). The plan 01 unit pin is not what this rests on.
- **S1: PASS** on the persistence arm (`decision-name-input` 0 -> 1; name and node text survive library round trip and a hard reload). **Blocked:** the generate-then-dismiss arm, because the authoring model resolves to `claude-opus-4-8` and Anthropic returns "credit balance is too low".
- **S4: PASS, RED then GREEN.** Base backend: 0 / -5 / 99999 / 1801 all `ok:true`, 0 findings. Head: all four refused with one named finding stating the 30-minute range, by `/validate`, by `POST /workflows/{id}/publish` (`blocked_stage: interactive_phase`) and in the Builder UI (Publish disabled with the sentence). 300 and 1800 published through the gauntlet.
- **S3: PASS in the window** (published, run, `Waiting on fhdmrd@gmail.com (you) to answer "Approve the release?".`, same after hard reload, answered in the UI, run completed). **After the window it fails** (F-1, F-3).

## Roster (SC#10)

8 native/OpenRouter rows: OpenAI gpt-5.6-sol, Google gemini-3.5-flash, DeepSeek deepseek-v4-pro, Zhipu glm-5.2, MiniMax MiniMax-M3, Moonshot kimi-k2.6, OpenRouter z-ai/glm-5.2 **PASS**; **Anthropic claude-opus-4-8 BLOCKED** (billing, re-tested directly, not assumed). Multi-tool, parallel-thread and long-message rows PASS (all on deepseek-v4-pro). Full table with evidence in `288-VALIDATION.md`.

## Findings (live, not fixed)

| # | Finding | Where | Size |
|---|---|---|---|
| F-1 | After the answer window the run-surface card reads "EXPIRED - No response within 0:30 - agent stopped" with **no answer control**, directly beside the new server line "Still waiting ...; the run continues as soon as they answer". The two contradict, and D-11's "never says expired about a run that will resume" is violated by a surface this phase did not touch. | `PendingAskCard.tsx:576` | one hot file; needs a decision about what a paused ask shows |
| F-2 | The independent judge blocks the planted pause workflow most of the time (UI: 3 of 4 attempts; API: 3 of 4). Its stated reasons read as if the human's mock answer were the only user turn ("User only replied 'Yes.' with no task context"). Publishing a pause workflow is possible but unreliable. Possibly worth a SEED: the judge is shown the mock answer, not the golden input. | `publish_service.py` judge input | separate phase |
| F-3 | Answering a **paused** run (`POST /runs/{id}/ask_user_response`, 200) sets the run `active` and the `approve` phase `active`, and it never completes (reproduced twice; the first is still `active` after 17 minutes). The re-drive path (`_redrive_paused_workflow_run`, `_resume_run`, the `human_input.py` durable-answer consume) was **not touched by 288**; not re-run at base. This makes the new line's promise untrue for a paused run. Lead: `_build_resume_context` / the `ctx.pool` and `ctx.resume_answered_tool_call_id` hand-off. | `api/runs.py`, `services/harness/human_input.py` | serious; own phase |
| F-4 | On a successful publish the host runs `onGauntletPublished` -> `setPageView("library")`, which unmounts the gauntlet in the same tick, so the verdict block (including plan 02's `auto_answered` note and the existing `golden-no-send` line) is **never visible to the author on the success path**. The field is on the wire (`auto_answered: [{phase, message: "A pause step was answered automatically during validation and has not been exercised by a person."}]`, verified over HTTP) but D-07's "the publish verdict says" is not met in the UI. One mount decision in `WorkflowsPage.tsx`; not a <= 10-line fix because it needs a design call about where the note lives after the modal closes. | `WorkflowsPage.tsx:812` | small phase / quick |

Minor: `waiting_on.step_name` is `null` for a phase with no `name` (the sentence falls back to the prompt line); `auto_answered` OpenAPI items are untyped (`items: {}`); after completion the run band still read "Running" 3 s after the DB said `completed` (poll cadence); first click on `builder-back` was swallowed once while a save was in flight.

## A-06 note for the operator (resolved autonomously)

A non-owner viewer sees the owner's display name if one exists, never the email, with `prompt_line` withheld and no "(you)"; the owner viewer sees the email only when no display name exists. This is the pinned text of A-06 as written in 288-03 and was covered by backend unit tests; no second account was available to drive it live. The lint message exposes the 30-minute ceiling (A-03), confirmed live.

## Deviations from Plan

1. **[Tooling] Chrome tools unavailable:** the plan asked for claude-in-chrome; this executor had no browser tools, so the drives used headless Chromium via the repo's Playwright with the documented local dev login. Same live app, DOM and DB assertions; screenshots in `evidence/`.
2. **[Rule 1 - Bug, inherited] `test_182_validate` re-pointed** (see above); the plan named it as a suspect to resolve either way.
3. **[Rule 3 - Blocking] OpenAPI snapshot and 286 pins re-baselined** for the two additive fields; without this the baseline gate sat at 74, over the ceiling.
4. **[Rule 3] S1 generation arm and the Anthropic row recorded blocked** (billing), not dropped.
5. **No merge step:** plans 01-03 were already merged into `develop`, so there were no CLAUDE.md / ledger conflicts to resolve and no ledger edit was needed in this plan (the gates pass).
6. **ROADMAP:** plan checkboxes ticked and the progress row set to 4/4, human_needed (the plan said verify-only).
7. **S1 planted draft:** because generation was blocked, S1's persistence arm ran on an API-planted draft.

## Known Stubs

None.

## Threat Flags

None new. T-288-12 held (no Supabase MCP call; local PostgREST reads and local cleanup only). T-288-13 held (every figure above is from this session's own runs, inherited-vs-new established at the base commit). T-288-14 held (no env value or key is written anywhere; provider key presence was read as a boolean only).

## Self-Check: PASSED

Commits `062b5c21e` and `b0bc01acb` exist on `develop`; `288-VALIDATION.md`, `288-UAT.md` and `evidence/` exist. Local DB diff after cleanup: 0 new / 0 missing across six tables.
