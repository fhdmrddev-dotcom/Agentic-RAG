---
phase: 189
plan: 05
subsystem: backend-harness-engine
tags: [wave-2, governance, publish-gauntlet, red-to-green, fail-closed, falsification-plants]
requires:
  - "app.services.harness_engine._run_phase_with_gates — the D-187-01 armed action-risk checkpoint (shipped)"
  - "app.services.harness.publish_service._drive_golden_run — the stage-3 ctx literal (shipped)"
  - "app.db.workflows.create_workflow_run(is_golden_run=...) — the keyword-only default-off precedent (shipped)"
  - "189-02 — the two CONFLICT-1 REDs and the three standing controls"
provides:
  - "ctx.is_golden_run — the fact threaded from the one site that holds it"
  - "the golden-run branch: the PAUSE is skipped, the RECORD is not, the STEP still runs"
  - "D-06 half two — an armed phase no longer kills a publish at golden_run_timeout"
  - "two new fences: no approval/pending receipt on a golden run, and the executor was reached"
affects:
  - "189-07 (the external_action executor — its golden-run path is now reachable)"
  - "189-11 (V20's final green — both CONFLICT halves are now clear)"
tech-stack:
  added: []
  patterns:
    - "an additive ctx fact set at ONE builder, read everywhere via getattr(..., False) — the run_workflow ctx.definition precedent"
    - "if/elif on a hoisted local instead of re-indenting a shipped block, so the preserved path is textually unchanged"
    - "four wrong-fix plants driven into production source and each observed RED before the green was trusted"
key-files:
  created: []
  modified:
    - backend/app/services/harness/publish_service.py
    - backend/app/services/harness_engine.py
    - backend/tests/unit/test_publish_service.py
decisions:
  - "The golden-run branch is an if/elif on a hoisted `_armed` local rather than nesting the shipped block inside `if not is_golden_run`. Re-indenting ~45 lines would have made the LIVE path — the one that must stay byte-identical — the largest hunk in the diff, and a reviewer cannot see 'unchanged' in a wholly-rewritten block."
  - "The golden run's only trace is a `logger.info`, deliberately NOT a `harness_audit` row. D-09 already declines a new event type, and a ledger row for a checkpoint nobody reached is the receipt-without-consequence shape D-19 rejected Option C over."
  - "The plan's `files_modified` named `backend/tests/test_publish_gate.py`. That file is the Phase-136 SKILL gate and does not import `publish_service` — the same measurement 189-02 recorded as its Deviation 1. Work landed in `tests/unit/test_publish_service.py`, where the REDs actually live."
metrics:
  duration: "~45 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 3
  tests_added: 2
---

# Phase 189 Plan 05: Resolve CONFLICT 1 — the Golden Run Stops Waiting for a Person Who Is Not There Summary

**`is_golden_run` occurred ZERO times in `harness_engine.py`; it occurs there now, and that
one fact is the whole fix.** An armed phase's checkpoint auto-continues on a golden run —
the *pause* is skipped, the *step* still runs, and **no receipt is written for an approval
that never happened**. A live run is byte-identical and still fails closed.

## What was built

| File | Change | Result |
|---|---|---|
| `backend/app/services/harness/publish_service.py` | `is_golden_run=True` on the stage-3 ctx literal + the D-19 comment | +11 / −0 |
| `backend/app/services/harness_engine.py` | the golden-run branch + its decision block | +60 / −2 |
| `backend/tests/unit/test_publish_service.py` | 2 new tests + the audit/emit recorder on the shared drive | +106 / −3 |

| Commit | Task |
|---|---|
| `a38c3198` | Task 1 — thread the fact, additively, and prove it INERT |
| `3383dda8` | Task 2 — the branch, the two new fences, and four observed plants |

`git diff --stat a38c3198~1 -- backend/` lists **exactly three files**. `frontend/` is empty.
`backend/app/api/threads.py` is untouched — `grep -c "is_golden_run"` → **0**.

