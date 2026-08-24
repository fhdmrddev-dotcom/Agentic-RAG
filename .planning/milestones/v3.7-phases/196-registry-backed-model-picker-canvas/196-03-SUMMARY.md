---
phase: 196-registry-backed-model-picker-canvas
plan: 03
subsystem: harness-runtime
tags: [harness, model-resolution, run-honesty, audit, count-gate]
requires:
  - "app.services.run_model_resolution._resolve_enabled_model (Phase 149 / D-149-10)"
  - "phase_types._emit_phase_substep + _emit_audit (Phase 101.1 / D-11, D-12)"
  - "db/workflows._AUDIT_EVENT_TYPES 'policy_applied' (mig 070)"
provides:
  - "phase_types._effective_model_checked — the harness's disabled-model gate"
  - "EmitSubStep 'model_fallback' + its PhaseCard SUBSTEP_META mapping"
  - "_build_phase_tool_context(..., model=) — the checked model's way into the sub-agent ctx"
  - "PhaseCard.test.tsx inside the count gate (both knobs), pinned at 27"
affects:
  - "every llm_single / llm_agent / llm_batch_agents / llm_emit phase at run time"
  - "the run surface (one new phase_substep status) and harness_audit (policy_applied rows)"
tech-stack:
  added: []
  patterns:
    - "additive-then-repoint + late function-local import (the run_model_resolution.py register)"
    - "fail-open on a registry blip, stated as a decision in the docstring"
    - "two-knob count-gate adoption (TARGETS runs, BASELINE guards) in one commit"
key-files:
  created:
    - backend/tests/unit/test_196_harness_enabled_check.py
  modified:
    - backend/app/services/harness/phase_types.py
    - backend/tests/unit/test_185_detection.py
    - frontend/src/types/index.ts
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/components/panel/PhaseCard.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "FAIL-OPEN inherited from the chat path, recorded as a decision: a registry-read blip lets a disabled model run rather than sinking the phase. Failing closed would make an infrastructure hiccup look like an authoring error."
  - "No 25th harness_audit kind. `policy_applied` already means 'an operator policy was applied to this run', which is exactly this event."
  - "The fifth call site takes an optional `model=` keyword rather than an async signature change — the plan's premise that all five sit inside `async def` is measurably false."
  - "A1 is proven in a SUBPROCESS, not by sys.modules eviction — the eviction form broke 23 tests in two other files."
metrics:
  duration: ~65 min
  completed: 2026-08-18
  tasks: 3
  commits: 3
---

# Phase 196 Plan 03: Harness Disabled-Model Check Summary

**The harness now refuses to hand an operator-disabled model to a provider, and says so twice —
once on the run surface and once in a durable receipt.** Reuses the shipped Phase-149 resolver
rather than re-implementing it, so the dead-default case comes for free.

## What shipped

`_effective_model` (`phase_types.py:393`) handed a per-phase model string straight to the
provider with **no check at all**. `_resolve_enabled_model` — shipped in Phase 149 as D-149-10 —
had only ever guarded the chat `send_message` path. So a workflow authored before this phase
could burn a run on a model an operator disabled, in complete silence, and no amount of honesty
in the authoring form could fix it because the author's browser is long gone by then.

One additive async helper closes that:

- **`_effective_model_checked`** — calls the sync `_effective_model`, reads the org default off
  `ctx.user_settings.llm_model`, and awaits the shipped resolver through a **function-local**
  import (the discipline `run_model_resolution.py` documents about itself).
- **An ENABLED model is a strict no-op** — same value, no sub-step, no receipt. Asserted with
  `assert not carriers.substeps` / `assert not carriers.audits`, the `test_149_default_guard.py:86`
  `assert not pool.calls` shape transposed onto the two carriers.
- **A DISABLED one is never substituted silently** — one `model_fallback` `phase_substep` on the
  producer stream the frontend already tails, plus one durable `policy_applied` receipt naming
  both ids, the phase slug and the resolver's own message.
- **`_effective_model` is untouched** — still sync, still exported, same values. Pinned by a case.
- **No 25th audit kind, no migration, no new wire path.** `_AUDIT_EVENT_TYPES` is byte-unchanged
  (`git diff --numstat backend/app/db/workflows.py` → empty).

Frontend: `"model_fallback"` joins `EmitSubStep` and gets a real `SUBSTEP_META` entry —
`node: "degraded"` with the `recovering` amber, because a substitution is degraded-but-honest.
It deliberately does **not** reuse the `recovering` *status*: a narrated-emit recovery and a
disabled-model substitution are different events, and collapsing them would put a lie on the run
surface.

