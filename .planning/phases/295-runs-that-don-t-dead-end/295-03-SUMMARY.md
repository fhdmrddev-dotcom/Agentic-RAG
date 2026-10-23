---
phase: 295-runs-that-don-t-dead-end
plan: 03
subsystem: harness-engine
tags: [durable-pause, ask-user, citations-gate, armed-checkpoint, seed-137, g-5]
requires:
  - "295-01 engine_ask seam (verbatim move, re-export at the end of harness_engine)"
  - "295-05 read wire (get_unanswered_ask_user carries created_at + engine_pause)"
provides:
  - "engine_ask.engine_pause: the durable engine ask (found-nothing citations gate and the armed approval)"
  - "engine_ask.consume_engine_answer: the re-drive consume with an exact-label allow-list"
  - "engine_ask.engine_answer_refusal: the allow-list the answer route uses (HTTP 422)"
  - "grounding.is_engine_citation_gate: the one pure predicate"
  - "run_handoff.phase_scope_ids: pure leaf for the folder re-run override"
  - "db: stash_awaiting_answer; pause_run releases claimed_at; get_ask_user_response returns folder_id"
  - "/pending engine_pause projection; AskUserResponseBody.folder_id"
  - "tests/unit/engine_ask_fakes.World: the in-memory durable world engine-ask suites drive"
affects:
  - backend/app/services/harness_engine.py
  - backend/app/services/harness/phase_types.py
  - backend/app/api/runs.py
  - backend/app/api/panel.py
tech-stack:
  added: []
  patterns:
    - "immediate durable pause: pause_run, stash, prompt row (fail-closed), policy_applied, emit, PhaseOutcome(pause_run)"
    - "single-use resume flag consumed only on a matching stash (the human_input precedent)"
    - "one allow-list shared by the route (422) and the consume step"
key-files:
  created:
    - backend/app/services/harness/run_handoff.py
    - backend/tests/unit/engine_ask_fakes.py
    - backend/tests/unit/test_295_engine_ask_pause.py
    - backend/tests/unit/test_295_found_nothing_choices.py
    - backend/tests/test_295_engine_ask_redrive.py
  modified:
    - backend/app/services/harness/engine_ask.py
    - backend/app/services/harness/grounding.py
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/phase_types.py
    - backend/app/db/workflows.py
    - backend/app/api/runs.py
    - backend/app/api/panel.py
    - backend/tests/unit/test_187_armed_checkpoint_property.py
    - backend/tests/unit/test_185_engine_attachment.py
    - backend/tests/unit/test_ask_user_disposition.py
    - backend/tests/unit/test_214_approval_names_service.py
    - backend/tests/unit/test_295_engine_ask_seam.py
    - backend/tests/unit/test_publish_service.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - backend/tests/unit/test_190_connector_source_fence.py
    - docs/public/api/openapi.snapshot.json
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "An armed answer that is not the exact approve label fails the run (Pattern 5: 'otherwise the shipped decline reason'). A citations answer the allow-list cannot match leaves the run paused."
  - "Continue on a step locked since the pause fails the step with words; it does not stay paused. The answered prompt has a response row, so /pending would show no card, and that is a dead end (D-50)."
  - "The armed approval receipt is written where the approval is used: in the armed checkpoint on the re-drive, after the pre-gates pass again (consequence ≠ receipt). It is not written at consume."
  - "The person's name in a stored reason uses the shared waiting_who chain (lazy import from api/workflow_runs), called without the email. Colleagues can read the reason."
  - "RETIRED keeps its moved-names invariant. The retired in-process armed observables live in a sibling dict, RETIRED_ARMED_ASSERTIONS, which is checked for living tests."
metrics:
  duration: "~4h"
  completed: 2026-10-21
  tasks: 3
  files: 23
---

# Phase 295 Plan 03: The durable engine ask Summary

Engine-owned asks no longer block in-process. This covers the found-nothing / uncited citations gate and the armed action-risk approval. Each one now pauses the run durably with server-built choices and no deadline. A re-drive consumes the answer through an exact-label allow-list: continue (marked `unsourced`), stop (worded, names the person), search another folder (the step re-runs once), approve (the body runs once), or decline. A forged or unoffered answer gets a 422 at the route. It also never proceeds at the consume step.

## Tasks

