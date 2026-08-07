---
phase: 189
plan: 01
subsystem: backend-tests
tags: [wave-0, red-first, falsification, governance, no-egress, migration-gate]
requires:
  - "app.models.harness.WorkflowDefinition (shipped)"
  - "app.services.harness.grounding.KB_TOOLS (shipped)"
  - "app.services.tool_dispatcher._TOOL_REGISTRY (shipped)"
  - "app.services.openai_service.get_tools (shipped)"
  - "live Postgres :54322 (for the migration gate only)"
provides:
  - "V06 — D-04's stored-false coercion, as an executable falsification"
  - "V09 — the emptied-available_tools refusal"
  - "V10 — the patched-transport no-egress falsification (with an inertness control)"
  - "V11 — the `mcp` source fence over backend/app (with a positive control)"
  - "V13 — migration 115's positive AND negative CHECK controls (green-skip until applied)"
  - "D-02's closed-set raise · D-15's exact three-name SET · D-22's standing tool-registry guard"
affects:
  - "189-07 (must turn V01/V06/V09 green)"
  - "189-09 (must turn V10 green)"
  - "189-06 (its operator apply flips test_migration_115.py from skip to pass)"
tech-stack:
  added: []
  patterns:
    - "the `?raw` source-fence idiom (PhaseNodeCard.test.tsx) adapted to Python"
    - "test_139_migration_090.py's rollback-only live-DB constraint gate"
    - "anti-vacuity guard: every absent-code case asserts the symbol exists FIRST"
key-files:
  created:
    - backend/tests/unit/test_189_external_action_model.py
    - backend/tests/unit/test_189_no_egress.py
    - backend/tests/test_migration_115.py
  modified: []
decisions:
  - "The plan-specified mcp fence regex `\\bmcp\\b` was FALSIFIED by its own positive control (it does not match `MCPClient`) and was strengthened to fire on word AND camel/Pascal segment starts."
  - "Every external_action case guards on a symbol-exists assertion first, so the Wave-0 RED is an assertion (not a collection error) and the rejection cases can never pass for the wrong reason."
  - "The migration-115 FK seed harness was exercised against the live DB from the scratchpad today, so plan 189-06 will not be the first time it runs."
metrics:
  duration: "~35 min"
  completed: 2026-08-07
  tasks: 3
  commits: 3
  files_created: 3
  files_modified: 0
  tests_added: 17
---

# Phase 189 Plan 01: Wave-0 Backend Falsifications Summary