---

## THE RED → GREEN PAIR

### BEFORE — verbatim from `189-02-SUMMARY.md`, re-measured at this plan's start

Re-run before a line was edited: **`2 failed, 23 passed, 1 warning in 0.57s`** — the same two,
so the inherited claim was verified rather than assumed.

**RED 1 — the property** (`test_an_armed_phase_does_not_subscribe_to_the_ask_channel_on_a_golden_run`):

```
E       AssertionError: D-19 / CONFLICT 1: an armed phase SUBSCRIBED TO THE ASK CHANNEL on a golden run.
        subscribe_for_response was awaited 1 time(s) with timeout_seconds=[None] — and `None` is what
        ask_user_service.subscribe_for_response's own docstring calls 'wait indefinitely'. ...
E       assert [None] == []
E         Left contains one more item: None
```

**RED 2 — the mechanism** (`test_the_armed_golden_run_subscribe_carries_the_indefinite_wait`):

```
E       AssertionError: D-19 / CONFLICT 1 mechanism: the golden run's armed checkpoint awaited
        subscribe_for_response with timeout_seconds=[None]. ... inside a request bounded at 7200s.
E       assert None not in [None]
E        +  where [None] = namespace(timeouts=[None], body_invoked=False, wedged=True).timeouts
```

> **The two numbers 189-02 asked to be carried verbatim: subscribe call count expected `0`,
> observed `1`; recorded `timeout_seconds` = `None`.** `settings.harness_publish_max_seconds`
> is still asserted == **7200** from config, not re-typed, and that assertion is now green.

### AFTER

```
$ venv/Scripts/python.exe -m pytest tests/unit/test_publish_service.py -q --no-header
27 passed, 1 warning in 0.30s
```

Both REDs green. **All three named controls still green** — and they are not merely green,
they were each driven RED by a plant below, so their green is a measurement:

| Control | Still green | Proved non-vacuous by |
|---|---|---|
| `test_a_live_non_golden_run_still_pauses_on_an_armed_phase` | ✅ | PLANT D |
| `test_the_armed_checkpoint_is_not_a_validator` | ✅ | PLANT B |
| `test_an_armed_definition_reaches_the_stage_3_golden_run` | ✅ | PLANT B |
| `test_187_armed_checkpoint_property.py` (all 30) | ✅ | — (shipped fence, unmoved) |

**Wall clock: 0.30 s for 27 tests. NOTHING WAITED.** The 7200 s path is proved by its
MECHANISM — the resolved timeout value, the code path taken, the recorded status — exactly as
189-02 built it. `subscribe_for_response` is still a raising sentinel, never awaited.

---

## THE FIX, AND THE TWO SHAPES IT DELIBERATELY IS NOT

```python
_armed = getattr(phase, "action_risk_armed", False)
if _armed and getattr(ctx, "is_golden_run", False):
    logger.info("publish golden run: armed action-risk checkpoint auto-continued ...")
elif _armed:
    <the shipped block, textually and indentationally UNCHANGED>
```

Execution falls through to the retry loop, so the phase executor runs and records its intent.

### Options B and C — EXPLICITLY DECLINED, with their reasons

**Option B — naming armed phases in `publish_service._interactive_phase_failures` so the
gauntlet blocks pre-run. DECLINED.** It makes an `external_action` workflow **unpublishable**,
which contradicts **D-06** outright — the phase exists to ship a node that publishes and runs,
not a drawer of unpublishable drafts. `189-PATTERNS.md` flags this same helper as a **BAD
ANALOG** ("excerpted only so it is recognised and declined"). **Measured, not asserted:**
`_interactive_phase_failures` is byte-identical (`git diff` shows no hunk in it), and
`grep -c "external_action" publish_service.py` → **0**, so the fix is type-agnostic and no
seventh phase type is special-cased into a shared governance rule.