| Task | Name | RED | GREEN |
|------|------|-----|-------|
| 1 | Durable pause: predicate, choices, folder bound, stash, lease, fail-closed prompt row | `14860e324` | `80fc12e76` |
| 2 | Consume on re-drive, forged-answer refusal, the folder re-run | `97bcc623e` | `5fea3cb72` |
| 3 | Boot sweep, post-Proceed gate (D-48), precedence record (D-08) | `487cb3f83` | `b101092f3` |
| gate | Full-gate fixes (line-pin + OpenAPI snapshot) | | `e9be97a04` |

## TDD gate record

- **Task 1 RED:** 74 failed, 60 passed. Causes: the missing `is_engine_citation_gate`, and `engine_ask` seams that `World.patches` targets (`pause_run`, `stash_awaiting_answer`, `get_active_phase`, `resolve_kb_label`, `permitted_folder_options`). **GREEN:** the nine verify suites gave 233 passed and 22 xfailed (strict, the consume halves). The one failure was the inherited `test_no_twenty_fifth_audit_kind_was_added`.
- **Task 2 RED:** 22 failed, 25 passed. **GREEN:** every `xfail(strict)` was removed and the verify suites gave 308 passed. The one failure was the same inherited one.
- **Task 3 RED:** the sweep pair and the two D-48 cases failed. The D-08 record was already green, because consume landed in Task 2. **GREEN:** 432 passed across the 18 suites named in the plan, with the same one inherited failure.
- No REFACTOR commit.

## Armed-suite rule (assertion lines, `grep -c assert`)

| Suite | Before | After |
|---|---|---|
| `test_187_armed_checkpoint_property.py` | 36 | 36 |
| `test_185_engine_attachment.py` criteria 18/19 block (the 185-04 armed section) | 24 | 24 |
| `test_185_engine_attachment.py` whole file | 101 | 101 |
| `test_214_approval_names_service.py` | 85 | 85 |
| `test_ask_user_disposition.py` | 84 | 87 (+3: one NEW invariant test; nothing deleted) |

No assertion was deleted. Each in-process armed observable was re-pointed to the durable pause. Asked now means a durable prompt row. Answered now means a durable answer consumed on the re-drive. Receipts are counted by kind, because the pause itself writes `policy_applied`. The test once named `test_armed_gate_subscribes_with_no_timeout_at_all` is now `test_armed_gate_pauses_with_no_timeout_at_all`. Every retired shape is named, with its reason citing D-18, in `test_295_engine_ask_seam.py::RETIRED_ARMED_ASSERTIONS`, and a test checks that each named test still exists. `RETIRED["_resolve_failure_with_ask_user"]` records the moved body changing in all three tasks.

## Wire contract as shipped

- **Prompt row `tool_calls[0]`, the `ask_user_prompt` SSE and `/pending`** carry: `prompt` (server-built, UI-SPEC A.2), `options` (fixed order `Search another folder` / `Continue without sources` / `Stop the run`, with absent options removed, never blanked), `timeout_seconds: null`, `draft` (the produced text, citations kinds only), and `engine_pause: {kind: "no_sources"|"no_markers"|"action_risk", phase, continue_allowed, locked, folders: [{id, name, depth}]}`. For `action_risk` the options are the shipped armed pair and `folders` is `[]`.
- **These labels match the 295-06 card byte for byte**, as `enginePause.ts` on develop @ `b78b8d14b` keys them: `ENGINE_CHOICE_SEARCH = "Search another folder"`, `ENGINE_CHOICE_CONTINUE = "Continue without sources"`, `ENGINE_CHOICE_STOP = "Stop the run"`. Neither side needs to change.
- **Answer body:** `AskUserResponseBody {tool_call_id, response_text, choice_index?, folder_id?}`. The persisted response row adds `folder_id`. `get_ask_user_response` returns `{response_text, choice_index, folder_id}`.
- **422 words:** `That choice is not one this question offers.` · `That folder is not one this question offers.` · `This step is set to Must prove it, so it can't continue without sources.`
- **Stored output on continue:** the produced output unchanged, plus `unsourced: {continued_by: <user id str>, at: <ISO-8601>}`. Plan 05 maps the id to words.
- **Stash:** `workflow_phases.output._awaiting_answer = {tool_call_id, kind, phase, options, continue_allowed, locked, folder_option_ids, folder_names, produced_output, finding, failed_idx, stop_reason}`.
- **Audit:** `policy_applied {policy: "engine_ask_pause", phase, finding}`. This is an existing kind, so there is no migration and no new audit kind.

