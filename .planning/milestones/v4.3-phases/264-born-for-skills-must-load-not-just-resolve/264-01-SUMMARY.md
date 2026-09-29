---
phase: 264-born-for-skills-must-load-not-just-resolve
plan: 01
subsystem: backend-run-path
tags: [carrier, dataclass, expert-scope, tdd, closed-core-invariant]
requires:
  - "expert_service.ResolvedExpertBundle.bundle_id (the access-checked id, Phase 260)"
  - "skills.born_for_expert_bundle_id (mig 191, Phase 263)"
provides:
  - "_resolve_thread_scoping returns a 5-tuple whose fifth element is the access-checked bundle id"
  - "RunContext.born_for_bundle_id (frozen dataclass, default None)"
  - "ToolContext.born_for_bundle_id (default None) — the field 264-03's resolver will read"
  - "the carrier wired at 4 build sites + 1 sub_ctx propagation, inert"
affects:
  - "264-03 (the dispatcher resolver that consumes the field)"
  - "264-02 / 264-04 (unblocked: the arity change is landed and the gate is green)"
tech-stack:
  added: []
  patterns:
    - "additive default-None dataclass field, mirroring skill_instructions_override verbatim"
    - "ast.keyword counting as a wiring fence (not grep — a comment satisfies a grep)"
    - "negative AST fences over UNCHANGED modules, each driven RED by a planted keyword"
key-files:
  created:
    - backend/tests/unit/test_264_born_for_carrier.py
  modified:
    - backend/app/services/run_producer.py
    - backend/app/services/agent_loop.py
    - backend/app/services/tool_dispatcher.py
    - backend/app/services/task_service.py
    - backend/tests/unit/test_260_expert_chat_scoping.py
    - backend/tests/unit/test_260_financial_analyzer_conversation.py
    - backend/tests/unit/test_261_expert_authoring_scenarios.py
    - backend/tests/unit/test_261_expert_runtime_scoping.py
decisions:
  - "D-264-03 honoured with the name born_for_bundle_id; the PACK-01 Closed-Core Invariant stays green BY CONSTRUCTION and was re-driven, not inherited"
  - "D-264-05 propagate onto sub_ctx — no measured reason to deviate was found"
  - "RESEARCH §8.3's hashability premise is REFUTED by measurement; the fence pins frozen-ness + field-type hashability instead"
metrics:
  duration: "~2h10m"
  completed: 2026-09-22
  tasks: 3
  commits: 3
---

# Phase 264 Plan 01: The Born-For Carrier Summary

`_resolve_thread_scoping` now returns the access-checked Expert bundle id as a fifth value, and
that id rides `RunContext` → `ToolContext` → sub-agent `sub_ctx` as an additive default-`None`
field named `born_for_bundle_id` — four build sites, one propagation, **zero consumers**, backend
unit baseline back at exactly 71 with an empty set-diff in both directions.

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `844845a66` | `feat(264-01): widen _resolve_thread_scoping to a 5-tuple born-for carrier` |
| 2 | `ba94ede91` | `feat(264-01): born_for_bundle_id on both dataclasses, 4 build sites + sub_ctx` |
| 3 | `b9028850b` | `test(264-01): fence the UNCHANGED sites and both resolver arms` |

Base: `e9d6a94100674f627a815b91c223da7e3298d355`. `git diff --stat` base..HEAD touches **exactly the
nine files** in `files_modified` and nothing else.

## What shipped

**`run_producer.py`** — `_resolve_thread_scoping`'s return annotation is five-wide (`… , UUID | None`);
the no-consultant arm returns five `None`s; the success return appends **`resolved.bundle_id`**
(T-264-01 — the value `resolve_expert_bundle` already access-checked, never the raw
`active_expert_id` read off the thread row); the `except` arm still re-raises so no 4-tuple path
survives. Both `RunContext` builds — Deep **and** continuation — pass `born_for_bundle_id=_born_for`.

**`agent_loop.py`** — `RunContext` gains the field after `scoped_folder_path`; it is bound once
beside `skill_instructions_override = ctx.skill_instructions_override` and passed into **both**
`ToolContext` builds (resume + primary per-iteration).

**`tool_dispatcher.py`** — `ToolContext` gains the field after `has_connection_retrieval`. Field
only; no resolver change (that is 264-03).

**`task_service.py`** — `born_for_bundle_id=parent_ctx.born_for_bundle_id` beside the
`skill_instructions_override` propagation, with the same structural-unreachability reason the
096-02 / 099 CR-02 comments above it give. Deliberately **not** the `dead_gap_tokens_in_run=set()`
fresh-per-sub-agent shape — that is a mutable accumulator, this is an immutable scope id.

