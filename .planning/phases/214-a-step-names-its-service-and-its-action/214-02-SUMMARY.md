---
phase: 214-a-step-names-its-service-and-its-action
plan: 02
subsystem: workflow-run wire contract (failure reason + step identity)
tags: [STEP-04, STEP-05, D-214-23, D-214-16, D-214-14, wire-contract, two-wire-models, string-scalar]
requires:
  - "workflow_phases.output._failure_reason (written by db/workflows.py::fail_phase — already shipped)"
  - "app.models.thread.phase_output_object (the ONE read-side unwrap — Phase 200.1)"
  - "connector_connections.name (SELECT granted column-by-column, migration 118)"
provides:
  - "WorkflowRunPhaseRead.{failure_reason,tool_name,capability,service_name} — the run page wire"
  - "WorkflowPhaseState.{failure_reason,tool_name,capability,service_name} — the chat panel wire"
  - "app.models.thread.step_identity(definition) -> slug -> (tool_name, capability, connection_id)"
  - "Phase.{failureReason,toolName,capability,serviceName} — the client panel shape"
  - "WorkflowRunPhase.{failure_reason,tool_name,capability,service_name} — the run page client mirror"
  - "lib/api/threads.ts::WorkflowPhaseState.{failure_reason,tool_name,capability,service_name}"
  - "PublishNamedFailure {step_name?, argument?, upstream?} — consumed by 214-10"
  - "GenerateWorkflowBody.allowed_connection_ids?: string[] — consumed by 214-13"
affects:
  - "214-08 (the shared identity element receives these as data)"
  - "214-11 (renders them; serviceOf(slug) reads service_name)"
  - "214-10 (named_failures entries)"
  - "214-13 (allowed_connection_ids)"
  - "214-14 (seam audit checks both sides against this list)"
  - "214-15 (owes ledger rows for api/workflow_runs.py, models/thread.py, lib/api/threads.ts)"
tech-stack:
  added: []
  patterns:
    - "PATTERNS §3a — read through phase_output_object, never a second isinstance(raw, dict)"
    - "PATTERNS §3b — one parse per row, N facts off it"
    - "PATTERNS §3e — the two-wire-model same-commit rule, at full strength"
    - "PATTERNS §E — computed never stored (service_name resolved at read time)"
    - "PATTERNS §F — additive field with the mechanism stated"
key-files:
  created:
    - backend/tests/unit/test_214_failure_reason_seam.py
    - .planning/phases/214-a-step-names-its-service-and-its-action/214-02-deferred-items.md
  modified:
    - backend/app/api/workflow_runs.py
    - backend/app/api/threads.py
    - backend/app/models/thread.py
    - backend/app/db/workflows.py
    - backend/tests/unit/test_200_1_deliverable_text.py
    - backend/tests/unit/test_200_1_phase_output_shape.py
    - frontend/src/types/index.ts
    - frontend/src/lib/api/workflows.ts
    - frontend/src/lib/api/knowledge.ts
    - frontend/src/lib/api/threads.ts
    - frontend/src/lib/api.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/lib/apiRunFields.fences.test.ts
    - frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx
decisions:
  - "The four wire fields are additive and nullable on BOTH models; null means NOT RECORDED and an empty string is never shipped."
  - "service_name is resolved ONCE PER RUN before each row loop, reading only the connection's display name."
  - "step_identity lives in models/thread.py — one derivation, two consumers; the two shipped slug->phase_type loops are byte-unchanged."
  - "The plan's `lib/api/workflows.ts` target for named_failures / generateWorkflow was wrong (Phase 207 moved both types to lib/api/knowledge.ts); the widening landed in their real home plus the barrel."
metrics:
  duration: ~2h
  completed: 2026-08-28
  tasks: 4
  commits: 5
---

# Phase 214 Plan 02: The failure reason and the step identity reach both run wires — Summary

`BUG-260826-05`'s reason was never missing; it was never **projected**. This plan carries
`output._failure_reason` plus the step's `(tool_name, capability, service_name)` identity from the
`workflow_phases` row to **both** run wire models through the one shared unwrap, widens the three
client types, and maps all four onto `Phase` in **both** `reconcilePhases` branches — the two hops
Phase 200-02 missed on these exact two files.

## What was built