## Task 1 RED output, verbatim

```
FFFFFF.                                                                  [100%]
E           AssertionError: the harness must expose the checked model helper after a fresh import
E           assert False
E            +  where False = hasattr(<module 'app.services.harness.phase_types' ...>, '_effective_model_checked')
tests\unit\test_196_harness_enabled_check.py:91: AssertionError
...
FAILED tests/unit/test_196_harness_enabled_check.py::test_a1_harness_import_cycle_guard_fresh_import
FAILED tests/unit/test_196_harness_enabled_check.py::test_disabled_phase_model_falls_back_to_the_run_model
FAILED tests/unit/test_196_harness_enabled_check.py::test_enabled_phase_model_is_a_strict_noop
FAILED tests/unit/test_196_harness_enabled_check.py::test_blank_phase_model_inherits_the_ctx_model
FAILED tests/unit/test_196_harness_enabled_check.py::test_dead_default_resolves_without_infinite_substitution
FAILED tests/unit/test_196_harness_enabled_check.py::test_registry_read_failure_fails_open
6 failed, 1 passed, 1 warning in 0.62s
```

The one passing case is `test_effective_model_is_still_sync_and_exported` — it pins a helper this
plan promises **not** to change, so green at Task 1 is the correct reading, not a vacuous case.
After Task 2 the file reads `9 passed` (7 original + the A1 in-process half + the deviation fence).

## `phase_types.py` diffstat

```
 backend/app/services/harness/phase_types.py | 47 ++++++++++++++++++++++++-----
 1 file changed, 39 insertions(+), 8 deletions(-)
```

⚠ **The plan's budget was `fewer than 40 changed lines` and this is 39 insertions / 47 total.**
Recorded rather than rounded: the budget was computed against a site inventory that turned out to
be wrong (see Deviation 1), so the plan expected five one-word edits where the real shape is four
one-word edits, a signature line, a guarded field line, two builder call sites and a three-line
comment saying why. **The SHAPE criterion G-5 actually cares about is met** — one function plus
call-site-only edits, no second concern — which is verbatim the test 190's clearance was recorded
on (*"190's whole change to this file is one function … so it adds a call-out, not a concern"*).

## G-5 — honoured by construction, no override taken

`backend/app/services/harness/phase_types.py` measures **38 / 15 / 2393** and G-5 **FIRES**; its
ledger row reads *"extraction due — not taken in 190 (no 2nd concern)"*. This plan adds **one
function** and repoints call sites. The five-plus concerns that make the file big (the emit path,
the fill/render path, the ask_user path, the tool-context builders, the seven executors) are
untouched. Taking the named seam — one module per executor under `harness/phase_types/` — means
splitting seven executors with their own tool-context wiring and audit receipts across a file
fifteen phases have edited; that is its own phase, and G-5 exists to make it a deliberate one.
**Plan 196-09 re-derives this file's row at close (D-23).** No guardrail override was offered or
taken, so the absence of a 196-03 entry under `Guardrail overrides` is a measurement.

## Deviations from Plan

### 1. [Rule 3 — blocking] The plan's five-call-site premise is measurably FALSE

- **Found during:** Task 2, before the first edit.
- **Issue:** the plan states *"The FIVE call sites, all inside `async def`"* and *"All five
  already sit inside `async def`, so no signature changes."* Site `:455` is inside
  **`def _build_phase_tool_context`** — a **sync** function called synchronously by **fifteen
  shipped test sites** across seven files. Making it async is a signature change with a large
  blast radius, not a one-word edit. It also cannot simply be skipped: **`run_task_sub_agent`
  reads `parent_ctx.model`, not the executor's local `model`**, so `:455` is the site that
  actually decides which model an `llm_agent` / `llm_batch_agents` phase runs on. Leaving it
  unchecked while checking `:548`/`:642` would have produced a ToolContext disagreeing with the
  executor's own resolved value — a worse state than before.
- **Fix:** an optional keyword — `_build_phase_tool_context(phase, ctx, *, model=None)`. The two
  **production** callers (`_exec_llm_agent`, `_exec_llm_batch_agents`, both inside `async def`)
  pass the model they already awaited; every existing sync caller omits it and gets the shipped
  `_effective_model` fallback, byte-identical. Fenced by
  `test_phase_tool_context_carries_the_checked_model_when_given_one`, which pins **both** arms
  plus `count(...) == 2` on the production call form, so the fallback cannot quietly become the
  only arm again.