**Option C — publishing a synthetic approval onto the ask channel. DECLINED.** It writes a
`validator_ask_user_approved` receipt claiming a human approved **when none did**, violating
the Control-Room `consequence ≠ receipt` rule. The same argument retires `action_risk_pending`:
that row records the consequence *"the run paused for a person"*, and on a golden run nothing
paused — so the branch writes **neither**, at the ledger **and** at the wire. That is now a
driven assertion (`test_a_golden_run_writes_no_approval_and_no_pending_receipt`), recorded from
the drive rather than read off the source, with a live positive control proving both names are
genuinely producible first.

### A third shape declined without being asked: `_exec_llm_human_input`

`189-PATTERNS.md`'s second flagged BAD ANALOG. It **times out at 300 s (cap 1800) and returns
NORMALLY — the run ADVANCES**. An action-risk gate built on that substrate would silently let an
unapproved external action proceed. **Nothing in this plan touches it.** The armed path's
fail-closed machinery — `timeout_seconds = None if is_action_risk`, the shutdown-sentinel
`CancelledError`, the unparseable-payload refusal — is untouched on the live branch, and
`test_a_live_non_golden_run_still_pauses_on_an_armed_phase` asserts all three of
`timeouts == [None]`, `wedged is True` and `body_invoked is False`.

---

## ANTI-VACUITY: FOUR PLANTS, EACH OBSERVED RED

The prompt named the 189-04 trap explicitly — *the plausible-but-wrong fix was planted and the
whole suite stayed green*. So the wrong fixes were driven here before the green was trusted.
All four were driven into **production source**, observed, and removed. Restoration verified by
**md5sum against pre-plant backups** (all three files byte-identical) and
`grep -c "PLANT"` → **0 / 0 / 0**.

### PLANT B — Option B, in `_interactive_phase_failures`

```
FAILED tests/unit/test_publish_service.py::test_the_armed_checkpoint_is_not_a_validator
FAILED tests/unit/test_publish_service.py::test_an_armed_definition_reaches_the_stage_3_golden_run
2 failed, 25 passed
```

```
E       AssertionError: stage 2.5 now blocks an ARMED phase pre-run. That is CONFLICT-1 Option B,
        REJECTED by D-19: it makes an external_action workflow unpublishable and contradicts D-06.
        The fix belongs in the engine (189-05), not here.
E       Left contains one more item: {'message': 'armed phases block publish', 'phase': 'send-the-notice'}
```

### PLANT C — Option C, a `validator_ask_user_approved` write in the golden branch

```
E       AssertionError: D-19 / REJECTED OPTION C: the golden run wrote
        ['validator_ask_user_approved'] into harness_audit. Nobody was asked and nobody approved ...
1 failed, 26 passed
```

### PLANT D — the D-04 wire-around (`if _armed:` — skip the pause on EVERY run)

```
FAILED ...::test_an_armed_phase_does_not_subscribe_to_the_ask_channel_on_a_golden_run
FAILED ...::test_a_live_non_golden_run_still_pauses_on_an_armed_phase
FAILED ...::test_a_golden_run_writes_no_approval_and_no_pending_receipt
3 failed, 24 passed
```

```
E       AssertionError: a LIVE armed run must pause indefinitely on the ask channel; observed
        timeouts=[]. A fix that silences the golden run by disarming the checkpoint outright is
        the wire-around D-04 and SC#2 forbid.
```