| Hop | Where | What |
|---|---|---|
| 1 · projection | `api/workflow_runs.py:764-778` | `_failure_reason` read as the **third** fact off the existing single `phase_output_object` parse |
| 2 · run wire | `WorkflowRunPhaseRead` | four additive nullable fields, **populated** by the same loop |
| 3 · chat wire | `models/thread.py::WorkflowPhaseState` | the identical four, **same commit**, populated by `api/threads.py`'s builder |
| 4 · derivation | `models/thread.py::step_identity` | ONE definition→identity walk, imported by both API modules |
| 5 · client types | `types/index.ts` · `lib/api/workflows.ts` · **`lib/api/threads.ts`** | the panel shape, the run mirror, and the client mirror `200-02` forgot |
| 6 · the mapper | `StreamsProvider.tsx::reconcilePhases` | both `Phase`-returning literals map all four |

### The wire contract (for `214-08` / `214-11` / `214-14`)

Four fields, identical names and semantics on `WorkflowRunPhaseRead` **and** `WorkflowPhaseState`:

| snake_case (wire) | camelCase (`Phase`) | `null` means |
|---|---|---|
| `failure_reason` | `failureReason` | **NOT RECORDED.** `""` is impossible by construction (`fail_phase` always writes a non-empty reason) and any read anyway is normalised to `null`, so the panel's `reason_unknown` sentinel keeps its meaning. |
| `tool_name` | `toolName` | not an `external_action` step, or the step names only a native capability |
| `capability` | `capability` | an MCP step (carries `tool_name` and no capability) |
| `service_name` | `serviceName` | **the connection could not be resolved** — deleted, another org's, or none bound. The surface renders the ACTION ALONE. Never a substitute string. |

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] The plan's `select("*")` criterion was unsatisfiable at HEAD — the 187-24 trap, fired #1**
- **Found during:** Task 1, on the first RED run.
- **Issue:** the criterion is `grep -c 'select("\*")' backend/app/api/workflow_runs.py` == 0. Measured on the **unmodified base commit** it reads **2** — both occurrences are inside the module's own comments at `:727` and `:752`, which SPELL the forbidden form in order to reject it in writing. The only way to drive that grep to 0 is to delete the two paragraphs that state the rule.
- **Fix:** the fence walks the **AST** for `.select("*")` CALL nodes (a comment is not a node), with a non-vacuity control (`>= 3` real `.select(...)` calls found) and a case that records the contrast — the raw count is asserted to still be exactly 2.
- **File:** `backend/tests/unit/test_214_failure_reason_seam.py`
- **Commit:** `5ecfd1ee4`

**2. [Rule 1 — Bug] `_blob_at_base` decoded `git show` with the Windows locale codec**
- **Found during:** Task 1. `text=True` alone uses cp1252 here; these modules carry `⚠` and `—`, so the reader thread died with `UnicodeDecodeError`, `.stdout` came back `None`, and the fence failed with an `AttributeError` that looked nothing like the property it pins.
- **Fix:** `encoding="utf-8"`, with the mechanism recorded beside it.
- **Commit:** `5ecfd1ee4`

**3. [Rule 1 — Bug] The plan's "ONE door" call-site count was `1`; the measured number is `2`**
- **Issue:** the criterion says "the pre-existing call sites plus zero". The pre-existing count is **2** — `read_workflow_run`'s per-row loop and a second route's single-row read. "One parse per row" is a **per-loop** property, not a per-module one.
- **Fix:** the fence pins `calls == base_calls == 2` and states why, so it forbids a THIRD without asserting a number the module never had.
- **Commit:** `5ecfd1ee4`

**4. [Rule 3 — Blocking] Sibling suite `test_200_1_deliverable_text.py` re-baselined (9 → 13 keys, 1 → 2 allow-listed output keys)**
- **Issue:** it asserts the phase object's key set as a **set EQUALITY** and the serializer's named-key reads as an exact set. Widening `WorkflowRunPhaseRead` reds six of its cases.
- **Fix:** both constants updated with the reason recorded in place; kept as EQUALITIES, never relaxed to supersets — the equality is what catches a key invented tomorrow. `test_serializer_reads_exactly_one_key_by_name` renamed to `..._exactly_the_allow_listed_keys_by_name`, because a fence whose NAME asserts a number it no longer checks is a stale guard.
- **Commit:** `5ecfd1ee4`