## Reasons (server words)

- Golden run, found nothing: `Searched {folder} and found nothing for “{step}” during the trial run, so it was stopped. Add documents to that folder, or point the step at a folder that has them.`
- Only Stop would remain: `{finding sentence} No other folder is available to search, and this step is set to Must prove it, so the run stopped.`
- Stop: `Searched {folder} and found nothing for “{step}”. Stopped by {name}.` For 0 markers: `“{step}” answered without citing its sources. Stopped by {name}.`
- Armed decline: `{name} chose not to run “{step}”, so the run stopped.` Any other answer: `“{step}” was not run: the answer did not match the approval option, so the run stopped.` Neither carries the armed prompt sentence (D-42).
- Prompt row or stash failure (fail-closed): `“{step}” needed your answer. The run could not keep this question for you, so it stopped here.`

## G-5 record

Triples (commits / phases / lines) and branch counts were measured with `ast.walk`. The base is `ea1347c4d`; "after" is `e9be97a04`.

| File | Triple before → after | `If` | `IfExp` | defs |
|---|---|---|---|---|
| `harness_engine.py` | 63/26/2897 → 65/26/2926 | 83 → 86 | 33 → 34 | 25 → 25 |
| ↳ `_run_phase_with_gates` | 550 → 561 L | 14 → 15 (+1: the ONE consume call) | 7 → 7 | |
| ↳ `resume_stranded_workflows` | 187 → 202 L | 11 → 13 (+2: the ONE sweep arm, plus its answered half after the ctx build) | 2 → 3 | |
| `harness/phase_types.py` | 57/29/3050 → 58/30/3052 | 113 → 113 | 20 → 20 | 55 → 55 |
| `harness/grounding.py` | 22/9/1417 → 23/10/1437 | 24 → 24 | 6 → 6 | 19 → 20 (+1: `is_engine_citation_gate`) |
| `harness/engine_ask.py` | 1/1/599 → 4/1/1338 | 24 → 77 | 5 → 15 | 6 → 28 |
| ↳ `_resolve_failure_with_ask_user` | 328 → 373 L | 14 → 17 | 4 → 4 | |
| `db/workflows.py` | 55/29/2773 → 57/29/2802 | 32 → 32 | 9 → 9 | 38 → 39 (+1: `stash_awaiting_answer`) |
| `api/runs.py` | 45/20/1845 → 46/21/1893 | 54 → 56 | 29 → 32 | 11 → 12 (+1: `_engine_answer_refusal`) |
| ↳ `submit_ask_user_response` | 208 → 221 L | 6 → 7 | 3 → 4 | |
| `api/panel.py` | 5/4/282 → 6/5/285 | 6 → 6 | 6 → 6 | 5 → 5 |
| `harness/run_handoff.py` (new) | — → 1/1/25 | 0 | 1 | 1 |

`api/panel.py` was re-derived BEFORE the edit at 5/4/282. Its buckets are 085, 093, 096 and 163, so G-5 fires, and it had no row in either document. Its scan-list row, its section in `docs/HOT-FILE-LEDGER.md` and a CLAUDE.md FIRING row all landed in `80fc12e76`. `node scripts/check-claude-md-size.cjs` exits 0. Plan 07 owns the ledger rows for the new `engine_ask.py` and `run_handoff.py`.

## Backend unit gate (failing-id SET diff)

Command: `cd backend && venv/Scripts/python -m pytest tests/unit -q --continue-on-collection-errors -p no:cacheprovider -rf`. IDs were extracted with `grep ^FAILED | sed | sort -u` and compared with `comm`.

- **Base `ea1347c4d`:** 70 failed, 8522 passed, 1 skipped, 2 xfailed, 2 xpassed (70 ids).
- **After `b101092f3`:** 72 failed, 8578 passed (72 ids). `comm -13` (new) showed four ids. Two were real: `test_190_connector_source_fence::test_no_vendor_module_enters_the_import_graph_until_a_send_happens` (a line pin, 119 → 121) and `test_276_openapi_snapshot_fresh` (the snapshot lacked `folder_id`). Both were fixed in `e9be97a04` and are now green (10 passed). The other two (`test_explorer_agent…uses_explorer_prompt`, `test_streaming_reliability…is_sync`) are log-text-glued twins of ids that fail in both sets. They appear in `comm -23` with the glue on the other side.
- **Net new failing ids versus base: 0.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3: blocking] Consume-dependent re-pointed halves were `xfail(strict)` through Task 1.**
- The plan's Task 1 lists the decline and no-answer consume behaviours, but consume lands in Task 2. So every re-pointed assertion that needs consume (P2 ×8, P3, and seven armed tests in `test_ask_user_disposition`, three ledger tests in `test_214`, plus three in the pause suite) carried `xfail(strict=True, reason="consume lands in 295-03 Task 2")`. Task 2 removed all of them and they pass.