**Ten `tests/unit` unpack sites** widened; seven gained `assert born_for == expert_id`, and the
no-expert case gained `assert born_for is None`. Nothing any of them asserts about the first four
values changed.

## TDD: every RED observed, quoted

### Task 1 RED — the arity change

Widening the production return before touching a single test:

```
FAILED tests/unit/test_260_expert_chat_scoping.py::test_resolve_thread_scoping_no_expert
FAILED tests/unit/test_260_expert_chat_scoping.py::test_resolve_thread_scoping_with_active_expert
FAILED tests/unit/test_260_financial_analyzer_conversation.py::test_resolve_thread_scoping_derives_expert_core_tools
FAILED tests/unit/test_261_expert_authoring_scenarios.py::test_scenario_s4_union_scope_composition
FAILED tests/unit/test_261_expert_authoring_scenarios.py::test_scenario_s5_strict_isolation
FAILED tests/unit/test_261_expert_authoring_scenarios.py::test_scenario_s6_additive_tool_floor_deliverables
FAILED tests/unit/test_261_expert_runtime_scoping.py::test_union_scope_composition_default_biased
FAILED tests/unit/test_261_expert_runtime_scoping.py::test_strict_isolation_restricted_mode
FAILED tests/unit/test_261_expert_runtime_scoping.py::test_additive_tool_floor_preserves_deliverable_tools
9 failed, 16 passed, 3 warnings in 0.96s
```
`E   ValueError: too many values to unpack (expected 4)` at every one.

⚠ **MEASURED CORRECTION TO RESEARCH §2.8.** It names **ten unpack sites** — correct — and predicts
the gate moves *"71 → 81 failed"*. The real figure is **71 → 80**: the ten sites are only **NINE
node ids**, because `test_261_expert_runtime_scoping.py::test_additive_tool_floor_preserves_deliverable_tools`
contains **two** unpack sites (`:158` and `:197`) inside one test function. The count of sites and
the count of tests are different numbers and the plan conflated them. All ten sites were still
updated; only the predicted failure count was wrong.

### Task 2 RED — the carrier fence, before implementation

```
E   assert 'born_for_bundle_id' in {'body', 'current_user', 'dropped_tool_calls', 'effective_folder_ids', 'effective_tools', 'redis', ...}
E   assert 'born_for_bundle_id' in {'available_tools', 'current_user', 'dead_gap_tokens_in_run', 'emit', 'folder_subtree_ids', 'has_connection_retrieval', ...}
E   AttributeError: 'RunContext' object has no attribute 'born_for_bundle_id'
E   AssertionError: expected exactly 2 `born_for_bundle_id=` keyword args in run_producer.py (the Deep build and the continuation build), found 0
E   AssertionError: expected exactly 2 `born_for_bundle_id=` keyword args in agent_loop.py (the resume ToolContext build and the primary per-iteration build), found 0
E   AssertionError: expected exactly 1 `born_for_bundle_id=` keyword arg in task_service.py (the sub_ctx build), found 0
6 failed, 2 passed, 1 warning in 0.67s
```

The **2 passed** are the two *negative* fences (the closed-core re-drive and the no-branch fence),
which are vacuously green before the field exists. Both were therefore driven against planted
defects rather than accepted — plants 1, 3 and 4 below.

### The nine planted defects, with md5 pairs

Every plant was applied byte-exactly, the fence observed firing, then reverted and the file's md5
compared against its pre-plant value. **All nine restored identical**, and `git diff` on the three
UNCHANGED modules is empty.