**5. [Rule 1 — Bug] `test_200_1_phase_output_shape.py`'s byte-identity extractor stopped at `\nclass ` while its own comment said "the next top-level definition"**
- **Found during:** the full backend baseline run (69 failed, one over the plan's bar).
- **Issue:** Task 2 added a top-level `def` (`step_identity`) between `declared_phase_measure` and the next class, so the "tail" slice silently grew to swallow it and the fence reported `declared_phase_measure`'s tail as CHANGED **with not one byte of it moved**. The code contradicted the comment directly above it; it had been indistinguishable from correct only while no `def` happened to sit there.
- **Fix:** `end = min(next class, next def)`, with an assertion that at least one was found. Backend unit **69 → 68 failed**, the plan's bar.
- **Commit:** `bdbc40ddc`

**6. [Rule 3 — Blocking] The two later-wave types are in `lib/api/knowledge.ts`, not `lib/api/workflows.ts`**
- **Issue:** the plan directs `named_failures`' entry type and `generateWorkflow`'s request body to be widened in `lib/api/workflows.ts`. `PublishVerdict` and `GenerateWorkflowBody` **live in `lib/api/knowledge.ts`** — Phase 207's api split moved them; `workflows.ts` only `import type`s them.
- **Fix:** widened in their real home, and `PublishNamedFailure` added to the `lib/api.ts` barrel list in the same commit (that file's own stated rule). The fence asserts over `API_SOURCE`, which concatenates every api module and is therefore indifferent to which one — deliberately, so it could not be satisfied only by putting the type in the wrong home.
- ⚠ **Consequence for the plan's ownership argument:** waves 3 and 4 will not need to touch `lib/api/workflows.ts`, but the file they must not touch is `lib/api/knowledge.ts`.
- **Commit:** `3750bf5a3`

**7. [Rule 1 — Bug] `named_failures` was `unknown[]`, not an entry type with keys**
- The plan says its "entry type gains" three keys. The array is typed `unknown[]` because it is **POLYMORPHIC across stages** and `PublishGauntlet.tsx`'s rule 4 requires key detection PER ENTRY. Narrowing it would break every other stage's rendering.
- **Fix:** a new exported `PublishNamedFailure` describing an entry a consumer may DETECT, with all three keys optional; `named_failures: unknown[]` is **untouched** and a fence asserts that.

**8. [Rule 1 — Bug] The absent-vs-empty fence fired on its own rule — the 187-24 trap, fired #2 and #3**
- **Found during:** Task 3, first run: `expected [ '/src/lib/api/knowledge.ts' ] to deeply equal []`. The "offender" was the field's own docblock stating the rule it forbids. The same held for the two reason forms.
- **Fix, both halves:** (a) the sweep now reads **code** — block comments and whole-line `//` comments stripped, URLs preserved by the line anchor — with a control proving the stripper spares prose and still catches the same form as code on the next line; and (b) the field docs were rewritten to the house *"describe, never spell"* discipline (`phase_output_object`'s recorded style), so the plan's literal greps are satisfiable too.
- **Fired a 4th time** in Task 4: an added comment in `StreamsProvider.tsx` used the word `positional`, which is one of the four tokens the plan's "no status logic moved" grep looks for — the comment was reworded and the incident recorded in it.

### Plan premise corrected (no code consequence)

**`types/index.ts:188` documents `Message.runError`, not `Phase.error`.** The plan (and D-214-23) cite
`:188` as `Phase.error`'s doc. `Phase.error` had **no docblock at all**; the quoted sentence belongs
to `Message.runError` and is line-wrapped there, so `grep -c "Only available for live-streamed runs"`
read **0**, not 1. `Phase.error` now carries its first docblock: the sentence verbatim (grep reads 1),
plus the correction naming `failureReason` as the reconciled sibling to prefer under D-v2.5-03.

## Measured findings worth not rediscovering

⚠ **`import.meta.glob` EXCLUDES the module that calls it.** From a sibling probe,
`/src/lib/apiRunFields.fences.test.ts` resolved at 19,311 chars; from **inside** that file the same
key reads `undefined`. This matters because the fence suite must spell all four forbidden forms —
they are its needles — and a reader could reasonably conclude it self-exempts by design. It does not;
it structurally cannot see itself. **A collapse written in that file would not be caught there**, and
that is now asserted and stated rather than left to be discovered. It also makes the needles safe to
spell. The exclusion was proven both ways: a scratch probe placed in the same directory during
development **was** reported as an offender by the sweep.

⚠ **A `model_fields` check and a value assertion are different claims, and the difference was DRIVEN
rather than argued.** Deleting `service_name=service_name` from the run-page serializer produced:

```
FAILED test_POPULATION_run_page_carries_the_resolved_service_and_action
FAILED test_T_214_02_01_only_the_display_name_crosses_from_the_connection_row
FAILED test_AGREEMENT_the_identity_values_are_equal_on_both_models
    AssertionError: assert None == 'Acme Slack (production)'
3 failed, 34 passed
```

`test_both_models_DECLARE_the_four_fields_neither_widened_alone` stayed **GREEN** throughout. That is
the declared-but-unpopulated world the round-2 blocker named, observed rather than described.

⚠ **The two run routes share `get_user_supabase_client`.** The AGREEMENT case drives both wires in one
test; `_canvas_on` installs the run page's projecting fake on that dependency and the thread route
resolves its ownership check through it, answering `404 Thread not found`. **Clearing the override is
not the repair either** — conftest installs its own there, which is what `mock_execute_result` drives,
so popping it 404s too (both wrong answers observed, in that order). The chat frame is therefore
driven FIRST and a guard in `_thread_frame` says so by name if the order is ever reversed.

## RED drivers — observed before the fix, verbatim

**Task 1 · the string-scalar arm** (38 of 43 failed rows). Against the pre-fix source, 12 of 15 cases
failed; `failure_reason` was absent from the serialized phase object entirely. The counterfactual is a
**local re-statement** of the dict-only reader (`_dict_only_reader`), never an import — it finds
`None` on the string-scalar fixture the shipped door parses, and its own positive control proves it is
not simply broken for every input (it DOES find the reason on the 2-of-43 object rows).

**Task 4 · the mapper.** `3 failed | 21 passed` on unmodified source. Received, verbatim:

```
AssertionError: expected { Object (slug, phaseIndex, ...) } to match object { …(4) }
- Expected
+ Received
-   "capability": "post_message",
-   "failureReason": "tool 'read_wiki_structure' refused: permission not granted",
-   "serviceName": "Acme Slack (production)",
-   "toolName": "post_message",
+   "pendingAsk": null,
+   "phaseIndex": 0,
+   "phaseType": "external_action",
+   "slug": "notify",
+   "status": "failed",
+   "subAgents": [],
```

i.e. **the server was sending all four and the mapper was dropping all four** — the 200-02 omission,
reproduced deliberately before being closed. The structural fence failed too
(`the HARNESS literal is missing failureReason`).

## Scope statements (claims deliberately qualified)

- **"Two literals" is a claim about `reconcilePhases`, never about the 4,119-line file.**
  `StreamsProvider.tsx:998-1005` builds a **third** `Phase`-shaped object — the
  `onPhaseStarted → appendPhaseForThread` ARGUMENT. It was **read and left alone** (`git diff | grep -c
  appendPhaseForThread` is 0): it is an argument rather than a `Phase`-typed return, so the `?raw`
  extraction structurally cannot see it, and the row it appends is transient — the placeholder branch
  merges via `{...p, ...phase}` and the pure-append branch is healed by `replacePhasesForThread`. The
  bounded consequence is real: a live-SSE-appended row shows no service/action until reconcile lands.
- **`db/workflows.py` changed by DOCSTRING ONLY.** No behaviour, no SQL, no new import. The
  `load_run_phases` docstring now states the read contract (parse through `phase_output_object`, never
  `output["_failure_reason"]`) and names `get_latest_completed_workflow_run`'s weaker inline unwrap
  (bare `except Exception`, `{"text": raw_output}` fallback) as a **known divergence** — not extended,
  not copied, per the plan.
- **`runStepCount.ts` is a third consumer of `WorkflowPhaseState` and reads `step_count` only.**
  Asserted rather than assumed: its suite runs green with no per-file decrease (45 cases across it and
  `PhaseReconcile.test.tsx`).

## Verification

| Check | Result |
|---|---|
| `pytest tests/unit/test_214_failure_reason_seam.py` | **37 passed** |
| `pytest tests/unit/test_200_1_phase_output_shape.py` | 47 passed, 1 failed (pre-existing) |
| `pytest tests/unit/test_200_1_deliverable_text.py` | all passed |
| `pytest tests/unit` (full) | **68 failed / 2872 passed** — the plan's bar is "no more than 68" |
| `tsc --noEmit -p tsconfig.app.json` | **34 errors** — the recorded baseline exactly |
| `vitest run src/lib/apiRunFields.fences.test.ts` | **20 passed** (up from 13) |
| `vitest run PhaseReconcile.test.tsx runStepCount.test.ts` | **45 passed**, no per-file decrease |

⚠ **The whole-tree count gate was NOT run** — the orchestrator owns it at the post-merge gate, and
CLAUDE.md records that `count gate OK` is not reliably reachable on demand. The per-file deltas above
are the deterministic half.

⚠ **No suite here mutates the database** (worktree rule 4): every backend case is offline, using the
shared projecting `_FakeSupabase` and the conftest mocked asyncpg pool.

## Deferred Issues

**`test_200_1_phase_output_shape.py::test_this_plan_wrote_no_migration` is RED at HEAD and is not
mine.** It diffs `supabase/migrations/`'s listing against Phase 200.1's base SHA and asserts equality;
five migrations (124–128) have landed since, so it reds on every commit after 200.1. This plan writes
no migration (its four source files are all under `backend/app` and `frontend/src`). Not repaired here
— re-pointing another plan's fence from inside this one would silently re-baseline a guard nobody
asked to move. Suggested disposition: `/gsd:fast` (G-3). Recorded in
`214-02-deferred-items.md` (plan-scoped filename: four executors ran this phase in parallel worktrees
and a shared `deferred-items.md` would collide on merge).

**Two other in-radius backend failures are pre-existing, proven by measurement rather than asserted:**
`test_071_1_threadpool_sweep.py::test_extract_composable_calls_wrapped_in_threadpool` and
`test_phase56_iteration_start.py::…::test_threads_py_emits_iteration_start_at_loop_top` both fail
identically when `backend/app/api/threads.py` is checked out at the plan's base SHA.

## Threat Flags

None. The plan's own `<threat_model>` covers every trust boundary this plan opens, and all six
dispositions are implemented and tested:

| Threat | Where it is tested |
|---|---|
| T-214-02-01 (info disclosure — only `name` crosses) | `test_T_214_02_01_only_the_display_name_crosses_from_the_connection_row`, with `config` + `mcp_server_url` PLANTED on the fixture row and a positive control asserting they were there |
| T-214-02-02 (third-party error text) | `test_T_214_02_02_a_script_bearing_reason_round_trips_as_TEXT_not_markup` |
| T-214-02-03 (DoS via `json.loads` recursion) | `test_T_214_02_03_a_deeply_nested_output_string_degrades_and_never_raises` (20,000 levels) |
| T-214-02-04 (spoofed service name) | `test_T_214_02_04_no_substitute_service_name_is_EMITTABLE_anywhere_in_the_backend` — an AST sweep over all of `backend/app` excluding docstrings and `description=` field docs, with a planted-emission control |
| T-214-02-05 (models silently disagreeing) | the mechanical DECLARATION case plus the AGREEMENT value case |
| T-214-02-SC (package installs) | nothing installed |

⚠ **T-214-02-04's fence had to be rebuilt.** The plan's `grep -rn "Unknown service" backend/app | wc -l`
== 0 is the 187-24 trap for the third time in this plan: the serializers now carry comments and a
Pydantic field description that spell the substitute in order to forbid it. The fence walks the AST
for **emittable** string constants (docstrings and `description=` keywords excluded, `#` comments
invisible by construction) and carries a control proving it distinguishes an emission from the prose
that forbids it.

## Self-Check: PASSED

Files asserted present:
- `FOUND: backend/tests/unit/test_214_failure_reason_seam.py`
- `FOUND: .planning/phases/214-a-step-names-its-service-and-its-action/214-02-deferred-items.md`

Commits asserted present in `git log`:
- `FOUND: 5ecfd1ee4` — feat(214-02): the failure reason reaches the run wire, parsed through the ONE door
- `FOUND: c26891ead` — feat(214-02): the SECOND wire model, and the step identity POPULATED on both builders
- `FOUND: 3750bf5a3` — feat(214-02): the client types, additively — plus this file's other two widenings
- `FOUND: b9bb38539` — feat(214-02): the client mirror and the mapper — the two hops 200-02 missed
- `FOUND: bdbc40ddc` — fix(214-02): the byte-identity extractor stops at the next top-level DEF

STATE.md and ROADMAP.md were NOT modified — the orchestrator owns those writes after the wave.