Three new pytest files that make the phase's two hardest claims — **the arming cannot be
turned off** (D-04) and **nothing is sent** (SC#4) — plus migration 115's constraint gate,
falsifiable *before* any 189 source exists; 11 assertions observed RED, 7 controls green
today, 3 green-skipping until the operator applies the migration.

## What was built

| File | Rows | Tests | At HEAD |
|---|---|---|---|
| `backend/tests/unit/test_189_external_action_model.py` | V01 precursor · V05 (set half) · **V06** · **V09** · D-02 · D-15 | 8 defs / 10 cases | **8 RED**, 2 controls green |
| `backend/tests/unit/test_189_no_egress.py` | **V10** · **V11** · D-22 | 6 defs / 8 cases | **3 RED**, 5 controls green |
| `backend/tests/test_migration_115.py` | **V13** (D-08 / D-17) | 3 | 3 green-skip |

**No source file was modified.** Proved: `git diff --stat d8926830~1..HEAD -- backend/app
frontend/src supabase` is **empty**; the whole-plan diff is exactly the three new files
(964 insertions).

## Observed REDs — verbatim

### Task 1 — `test_189_external_action_model.py` (8 failed, 2 passed)

All eight REDs terminate at the same anti-vacuity guard, which is the honest failure: the
7th union member does not exist, so nothing downstream is reachable.

```
E       AssertionError: app.models.harness.ExternalActionPhaseConfig does not exist: D-01's 7th PhaseConfig union member (external_action) has not landed yet (plan 189-07). This is the expected Wave-0 RED.
E       assert None is not None

tests\unit\test_189_external_action_model.py:82: AssertionError
```

```
FAILED tests/unit/test_189_external_action_model.py::test_external_action_is_a_seventh_union_member
FAILED tests/unit/test_189_external_action_model.py::test_an_unknown_key_on_the_external_action_config_still_422s
FAILED tests/unit/test_189_external_action_model.py::test_action_risk_armed_cannot_be_stored_false_on_this_type
FAILED tests/unit/test_189_external_action_model.py::test_emptied_available_tools_is_a_validation_error[phase_kwargs0-available_tools emptied to []]
FAILED tests/unit/test_189_external_action_model.py::test_emptied_available_tools_is_a_validation_error[phase_kwargs1-available_tools omitted entirely]
FAILED tests/unit/test_189_external_action_model.py::test_emptied_available_tools_is_a_validation_error[phase_kwargs2-available_tools omits its own capability]
FAILED tests/unit/test_189_external_action_model.py::test_the_capability_set_is_exactly_three_and_disjoint_from_kb_tools
FAILED tests/unit/test_189_external_action_model.py::test_a_capability_outside_the_closed_set_is_refused
8 failed, 2 passed, 1 warning in 0.51s
```

Cases 1, 4, 6, 7 and 8 named by the plan are all present in that list (case 6 as its three
parametrisations).

**Controls that PASS today, as the plan required:**
- `test_a_pre_189_row_still_validates` (case 3) — a definition naming only the six shipped
  `phase_type` values still parses into exactly those six.
- `test_a_shipped_type_may_still_be_unarmed` (case 5) — an `llm_single` phase stored with
  `action_risk_armed: false` reads `False`. Without this, V06 would be satisfied by an
  implementation that armed every phase type.

**Acceptance greps:** `grep -c "def test_"` → **8** (≥ 8 required); tokens present —
`D-04` ×8, `D-02` ×6, `D-15` ×7, `V06` ×5, `V09` ×5.

### Task 2 — `test_189_no_egress.py` (3 failed, 5 passed)

```
E       AssertionError: app.services.harness.phase_types._exec_external_action does not exist: the 7th executor has not landed yet (plan 189-09). This is the expected Wave-0 RED.
E       assert None is not None

tests\unit\test_189_no_egress.py:113: AssertionError
```

```
FAILED tests/unit/test_189_no_egress.py::test_the_external_action_executor_performs_no_network_io[send_email]
FAILED tests/unit/test_189_no_egress.py::test_the_external_action_executor_performs_no_network_io[create_ticket]
FAILED tests/unit/test_189_no_egress.py::test_the_external_action_executor_performs_no_network_io[post_message]
3 failed, 5 passed, 1 warning in 1.03s
```

**Controls that PASS today:**
- **Case A (V11)** — the `mcp` fence over `backend/app` walks **160** `*.py` files and finds
  **zero** matches, under the *strengthened* matcher (see Deviations). The walk-size guard
  (`> 100` files) means the fence cannot pass on a broken walk.
- **The fence's positive control** — the matcher is driven against eight haystacks that DO
  contain the token and five near-misses that must not fire.
- **The transport inertness controls (sync + async)** — with the patch installed,
  `httpx.Client(...).get(...)` and `httpx.AsyncClient(...).get(...)` both raise the
  `_EgressAttempted` sentinel. If the patch had bound nothing, Case B would have measured
  nothing.
- **Case C (D-22)** — none of `send_email` / `create_ticket` / `post_message` appears in
  `_TOOL_REGISTRY` or in `get_tools(None)`. This is a standing regression fence, not a RED.

**Acceptance greps:** `grep -c "hasattr\|getattr\|import"` → **16** (non-zero); tokens
present — `SC#4` ×8, `V10` ×6, `V11` ×5, `D-22` ×6.

`aiohttp` is deliberately **not** patched: it is not installed and not in
`requirements.txt` (`venv/Scripts/python.exe -c "import aiohttp"` →
`ModuleNotFoundError`). `httpx 0.28.1` is the only declared HTTP client.

### Task 3 — `test_migration_115.py` (3 skipped)

Skip reason, verbatim (identical for all three tests), containing the required `189-06`
substring:

```
SKIPPED [1] tests\test_migration_115.py:189: migration 115 NOT applied - workflow_phases_status_check does not yet admit 'recorded_not_sent'. This green-skip is EXPECTED UNTIL PLAN 189-06 TASK 2 APPLIES IT (operator pastes supabase/migrations/115_workflow_phases_recorded_not_sent.sql into the Supabase SQL editor, then runs scripts/regenerate-full-schema.sh with no --reset; NEVER db push / db reset). Once applied, this file MUST PASS.
```

```
sss                                                                      [100%]
3 skipped, 1 warning in 0.26s
```

**Acceptance greps:** `grep -c "rollback\|ROLLBACK\|savepoint\|SAVEPOINT"` → **7**
(non-zero); tokens present — `D-08` ×2, `D-17` ×7, `V13` ×3, `recorded_not_sent` ×6,
`189-06` ×2. The em-dash string `Not sent — recorded` appears only as the module contract's
D-17 explanation and as the NEGATIVE control's payload constant — never as a value any
positive path stores.

## The harness was proved, not assumed

A file that only ever green-skips is a file whose machinery has never run. Rather than
leave that discovery to plan 189-06, the seed chain and both control mechanics were driven
against the **live** local DB today from the scratchpad (`probe_mig115_seed.py`, **not**
committed — `backend/` is a watched tree):

```
migration 115 applied? False
workflow_phases before: 439
seed chain OK, run_id = 36f21b6b-682f-4e1d-ab37-27328c2c8869
  admitted 'pending' / 'active' / 'completed' / 'failed' / 'skipped'
  rejected display sentence: 23514 constraint = workflow_phases_status_check
  rejected slug pre-115:     23514 constraint = workflow_phases_status_check
workflow_phases after rollback: 439 -> unchanged: True
leaked seeded users: 0
```

Three things that matters:
1. The FK chain (`auth.users` → `threads` → `workflow_definitions` → `workflow_runs` →
   `workflow_phases`) seeds cleanly inside the rolled-back transaction.
2. **`recorded_not_sent` is rejected TODAY with 23514** — so the positive control will
   genuinely swing from refused to admitted when the operator applies 115. It is not a
   test that was always going to be green.
3. **Nothing survived**: 439 rows before and after, zero leaked seed users. The suite does
   not mutate the operator's dev data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing critical functionality] The plan-specified `mcp` fence regex was falsified by its own positive control**

- **Found during:** Task 2
- **Issue:** The plan specified the fence as the case-insensitive word-boundary token
  `mcp` (`grep -rni "\bmcp\b"`). Its mandated positive control was written first and
  immediately FAILED on the very first haystack:
  ```
  E  AssertionError: the mcp fence matcher failed to fire on 'client = MCPClient(server_url)' - the fence would pass vacuously over the whole tree
  E  assert None
  E   +  where None = <built-in method search of re.Pattern object at 0x...>('client = MCPClient(server_url)')
  E   +    where ... = re.compile('\\bmcp\\b', re.IGNORECASE).search
  ```
  `\b` requires a non-word character after `mcp`; in `MCPClient` the next character is `C`.
  So **a PascalCase MCP client class — the single most likely shape MCP code would ever
  take in this tree — would have sailed straight through a gate reporting green.** That is
  exactly the vacuous-fence failure class the control exists to catch. This is SC#4's only
  mechanical proof, so a fence that misses the obvious case is a correctness defect, not a
  style nit.
- **Fix:** Strengthened the matcher to
  `(?:(?<![A-Za-z0-9])[Mm]|(?<=[a-z0-9])M)[Cc][Pp](?![a-z0-9])` — fires when `mcp` starts a
  word (`mcp_client`, `MCP_URL`, `.Mcp`) **or** starts a camel/Pascal segment
  (`httpMCPClient`, `httpMcpClient`), and never when a lowercase letter or digit continues
  it (`mcpherson`, `dmcpx`, `McPherson`). Deliberately **not** `re.IGNORECASE`: the flag
  would make the `[a-z0-9]` guards match uppercase too and collapse the rule. Both halves —
  eight must-fire haystacks and five must-not-fire near-misses — are driven in the control.
  The reason is recorded in the constant's own comment block so a later reader cannot
  "simplify" it back.
- **Effect on the measured baseline:** none — `backend/app` is still **0** under the
  stronger fence, so the plan's measured `0` holds and now holds against more shapes.
- **Files modified:** `backend/tests/unit/test_189_no_egress.py`
- **Commit:** `47d0a988`

**2. [Rule 2 — Missing critical functionality] Anti-vacuity guards added to every absent-code case**

- **Found during:** Tasks 1 and 2
- **Issue:** At HEAD, *every* `external_action` payload raises `ValidationError` because the
  discriminator has no such member. So the plan's cases 2 ("an unknown key still 422s") and
  8 ("a capability outside the closed set raises") would have **passed today for entirely
  the wrong reason**, and would then have been green forever without proving anything.
- **Fix:** (a) every `external_action` case calls `_external_action_config_cls()` /
  `_external_action_executor()` first — an `assert`, not a bare import, so the RED is an
  assertion rather than a collection error (the plan explicitly rejects collection errors as
  a valid RED); and (b) both rejection cases assert the CLEAN payload parses before
  asserting the bad one raises. Case 8 admits all three D-15 names before refusing
  `wire_transfer`.
- **Files modified:** `backend/tests/unit/test_189_external_action_model.py`,
  `backend/tests/unit/test_189_no_egress.py`
- **Commits:** `d8926830`, `47d0a988`

**3. [Rule 2 — Missing critical functionality] V10 runs for all three capabilities, not one**

- **Found during:** Task 2
- **Issue:** SC#4 is a property of the phase type, not of one capability name. A single
  `send_email` row would leave two thirds of the closed set unproved.
- **Fix:** `test_the_external_action_executor_performs_no_network_io` is parametrised over
  all three D-15 names (three REDs today, three greens after 189-09).
- **Files modified:** `backend/tests/unit/test_189_no_egress.py`
- **Commit:** `47d0a988`

**4. [Rule 2 — Missing critical functionality] V13 asserts both write paths and the constraint's identity**

- **Found during:** Task 3
- **Issue:** The engine writes `recorded_not_sent` by UPDATING an `active` row, not only by
  INSERT; and a `23514` alone does not prove *which* constraint fired.
- **Fix:** The positive control exercises INSERT **and** UPDATE-into; the negative control
  additionally asserts `constraint_name` is `workflow_phases_status_check`. The third test
  re-asserts all five shipped statuses after the DROP+ADD **plus** a still-refused nonsense
  value, so "adds exactly ONE literal and changes nothing else" is proved rather than
  assumed — a re-typed `ARRAY[…]` is precisely where a shipped literal gets silently
  dropped.
- **Files modified:** `backend/tests/test_migration_115.py`
- **Commit:** `41e289f8`

### Re-derived, not inherited

Per the phase's standing rule, every measurement was re-taken on the working tree
(2026-08-07) rather than carried from the plan text:

| Claim | Command | Result |
|---|---|---|
| 189-scope backend baseline | the 9-file command, §D15 | ✅ **166 passed / 2 failed** — exactly as measured, the two named `test_182_grounding_bundle.py` `asyncpg … pool is closing` failures, unmoved |
| `grep -rniE "\bmcp\b" backend/app --include=*.py \| wc -l` | run | ✅ **0** |
| `backend/app` `*.py` file count | `find` | **160** (pinned as a `> 100` walk-size guard) |
| `workflow_phases_status_check` is 5-valued | live `pg_get_constraintdef` | ✅ HOLDS — `pending, active, completed, failed, skipped` |
| `aiohttp` is a dependency | `import aiohttp` in the venv | ❌ **FALSE** — `ModuleNotFoundError`; only `httpx 0.28.1` is patched |
| `KB_TOOLS` members | `grounding.py:797` | 5 names, none of them a D-15 capability |
| pytest `asyncio_mode` | `backend/pytest.ini` | `auto` — async tests need no marker |

**Pointer note:** `_exec_programmatic` is at `phase_types.py:433` and `_exec_llm_single` at
`:466` (PATTERNS' §2 excerpt line numbers were re-derived by symbol search, per the
standing rule). No pointer in this plan's own `<read_first>` blocks was found stale.

## Authentication Gates

None.

## Verification

```
$ backend/venv/Scripts/python.exe -m pytest tests/unit/test_189_external_action_model.py \
    tests/unit/test_189_no_egress.py tests/test_migration_115.py -q --no-header -rs
11 failed, 7 passed, 3 skipped, 1 warning in 1.25s
```

```
$ backend/venv/Scripts/python.exe -m pytest <the nine 189-scope files> -q --no-header
2 failed, 166 passed, 3 warnings in 2.15s
```

```
$ git diff --stat d8926830~1..HEAD -- backend/app frontend/src supabase
(empty)
$ git diff --stat d8926830~1..HEAD
 backend/tests/test_migration_115.py                | 299 +++++++++++++++++
 backend/tests/unit/test_189_external_action_model.py | 357 +++++++++++++++++
 backend/tests/unit/test_189_no_egress.py           | 308 ++++++++++++++++++
 3 files changed, 964 insertions(+)
```

## Known Stubs

None. This plan ships no source code and no placeholder values; every assertion is live.

## What the next plans owe

| Plan | What must turn green |
|---|---|
| **189-07** | `test_external_action_is_a_seventh_union_member`, `…_unknown_key_…_422s`, `…action_risk_armed_cannot_be_stored_false…`, the three `…emptied_available_tools…` cases, `…capability_set_is_exactly_three_and_disjoint_from_kb_tools`, `…capability_outside_the_closed_set_is_refused` |
| **189-09** | the three `test_the_external_action_executor_performs_no_network_io[…]` cases |
| **189-06** | `test_migration_115.py` flips from 3 skips to 3 passes once the operator applies 115 |

**Two invariants these files now pin for the rest of the phase**, worth naming because a
later plan could satisfy a green while breaking them:

1. **`test_a_shipped_type_may_still_be_unarmed` must keep passing.** Arming everything would
   turn V06 green and change the governance posture of six shipped types.
2. **`test_no_capability_is_a_dispatchable_tool_or_an_advertised_schema` must keep passing.**
   Adding a `get_tools()` schema is the fastest way to make the stage-2.6 fidelity gate stop
   complaining — and it is exactly the D-20 leak that would let an author whitelist
   `send_email` on an ordinary, **unarmed** `llm_agent` step. D-20's fix is
   `EXTERNAL_ACTION_CAPABILITIES` unioned into `tool_names` **only**.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file access pattern and no schema
change. Its only trust-boundary contact is the test process → local Postgres `:54322`, and
every write there is inside a transaction proved to roll back (439 rows before and after).

The plan's own threat register is addressed rather than deferred: **T-189-01** (the D-04
disarm paths) is now an executable falsification covering all six write paths at once,
because every one of them goes through `WorkflowDefinition.model_validate`; **T-189-02**
(dynamic capability resolution) is `test_a_capability_outside_the_closed_set_is_refused`;
**T-189-03** (egress) is Cases A + B with their controls; **T-189-04** (this suite mutating
dev data) was driven and measured, not asserted.

## Self-Check: PASSED

- `backend/tests/unit/test_189_external_action_model.py` — FOUND
- `backend/tests/unit/test_189_no_egress.py` — FOUND
- `backend/tests/test_migration_115.py` — FOUND
- commit `d8926830` — FOUND
- commit `47d0a988` — FOUND
- commit `41e289f8` — FOUND
