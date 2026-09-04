---
phase: 214-a-step-names-its-service-and-its-action
plan: 16
subsystem: workflow kickoff wire (declared launch inputs)
tags: [STEP-02, D-214-04, D-103-CONF-1-amended, wire-contract, two-literals, jsonb-string-scalar]
requires:
  - "MessageCreate / postMessage — the shipped kickoff POST (Phase 092 / 152)"
  - "create_workflow_run(inputs=...) — the durable workflow_runs.inputs jsonb (SEED-047)"
  - "resolve_arguments (plan 214-01) — the ask arm reads run_inputs[spec.ask_key or name]"
  - "_NON_ACTION_RUN_INPUTS / _external_action_inputs (phase_types.py) — the consumer"
provides:
  - "postMessage options.inputs?: Record<string, string> — the client channel"
  - "MessageCreate.inputs: dict[str, str] | None — the request field"
  - "app.models.message.RESERVED_RUN_INPUT_KEYS — the ONE frozenset both merge sites import"
  - "the declared keys inside workflow_runs.inputs (persisted) AND ctx.inputs (live)"
  - "backend/tests/integration/test_214_launch_inputs_wire.py — the real-POST proof"
affects:
  - "214-09 (its onLaunch claim is now true end to end)"
  - "214-12 (its 'via the existing postMessage payload' key_link now exists)"
  - "214-14 (its S-5 hand-in is now backed by a driven wire; seam audit reads both sides)"
  - "214-15 (owes ledger rows for lib/api/threads.ts, models/message.py, workflow_kickoff.py)"
tech-stack:
  added: []
  patterns:
    - "PATTERNS §F — additive field with the mechanism stated"
    - "the two-copies-of-one-fact rule, made executable rather than commented"
key-files:
  created:
    - backend/tests/integration/test_214_launch_inputs_wire.py
  modified:
    - frontend/src/lib/api/threads.ts
    - frontend/src/lib/apiRunFields.fences.test.ts
    - backend/app/models/message.py
    - backend/app/api/threads.py
    - backend/app/services/workflow_kickoff.py
decisions:
  - "The reserved keys are STRIPPED from the launcher's map, not merely spread last — measured: out-ranking alone left a launcher folder_id intact on every request that carried no override."
  - "RESERVED_RUN_INPUT_KEYS lives in models/message.py and is imported by both merge sites; the plan's complaint is a fact in two places, so the fix does not add a third."
  - "dict[str, str], never dict[str, Any] — a non-string arrives as a 422 before any row is created."
  - "An empty inputs map is never put on the wire; absent and empty are the same dict server-side."
  - "D-103-CONF-1 amended in writing: one additive request field and one dict literal (twice). No route, no response key, no ordering change."
metrics:
  duration: ~2h
  completed: 2026-08-28
  tasks: 3
  commits: 4
---

# Phase 214 Plan 16: The launch-inputs wire — declared values reach the run, live and persisted — Summary

`BUG-260826-01`'s recipient was never resolved because it never left the browser. `postMessage`'s
options were exactly five and none of them could carry a declared value. This plan adds the sixth,
declares it on `MessageCreate`, merges it into **both** kickoff dict literals in one commit, and
proves the whole path with an integration suite that drives a real `POST /threads/{id}/messages` and
reads `workflow_runs.inputs` back out of Postgres.

## The merge literal, both copies, side by side

**`backend/app/api/threads.py:954`** — the PERSISTED dict:

```python
inputs={
    **{k: v for k, v in (body.inputs or {}).items()
       if k not in RESERVED_RUN_INPUT_KEYS},
    "kickoff_prompt": body.content,
    **({"folder_id": str(body.folder_id)} if body.folder_id else {}),
},
```

**`backend/app/services/workflow_kickoff.py:524`** — the LIVE `ctx.inputs` mirror:

```python
inputs={
    **{k: v for k, v in (body.inputs or {}).items()
       if k not in RESERVED_RUN_INPUT_KEYS},
    "kickoff_prompt": body.content,
    **({"folder_id": str(body.folder_id)} if body.folder_id else {}),
},
```