Note the anti-vacuity control **inside** the property test fired first (`assert 0 == 1` on the
live drive's subscribe count) — the golden-run silence refused to be read as a pass while the
harness had stopped reaching the checkpoint at all.

### ⚠ PLANT E — THE 189-04 TRAP, REPRODUCED EXACTLY. This is the plan's most valuable result.

`return PhaseOutcome("completed", {}, None, None)` in the golden branch — *skip the pause **and**
the step*, the most plausible wrong reading of "auto-continue":

```
FAILED tests/unit/test_publish_service.py::test_the_armed_step_still_runs_on_a_golden_run
1 failed, 26 passed
```

```
E       assert False is True
E        +  where False = namespace(timeouts=[], body_invoked=False, ...).body_invoked
```

**BOTH of 189-02's CONFLICT-1 REDs stayed GREEN under PLANT E.** A fix that silently skipped
every governed step on every publish would have satisfied the plan's headline acceptance
criteria completely, shipped the fail-open shape Phase 188 spent two plans closing, and made
the arming decorative — and **exactly one test in the tree could see it**: the one this plan
added because the plan's `<action>` asked for it. The 189-04 lesson ("plant the wrong fix; if
nothing goes red, your tests cannot distinguish the right fix from the wrong one") did not just
transfer as a procedure — it named the missing assertion before it was missing.

---

## Deviations from Plan

### Rule 3 — a blocking issue, inherited from 189-02

**1. [Rule 3 — Blocking] The plan's `files_modified` names `backend/tests/test_publish_gate.py`; the REDs are in `tests/unit/test_publish_service.py`**

- **Found during:** the `<read_first>` step, and pre-flagged by the executor prompt.
- **Issue:** the plan lists `backend/tests/test_publish_gate.py` in `files_modified`, in its
  `<verify>` command and in three acceptance criteria. That file is the **Phase-136 SKILL
  publish gate** and does not import `publish_service` — measured by 189-02 and re-confirmed
  here: it is in the 10-file scope run and its results are **unchanged** by this plan.
- **Fix:** all test work landed in `backend/tests/unit/test_publish_service.py`, where 189-02
  authored the REDs and where the publish-driving fixture, judge mock and
  `_interactive_phase_failures` unit test all live. The `<verify>` command was run against the
  real file. No second harness was built — the two new tests reuse `_drive_armed_phase`.
- **Files modified:** `backend/tests/unit/test_publish_service.py`
- **Commit:** `3383dda8`

### Rule 2 — missing critical functionality

**2. [Rule 2] The audit/emit recorder replaced two blind `AsyncMock()`s on the SHARED drive**

- **Found during:** Task 2, writing the no-receipt assertion.
- **Issue:** `_drive_armed_phase` patched `write_audit` and `_emit` with bare `AsyncMock()`s
  that were **discarded**, so no test could observe what the checkpoint wrote. Asserting "no
  receipt" by reading the source is exactly the shape D-19 forbids ("must be DRIVEN, never
  asserted from a reading of the source" — this class of defect is `BUG-260731-02`).
- **Fix:** recording spies with the production signatures, returned as `audit_events` / `emits`
  on the existing namespace. Both the `action_risk_pending` announce (`harness_engine` :776) and
  the `validator_ask_user_approved` receipt (:1362, inside `_resolve_failure_with_ask_user`) go
  through the same patched symbol, so **one recorder sees both** — which PLANT C confirmed.
- **Files modified:** `backend/tests/unit/test_publish_service.py`
- **Commit:** `3383dda8`

**3. [Rule 2] The no-receipt test asserts the WIRE as well as the ledger, and carries its own positive control**

- **Found during:** Task 2.
- **Issue:** the plan asks for "no approval/pending audit write". The checkpoint writes the row
  **and** emits `action_risk_pending` to Phase 188's run surface. Auditing only the ledger would
  leave the run surface told that a step awaits a person when the only thing on the other end is
  a publish request — the same lie one layer out. And an "absent receipt" assertion is
  trivially satisfied by a drive that never reached the checkpoint, or by a recorder wired to
  the wrong symbol.
- **Fix:** both halves asserted, and the LIVE control runs first inside the same test asserting
  **both names are present** before the golden run's silence is read as a measurement.
- **Files modified:** `backend/tests/unit/test_publish_service.py`
- **Commit:** `3383dda8`

### A shape chosen deliberately, and why

**4. `if/elif` on a hoisted `_armed` local, not `if not is_golden_run:` around the shipped block.**
Nesting would have re-indented ~45 lines, making the LIVE path — the one whose whole requirement
is *byte-identical* — the largest hunk in the diff. A reviewer cannot see "unchanged" in a wholly
re-indented block. The `elif` preserves the shipped body's text and indentation exactly, so
`git diff` shows the live path is untouched rather than asking anyone to take it on trust.

**5. The golden run's trace is a `logger.info`, NOT a `harness_audit` row.** D-09 already declines
a new audit event type for this phase, and a ledger row for a checkpoint nobody reached is the
receipt-without-consequence shape Option C was rejected over. The log line says in words that no
receipt is written and why.

---

## Re-derived, not inherited

Per the phase's standing rule, every load-bearing pointer was re-derived by **symbol search** on
2026-08-07 rather than seeking to a line number.

| Claim | How re-derived | Result |
|---|---|---|
| `is_golden_run` occurs **0×** in `harness_engine.py` | `grep -c` before the edit | ✅ **HOLDS** — 0 |
| `is_golden_run` is in `publish_service.py` (4 sites) + `db/workflows.py` | `grep -n` | ✅ HOLDS — `:14, :244, :802, :811` |
| the armed checkpoint reads the boolean directly | `grep -n "action_risk_armed"` → `harness_engine.py:754` | ✅ HOLDS |
| `_is_armed_action_risk` is the boot-time sweep at a DIFFERENT site | same grep → `:2240` | ✅ HOLDS — the plan's `:2148` is the *comment* reference; the `def` is `:2240` |
| `timeout_seconds = None if is_action_risk` | `grep -n` → `:1104`, passed at `:1174` | ✅ HOLDS |
| `_interactive_phase_failures` blocks exactly two shapes | `grep -n` → `publish_service.py:500`; read the body | ✅ HOLDS — `:521` and `:531` |
| `validator_ask_user_approved` is written via the module-level `write_audit` | `grep -n` → `harness_engine.py:1362` | ✅ HOLDS — so the patched symbol catches it |
| the `ctx.definition = definition` additive precedent | `grep -n` → `:1370` | ✅ HOLDS — additive + defensive, as quoted |
| `create_workflow_run`'s keyword-only default-off wording | `grep -n "is_golden_run" db/workflows.py` | ✅ HOLDS — *"default OFF = byte-identical"* at `:262` |
| `harness_publish_max_seconds == 7200` | asserted from `app.config.settings` in the suite | ✅ HOLDS |
| 10-file baseline **4 failed / 195 passed** | re-run before any edit | ✅ HOLDS exactly |
| `tests/unit/test_publish_service.py` baseline **2 failed / 23 passed** | re-run before any edit | ✅ HOLDS exactly |

---

## Verification

**The 10-file 189-scope command — the delta accounted for exactly:**

```
$ venv/Scripts/python.exe -m pytest <the nine §D15 files> tests/unit/test_publish_service.py -q --no-header
2 failed, 199 passed, 1 warning in 2.22s

FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette
FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_fields_come_from_the_bundle
```

| | After 189-04 | **After 189-05** | Delta | Accounted for by |
|---|---|---|---|---|
| failed | 4 | **2** | **−2** | the two CONFLICT-1 REDs flipped GREEN |
| passed | 195 | **199** | **+4** | the 2 flipped REDs + 2 new tests |

**The only remaining failures are the two named pre-existing `asyncpg … pool is closing` rows** —
live-DB integration, unmoved, not 189's. No third.

**Targeted suites:**

| Command | Result |
|---|---|
| `pytest tests/unit/test_publish_service.py -q` | **27 passed in 0.30 s** |
| `pytest tests/test_harness_engine.py -q` | **40 passed in 0.28 s** — unchanged from HEAD |
| `pytest tests/unit/test_187_armed_checkpoint_property.py -q` | **30 passed** — incl. the no-false-receipt fence |
| `pytest -k two_resume_predicates tests/ -q` | **1 passed** — the predicates stay independent |

**Acceptance greps:**

| Check | Command | Result |
|---|---|---|
| the hot file is untouched | `grep -c "is_golden_run" app/api/threads.py` | **0** ✅ |
| Option B declined / type-agnostic | `grep -c "external_action" app/services/harness/publish_service.py` | **0** ✅ |
| arming reads unchanged in count | `grep -c "action_risk_armed" app/services/harness_engine.py` | **6** (was 5; the +1 is the hoisted `_armed` read — no reading was removed) |
| `_is_armed_action_risk` textually untouched | `git diff -U0` grep | only a **comment reference**; **no hunk in the function** ✅ |
| plants removed | `grep -c "PLANT"` over all three files | **0 / 0 / 0** ✅, and md5sums match pre-plant backups |
| scope | `git diff --stat a38c3198~1 -- backend/` | exactly **3 files**; `frontend/` empty ✅ |

**D-04 and D-05 both still true.** `action_risk_armed` is neither cleared in memory nor in
storage anywhere in this diff — only the pause is skipped; and the golden run still RUNS the
step (`test_the_armed_step_still_runs_on_a_golden_run`), which is what "the record is not
skipped" means at this plan's layer. The `recorded_not_sent` write itself belongs to the
`external_action` executor in **189-07**; nothing here blocks or pre-empts it.

---

## Deferred Issues

None new. Two pre-existing items remain out of this plan's scope and were **not** touched:

- **`D-189-DEF-01`** — `test_182_extraction_parity.py`'s NL-gen count pin has been RED since
  189-02 and is in neither the 9- nor the 10-file scope command. This plan added **0** tests to
  `test_103_grounding_fidelity.py`, so it does not move the number again.
- the two `test_182_grounding_bundle.py` `pool is closing` failures — live-DB, pre-existing,
  unmoved and still exactly two.

## Authentication Gates

None.

## Known Stubs

None. No placeholder values, no hardcoded empties, no "coming soon". Every number above was
measured today; the one new log string is a real diagnostic on a real branch.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern or schema change. This plan's own
register is addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-06** — DoS on the publish request thread via an armed phase | **mitigated** | The golden-run branch never reaches the subscribe. Driven by a zero-call assertion whose recorder RAISES, so the test can never await 7200 s. Suite wall clock **0.30 s**. |
| **T-189-07** — Repudiation: a receipt written when no human was asked (**rejected Option C**) | **mitigated** | Ledger AND wire asserted empty of `validator_ask_user_approved` / `action_risk_pending`, recorded from the drive, with a live positive control. **PLANT C observed RED.** |
| **T-189-14** — EoP: the branch loosening arming on LIVE runs (the D-04 disarm path) | **mitigated** | The live branch is textually unchanged (`elif`, not a re-indent). `test_a_live_non_golden_run_still_pauses_on_an_armed_phase` green, and **PLANT D drove it RED**. No mutation of `action_risk_armed` anywhere in the diff. |
| **T-189-15** — Spoofing: "skip the pause" silently becoming "skip the step" | **mitigated** | `test_the_armed_step_still_runs_on_a_golden_run`. **PLANT E observed RED — and it was the ONLY test in the tree that could see it**, while both original REDs stayed green. |
| **T-189-16** — Tampering: coupling the run-time reader to the boot-time resume predicate | **mitigated** | `_is_armed_action_risk` has no diff hunk; `test_the_two_resume_predicates_are_independent` passes. |
| **T-189-SC** — package installs | accept | This plan installed nothing. |

## Self-Check: PASSED

- `backend/app/services/harness/publish_service.py` — FOUND
- `backend/app/services/harness_engine.py` — FOUND
- `backend/tests/unit/test_publish_service.py` — FOUND
- `.planning/phases/189-governed-external-action-node-model/189-05-SUMMARY.md` — FOUND
- commit `a38c3198` — FOUND
- commit `3383dda8` — FOUND
- `grep -c "PLANT"` over the three modified files — **0 / 0 / 0**
- `git diff --stat a38c3198~1 -- frontend/` — EMPTY, as required