- **Consequence for the acceptance criteria, stated plainly rather than glossed:**
  `grep -c '_effective_model_checked'` is **5**, not the 6 the plan asserts, and
  `grep -c 'await _effective_model_checked'` is **4**, not 5. The missing one is the `model=`
  keyword, and that is the correct shape.
- **Files:** `backend/app/services/harness/phase_types.py`
- **Commit:** `7c574132`

### 2. [Rule 1 — bug] The A1 test the plan specified broke 23 tests in two other files

- **Found during:** Task 2 verification (the full `pytest tests/` comparison).
- **Issue:** the plan instructs A1 to *"clear the relevant `sys.modules` entries … and
  `importlib.import_module` the harness module"*. Done with save/restore, that restores the
  `sys.modules` **keys** but **not the parent package attribute** — `app.services.harness.phase_types`
  keeps pointing at the *second* module object the re-import created. The resulting split brain
  broke **23 tests** in `test_llm_emit_executor.py` and `test_185_detection.py`, each of which
  monkeypatches one module object while the code under test lives in the other.
  ⚠ **Every one of them passed in isolation**, which is exactly what makes this failure mode
  expensive — a per-file re-run would have declared it innocent.
- **Fix:** A1 now runs in a **subprocess**. That is **strictly stronger evidence**, not a
  workaround: it imports the harness *and awaits the helper* in an interpreter with nothing
  preloaded, so the real `app.api.threads` import happens from inside the harness at call time —
  which is the actual "does the backend start" question A1 asks. It also cannot perturb the
  session. An in-process companion case keeps the attribute assertion on the module everyone
  else imports.
- **Files:** `backend/tests/unit/test_196_harness_enabled_check.py`
- **Commit:** `7c574132`

### 3. [Rule 1 — bug] Two stub lambdas drifted from the widened builder signature

- **Found during:** the same verification pass.
- **Issue:** `test_185_detection.py:1125` and `:1161` stub the builder as
  `lambda phase, ctx: object()`. With the new keyword the executor raises
  `TypeError: <lambda>() got an unexpected keyword argument 'model'` — 3 failures.
- **Fix:** widened both to `lambda phase, ctx, **_: object()` with a comment naming why.
  ⚠ **`test_185_detection.py` is NOT in this plan's `files_modified`** — it is edited because
  this plan's own change broke it, which is squarely inside the scope boundary.
- **Commit:** `7c574132`

### 4. [observation, not fixed] `tsc --noEmit -p tsconfig.app.json` does not exit 0

The plan's criterion is *"exits 0"*. Measured: **33 errors**, which is **exactly the recorded
project baseline** (`STATE.md`: *"`tsc -p tsconfig.app.json` | 33 | unmoved across the whole
phase"*, unmoved through 193.2 and 195). **Zero of the 33 are in this plan's files** —
`npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -cE "PhaseCard|types/index"` → **0**. This is
pre-existing rot outside this plan's scope and is deliberately **not** fixed (the executor scope
boundary). The criterion as written was unmeetable on this tree.

## Verification

| Gate | Result |
|---|---|
| `pytest tests/unit/test_196_harness_enabled_check.py` | **9 passed**, 0 failed |
| the plan's `inspect` + `_AUDIT_EVENT_TYPES` verify command | `OK` |
| `pytest tests/` — baseline (pre-plan, clean: the new file was not collected) | **213 failed / 3962 passed** / 29 skipped / 5 xfailed / 9 xpassed / 2 errors |
| `pytest tests/` — after | **222 failed / 3962 passed** / 29 skipped / 5 xfailed / 9 xpassed / 1 error |
| `tsc --noEmit -p tsconfig.app.json` | 33 errors = recorded baseline, **0 in this plan's files** |
| `vitest run src/components/panel/PhaseCard.test.tsx` (`GSD_VITEST_MAX_WORKERS=2`) | **27 passed**, was **24** pre-change |
| count gate (`GSD_VITEST_MAX_WORKERS=2`) | **`count gate OK`** — see verbatim below |

### Count-gate verdict, verbatim (both knobs set)

```
  file                                     pinned  actual   delta
  PhaseCard.test.tsx                           27      27       0
  total                                      4123    4197     +74
  total 4197  ·  failed 0  ·  pinned total 4123
count gate OK — 84/84 pinned files present, no per-file decrease, 0 failing.
```