Character-for-character identical apart from indentation, and **asserted equal by a driven case**
(`test_MIRROR_live_ctx_inputs_equals_the_persisted_row`) rather than by the comments beside them.

## The precedence decision, and why it is a STRIP rather than an out-rank

The plan's `<interfaces>` specified `**(body.inputs or {})` first and the reserved keys last, on the
reasoning that *"the reserved keys are LAST and therefore WIN"*.

⚠ **That is only true when they are PRESENT, and `folder_id` is spread CONDITIONALLY.** Measured by
the new suite on its first run — a POST with no `folder_id` and
`inputs={"folder_id": "1111…", "kickoff_prompt": "IMPERSONATED", "to": "b@example.test"}` stored:

```
{'folder_id': '11111111-1111-1111-1111-111111111111',
 'kickoff_prompt': 'the real kickoff',
 'to': 'b@example.test'}
```

`kickoff_prompt` was correctly overwritten; **`folder_id` survived untouched**, because there was no
reserved value to lose the race to. And `workflow_runs.inputs["folder_id"]` is read back as the
per-run retrieval override on the resume/Continue path (`runs.py:1119` →
`_resolve_run_scope_root(run_inputs=_wf_inputs, …)`), so this is not an inert key.

**Exposure was BOUNDED rather than absent, and the bound was read rather than assumed:**
`harness.scope.resolve_run_scope_root` re-validates any override against
`fetch_visible_folders(owner)` on every read and drops an unreachable id, so no cross-user scope was
possible. It is stripped anyway — a value that reaches the durable jsonb without passing
`MessageCreate.folder_id`'s UUID validation is a second door into a gated field, and defence in depth
here costs one dict comprehension.

`RESERVED_RUN_INPUT_KEYS = frozenset({"kickoff_prompt", "folder_id"})` lives in
`backend/app/models/message.py`, beside the field whose docblock explains the rule, and is imported by
both merge sites. **One fact, one home, two consumers** — this plan's entire complaint is a fact
living in two places, so the fix does not create a third.

## `runs.py`'s resume path — the finding the plan asked for, stated rather than assumed

**A resumed run DOES read the persisted `workflow_runs.inputs`.** `runs.py:1052-1063` pulls
`wf_row["inputs"]`, defensively `json.loads`es a string form, and hands it to the continuation as
`run_inputs=_wf_inputs` at `:1119`. That is exactly why only the two KICKOFF literals needed widening
— and exactly why widening only one of them would have produced a defect visible **only on a resume**.

## D-103-CONF-1, amended verbatim

Recorded in full on `MessageCreate.inputs`' docblock and referenced at the merge site:

> The shipped constraint reads *"reuses the EXISTING kickoff path — `createThread` +
> `sendMessage(workflow_definition_id)` — NEVER a bespoke `/workflows/{id}/run` route
> (D-103-CONF-1; threads.py byte-identical)"*. Its PURPOSE is that there is exactly ONE kickoff path
> with one governance story; *"threads.py byte-identical"* is how Phase 103 achieved that at the
> time, not the thing being protected.
>
> - **WHAT IS AMENDED:** one additive request field, plus one dict merge in each of the two kickoff
>   literals.
> - **WHY SC#2 CANNOT BE MET WITHOUT IT:** the declared values have no other channel, and a second
>   route is the thing D-103-CONF-1 actually forbids.
> - **THE NEW BOUNDARY:** no new route, no new key on the POST *response*, no change to the two-rows
>   model, the create-before-spawn ordering, the template-upload sequencing or the orphan cleanup.

Mechanically checked: `grep -c "def send_message\|@router.post" backend/app/api/threads.py` reads
**3** — unchanged from HEAD; the ordering grep
(`create_workflow_run(|await get_pg_pool|maybe_autotitle|preflight_workflow_kickoff|@router`) reads
**0** changed lines; `git diff -- backend/app/services/scheduler_service.py` is **EMPTY** — the door
that already worked was not touched.

## RED drivers — observed before the fix, verbatim

**Task 1 · the client.** Against the pre-change `lib/api/threads.ts`:

```
FAIL  the declared values reach the request body under `inputs`, with their keys intact
AssertionError: expected undefined to deeply equal { to: 'a@example.test', subject: 'S' }
```

