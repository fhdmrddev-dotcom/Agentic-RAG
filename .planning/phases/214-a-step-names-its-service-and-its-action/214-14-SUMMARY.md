---
phase: 214-a-step-names-its-service-and-its-action
plan: 14
subsystem: governance-flags + cross-plan seam verification
tags: [feature-visibility, cold-default, seam-audit, integration-tests, D-214-19]
requires:
  - "214-01 args.py: resolve_arguments / unsatisfiable_arguments / schema_for_bound_tool"
  - "214-02 the _failure_reason wire and both serializers"
  - "214-05 reachability LINT_CODES + publish_service tool-schema builder"
  - "214-06 grounding._approval_sentence + the engine's armed branch"
  - "214-16 the launcher-inputs integration suite (cited, not re-implemented)"
provides:
  - "visual_workflow_canvas cold-reads `everyone` (D-214-19); live_connectors stays `off`"
  - "docs/OPERATOR.md Step-3 governed-feature cold-default table"
  - "backend/tests/unit/test_214_flag_cold_default.py — 13 cases, nothing seeded"
  - "backend/tests/integration/test_214_argument_seams.py — 20 cases, neither side mocked"
  - "the DERIVED seam list, with seven unowned path files named"
affects:
  - "every deployment: a fresh install now shows the canvas layer without an operator flip"
  - "seven test suites whose `when off` assertions silently inverted"
tech-stack:
  added: []
  patterns:
    - "a cold-default test that seeds NOTHING (the assertion Phase 209 did not have)"
    - "route bodies called as ordinary async functions against real rows + real PostgREST"
    - "an AST self-check that fails if a function under test appears inside a patch("
    - "assembled needles — a scan that cannot count its own prose (187-24)"
key-files:
  created:
    - backend/tests/unit/test_214_flag_cold_default.py
    - backend/tests/integration/test_214_argument_seams.py
    - .planning/phases/214-a-step-names-its-service-and-its-action/214-14-deferred-items.md
  modified:
    - backend/app/models/user_settings.py
    - docs/OPERATOR.md
    - backend/tests/test_148_effective_features.py
    - backend/tests/test_181_flip_on.py
    - backend/tests/test_181_off_audience.py
    - backend/tests/test_182_canvas_gate.py
    - backend/tests/test_182_grounding_bundle.py
    - backend/tests/test_188_workflow_run_read.py
    - backend/tests/test_revert_byte_identical.py
    - backend/tests/unit/test_182_canvas_auth.py
decisions:
  - "D-214-19 honoured on ONE key: visual_workflow_canvas -> everyone, live_connectors untouched"
  - "The OPERATOR.md parity is asserted by a unit test because check-deploy-drift.sh structurally cannot see feature_visibility (grep = 0)"
  - "A seed failure in the seam suite RAISES rather than skips — five unproven seams once read as a green line"
  - "S-7's raw-code-on-screen finding is REPORTED with a named owner, not absorbed here"
metrics:
  duration: ~3h
  completed: 2026-08-28
---

# Phase 214 Plan 14: The Cold Default and the Cross-Plan Seams — Summary

The canvas flag now cold-reads `everyone` with nothing seeded, and the phase's cross-plan seams
are proven by twenty cases that mock neither side — including the chat-panel transport half that
`BUG-260826-05` actually lives in, and the schema-provenance half `S-2` is structurally blind to.

---

## Task 1 — the flag, flipped against its COLD default

`_GOVERNED_FEATURES` (`backend/app/models/user_settings.py:1192`) — `"visual_workflow_canvas"`
went `"off"` → `"everyone"`. `"live_connectors"` did **not** move. Both comments were rewritten:
they were near-copies, and the flip made adjacency a liar, so each now carries its own reason.

**The cold-read fixture seeds nothing, and that is the whole point.** Two independent shapes of
"nothing stored" are driven:

| fixture | shape | why it is the honest one |
|---|---|---|
| `unseeded_settings` | `SimpleNamespace(feature_visibility={})` | a fresh `app_settings` row after OPERATOR.md Step 3 item 3, before anyone opens `/admin` |
| `cold_cache` | `load_app_settings` **raises** | a DB blip / cold cache — `_feature_record` swallows it and yields `{}` |