The run that **read** the pin printed `PhaseCard.test.tsx — 27 new`, verdict
`count gate OK — 83/83 pinned files present, no per-file decrease, 0 failing`, total 4197 ·
pinned total 4096. **The pin is set from that printed `actual` column, never from a number quoted
in any document.** Adoption moved `83/83 → 84/84` and pinned total `4096 → 4123` (+27); the grand
total is unchanged at **4197** because the `TARGETS` entry already made the suite RUN — only the
guarding half was missing. ⚠ **A growing total is the gate working**; its contract is no per-file
decrease and zero failing.

### Per-file delta for `PhaseCard.test.tsx`: 24 → 27

Measured as a real before/after rather than asserted: the pre-change file was restored with
`git checkout -- <that one file>` and run standalone at `GSD_VITEST_MAX_WORKERS=2` (**24 passed**),
then the plan's version was put back. The +3 is exactly this plan's cases — the `model_fallback`
member added to the whole-union `SUBSTEPS` `it.each` (+1), the fixed-sentence/amber-node case (+1),
and the positive control (+1).

### SEED-171 triage: no gate run ever reddened

Both gate runs returned `failed 0` on the first attempt with a sibling agent active. **No triage
was needed and none of SEED-171's three suites is invoked as an excuse.** ⚠ Per CLAUDE.md this is
recorded as an observation, not as evidence that those suites are stable — one green sample of a
flaky suite is not proof of innocence.

### The +9 backend delta, named before any conclusion was drawn

`comm -13` over the sorted `FAILED` lines of both runs gives **11 new failures and 2 recoveries**.
**All 11 are `tests/integration/test_085_ask_user_handler.py`**, and each of the three checks that
could implicate this plan clears it:

1. **Provably unmodified** — the file is absent from `git status --short` and from
   `git diff --name-only` across the whole plan.
2. **Structurally unreachable** — `grep -n "phase_types\|_effective_model\|_build_phase_tool_context"`
   over that file returns **nothing**. It never references the changed module.
3. **19/19 green alone** — run in isolation immediately afterwards.

It is a Redis-pubsub integration file with timeouts, and the run that reddened it shared the box
with two sibling executor agents. ⚠ Stated as **provably unmodified**, never as *"fine"*.
The arithmetic closes exactly: `213 + 11 − 2 = 222`, and `3962 − 11 + 2 + 9 (this plan's own new
cases) = 3962`, i.e. **the passing count is identical** and **no new failure is attributable to
this change**.

### Not provable here

*"The harness fallback notice is visible in a real run"* — that needs a real workflow run with a
disabled per-phase model and is a manual UAT row in `196-VALIDATION.md`. Nothing in this plan
claims it.

## Zero database mutation — a contract, not an accident

`196-RESEARCH.md` §K.30 flags this plan as one of two that could accidentally become DB-mutating,
and a `files_modified` check cannot see a database write. Every case stubs the harness ctx, patches
the override source in memory and **records** the two carriers instead of firing them.
`grep -cE 'INSERT INTO|create_workflow_run|redis\.Redis\(|from_url\('` over the new test file → **0**.
The one subprocess case awaits the real helper, whose only I/O is a **read** that fails open.

## Threat register dispositions

| Threat ID | Disposition | Where it landed |
|---|---|---|
| T-196-RUN1 | mitigated | `_effective_model_checked` routes through the shipped resolver; reuse, not re-implementation |
| T-196-RUN2 | mitigated | both carriers fire — `phase_substep` + a `policy_applied` row naming both ids |
| T-196-RUN3 | accept (unchanged) | `_AUDIT_EVENT_TYPES` byte-unchanged; no migration added |
| T-196-RUN4 | mitigated | A1 proven in a fresh interpreter that also **awaits** the helper |
| T-196-RUN5 | mitigated | the label is a fixed plain-text child; no id is interpolated, and a comment says why |
| T-196-RUN6 | accept, deliberately | fail-open, recorded in the helper docstring and above |
| T-196-SC | accept | no packages installed |

## Known Stubs

None. Every value this plan renders or writes is derived from a live resolver result.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `59098f01` | the A1 guard + the D-10 cases, observed RED (6 failed / 1 passed) |
| 2 | `7c574132` | the checked helper, the repointed call sites, both carriers, 3 deviations |
| 3 | `52e9652f` | the honest amber mapping + its positive control + both count-gate knobs |

## Self-Check: PASSED

All 7 claimed files exist on disk; all 3 claimed commit hashes are present in `git log`.