**Task 1 · the byte-identity fence is not vacuous.** Planting `inputs: options.inputs ?? {}` in the
shipped function reds **3 of the 5** new cases at once — both deep-equality arms *and* the code sweep,
which names the offender:

```
AssertionError: expected [ '/src/lib/api/threads.ts' ] to deeply equal []
```

**Task 3 · the MIRROR case, driven RED with only ONE side widened.** `threads.py` at its widened text
and `workflow_kickoff.py` restored to the plan's base commit:

```
FAIL  test_MIRROR_live_ctx_inputs_equals_the_persisted_row
assert {'kickoff_pro...: 'mirror me'} == {'kickoff_pro...example.test'}
```

i.e. the LIVE context carried `kickoff_prompt` alone while the persisted row carried both declared
keys — **the first-run-blind / resume-correct defect, reproduced deliberately before being closed.**
This is the only assertion in the phase that compares the two literals.

**Task 3 · the precedence case found a real defect** (see above) — that RED is a finding, not a
driver, and is recorded as deviation 1.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 — Missing critical functionality / security] The reserved keys had to be STRIPPED, not out-ranked**
- **Found during:** Task 3, `test_PRECEDENCE_reserved_keys_win_over_a_launcher_key`, first run.
- **Issue:** the plan's literal relies on the reserved keys being spread last, but `folder_id`'s
  spread is conditional on `body.folder_id`. On every request without a folder override, a launcher
  key named `folder_id` survived into `workflow_runs.inputs` verbatim. `T-214-16-01`'s mitigation
  claim (*"the merge's precedence puts the reserved keys LAST, so they win"*) was therefore not
  implemented by the literal it describes.
- **Fix:** a dict comprehension strips `RESERVED_RUN_INPUT_KEYS` from the launcher's map at **both**
  merge sites, with the frozenset defined once in `models/message.py`.
- **Files:** `backend/app/models/message.py`, `backend/app/api/threads.py`,
  `backend/app/services/workflow_kickoff.py`
- **Commit:** `31ca70b32`

**2. [Rule 3 — Blocking] `unsatisfiable_arguments`' signature is not the one the plan's arm assumed**
- **Issue:** the end-to-end arm's optional gate assertion called
  `unsatisfiable_arguments(config=…, schema=…, upstream_slugs=…)` and got
  `TypeError: missing 1 required keyword-only argument: 'declared_input_keys'`. `declared_input_keys`
  is the DEFINITION's author-time declared inputs, not the run's inputs — so satisfying it would have
  meant the test supplying the very thing the case exists to prove came from the wire.
- **Fix:** the gate half was replaced with a strictly stronger, DB-sourced **counterfactual**: the
  same `config` and the same `schema` against the pre-214 run-inputs literal
  (`{"kickoff_prompt": …}`) resolve to `{}`. That is `BUG-260826-01` reproduced in one call, and it
  is what makes the positive assertion mean the value came from the wire rather than from the schema,
  from `tool_args`, or from the test.
- **Commit:** `1b18f9809`

**3. [Rule 1 — Precision] The plan's case-3 wording conflates two different mechanisms**
- The plan asks the precedence case to assert *"through the real `_external_action_inputs`, that
  neither reaches an adapter argument — the `_NON_ACTION_RUN_INPUTS` exclusion"*. Only
  `kickoff_prompt` is in that frozenset; `folder_id` is **not**, and would survive
  `_external_action_inputs` if it ever reached the bag. What stops it is a *different* mechanism —
  `resolve_arguments` walking the schema's DECLARED properties.
- **Fix:** both are asserted, separately and by name, and the second is exercised over a bag that
  deliberately DOES carry `folder_id` so the strip above cannot make it vacuous.

### Plan premise corrected (no code consequence)

**`workflow_kickoff.py:500` and `threads.py:917` are `:524` and `:954` on the merged tree.** The plan
cites line numbers from before wave 1 landed. Named here so a reader does not conclude the wrong
literal was edited.

## Measured findings worth not rediscovering