Neither writes a row. `test_no_case_in_this_file_seeds_the_flag` reads the module's own source,
strips docstrings and comments, and fails if `set_feature_visibility`, `get_pg_pool`,
`INSERT INTO` or `UPDATE app_settings` appears in the **code**. ⚠ Every needle is **assembled**
(`"set_feature_" + "visibility"`) — spelled whole, the list would be an occurrence and the check
would fail against itself. The stripper carries a did-something control, also assembled, because
spelling the control phrase whole put it in the code and the control failed on the first run.

⚠ **One real asymmetry was found and pinned rather than papered over.**
`resolve_feature_access` does **not** consult `_GOVERNED_FEATURES` — it reads the stored record
and fail-closes to `False` when there is none. So on a fresh box the canvas is granted by
`require_canvas`'s `audience == "everyone"` branch (`dependencies.py:687`), never by
`resolve_feature_access`. A case asserting `resolve_feature_access(...) is True` cold would fail
for a reason unrelated to this flip, and "fixing" it by seeding a row is Phase 209's mistake in
different clothes.

### RED-driven, all four guards, files restored md5-identical

| planted defect | cases that went RED |
|---|---|
| `"visual_workflow_canvas": "off"` restored | 4 (`..._on_a_fresh_unseeded_row`, `..._when_the_settings_read_fails`, `..._read_by_feature_audience_not_resolve...`, `..._in_the_authoritative_dict`) |
| OPERATOR.md row drifts `everyone` → `operators` | 2 (the parity case and its positive control) |
| a 7th governed key appears with no decision | 2 (the six-key set, and the parity case) |

### ⚠ The deployment-artifact obligation is enforced by NOTHING, and that is measured

```
grep -n "feature_visibility\|visual_workflow_canvas" docs/OPERATOR.md scripts/check-deploy-drift.sh
→ exit 1, ZERO matches (before this plan)
```

`scripts/check-deploy-drift.sh` has four checks — env-var keys, Step-3 migration **filenames**,
the sandbox image tag, the compose parse. It has never looked at the audience map and cannot
tell anyone this table has gone stale. So OPERATOR.md's new cold-default table is asserted by
`test_operator_doc_names_every_governed_feature_and_its_cold_default` instead, which requires the
feature **and its default on the same row** so a stale default cannot hide behind a correct-
looking mention elsewhere in the document.

