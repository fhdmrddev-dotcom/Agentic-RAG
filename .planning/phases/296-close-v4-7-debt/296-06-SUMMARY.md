---
phase: 296-close-v4-7-debt
plan: 06
subsystem: inbound + API keys, kickoff, provider routing, chat markup, wire typing
tags: [kickoff, inbound, api-keys, moonshot, provider-routing, harness, agent-loop, openapi, pytest]
requires:
  - phase: 296-01
    provides: create_draft org stamp in api/workflows.py (this plan adds one except arm in delete_draft)
  - phase: 296-02
    provides: "create_workflow_run(provider=) keyword (this plan passes it from the in-app kickoff)"
  - phase: 296-03
    provides: "auto_answered {phase: None} stand-in note; could_not_generate:provider_error"
  - phase: 296-07
    provides: "splitTemplateBind strips unplaced_sentences before definition.assets[]"
provides:
  - "inbound_inputs.missing_required: ONE required-input predicate for in-app kickoffs and key calls (287-T01)"
  - "preflight_workflow_kickoff refuses a missing required input with a worded 422 before any write"
  - "in-app kickoff records its provider on the run (SEED-362 kickoff half)"
  - "needs_task key state / picker reason / refusal; create_key names only picker-offered workflows (293-IN-06)"
  - "file link consumed only after the per-key limiter (293-IN-01); 413 body cap (293-IN-03); quiet re-revoke (293-IN-08)"
  - "provider_gateway/schema_moonshot.py: inline_refs + moonshot_tools, applied only on a moonshot ENDPOINT (BUG-261024-01)"
  - "schedule + golden kickoffs fold declared answers via launch_kickoff (291-S6-F8)"
  - "emit step pinned to another provider's model routes there; agent step's swapped pin is told (293-F-4)"
  - "typed wire: RunEvidenceConfidence on run reads, AutoAnsweredNote, TemplateAssetRef.unplaced_sentences"
affects: [296-05 (seeds: cross-provider sub-agent routing; live D-21 roster; vitest count gate), deploy (public OpenAPI regenerated)]
tech-stack:
  added: []
  patterns:
    - "Body cap from Content-Length in a router route_class, before FastAPI reads the body"
    - "Peek-then-consume for single-use Redis tokens (GET, checks + limiter, then GET+DEL MULTI and compare)"
    - "Provider-specific schema transform as a pure leaf keyed on the ENDPOINT provider; identity for ref-free input"
key-files:
  created:
    - backend/app/services/provider_gateway/schema_moonshot.py
    - backend/tests/unit/test_296_kickoff_and_keys.py
    - backend/tests/unit/test_296_step_inputs_and_routing.py
    - backend/tests/unit/test_296_moonshot_schema.py
    - backend/tests/unit/test_296_chat_and_wire.py
  modified:
    - backend/app/services/inbound_inputs.py
    - backend/app/services/workflow_kickoff.py
    - backend/app/api/threads.py
    - backend/app/api/inbound.py
    - backend/app/api/api_keys.py
    - backend/app/db/api_keys.py
    - backend/app/models/api_key.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness/form_inputs.py
    - backend/app/services/provider_gateway/openai_compat.py
    - backend/app/services/scheduler_service.py
    - backend/app/services/harness/publish_service.py
    - backend/app/services/text_tool_calls.py
    - backend/app/services/agent_loop.py
    - backend/app/services/eval_runner_service.py
    - backend/app/services/tools/sandbox.py
    - backend/app/services/harness/phase_confidence.py
    - backend/app/api/workflow_runs.py
    - backend/app/api/workflow_run_evidence.py
    - backend/app/api/workflow_wire.py
    - backend/app/api/workflow_authoring_doors.py
    - backend/app/api/workflows.py
    - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
    - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
    - frontend/src/lib/api/apiKeys.ts
    - backend/tests/fixtures/phase293/launch_fields_cases.json
    - backend/tests/fixtures/phase286/workflows_openapi.json
    - backend/tests/fixtures/phase286/workflows_moved_ast.json
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "287-T01's guard lives in preflight_workflow_kickoff (before the user-message INSERT), not at threads.py's create_workflow_run call, which runs after the message and runs rows exist"
  - "needs_task = a workflow with no declared launch field (the browser's kickoff_prompt fallback); checked after the unknown-key refusal"
  - "293-F-4 agent path: measured silent swap (cross-provider AND same-provider: the owner's llm_model outranks the pin); fixed with a worded notice only; routing is a seed for 296-05 (D-03)"
  - "BUG-261024-04: lead 2 reproduced and fixed with one condition in tools/sandbox.py; lead 1 did not reproduce"
  - "293-DEL arm is in delete_draft (DELETE /workflows/{id}), not delete_workflow_cascade (which deletes runs first)"
  - "RunEvidenceConfidence moved verbatim to phase_confidence.py to avoid an import cycle; re-exported from workflow_run_evidence"