⚠ **`workflow_runs.inputs` is a jsonb STRING SCALAR, and a naive read would have made this suite lie.**
`db/workflows.py`'s own docblock records it (`jsonb_typeof(inputs)` = `string` on **230 of 230** rows)
because `create_workflow_run` hands `json.dumps(inputs)` to a pool whose `init` hook already installs
a `jsonb` codec with `encoder=json.dumps` — the value is dumped twice. A read that stopped at the
first `json.loads` returns a **`str`**, and every membership assertion in this suite would then have
been a substring test that passes for the wrong reason: `"to" in '{"to": "a@example.test"}'` is
`True`. `decode_inputs` unwraps until it has a **dict**, the caller asserts the type, and the loop is
bounded — so the suite keeps working unchanged on the day the double-dump is fixed.

⚠ **`import.meta.glob` cannot see the module that calls it** (inherited from `214-02` and relied on
here): the new `inputs ?? {}` sweep spells its own needles and is safe to, but a collapse written
*inside* `apiRunFields.fences.test.ts` would not be caught there.

⚠ **An AST walk, not a grep, for the "nothing is patched" self-check.** This suite's prose names all
four forbidden functions — it has to, they are what it forbids — so a text search would have reported
the paragraph that states the rule (the 187-24 trap, which this project has now recorded firing seven
times). A docstring and a comment are not `Call` nodes; the walk carries a planted-violation control
and a non-vacuity assertion that it found this module's one real `patch(...)`.

⚠ **A `git checkout --` does NOT give you the plan's base once you have committed.** Driving the
MIRROR case RED needed `git show a81cb6dfa:…`, not a checkout — the checkout restores the *last
commit*, which by then already carried the fix. Recorded because the first attempt silently restored
the wrong text and would have produced a green "RED" run.

## Scope statements (claims deliberately qualified)

- **The suite fakes PostgREST, Redis and the detached producer, and each is off the path under test.**
  The run's `inputs` jsonb is written by `create_workflow_run` on the **real** asyncpg pool; the
  producer is spawned *after* that row exists (the two-rows ordering), so stubbing it removes an LLM
  call and not a single step of the wire. Stated rather than left for a reader to audit.
- **The definition FK target is an EXISTING published row, read never written.** The parsed definition
  the route runs on comes from the faked resolve, so the row only has to exist — writing one would
  have meant inventing an `org_id` and leaving a second kind of litter.
- **No `TARGETS` entry is owed.** This plan creates no new frontend suite; it extends the
  count-gate-pinned `src/lib/apiRunFields.fences.test.ts` from 20 cases to **25**.

## G-5 disposition — re-derived at execute time, not copied from the plan

| File | measured `commits / phases / lines` | plan's cell | verdict |
|---|---|---|---|
| `backend/app/api/threads.py` | **238 / 78 / 1408** | 234 / 76 / 1273 | **FIRES** — honoured by construction |
| `frontend/src/lib/api/threads.ts` | **3 / 2 / 1600** | *(no row)* | does not fire (2 phases) — ⚠ row still owed |
| `backend/app/models/message.py` | **15 / 8 / 120** | *(no row)* | ⚠ **FIRES at 8 phases and has no row** |
| `backend/app/services/workflow_kickoff.py` | **8 / 6 / 554** | *(no row)* | ⚠ **FIRES at 6 phases and has no row** |

**Honoured by construction on all four**, and the argument is bounded rather than rhetorical:
`threads.py` gains **one dict literal's contents, one import name and a comment block** — no route,
no response key, no reordering, all three asserted mechanically above. `workflow_kickoff.py` gains
the same literal plus one import. `models/message.py` gains one documented field and one frozenset.
`lib/api/threads.ts` gains one option and one conditional spread. **No new responsibility enters any
of them.**

⚠ **Three of the four have no ledger row at all, and two of those three FIRE.** That is the
`ChatLayout.tsx`-for-twenty-one-phases failure mode exactly — G-5 could never have fired on
`workflow_kickoff.py`, which is precisely the file whose absence from the scan list is why the
`ctx.inputs` mirror was invisible to this phase's first pass. Plan `214-15` owns adding all three rows
and their `docs/HOT-FILE-LEDGER.md` sections. **Recorded here as an obligation, not discharged.**