**2. [Rule 3] A shared test world.**
- `backend/tests/unit/engine_ask_fakes.py` (not in `files_modified`) models the durable half once, so four suites can re-point to the same pause and re-drive. The `decision_engine_fakes.py` precedent applies.

**3. [Rule 3] Suites outside the file list that the change broke.**
- `test_publish_service.py`'s live armed drives were re-pointed. "Reached the ask" now means a subscribe OR a durable prompt row. No assertion line changed.
- `test_256_finish_run_unchanged.py` positions were re-derived. The counts stayed identical; only positions shifted: harness_engine +13, runs.py +35.
- `test_190_connector_source_fence.py`: the importer line was re-pinned at 121.
- The OpenAPI snapshot was regenerated.

**4. [Rule 2] Lock re-checked at consume ends the step with words, not a pause.** See decisions. Leaving the run paused would leave it with no answerable card.

**5. The `RETIRED` dict's own invariant.** `set(RETIRED) <= set(MOVED)` stops test names going into it, so retired test assertions live in `RETIRED_ARMED_ASSERTIONS`, which a test checks.

## Deferred Issues

- **The boot sweep's resume finalizer expires prompts even when the re-drive paused again.** `resume_stranded_workflows` calls `_expire_pending_ask_user` on every exit path of a re-drive it ran. If an answered engine ask is re-driven by the sweep and the step pauses again (search another folder finds nothing), the sweep expires the NEW prompt. The same is already true for a re-driven human step. The answer-route re-drive (`_wake`) does not do this, so the normal path is safe. The fix belongs in `_resume_run` / the sweep finalizer, which is D-41 territory (plan 295-04): skip the expiry when the run reads `paused`. I did not fix it here because the plan allows exactly ONE sweep arm. **Re-open trigger:** plan 295-04's `_resume_run` terminalize.
- On a re-drive that consumes an armed approval, the armed block writes a second `action_risk_pending` row before the helper uses the approval. The block's call site must stay byte-identical, so this is recorded rather than changed.
- These are still inherited and were not run (they hang at base): `test_096_ci_workflow_regression`, `test_harness_gates::test_caps_step_and_wall_clock`, and the `test_harness_templates` end-to-end tests. `test_200::test_no_twenty_fifth_audit_kind_was_added` and `test_120::test_phase_types_ask_user_prompt_tags_harness` were red at base too.
- I did not run `graphify update .`, because it writes `graphify-out/` inside a parallel worktree. The orchestrator should run it after the merge.

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: input-validation | backend/app/api/runs.py | The answer route now loads the prompt row through the service-role pool, scoped by thread, tool_call_id and run_id after the owner-scoped, anchor-confirmed resolution. It refuses unoffered answers with 422 before persisting (T-295-03-01/-02, mitigated). |

## Self-Check: PASSED

- FOUND: backend/app/services/harness/run_handoff.py, backend/tests/unit/engine_ask_fakes.py, backend/tests/unit/test_295_engine_ask_pause.py, backend/tests/unit/test_295_found_nothing_choices.py, backend/tests/test_295_engine_ask_redrive.py
- FOUND commits: 14860e324, 80fc12e76, 97bcc623e, 5fea3cb72, 487cb3f83, b101092f3, e9be97a04
- Acceptance greps: `def is_engine_citation_gate` 1; grounding `+def` 1; `on_failure="fail_run"` 2 = base 2; `claimed_at = NULL` 1 inside pause_run; engine_ask `subscribe_for_response` 3 = 295-01's 3; `"engine_pause": payload.get("engine_pause")` 1; `consume_engine_answer(` in harness_engine 1; `phase_scope_ids(ctx, phase)` in phase_types 1; run_handoff has no `from app` / `import app`; `_awaiting_answer` appears in harness_engine (the sweep arm).