| # | File | md5 before → after plant | Fence driven | Failure text |
|---|---|---|---|---|
| 1 | `agent_loop.py` | `a3e5fba3…` → `d5858d68…` → **`a3e5fba3…`** | closed-core ×2 (264's re-drive + `test_260`'s original) | `AssertionError: Forbidden AST Name 'expert_bundle_id' in agent_loop.py:1352` |
| 2 | `agent_loop.py` | `a3e5fba3…` → `7bdf4c26…` → **`a3e5fba3…`** | the two-`ToolContext`-build trap (8.6 / T-264-02) | `expected exactly 2 … found 1` |
| 3 | `tool_dispatcher.py` | `9e64a96b…` → `e74ea8f8…` → **`9e64a96b…`** | "the carrier adds no branch" | `Found: services/tool_dispatcher.py:1422: ctx.born_for_bundle_id is not None` |
| 4 | `agent_loop.py` | `a3e5fba3…` → `aef50441…` → **`a3e5fba3…`** | `frozen=True` | `assert False is True … frozen=False` |
| 5 | `task_service.py` | `ecc27ff7…` → `2e281486…` → **`ecc27ff7…`** | sub_ctx source is `parent_ctx` | `the sub_ctx value must come from parent_ctx …` |
| 6 | `harness/phase_types.py` | `cad31302…` → `2982eec8…` → **`cad31302…`** | UNCHANGED keyword count | `phase_types.py passes 'born_for_bundle_id=' 1 time(s)` |
| 7 | `harness/phase_types.py` | `cad31302…` → `6c975ce0…` → **`cad31302…`** | UNCHANGED *behavioural* | `the harness phase ToolContext must carry NO consultant scope` |
| 8 | `eval_runner_service.py` | `e6cea424…` → `bd1c5059…` → **`e6cea424…`** | UNCHANGED keyword count | `eval_runner_service.py passes 'born_for_bundle_id=' 1 time(s)` |
| 9 | `harness/grounding.py` | `38144a07…` → `a936fdee…` → **`38144a07…`** | keyword count **and** the column-name fence | both fired |

⭐ Two of these are worth naming rather than tallying:

- **Plant 6 vs plant 7.** Plant 6 added `born_for_bundle_id=getattr(ctx, "born_for_bundle_id", None)`
  at the harness builder. The AST count fence fired — **the behavioural one did not**, because the
  planted value resolved to `None` anyway. So plant 7 re-planted with a real `uuid4()` to drive the
  behavioural fence separately. **The two fences catch different things and neither subsumes the
  other**; a plan that had planted only the harmless spelling would have called one of them driven
  when it had not been.
- **Plant 8 passed an explicit `None`** — a wiring that changes no behaviour at all — and the fence
  still fired. That is the intended sensitivity: D-264-04 fences the *decision*, not the value.

## Deviations from Plan

### 1. [Rule 1 — refuted premise] RESEARCH §8.3's hashability argument is FALSE, measured

**Found during:** Task 2, when the fence I wrote from §8.3 verbatim went red against correct code.

§8.3 argues the new field *"must be hashable"* because `RunContext` is `@dataclass(frozen=True)`.
`hash(ctx)` raised `TypeError: unhashable type: 'dict'`. I drove the question at the **phase base**
rather than reasoning about it — extracted `RunContext` from `agent_loop.py` at `e9d6a9410`,
rebuilt it standalone, and measured:

```
BASE field count: 16
BASE has born_for_bundle_id: False
BASE hash(ctx) RAISES: TypeError unhashable type: 'dict'
```

`RunContext` **instances have been unhashable since Phase 260**, because the required
`current_user: dict` field is unhashable. The premise is wrong; the code is not.

⭐ **The discipline survives the refutation and the fence now pins the part that is real:**
`frozen=True` still holds (asserted via `__dataclass_params__` *and* a `FrozenInstanceError` on
reassignment), and the field's own declared type must be hashable so the field never *becomes* the
reason an instance cannot be hashed (`UUID` and `None` both are; a `dict`/`set` default would not).
The original wording is preserved inside the test's docstring rather than dropped, and the fence's
frozen assertion was driven RED by plant 4.

### 2. [Rule 3 — blocking] The plan's own grep criterion conflicted with my comment

Task 2's acceptance criterion is `grep -n "expert_bundle_id" backend/app/services/agent_loop.py`
returns nothing. My `RunContext` comment named the mig-191 column verbatim
(`skills.born_for_expert_bundle_id`), which **contains** that substring — the AST invariant was
green (a comment is not an `ast.Name`) but the literal criterion was not. Reworded to *"the mig-191
born-for provenance column on `skills`"*. `grep -c` now reads **0**. No behaviour, no fence changed.

### 3. [process error, mine] A gate run read 72 failed because I edited source while it ran

The Task-2 full gate read **`72 failed`** with one genuinely new id:
`tests/unit/test_256_llm_emit_rollup.py::test_the_summer_itself_is_reused_not_reimplemented`.

I triaged it before touching anything, and the failure text named its own cause:

```
E  AssertionError: _exec_llm_emit must fold its spend through the shared summer
E  assert '_record_run_usage(' in '    def __getattr__(self, name: str):\n …'
```

That test does `inspect.getsource(phase_types._exec_llm_emit)`. **`inspect.getsource` re-reads the
file from disk by recorded line number.** I ran plants 6/7 — which insert a line into
`phase_types.py` **above** `_exec_llm_emit` — while that background gate was still executing, so
every subsequent line shifted by one and `getsource` returned a different function's body. The test
passes in isolation, and the file was md5-identical by the time I looked.