## Verification

| Check | Result |
|---|---|
| `pytest tests/integration/test_214_launch_inputs_wire.py -q` | **12 passed** (bar: ≥ 6 cases, green) |
| `pytest tests/unit -q` (full) | **68 failed / 2965 passed** — the plan's bar is "no more than 68" |
| the failing set at the plan's base commit (`a81cb6dfa`, all three source files restored) | **68 failed, `diff` of the sorted FAILED lists is EMPTY** — the diff introduces zero new failures, proven not asserted |
| `pytest tests/unit -k "kickoff or threads or workflow_run"` | 5 failed / 21 passed — **the identical 5 at base** |
| `tsc --noEmit -p tsconfig.app.json` | **34 errors** — the recorded baseline exactly |
| `vitest run src/lib/apiRunFields.fences.test.ts` | **25 passed** (up from 20 after `214-02`) |
| `git diff -- backend/app/services/scheduler_service.py` | **EMPTY** |
| `grep -c "def send_message\|@router.post" backend/app/api/threads.py` | **3** — unchanged |
| `git diff -U0 -- frontend/src/lib/api/threads.ts` hunks | `@@ +468` and `@@ +496` — **disjoint from `214-02`'s `:1247-1279` region** |

⚠ **The whole-tree count gate was NOT run** — the orchestrator owns it at the post-merge gate, and
CLAUDE.md records that `count gate OK` is not reliably reachable on demand. The per-file delta above
(20 → 25 on a pinned file, no decrease) is the deterministic half. **Figures for plan `214-15`:** this
plan adds **+5** gated frontend cases and creates **no** new gated suite.

⚠ **This is the only DB-writing plan in wave 2** and it stayed that way. Its rows are seeded under
generated ids and deleted FK-safely; `test_CLEANUP_the_workflow_runs_count_returned_to_its_baseline`
asserts the whole-table count returned to the value captured at import (243 before, 243 after).

## Threat Flags

None new. The plan's `<threat_model>` covers every boundary this plan opens, and every `mitigate`
disposition is implemented and driven:

| Threat | Where it is tested | Note |
|---|---|---|
| T-214-16-01 (a launcher key overwriting `folder_id`) | `test_PRECEDENCE_reserved_keys_win_over_a_launcher_key` | ⚠ **the plan's stated mitigation did not hold as specified** — the strip is the real one (deviation 1) |
| T-214-16-02 (an undeclared key reaching an adapter argument) | `test_PRECEDENCE_neither_reserved_key_reaches_an_adapter_argument`, exercised over a bag that DOES carry the key | |
| T-214-16-03 (a nested/non-string value on a flat path) | `test_422_a_non_string_value_is_refused_and_writes_no_run_row` — 422 **and** a row count of 0 | |
| T-214-16-04 (the persisted dict and the live context disagreeing) | `test_MIRROR_live_ctx_inputs_equals_the_persisted_row`, **driven RED first** | |
| T-214-16-05 (a second kickoff path) | the route-count and ordering greps above | |
| T-214-16-06 (an unbounded map — **accept, NAMED**) | not tested; the acceptance stands unchanged | |
| T-214-16-07 (the suite mutating the operator's database) | `test_CLEANUP_…` plus per-case FK-safe teardown | |
| T-214-16-SC (package installs) | nothing was installed | |

## Self-Check: PASSED

Files asserted present:
- `FOUND: backend/tests/integration/test_214_launch_inputs_wire.py` (767 lines, 12 cases)
- `FOUND: .planning/phases/214-a-step-names-its-service-and-its-action/214-16-SUMMARY.md`

Commits asserted present in `git log`:
- `FOUND: 360128a90` — feat(214-16): the launch-inputs channel — one client option, one request field
- `FOUND: b4e223b37` — feat(214-16): both kickoff literals merge the declared inputs, in ONE commit
- `FOUND: 31ca70b32` — fix(214-16): the reserved keys are STRIPPED, not merely out-ranked
- `FOUND: 1b18f9809` — test(214-16): the launch-inputs wire, driven through a REAL POST

STATE.md and ROADMAP.md were NOT modified — the orchestrator owns those writes after the wave.