requirements-completed: []
duration: ~62min
completed: 2026-10-26
---

# Phase 296 Plan 06: inbound, providers and wire (W2b) Summary

**A launch is now refused or started on the server's word. A pinned model runs where it was pinned, or the step says where it ran instead. Moonshot gets ref-free tool schemas while every other provider's bytes stay the same. No answer preview or raw tool markup reaches the logs or the chat.**

## Performance

- **Base sha:** `4cfb79f87` (develop, with 296-01, 296-02, 296-03, 296-04 and 296-07 merged)
- **Started:** 2026-10-26T20:21Z
- **Completed:** 2026-10-26T21:25Z
- **Tasks:** 3 of 3. Each was committed RED first, then fixed.
- **Commits:** 8 task commits, plus the SUMMARY commit
- **Diff vs base:** 45 files, +2225 / −111. Source alone: 27 files, +437 / −52.

## What changed, per row (RED evidence → verdict)

| Row | RED evidence (failing before the fix) | Verdict / fix |
|---|---|---|
| 287-T01 | `missing_required` absent; preflight returned the definition with `recipient` blank | **Fixed.** `inbound_inputs.missing_required` is the one predicate, and `validate_inbound_inputs` calls it. `preflight_workflow_kickoff` raises `422 Missing required input(s): recipient.` before any write. Parity is pinned by 5 new `expected_missing` cases in `launch_fields_cases.json`, read by both suites (the frontend twin now asserts `missingRequiredFields` too). |
| SEED-362 (kickoff) | `create_workflow_run` kwargs had no `provider` (`KeyError`) | **Fixed.** One kwarg, `provider=_resolved_provider`, in `threads.py`. |
| 293-IN-01 | a 429 and a 503 both deleted the token | **Fixed.** The route reads the token without consuming it, runs the live checks and the per-key limiter, then consumes it with the same MULTI. If another request consumed it first, the answer is the same 404. |
| 293-IN-03 | no constant; an oversize non-JSON body was parsed | **Fixed.** `INBOUND_MAX_BODY_BYTES = 50 × (8000 × 6 + 256) + 1024 = 2,413,824` bytes. A `_BodyCapRoute` answers `413 This request is too large: send at most 2357 KB of inputs.` from `Content-Length`, before the body is read. |
| 293-IN-06 | picker and create allowed a field-less workflow and a global | **Fixed.** A field-less workflow reads `needs_task` in `_ref_state`, in the picker, in `create_key` (`{name} starts from a typed task, which a key can't send yet.`) and on an inbound start (`needs_task`). `create_key` also refuses any workflow the picker does not offer, globals included. The UI-SPEC F strings are in `apiKeysCopy.ts` and are mapped in `apiKeyFacts.ts`. |
| 293-IN-08 | two `api_key.revoke` rows for two revokes | **Fixed.** `revoke_key` returns `revoked_now` from the UPDATE's status tag. Both routes audit only when it is true. |
| 291-S6-F8 (a) in-app | GREEN at base | **Already fixed by 293-05** (`launch_kickoff`). The test is the evidence. |
| 291-S6-F8 (b) key | GREEN at base | **Already fixed by 293-05** (`inbound_kickoff`, inside the untrusted envelope). The test is the evidence. |
| 291-S6-F8 (c) schedule | `topic: Lisbon` appeared 0 times | **Fixed** in `scheduler_service.py`: the kickoff goes through `launch_kickoff`. With no declared answers it is byte-identical. |
| 291-S6-F8 (d) golden | the stand-in appeared 0 times | **Fixed** in `publish_service.py`: one statement after `golden_run_inputs`. |
| 293-F-4 emit | provider `deepseek` for a step pinned to `gpt-5.6-luna` | **Fixed.** One precedence expression: a pinned step goes to `_provider_for_model(model, ctx)`. An unpinned step keeps the run's provider. |
| 293-F-4 agent (measured) | `_resolve_sub_agent_effective_model` returned `deepseek-v4-pro` for a `gpt-5.6-luna` pin, and also `gpt-5.5` for a same-provider pin (the owner's `llm_model` outranks the pin) | **Notice added; routing NOT built (D-03).** One helper and one call in `phase_types._exec_llm_agent`. They emit one `model_fallback` sub-step and one `policy_applied` row: `This step asked for {model}, which runs on another provider, so it ran on {used} instead.` (same provider: `…, but it ran on {used}.`). **The seed is owed to 296-05:** cross-provider sub-agent routing, plus honouring a same-provider pin, which changes Deep's `task()` resolver as well. |
| 291-IN-01 | 3 forced calls with no KB evidence | **Fixed.** One guard: the retry needs `retrieved_ids - input_ids` to be non-empty. |
| 291-IN-06 | an optional blank kept the model's invented value | **Fixed.** An optional `user` input left blank is overlaid as an explicit null, and no id is minted for it. |
| BUG-261024-01 | module missing; Moonshot endpoint got `$ref`s | **Fixed at the adapter (unit-proven; live row ⛔ suspended).** The new leaf `schema_moonshot.py` provides `inline_refs` and `moonshot_tools`. `openai_compat` has one conditional on `request.retries_provider() == "moonshot"`. Identity holds over `get_tools()` and for the openai, deepseek and zhipu endpoints. `jsonschema` gives the same verdicts on 3 valid and 3 invalid definitions. A cycle is refused with `ValueError`. No `jsonref`. |
| 292.1-IN-01 | `detect_markup` returned None after an unclosed fence | **Fixed.** An unclosed fence now ends at a DSML opener that starts a line. A closed fence is unchanged. |
| 292.1-IN-02 | log `preview='No matches…'`; notice never streamed | **Fixed.** The log carries the length and the sha256 only. The notice is sent as a `delta` before the save. |
| 292.1-IN-04 | `EVAL_MAX_TOOL_ROUNDS` absent | **Fixed.** `EVAL_MAX_TOOL_ROUNDS = 15` (`ROUND_CAP_DEFAULTS["general"]`, today's effective default). It is applied on a `model_copy` of the eval settings, so the owner's object is untouched. |
| BUG-261024-04 lead 2 | iteration 2's re-seed overwrote a.pdf's meta with `url: None` | **Reproduced and fixed** with one condition in `tools/sandbox.py`: the baseline seed never overwrites a hash this run already recorded. |
| BUG-261024-04 lead 1 | GREEN at base | **Did not reproduce.** Turn 2 lists only the regenerated `a.pdf` (new hash). The unchanged `b.png` is excluded by the baseline. The live verdict is G-4 scenario 8 (296-05). |
| 289-IN-07 | `confidence` schema was `{type: object}` | **Fixed.** An optional `RunEvidenceConfidence`. |
| 288-IN-01 | `auto_answered.items` was `{}` | **Fixed.** `list[AutoAnsweredNote]`, typed as `{phase: str \| None, message: str}`. |
| 291-IN-03 | `TemplateAssetRef` had no `unplaced_sentences` | **Fixed.** A partial placement returns its sentences. A full placement returns `[]`. The none-placed 422 is unchanged. |
| 293-DEL | `ForeignKeyViolationError` propagated (the 500) | **Fixed.** `delete_draft` returns 409 with the UI-SPEC E sentence and never sends the constraint text. |

## Commits

| Hash | Message |
|---|---|
| `710cf99b4` | test(296-06): add failing tests for kickoff required inputs, kickoff provider and key fixes |
| `04618f10e` | fix(296-06): server-side required inputs, kickoff provider, inbound and key fixes |
| `fab31d6a8` | test(296-06): add failing tests for first-step answers, pinned-model routing, citation retry and Moonshot schemas |
| `c2a8f6ace` | fix(296-06): first-step launch answers, pinned-model routing, citation retry, Moonshot schemas |
| `847a00dcc` | test(296-06): add failing tests for chat markup, eval cap, follow-up files, wire typing and delete 409 |
| `0ad717a67` | fix(296-06): chat markup and notice, eval round cap, follow-up file metas, wire typing, delete 409 |
| `4ffe3fdbd` | test(296-06): reconcile three pins the plan-end gate named, each with its reason |
| `f318d2b69` | fix(296-06): keep the 293-DEL sentence's key phrase on one source line |

## Deviations from Plan

1. **[Rule 1] The 287-T01 guard is in `preflight_workflow_kickoff`, not at `threads.py`'s `create_workflow_run` call.**
   - That call runs after the user-message INSERT and the runs row. A guard there would leave both behind, which contradicts the behaviour ("no thread message row is written").
   - `send_message` calls the preflight before any write.
   - Result: `grep -c missing_required threads.py` is **0**, not the plan's 2. `threads.py` got only the SEED-362 kwarg.
2. **[Rule 1] The 293-DEL arm is in `delete_draft`, not `delete_workflow_cascade`.**
   - The measured 500 was `DELETE /workflows/{id}`, which is `delete_draft`.
   - The cascade deletes runs first and cannot hit this FK.
3. **[Rule 3] Kickoff fixes went into two FIRING files outside `files_modified`:**
   - `scheduler_service.py` (S6-F8 c) and `publish_service.py` (S6-F8 d): the plan said to fix each failing path at its own kickoff build.
   - No phase_types helper was needed.
4. **[Rule 3] `RunEvidenceConfidence` moved verbatim to `phase_confidence.py`.**
   - `workflow_runs.py` cannot import it from `workflow_run_evidence.py`, which imports `workflow_runs` at load (a cycle).
   - It is re-exported under the old path.
   - It has no docstring, so the OpenAPI component is byte-identical.
5. **[Rule 3] Frontend files touched outside the list, for 293-IN-06:**
   - `apiKeyFacts.ts` (the reader for the new strings) and `lib/api/apiKeys.ts` (the state union).
   - `launchFieldsTwin293.test.ts` now asserts `missingRequiredFields` over the new parity cases ("both suites pin parity").
6. **[Rule 3] Test harness changes:**
   - `phase293_inbound_fakes.FakeRedis.get`: the peek.
   - The 293 route fake reports `revoked_now`.
   - Two `test_293_api_keys_routes` tests created keys for `WF_GLOBAL` and now use a second own workflow. Reason: `create_key` refuses globals.
7. **[Rule 1] Pins reconciled at the plan-end gate**, each with its reason written in the test (the D-206-07 precedent):
   - `test_193`: the bind response carries `unplaced_sentences`, split off as the Builder does.
   - `test_256`: the `finish_run` call site moved +10 in `api/workflows.py`. Counts identical.
   - `test_278`: `_handle_execute_code` retired by name, because of the deliberate lead-2 edit.
   - `test_286`: the fixtures were re-baselined with a written paragraph. A first capture was discarded because a docstring leaked plan ids into the public schema.
8. **[Rule 1] The agent-pin notice helper was hardened.** `test_retrieval_failure_honesty` passed a MagicMock config. The helper now acts only on a `str` pin and never raises.
9. **[Rule 2] Scope widening, now told rather than silent:** the agent-path notice also fires on a same-provider pin that does not run.
   - The measurement showed that the owner's `llm_model` outranks it.
   - Honouring the pin is owed to the 296-05 seed.
10. **`sub_agent_models.py` was NOT touched.** Its row and section were still added (D-26), because the ledger gate names it from `files_modified`.
11. **`task_service.py` was NOT touched.** The notice lives in `phase_types.py`, where the `model_fallback` and `policy_applied` mechanism lives.

## G-5 record

Ledger triples, each re-derived in the same commit as its touch. Each file has a section under `## Phase 296-06 touches (2026-10-26)` in `docs/HOT-FILE-LEDGER.md`.

| File | Triple |
|---|---|
| `api/threads.py` (⛔) | `283/95/2745`. One kwarg. |
| `workflow_kickoff.py` | `13/10/602`. One guard and one import name. |
| `harness/phase_types.py` (G-5 OWED) | `66/33/3135`. Three touches: one precedence expression, one retry guard, one helper plus one call. |
| `agent_loop.py` (⛔) | `78/36/3782`. One log argument and one emit, inside the existing `if`. |
| `provider_gateway/openai_compat.py` | `10/7/468`. One conditional and one import. |
| `api/workflow_runs.py` ("extraction FIRST") | `21/15/1445`. One import name and one annotation. |
| `api/workflow_wire.py` | `4/4/532`. One model and one field. |
| `api/workflows.py` (split OWED) | `50/26/1699`. One except arm, then a re-flow of the same sentence. |
| `scheduler_service.py` | `12/7/314` |
| `publish_service.py` | `36/16/2061` |
| `eval_runner_service.py` | `14/9/1056` |
| `workflow_run_evidence.py` | `6/4/405` |
| `workflow_authoring_doors.py` | `5/3/797`. **Now FIRES**, and a CLAUDE.md row was added. |
| Young files | `inbound_inputs` 7/2/306, `inbound` 8/2/701, `api_keys` 3/2/421, `db/api_keys` 5/2/307, `models/api_key` 2/2/117, `form_inputs` 4/2/109, `text_tool_calls` 6/2/693, `tools/sandbox` 2/2/1223, `phase_confidence` 2/2/167, the three frontend files |
| **New rows** | `schema_moonshot.py` 1/1/97 (young). `sub_agent_models.py` 5/3/263: **FIRES**, absent its entire life, not touched. |

## Guardrail overrides for STATE.md

> Phase 296-06. Measured, not forecast:
>
> 1. **`api/workflow_runs.py` ("extraction FIRST next")** — an audited one-touch, as the plan required: `confidence: RunEvidenceConfidence | None` plus one import name. No def, no branch. The extraction is still owed.
> 2. **`harness/phase_types.py` (G-5 OWED)** — three touches where the plan forecast "one precedence expression, plus a guard only if needed":
>    - the 293-F-4 precedence expression;
>    - the 291-IN-01 retry guard;
>    - for the 293-F-4 agent notice, one new async helper `_note_pinned_model_not_run` (def +1, If +4 inside it) and one call. The helper was hardened after the gate (`isinstance` and `try`).
>
>    The seam is still not taken.
> 3. **`services/scheduler_service.py` and `harness/publish_service.py` (both FIRE)** — touched OUTSIDE `files_modified`, one kickoff expression each, for 291-S6-F8.
> 4. **`api/workflow_authoring_doors.py`** — crossed the G-5 threshold with this phase (3 phases).
> 5. **`services/tools/sandbox.py`** — `test_278_pure_move`'s AST fence on `_handle_execute_code` was retired by name for the lead-2 condition (SEED-177: retired deliberately, with the reason in the dict).

## OpenAPI / snapshot re-baseline reason

These rows changed response schemas, and they are deliberate:

- 288-IN-01: `PublishVerdict.auto_answered` items became `AutoAnsweredNote`.
- 291-IN-03: `TemplateAssetRef.unplaced_sentences` was added.
- 289-IN-07: `WorkflowRunPhaseRead.confidence` now references `RunEvidenceConfidence`.
- 293-IN-06: the `needs_task` enum value was added.

The files regenerated:

- `backend/tests/fixtures/phase286/workflows_openapi.json`: +35 / −1.
- `workflows_moved_ast.json`: +3 / −3, from the `PublishVerdict`, `TemplateAssetRef` and `upload_workflow_template` bodies.
- `docs/public/api/openapi.snapshot.json` and `openapi.public.json`: +37 / −4 each.
- `node scripts/build-public-openapi.cjs --check` reports OK.

## Gate evidence (HEAD vs base)

**Backend unit gate** (`node scripts/check-backend-unit-baseline.cjs`, no arguments, under the local-DB noclobber lock, which was released afterwards):

- **First HEAD run: 74 failed.** The 4 new failures were all pins of this plan's own deliberate edits (test_193 ×2, test_256, test_278), reconciled in `4ffe3fdbd`.
- **Final HEAD run (`4ffe3fdbd`): `70 failed, 10076 passed, 1 skipped, 2 xfailed, 2 xpassed` — `[GATE PASSED] failed: 70 <= 71, errors: 0`.**
- The final failing set is identical, id for id, to the first run minus those 4.
- Per-file counts match 296-02's recorded final set exactly:
  - retrieval_service 15, sql_service 12, explorer_agent 6, multimodal_query 5, 111_1 4;
  - sandbox_service 3, lifespan 3, db_runs 3;
  - module7 2, extraction 2, cross_worker 2, threadpool_sweep 2;
  - 1 each: streaming, published_ownership, phase56, per_format, get_model_capability, forced_emit, chat_tool_approval, 200_1 (`test_this_plan_wrote_no_migration`, a known inherited failure), 190, 075_4, 061.
- **Base subset check:** the 23 failing files were run against an archive of `4cfb79f87` (`git archive`, scratch). Every HEAD id also failed at base except the 2 `test_cross_worker_cancellation` ids. Those pass in isolation at HEAD (28 passed), so they are order-dependent. 296-02 recorded them in both its HEAD set and its base set.

**Targeted suites:** all green apart from failures that also fail at base:

- the 4 `test_296_*` files (79 tests);
- `test_293_*`, `test_295_template_lint`, `test_268_send_path_stamp`, `test_256_llm_emit_rollup`, `test_291_*`, `test_llm_emit_executor`, `test_workflow_scheduler`, `test_2921_*`, `test_289_*`, `test_120`, `test_244`, `test_286`, `test_276`, `test_193`, `test_278`, `test_256_finish_run_unchanged`, `tests/test_095_final_output_tag.py`, `test_075_4_dedup_supersedes`.

Inherited failures outside `tests/unit`, not caused by this plan:

- `tests/test_dual_mode_wiring.py`: 21 fail, because of stale fakes (for example `_fake_stream() got an unexpected keyword 'usage_box'`). 296-02 recorded the same.
- `tests/test_182_canvas_gate.py::test_openapi_tracks_the_flag_in_both_directions_in_one_process`: fails on 293's `RunOriginWire`, not this plan.

**Frontend:**

- `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/settings/apiKeys src/components/workflows/__tests__/launchFieldsTwin293.test.ts`: 9 files, all passed.
- `npx tsc -p tsconfig.app.json --noEmit`: the 62 errors at HEAD are the **identical set** to base (the 5 frontend files were checked out at base, the typecheck run, and the files restored).

**Other gates:**

- `node scripts/check-hot-file-ledger.cjs .planning/phases/296-close-v4-7-debt` passes, including the new rows for `schema_moonshot.py` and `sub_agent_models.py`.
- `node scripts/check-claude-md-size.cjs` passes.
- `grep -rn jsonref backend/app backend/requirements*.txt` finds nothing.

## Threat model

| Threat | Status | Pinned by |
|---|---|---|
| T-296-27 | Mitigated | the preflight 422 test |
| T-296-28 | Mitigated | the 413 test: a non-JSON oversize body is refused before parsing |
| T-296-29 | Mitigated | the 429/503 leave-token tests |
| T-296-30 | Mitigated | the create refusals for `needs_task` and globals |
| T-296-31 | Mitigated | the single audit row on re-revoke |
| T-296-32 | Mitigated | the key path still uses only the untrusted envelope, test (b) |
| T-296-33 | Mitigated | no preview in the log |
| T-296-34 | Mitigated | the endpoint-keyed identity tests |
| T-296-35 | Mitigated | the constraint text is never on the wire |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: dos-residual | backend/app/api/inbound.py | The body cap reads `Content-Length`. A chunked body with no length is not capped by the app; the onebox nginx bounds it. |

## Known Stubs

None.

## Deferred / for the orchestrator

- **Seed owed to 296-05:** cross-provider sub-agent routing for agent steps, and honouring a same-provider pin, which `resolve_sub_agent_model_safely` lets `llm_model` outrank. Evidence: `test_f4_measure_the_agent_step_resolver_swaps_a_cross_provider_pin_silently`, and the measured same-provider swap (`gpt-5.6-luna` pin → `gpt-5.5`).
- **D-21 live roster** for BUG-261024-01, 292.1-IN-01/02, S6-F8 and 293-F-4 runs in 296-05. The Moonshot row is ⛔ because the account is suspended.
- **Hung process from 296-02** is still running: PID 94388 (about 31 GB) and its launcher 101060. Not this plan's.

## Self-Check: PASSED

- The created files exist: `schema_moonshot.py` and the 4 `test_296_*` files.
- All 8 task commits were found in `git log`.
- No tracked file was deleted (`git diff --diff-filter=D 4cfb79f87 HEAD` is empty).
- STATE.md and ROADMAP.md were not modified.