⚠ **The lesson is procedural and generalises past this plan:** a source-reading fence
(`inspect.getsource`, `?raw`, `read_text` + line numbers) turns "edit a file during a test run" into
a red that looks like a real defect in an unrelated subsystem. **Do not mutate source while a gate
runs, even for a plant that will be reverted.** The final gate was run on a quiet tree and read 71.

### 4. Out of scope, logged not fixed

`node scripts/check-landing-drift.cjs` **fails at the phase base**: `SURFACE_TABS.orgAdmin` in
`OrgAdminShell.tsx` carries an `Experts` tab the landing canvas's `facts.ts` does not. Reproduced
standalone on a tree whose only modified files were two backend services. **This plan touches no
frontend source at all.** Recorded in
`.planning/phases/264-born-for-skills-must-load-not-just-resolve/deferred-items.md`.

## Baseline

Measured on this exact base, before any edit, and again on a quiet tree at the close.

| | base (`e9d6a9410`) | final (`b9028850b`) |
|---|---|---|
| verdict line | `71 failed, 5423 passed, 2 xfailed, 2 xpassed` | `71 failed, 5436 passed, 2 xfailed, 2 xpassed` |
| FAILED node ids | 71 | 71 |
| in this phase's blast radius | **0** | **0** |

**Set-diff, both directions, on node ids:**

```
base=71 final=71
NEW (final not in base):
GONE (base not in final):
=== both empty == identical set ===
```

The `+13 passed` is exactly this plan's own new cases (the 13-case carrier fence). ⚠ Two node ids
required normalising before comparison: interleaved stderr (a `RuntimeWarning: coroutine
'handle_query_tables' was never awaited`) is appended to a `FAILED` line mid-capture, so a raw
`comm` reports the *same* test as both NEW and GONE. **Diff the node id, not the printed line.**

## Verification

| Check | Result |
|---|---|
| `bash scripts/bootstrap-worktree.sh …` ran as the first action | ✅ `BOOTSTRAP OK` |
| `pytest tests/unit -q --continue-on-collection-errors` | ✅ `71 failed`, set-diff empty both ways |
| `pytest tests/unit/test_264_born_for_carrier.py -q` | ✅ 13 passed |
| the four 260/261 suites | ✅ 25 passed |
| `test_agent_loop_closed_core_ast_invariant` + `test_agent_loop_contains_zero_expert_branches` | ✅ 2 passed |
| `grep -n "expert_bundle_id" backend/app/services/agent_loop.py` | ✅ no matches |
| `grep -c "return None, None, None, None, None" run_producer.py` / `…, None$` | ✅ `1` / `0` |
| success return contains `resolved.bundle_id`, not `active_expert_id` | ✅ |
| AST keyword counts: run_producer / agent_loop / task_service / tool_dispatcher | ✅ `2 / 2 / 1 / 0` |
| `git diff --stat base..HEAD` confined to `files_modified` | ✅ 9 files, nothing else |
| no `if`/`elif`/ternary reads the field | ✅ fenced, and driven RED by plant 3 |

⚠ **`backend/tests/test_eval_runner.py::test_deep_mode_byte_identical_guard`** — the fence RESEARCH
§6.5 warned would false-RED in a worktree. Confirmed **`1 passed`** on the committed tree, as
predicted. Not triaged as a defect, not "fixed".

⚠ **The frontend vitest count gate was NOT run by this plan, deliberately** — zero frontend source
is touched (`git diff --name-only` base..HEAD is backend-only). Stated explicitly rather than left
unmentioned.

## Notes for the phase

- **`agent_loop.py:1435` (the Deep skill catalog, `SEED-129`) was NOT touched.** Confirmed: the only
  `agent_loop.py` changes are the field declaration, the local bind and the two build-site kwargs.
  SEED-129's trigger does not attach.
- **The ledger obligation is 264-04's**, per that plan's `files_modified`. This plan modifies four
  G-5-firing source files and adds no ledger rows; `264-04` owns the re-derived triples for all six
  and the new `skill_visibility.py` row.
- **Nothing reads the field yet.** `_resolve_skill_visibility_or` is untouched, so 264-03 will not
  collide with this worktree.

## Self-Check: PASSED

- `backend/tests/unit/test_264_born_for_carrier.py` — FOUND
- `.planning/phases/264-born-for-skills-must-load-not-just-resolve/264-01-SUMMARY.md` — FOUND
- `.planning/phases/264-born-for-skills-must-load-not-just-resolve/deferred-items.md` — FOUND
- commits `844845a66`, `ba94ede91`, `b9028850b` — all FOUND in `git log`