The drift script itself **ran and is UNAFFECTED** — `RESULT: PASS`, exit 0, its two WARNs
(seed-like migrations above #089; docker unavailable) byte-identical to before. That is recorded
as *unaffected*, not offered as evidence that the parity was checked.

---

## Task 2a — THE SEAM LIST, DERIVED FROM THE TREE

⛔ Not recalled from the plans. Not started from the plan's own table. The commands, verbatim:

```bash
# per field name — producer and every consumer
for f in _failure_reason failure_reason failureReason tool_name toolName service_name serviceName \
         arg_sources tool_args ask_key upstream_outputs schema_for_bound_tool tool_schemas \
         allowed_connection_ids unsatisfiable_arguments resolve_arguments ArgumentGapKind \
         REFUSAL_FOR_KIND launchInputFields run_inputs step_name; do
  grep -rln -- "$f" backend/app frontend/src | grep -v __pycache__
done

# then the MECHANICAL ownership diff: what the phase CHANGED, minus what any plan DECLARED
awk '/^files_modified:/{p=1;next} /^[a-z_]+:/{if(p)p=0} p' 214-*-PLAN.md | sed 's/^ *- *//' | sort -u
git diff --name-only bd495af0f 6d6528ce7 -- backend/app frontend/src scripts docs | sort -u
comm -23 changed.txt owned.txt
```

**Declared by some plan: 107 paths. Changed by the phase: 97 paths.**

### ⭐ SEVEN SOURCE FILES THE PHASE CHANGED THAT NO PLAN DECLARED

| # | unowned path file | who changed it | on which seam | verdict |
|---|---|---|---|---|
| U-1 | `frontend/src/components/workflows/publishRefusalEntry.ts` | **created** by `214-10` (`3d508f28f`) | S-4 — it is where `REFUSAL_CODES` is derived from `REFUSAL_FOR_KIND` (`:60`) and consumed by `PublishGauntlet.tsx` + `PublishRefusalList.tsx` | needs no change; S-4 pins its declaring module, not this one |
| U-2 | `frontend/src/components/workflows/soulData.ts` | `214-09` (`cb00deffd`) | **S-5** — `launchInputFields` (`:245`) is the REAL launch list, per 214-09's own correction | needs no change; the launcher wire is `214-16`'s |
| U-3 | `frontend/src/lib/api/knowledge.ts` | `214-02` (`3750bf5a3`) | **S-7 + S-4** — carries `allowed_connection_ids` (`:761`) and `step_name`; also where `PublishVerdict` / `GenerateWorkflowBody` really live after Phase 207's split | needs no change; ⚠ two plans' `files_modified` name `lib/api/workflows.ts` for types that are not there |
| U-4 | `frontend/src/components/workflows/useTemplateFirstDraft.ts` | `214-13` (`9f4dc0c62`) | **S-7** — `:623` forwards `result.error` to `setErrorState` | self-flagged by 214-13; confirmed and now asserted |
| U-5 | `frontend/src/components/workflows/stepActionWords.ts` | this phase | S-3 — `stepActionWords(capability)` (`:56`) feeds `StepIdentity` | needs no change |
| U-6 | `frontend/src/components/workflows/nodePresentation.ts` | this phase | S-3 — `renderPhaseMark` (`:117`), the canvas mark | needs no change |
| U-7 | `frontend/src/lib/api.ts` | this phase | all — the Phase-207 re-export barrel every client type crosses | needs no change |

⚠ **`frontend/src/pages/WorkflowBuilderPage.tsx` is NOT on this list**, though `214-13` flagged it
as undeclared: it IS declared, by `214-04`. Recorded because the finding as reported was half
right, and half-right findings are what an ownership diff is for.

Eight **test** files were likewise changed-but-undeclared: `PendingAskCard.retired.baseline.test.tsx`,
`settings/__tests__/ConnectionFormPanel.test.tsx`, `workflows/__tests__/connectionCardReachability.test.tsx`,
`workflows/__tests__/WorkflowScheduleModal.test.tsx`, `McpToolPicker.reachability.test.tsx`,
`WorkflowDoorSwitch.test.tsx`, `lib/__tests__/connectionMark.test.tsx`, `pages/WorkflowsPage.test.tsx`.

### ⭐ AND THE DIFF RAN THE OTHER WAY TOO — THREE DECLARED PATHS DO NOT EXIST

`comm -13` (declared, never changed) surfaced three paths that are not files in this tree at all:

| declared by | declared path | what actually exists |
|---|---|---|
| `214-08` | `frontend/src/components/settings/connectionMark.tsx` | `frontend/src/lib/connectionMark.tsx` |
| `214-08` | `frontend/src/components/settings/__tests__/connectionMark.test.tsx` | `frontend/src/lib/__tests__/connectionMark.test.tsx` |
| `214-09` | `frontend/src/components/workflows/WorkflowScheduleModal.test.tsx` | `frontend/src/components/workflows/__tests__/WorkflowScheduleModal.test.tsx` |

⚠ **This is the `npx vitest run <path-that-does-not-exist>` trap in latent form.** That command
**exits 0** when a non-existent path is named alongside real ones. Any verification that named
`components/settings/__tests__/connectionMark.test.tsx` executed **zero** of the cases it
believed it was running. Compounding `214-09`'s own finding: its schedule-modal suite is in
neither `BASELINE` nor `TARGETS` of the count gate **and** the path its plan declares is wrong.

### Field-by-field object constructions checked on the seam paths

The plan named this as where the defect hides (`200-02`: a widened wire model reached the panel
as `undefined` for a whole phase). Checked:

| constructor | file:line | verdict |
|---|---|---|
| `reconcilePhases` branch 1 | `StreamsProvider.tsx:3876` `Array.from(..., (_, i): Phase => {` | ✅ widened — `failureReason` / `toolName` / `capability` / `serviceName` all mapped |
| `reconcilePhases` branch 2 | `StreamsProvider.tsx:3946` `.map((r): Phase => ({` | ✅ widened in the SAME commit; `214-02` also planted a structural fence requiring both literals to declare the same key set |
| `WorkflowRunPhaseRead(...)` | `workflow_runs.py:880` | ✅ carries all four |
| `WorkflowPhaseState(...)` | `threads.py:1343` | ✅ carries all four |

⚠ Neither `reconcilePhases` literal uses a spread, deliberately — a spread of `row` would land
the wire's own spellings (`phase_index`, `status`) on a `Phase` and break the F2/CR-06 status
arithmetic. The fence, not the spread, is the right guard here.

---

## Task 2b — THE SEAM TABLE, file:line on BOTH sides

| # | value | WRITER / producer | READER / consumer | proven by |
|---|---|---|---|---|
| **S-1** | the failure reason | `db/workflows.py:1856` `fail_phase` → `output["_failure_reason"]` | `api/workflow_runs.py:870` → `WorkflowRunPhaseRead.failure_reason` **and** `api/threads.py:1339` → `WorkflowPhaseState.failure_reason`; then `types/index.ts:1114` `failureReason` → `StreamsProvider.tsx:3876/3946` → `PhaseCard.tsx:274` | 4 cases, both jsonb shapes, both readers, plus the two cross-language hops RUN |
| **S-2** | argument source arms | `models/harness.py:187` `ArgumentSourceSpec` → `config.arg_sources` / `config.tool_args` | `args.py:240` `resolve_arguments` (executor, via `phase_types.py:2661/2732`) **and** `args.py:329` `unsatisfiable_arguments` (gate, via `reachability.py`) | 4 cases, both directions + `shape_unknown` + the D-214-12 legacy arm |
| **S-3** | service + action strings | `connector_connections.name`; pause resolves at `harness_engine.py:949` | `grounding.py:1209` `_approval_sentence(service_name=...)` **and** `workflow_runs.py:879` `service_name = conn_names[...]` | 2 cases — one string equal on two paths, and nothing invented when unknown |
| **S-4** | the five refusal kinds | `args.py:81` `ArgumentGapKind` | `reachability.py:112` `ARGUMENT_GAP_CODES` → `:131` `LINT_CODES`; `publishRefusalVocabulary.ts:269` `REFUSAL_FOR_KIND` → `publishRefusalEntry.ts:60` | 1 cross-language case, **in pytest** (see below) |
| **S-5** | launcher inputs | `soulData.ts:245` `launchInputFields` → `RunModal`/`ChatLaunchForm` → `postMessage.inputs` → `models/message.py` → `threads.py:917` **and** `workflow_kickoff.py:500` | `workflow_runs.inputs` → `args.py:240`'s `ask` arm | **cited to `214-16`**, asserted to exist with ≥ 6 cases — never supplied in-process |
| **S-6** | tool `inputSchema` **provenance** | `args.py:417` `schema_for_bound_tool` | gate `publish_service.py:629` (`_bound_tool_schemas`, `:579`) · executor `phase_types.py:2661` (MCP) and `:2732` (native) · pause `harness_engine.py:990` | 3 cases: execution agreement, the native `_plain_json` control over every registered capability, and two source fences |
| **S-7** | the generate refusal code | `workflow_authoring.py:405/414/434` `{"ok": False, "error": "connection_not_allowed"}` | `useTemplateFirstDraft.ts:623` `setErrorState(result.error, …)` → `builderStore.ts:433` `errorMessage` → `WorkflowBuilderPage.tsx:2180` | 2 cases — and the path assertion **found something** |

---

## ⭐ FINDINGS THE SEAM WORK PRODUCED

### F-1 — S-7: the refusal reaches a screen, and the screen shows the MACHINE CODE

The chain resolves, so `214-13`'s assumption that no renderer needed changing is **correct**
about reachability. But `useTemplateFirstDraft.ts:623` passes `result.error` — the raw string
`connection_not_allowed` — as the **message**, and `WorkflowBuilderPage.tsx:2180` renders
`Couldn't generate — {errorMessage}`. So an author whose describe door refuses reads:

> Couldn't generate — connection_not_allowed

Every other refusal this phase shipped got a governed sentence (`214-03`'s vocabularies). This
one did not, because it crosses a plan boundary: **`214-13` owns the code, `214-04` owns the
page, and neither owns the translation.** ⛔ Not absorbed here — this plan's `files_modified`
names no frontend file, and inventing copy in a seam-audit plan is how a closure round smuggles
a feature. **Owner: whoever next opens `WorkflowBuilderPage.tsx` or `describeServiceMatch.ts`.**
The two cases pin the path *as it is*, including an assertion that no vocabulary maps the code —
so the day someone adds the sentence, the test fails and says why.

### F-2 — the flip inverted 18 "when off" assertions across seven suites

Measured, not predicted: **20 red**. Six `_cold_off` helpers handed back an **empty**
`feature_visibility` map and leaned on the cold default being `"off"`; with the default now
`"everyone"` the empty map resolves ON and every downstream *"when off"* assertion silently
inverted. All six now **store** `{"audience": "off"}` — the product's own re-flip route, which
`feature_audience` honours because Phase 181 put `"off"` in the accepted-enum tuple for exactly
this reason. What each case asserts is unchanged; only how OFF is reached.

Two more needed the assertion itself changed, and both are written out rather than overwritten:
`test_181_off_audience.py`'s two cold-read cases (inverted and renamed, with the fail-safe
property they really guard restated) and `test_148_effective_features.py::test_operator_sees_all_features_true`
(`visual_workflow_canvas is False` → `is True`, with `live_connectors is False` added beside it
as the control that the off arm still exists and this is a per-key decision, not a blanket True).

⚠ **None of these seven suites is in `backend/tests/unit`, so none was covered by this phase's
68-failure baseline.** They were invisible to it, and would have stayed invisible if this plan
had not run the flag suites explicitly. A baseline scoped to one directory is not a baseline for
a change to a global default.

### F-3 — two of the 20 are PROVABLY pre-existing, and were not touched

With the pre-flip default restored and nothing else changed, `test_canvas_ping_200_after_flip_on`
(a stale `kb_tools` expectation) and `test_openapi_tracks_the_flag_in_both_directions_in_one_process`
(a `_CANVAS_PATHS` inventory that has drifted behind `CANVAS_GATED_PATHS` by two routes) still
fail. Restored md5-identical after the check. Logged to `214-14-deferred-items.md` with owners.
⚠ The second is worth a second look: its other five assertions pass, so the gate genuinely
tracks the flip — what rotted is the test's own inventory of what "the canvas surface" is, in a
NON-discoverability test.

### F-4 — a `pytest.skip` on a seed failure turned five unproven seams into a green line

The suite's first run seeded `workflow_phases.status = 'running'`, which is not a legal status,
and the fixture's `pytest.skip` reported **5 skipped** — five seams unproven, reading green.
The handler now **raises**: a skip belongs to an absent database (handled at module scope) and
to a missing FK target, never to a broken INSERT. Every constraint the seeds satisfy
(`workflow_phases_status_check`, `connector_connections_capability_check`,
`connector_connections_has_a_service_identity`) was read off `pg_constraint`, not guessed —
each was learned by being rejected.

---

## What the seam suite fakes, and why each is off the seam

| faked | why it is not the seam |
|---|---|
| authentication (`current_user` as a dict; routes called as ordinary async functions) | who the caller is is not the seam; what the reader finds in the column is |
| `threads.py`'s `get_user_pg_connection` acquire | replaced with a REAL connection from the REAL pool minus the role swap. The SQL, the `phase_output_object` parse, the normalisation and the model construction all execute unmodified. The role swap is an authorisation boundary and is tested where it lives |
| the supabase client's ORIGIN | ⚠ `tests/conftest.py:10` does `os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")` before `app.config` imports, so `get_supabase()` under pytest builds a client for a hostname that does not resolve. The client is therefore built from `backend/.env` — and **REFUSES a non-local URL**, because this suite writes rows and must never be pointed at a deployment. Every PostgREST read is real |
| nothing else | every row is real; every write goes through the product's own writer; every read runs the product's own expression |

`test_S0_no_case_patches_a_function_under_test` walks this file's AST and fails if
`resolve_arguments`, `unsatisfiable_arguments`, `phase_output_object`, `_external_action_clause`
or `resolve_connection` appears inside a patch call. ⚠ Its first version checked
`func.attr` only, which **skips every `patch.object`** — the only patch form this suite uses.
The positive control caught it; the walk now follows the whole dotted chain.

S-3 uses `resolve_connection`'s **injected `fetch_row`** — the storage seam the function
declares for exactly this purpose. The resolver is untouched. ⚠ The injected fetch **decodes
the jsonb columns**, because the production fetch goes through PostgREST (decoded JSON) while
the raw pool here deliberately carries no codec — measured when `dict(row.get("config"))` raised
`ValueError` on the literal text `'{}'`.

## RED drives on the seam guards — all three fired, all files restored md5-identical

| planted defect | case that went RED |
|---|---|
| `threads.py`'s reader goes back to the RAW value (pre-214 shape) | `test_S1_string_scalar_output_reaches_BOTH_readers` |
| `args.py` drops the D-214-12 `run_inputs` fallback | `test_S2_the_D_214_12_legacy_arm_still_runs_an_already_published_workflow` |
| the executor hands the adapter's own declaration to the resolver | `test_S6_the_one_legitimate_INPUT_SCHEMA_read_is_the_compat_arm_and_stays_alone` |

⚠ **Stated precisely because it matters:** the third drive produced
`adapter.INPUT_SCHEMA or schema_for_bound_tool(...)` — a `BoolOp`, not a bare `Attribute` — so
the **AST fence did not fire and the COUNT pin did**. Two guards, and the pair caught it; the
AST fence alone would not have. That is a limit of the AST fence, recorded rather than smoothed.

⚠ **A blanket grep for `INPUT_SCHEMA` would have been the wrong fence, and measuring showed it.**
`phase_types.py:2175` reads it legitimately, inside the documented `schema is None` compatibility
arm three shipped suites still exercise (`test_190_ssti_fence.py` among them). Banning the
attribute outright would have demanded a change that breaks those suites and protects nothing.
The fence is on the ARGUMENT — every production `schema=` handed to the resolver must be a name
or a `schema_for_bound_tool` call — plus a count pin of exactly one legitimate read, in a named
file, inside a named guard.

---

## Verification

| check | result |
|---|---|
| `pytest tests/unit/test_214_flag_cold_default.py -q` | **13 passed** |
| `pytest tests/integration/test_214_argument_seams.py -q` | **20 passed**, 0 skipped |
| `pytest tests/unit -q` | **68 failed / 3055 passed** — the 68 baseline held **exactly**; +13 passed are this plan's own cases |
| every suite naming `visual_workflow_canvas` | 118 passed / **2 failed**, both provably pre-existing (F-3) |
| `bash scripts/check-deploy-drift.sh` | exit 0, `RESULT: PASS` — recorded as **unaffected**, not as evidence |
| `grep -c '"visual_workflow_canvas": "everyone"'` | `1` |
| `grep -c '"live_connectors": "off"'` | `1` |
| `git diff -- user_settings.py \| grep -c '^[-+].*live_connectors.*everyone'` | `0` |
| suite leaves no rows behind | `test_T_214_14_05_...` — order-independent, with a positive control that the cycle inserted |

⚠ **No frontend file was modified**, so the vitest count gate is not this plan's criterion —
plan `214-15` runs it once at the phase close. The two cross-language hops S-1 depends on WERE
run (`PhaseReconcile.test.tsx`, `PhaseCard.test.tsx`), from inside the seam suite, with a
positive control that the runner executed cases rather than exiting 0 over nothing.

## G-5

`backend/app/models/user_settings.py` has **no hot-file ledger row**, and this plan touched it
(one string in a dict literal, plus two comments — no control flow, no new function, no new
field). Re-derive its triple in plan `214-15`'s batch pass and add a row if G-5 fires. An absent
row is exactly how `ChatLayout.tsx` stayed invisible to its own guardrail for twenty-one phases
and `config.py` for forty-two. `backend/tests/` carries no ledger rows by convention.

## Known Stubs

None. No hardcoded empty value, placeholder string or unwired data source was introduced.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema
change. It **widens** one existing trust boundary — `visual_workflow_canvas` now cold-reads
`everyone` — which is D-214-19's recorded decision, asserted in both directions (`T-214-14-01`:
the canvas reads `everyone`, `live_connectors` reads `off`, and the diff contains no line pairing
`live_connectors` with `everyone`).

## Commits

| hash | message |
|---|---|
| `e018613cc` | `feat(214-14): visual_workflow_canvas cold-reads everyone; live_connectors stays off` |
| `ac7d1eec5` | `fix(214-14): the canvas flip silently inverted 18 "when off" assertions` |
| `7af6c28f0` | `test(214-14): seven cross-plan seams, each with NEITHER side mocked` |

## Self-Check: PASSED

- All four created files exist on disk.
- All three commit hashes resolve in `git log --all`.
- `git diff 6d6528ce7..HEAD` names neither `STATE.md` nor `ROADMAP.md` — the orchestrator owns those.
- Every `file:line` anchor quoted in the seam table was re-read from the tree and carries the
  content this summary claims for it (`workflows.py:1856`, `workflow_runs.py:870`,
  `threads.py:1339`, `harness_engine.py:990`, `soulData.ts:245`, `WorkflowBuilderPage.tsx:2180`).
